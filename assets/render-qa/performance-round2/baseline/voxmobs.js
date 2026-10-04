// =====================================================================
//  VoxMobs —— 方块暗黑破坏神的体素怪物 → 游戏 2D 方块骨骼（drawRig 格式）
//  1) 用原项目的 buildMonsterRig 搭出 rig（含关节层级 + 体素网格）
//  2) 每个网格：由贪心面片反推表面体素 → 同色合并为长方体（只做一次，按怪物缓存）
//  3) 每帧：poseMonsterRig 驱动原动画 → 读各网格世界矩阵 → 输出 BX 盒子列表
//  坐标：原模型 X 右 / Y 前 / Z 上（右手系，1 格 = 24 体素）
//        游戏骨骼 x 前 / y 侧 / z 上（左手系，PX = 1/30 格）→ 交换 X/Y 即可（行列式 -1，正好补偿手性）
// =====================================================================
(function(){
"use strict";
const VOX = 24, K = 30/24;                 // 体素 → 游戏骨骼单位
const cache = new Map();                   // defId -> {rig, entries:[{mesh, boxes}]}

const hex = (r,g,b) => '#' + [r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,'0')).join('');
const toSRGB = c => c <= 0.0031308 ? c*12.92 : 1.055*Math.pow(c,1/2.4) - 0.055;

// ---- 网格 → 长方体 ----
function meshToBoxes(mesh){
  const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, col = g.attributes.color, idx = g.index;
  if(!pos || !nor) return [];
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if(mat && (mat.visible === false || (mat.map && !col))) return [];      // 贴花平面（表情）等跳过
  const base = mat && mat.color ? mat.color : {r:1,g:1,b:1};
  const glow = !!(mat && ((mat.emissive && (mat.emissive.r+mat.emissive.g+mat.emissive.b) > 0.3 && (mat.emissiveIntensity||0) > 0.4) || mat.isMeshBasicMaterial));
  const cells = new Map(), surfaceFaces=new Map();
  const tri = idx ? idx.count/3 : pos.count/3;
  const vi = n => idx ? idx.getX(n) : n;
  let skipped = 0;
  for(let t=0; t<tri; t++){
    const a = vi(t*3), b = vi(t*3+1), c = vi(t*3+2);
    const nx = nor.getX(a), ny = nor.getY(a), nz = nor.getZ(a);
    const ax = Math.abs(nx) > 0.99 ? 0 : Math.abs(ny) > 0.99 ? 1 : Math.abs(nz) > 0.99 ? 2 : -1;
    if(ax < 0){ skipped++; continue; }
    const sg = [nx,ny,nz][ax] > 0 ? 1 : -1, u = (ax+1)%3, v = (ax+2)%3;
    const P = [a,b,c].map(n => [pos.getX(n)*VOX, pos.getY(n)*VOX, pos.getZ(n)*VOX]);
    const plane = Math.round(P[0][ax]);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for(const p of P){ u0 = Math.min(u0,p[u]); u1 = Math.max(u1,p[u]); v0 = Math.min(v0,p[v]); v1 = Math.max(v1,p[v]); }
    u0 = Math.round(u0); u1 = Math.round(u1); v0 = Math.round(v0); v1 = Math.round(v1);
    if((u1-u0)*(v1-v0) > 4096) continue;
    let r = base.r, gg = base.g, bb = base.b;
    if(col){ r *= col.getX(a); gg *= col.getY(a); bb *= col.getZ(a); }
    const color = hex(toSRGB(r), toSRGB(gg), toSRGB(bb));
    const w = sg > 0 ? plane-1 : plane;
    // 三角形只覆盖矩形的一半；两个三角形合起来覆盖整面，重复写入无妨
    for(let uu=u0; uu<u1; uu++) for(let vv=v0; vv<v1; vv++){
      const cell = [0,0,0]; cell[ax] = w; cell[u] = uu; cell[v] = vv;
      const key=cell[0]+','+cell[1]+','+cell[2];cells.set(key, color);
      surfaceFaces.set(key,(surfaceFaces.get(key)||0)|(1<<(ax*2+(sg>0?0:1))));
    }
  }
  // ---- 贪心合并同色长方体（X 方向 → Y → Z）----
  const boxes = [], has = (x,y,z,c) => cells.get(x+','+y+','+z) === c;
  const keys = [...cells.keys()].map(k=>k.split(',').map(Number)).sort((p,q)=>p[2]-q[2]||p[1]-q[1]||p[0]-q[0]);
  for(const [x,y,z] of keys){
    const c = cells.get(x+','+y+','+z); if(c === undefined) continue;
    let w = 1; while(has(x+w,y,z,c)) w++;
    let d = 1; rowY: while(true){ for(let i=0;i<w;i++) if(!has(x+i,y+d,z,c)) break rowY; d++; }
    let h = 1; rowZ: while(true){ for(let j=0;j<d;j++) for(let i=0;i<w;i++) if(!has(x+i,y+j,z+h,c)) break rowZ; h++; }
    for(let k=0;k<h;k++) for(let j=0;j<d;j++) for(let i=0;i<w;i++) cells.delete((x+i)+','+(y+j)+','+(z+k));
    // Only source mesh surfaces can be visible. Reconstructed shell boxes used
    // to draw their internal joins as well, multiplying normal-map work.
    let faces=0;const origin=[x,y,z],size=[w,d,h];
    for(let ax=0;ax<3;ax++)for(let side=0;side<2;side++){
      const u=(ax+1)%3,v=(ax+2)%3,p=[x,y,z];p[ax]+=side===0?size[ax]-1:0;
      scanFace:for(let uu=0;uu<size[u];uu++)for(let vv=0;vv<size[v];vv++){
        p[u]=origin[u]+uu;p[v]=origin[v]+vv;
        if((surfaceFaces.get(p.join(','))||0)&(1<<(ax*2+side))){
          const gameAxis=ax===0?1:ax===1?0:2;faces|=1<<(gameAxis*2+side);break scanFace;
        }
      }
    }
    // 交换 X/Y 进入游戏骨骼坐标
    boxes.push({c:[y+d/2, x+w/2, z+h/2], s:[d, w, h], col:c, glow,faces});
  }
  boxes.skipped = skipped;
  return boxes;
}

function prepare(id){
  let e = cache.get(id); if(e !== undefined) return e;
  e = null;
  try {
    const L = window.VOXLIB; if(!L || !L.monsters) throw Error('VOXLIB.monsters 未加载');
    const rig = L.monsters.build(id), entries = [];
    rig.root.updateMatrixWorld(true);
    rig.root.traverse(o => { if(o.isMesh){ const boxes = meshToBoxes(o); if(boxes.length) entries.push({mesh:o, boxes}); } });
    let n = 0; for(const en of entries) n += en.boxes.length;
    e = {rig, entries, nBoxes:n, def:rig.def};
  } catch(err){ console.warn('[VoxMobs] 构建失败', id, err); }
  cache.set(id, e); return e;
}

function visibleChain(o, root){ for(let n=o; n && n!==root.parent; n=n.parent) if(!n.visible) return false; return true; }

// m: 游戏怪物对象；返回 drawRig 盒子列表（单位：PX 骨骼单位，已含朝向）
function rig(m, pose, mkBox, matFn, mulFn){
  const e = prepare(m.vox); if(!e) return null;
  const L = window.VOXLIB, R = e.rig;
  try { L.monsters.pose(R, pose); } catch(err){ /* 个别模板缺字段时保持上一帧姿态 */ }
  R.root.position.set(0,0,0); R.root.rotation.set(0,0,0); R.root.scale.set(1,1,1);
  R.root.updateMatrixWorld(true);
  const yaw = matFn(m.ang, 0, 0), out = [];
  for(const en of e.entries){
    if(!visibleChain(en.mesh, R.root)) continue;
    const a = en.mesh.matrixWorld.elements;   // 列主序
    // 3×3：G = S·M·S（S 交换 X/Y）；平移：S·t·24·K
    const M = [
      a[5]*K, a[1]*K, a[9]*K,
      a[4]*K, a[0]*K, a[8]*K,
      a[6]*K, a[2]*K, a[10]*K,
      a[13]*VOX*K, a[12]*VOX*K, a[14]*VOX*K];
    const W = mulFn(yaw, M);
    for(const b of en.boxes){const box=mkBox(W, b.c, b.s, b.col, b.glow);box.faces=b.faces;out.push(box);}
  }
  return out;
}

window.VoxMobs = {prepare, rig, list: () => window.VOXLIB && window.VOXLIB.monsters ? window.VOXLIB.monsters.list() : []};
})();
