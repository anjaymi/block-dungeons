// =====================================================================
//  World3D —— Three.js 体素地形层（方块暗黑破坏神资源 → 暗黑肉鸽）
//  - 地面 / 墙体 / 火把 / 场景道具全部换成 3D 体素模型（vendor/voxel-world.js）
//  - 相机投影矩阵与游戏 2D 投影 P(x,y,z) 逐像素对齐（仍是 2D 俯视角）
//  - 角色、特效、UI 仍由原 2D 画布绘制，叠在 WebGL 画布之上
//  - 遮挡：墙/道具额外渲染到一张透明“遮挡层”，按原画家算法顺序贴回 2D 画布
//  依赖：window.THREE, window.VOXLIB；失败时 init() 返回 false，游戏回退到纯 2D
// =====================================================================
(function(){
"use strict";
const SXc = 44, SYc = 32, SZc = 38;           // 必须与 block-dungeons.html 中的 SX/SY/SZ 一致
const CHUNK = 16;                              // 视锥裁剪分块（格）
const WALL_LAYER = 1;
const MAX_TORCH_LIGHTS = 8;
const SHADOW_R = 17;                           // 阴影覆盖半径（格），围绕镜头中心
const SUN_DIR = [-0.55, 0.75, 1.15];           // Three 坐标：西北上方（+Y = 游戏北）
let shadowsOn = true;
const PR_CAP = 1.5;                            // 像素比上限（高分屏 2x→1.5x，填充量 -44%）
const SWAY_RE = /flower|bush|grass|pine|tree|cactus|palm|sprout|vine|fern|reed|mushroom/;
const uTime = {value: 0};
let glowSpots = [];
const SHADOW_LAYER = 2, MAX_SHADOW_BOXES = 8000;
let shadowProxy = null, shN = 0, shRec = false;

// ---------------------------------------------------------------------
//  主题 → 3D 资源配置
//  floors:   [lib,id,权重]       地面（每种 3 个随机种子 + 随机 90° 旋转）
//  wall:     墙体生成器名         整格体素砖墙（见 WALL_BUILDERS）
//  torch:    [lib,id]            壁挂火把
//  wallDeco: [[lib,id],...]      朝南墙面挂件（旗帜/书架）
//  clutter:  [[lib,id],...]      贴墙地面小摆件（可穿过，矮）
//  obstacle: [[lib,id],...]      房内障碍格（原 2D 的石块/柱子）→ 3D 道具
//  corner:   [[lib,id],...]      房间角落阻挡道具（decorate 生成，带碰撞）
//  light:    环境光配色
// ---------------------------------------------------------------------
const THEME3D = {
  '苔石地牢': {
    floors:[['dungeon','stone_floor',7],['dungeon','cracked_floor',2],['dungeon','brick_floor',1]],
    wall:'dungeon', torch:['dungeon','wall_torch'],
    wallDeco:[['dungeon','wall_banner'],['dungeon','bookshelf']],
    clutter:[['dungeon','bones_pile']],
    obstacle:[['dungeon','pillar'],['dungeon','knight_statue'],['dungeon','sarcophagus'],['dungeon','crystal_cluster'],['dungeon','altar']],
    corner:[['dungeon','barrel'],['dungeon','vase'],['dungeon','crate'],['dungeon','brazier']],
    light:{sky:0xa6b9d8, ground:0x2d3036, hemi:0.86, sun:0.88, torch:0xffa040, exposure:1.02},
  },
  '幽深矿井': {
    floors:[['volcano','basalt_floor',3],['dungeon','cracked_floor',3],['dungeon','stone_floor',2]],
    wall:'mine', torch:['volcano','wall_torch'],
    wallDeco:[['volcano','hanging_banner']],
    clutter:[['dungeon','bones_pile']],
    obstacle:[['dungeon','crystal_cluster'],['volcano','ore_cart'],['volcano','smithing_anvil'],['dungeon','pillar']],
    corner:[['volcano','crate'],['volcano','barrel'],['dungeon','lantern_stand'],['volcano','ore_cart']],
    light:{sky:0xd8c0a0, ground:0x302418, hemi:0.9, sun:0.9, torch:0xffa848},
  },
  '冰封洞窟': {
    floors:[['icefield','snow_tile',3],['icefield','frosted_stone',3],['icefield','packed_snow',2],['icefield','ice_floor',1]],
    wall:'ice', torch:['icefield','wall_torch'],
    wallDeco:[['icefield','hanging_banner']],
    clutter:[['icefield','snow_flowers'],['icefield','frozen_bush']],
    obstacle:[['icefield','ice_crystal_sprout'],['icefield','pillar'],['icefield','rune_stone'],['icefield','dead_tree'],['icefield','snow_pine']],
    corner:[['icefield','supply_sled'],['icefield','frozen_vase'],['icefield','barrel'],['icefield','brazier']],
    light:{sky:0xd0e8ff, ground:0x50607a, hemi:1.0, sun:0.95, torch:0xffb060},
  },
  '下界要塞': {
    floors:[['volcano','obsidian_floor',3],['volcano','cracked_basalt',3],['volcano','basalt_floor',2],['volcano','magma_brick',1]],
    wall:'nether', torch:['volcano','wall_torch'],
    wallDeco:[['volcano','hanging_banner']],
    clutter:[['volcano','ember_flowers'],['volcano','ash_bush']],
    obstacle:[['volcano','lava_crystal'],['volcano','rune_pillar'],['volcano','fire_pedestal'],['volcano','magma_vent'],['volcano','burnt_tree']],
    corner:[['volcano','barrel'],['volcano','smithing_anvil'],['volcano','fire_pedestal']],
    light:{sky:0xffb090, ground:0x401010, hemi:0.85, sun:0.85, torch:0xff7a30},
  },
  '沙海遗迹': {
    floors:[['desert','sand_tile',3],['desert','cracked_sandstone',3],['desert','packed_sand',2],['desert','mosaic_tile',1]],
    wall:'desert', torch:['desert','wall_torch'],
    wallDeco:[['desert','hanging_banner']],
    clutter:[['desert','desert_flowers'],['desert','dry_bush']],
    obstacle:[['desert','pillar'],['desert','obelisk'],['desert','tall_cactus'],['desert','short_cactus'],['desert','palm_tree']],
    corner:[['desert','clay_jar'],['desert','market_basket'],['desert','barrel'],['desert','crate']],
    light:{sky:0xffe8c0, ground:0x5a4428, hemi:1.05, sun:1.05, torch:0xffb050},
  },
};
const FALLBACK_THEME = '苔石地牢';

// ---------------------------------------------------------------------
//  整格砖墙：24×24 体素底面，高度随种子变化；只装饰朝南（-Y）的正面与顶面
// ---------------------------------------------------------------------
const WALL_BUILDERS = {
  dungeon(v, L, h, k){ const P = L.dungeon.P;
    P.masonry(v,-12,-12,0,24,24,h);
    // 屋顶铺成小块压顶石；整条 24 体素长石会在俯视镜头里形成灰色条带。
    v.box(-12,-12,h,24,24,2,0x414653);
    for(let y=-12;y<12;y+=8) for(let x=-12;x<12;x+=8){
      const c = P.D.stone[(k+(x+12)/8+(y+12)/8*2)%P.D.stone.length];
      const dark = (Math.round((c>>16)*.72)<<16) | (Math.round(((c>>8)&255)*.75)<<8) | Math.round((c&255)*.8);
      v.box(x+1,y+1,h,7,7,2,dark);
    }
    if(k%3===1){ P.moss(v,-10+k%5,-13,2,5,2); P.moss(v,3,-13,h-9,4,2); }
    if(k%3===2) buildMoss(v,k%3,-3,-4,h+2,.75);
  },
  mine(v, L, h, k){ const P = L.volcano.P;
    P.basalt(v,-12,-12,0,24,24,h,P.VC.basalt);
    v.box(-12,-12,h,24,24,1,P.VC.basaltDark,'solid',3);
    if(k%3===1){ v.box(-12,-14,h-6,24,2,2,P.VC.wood[1]); v.box(-11,-14,0,3,2,h-4,P.VC.wood[2]); v.box(8,-14,0,3,2,h-4,P.VC.wood[2]); }
    if(k%3===2){ for(let n=0;n<4;n++) v.box(-8+n*5,-13,5+((n*7)%11),2,1,2,0x7fd8ff,'glow'); }
  },
  ice(v, L, h, k){ const P = L.icefield.P;
    P.slate(v,-12,-12,0,24,24,h);
    P.snowCap(v,-12,-12,h,24,24,3);
    if(k%2===0) P.icicles(v,-11,-13,h-1,22,5+k%3);
  },
  nether(v, L, h, k){ const P = L.volcano.P;
    P.basalt(v,-12,-12,0,24,24,h,P.VC.obsidian);
    v.box(-12,-12,h,24,24,1,P.VC.basaltDark,'solid',3);
    if(k%3!==0) P.lavaCrack(v,-6+(k*5)%10,-12,1,Math.min(h-2,16+k%7),'z',k);
    if(k%3===2) P.lavaCrack(v,-10,-6,h,18,'x',k+3);
  },
  desert(v, L, h, k){ const P = L.desert.P;
    P.masonry(v,-12,-12,0,24,24,h);
    v.box(-12,-12,h,24,24,2,P.DS.sandstone,'solid',4);
    if(k%3===1) P.inlayBandX(v,-12,-12,h-8,24,2,1);
    if(k%3===2) P.glyphColumn(v,-2,-13,4,h-10,2);
  },
};
const WALL_HEIGHTS = [28, 31, 34, 30, 33, 29];
const WH_ORD = WALL_HEIGHTS.map((h,i)=>[h,i]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);   // 按高度排序的索引，配合平滑噪声让墙高渐变

// ---------------------------------------------------------------------
//  内部状态
// ---------------------------------------------------------------------
let T = null, L = null, ok = false, failed = false;
let renderer, scene, camera, glc, wl, wlctx, mats;
let hemi, sun, torchLights = [], playerLight, exitLight;
let world = null, builtFor = null, builtTheme = null;
let glLost = false, glFailG = null, wlAlphaOK = null;   // wlAlphaOK：读回的透明背景是否真的透明（部分 Windows 驱动读回为不透明黑 → 墙体贴回会把地面盖黑）   // WebGL 上下文丢失 / 渲染异常 → 回退 2D，避免 3D 画布冻结在旧帧（两张地图叠在一起）
let tileExt = null;          // Float32Array: 每格遮挡物高度（0 = 无遮挡物）
let tileSouth = null;        // Float32Array: 每格遮挡物向南突出量
let cornerProps = new Map(); // idx -> [lib,id]（decorate 生成的阻挡道具）
const partCache = new Map();
let W = 0, H = 0, PR = 1, ZOOMc = 1, builtGW = 0;

// 平滑值噪声（双线性 + smoothstep），用于成片的地面/墙高分布，避免逐格白噪声显得碎
const vnoise = (x, y, salt) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x-xi, fy = y-yi, sx = fx*fx*(3-2*fx), sy = fy*fy*(3-2*fy);
  const a = h32(xi,yi,salt), b = h32(xi+1,yi,salt), c = h32(xi,yi+1,salt), d = h32(xi+1,yi+1,salt);
  return a + (b-a)*sx + (c-a)*sy + (a-b-c+d)*sx*sy;
};
const fbm = (x, y, salt) => (vnoise(x/6, y/6, salt)*0.7 + vnoise(x/2.5, y/2.5, salt+7)*0.3);
const h32 = (a,b,c=0) => { let h = Math.imul(a|0,374761393) ^ Math.imul(b|0,668265263) ^ Math.imul(c|0,1274126177); h = Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
const pickW = (list, r) => { let s = 0; for(const e of list) s += e[2]||1; let t = r*s; for(const e of list){ t -= e[2]||1; if(t<=0) return e; } return list[list.length-1]; };

function kindOf(mesh){
  const n = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name || '';
  if(/glow/.test(n)) return 'glow';
  if(/water/.test(n)) return 'water';
  if(/crystal/.test(n)) return 'crystal';
  return 'solid';
}
function extractParts(root){
  root.updateMatrixWorld(true);
  const parts = []; let maxZ = 0, maxS = 0;
  root.traverse(o=>{
    if(!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    if(g.attributes.uv) g.deleteAttribute('uv');
    g.computeBoundingBox(); maxZ = Math.max(maxZ, g.boundingBox.max.z); maxS = Math.max(maxS, -g.boundingBox.min.y);
    parts.push({geo:g, kind:kindOf(o)});
    o.geometry.dispose(); for(const m of [].concat(o.material)) m.dispose();
  });
  return {parts, maxZ, south:maxS};
}
function assetParts(lib, id, seed){
  const key = lib+'/'+id+'/'+seed;
  let p = partCache.get(key);
  if(!p){
    try { p = extractParts(L[lib].create(id, seed)); }
    catch(e){ console.warn('[World3D] asset failed', key, e); p = {parts:[], maxZ:0, south:0}; }
    partCache.set(key, p);
  }
  return p;
}
// 把 [[geometry, Matrix4], ...] 烘焙成一个非索引 BufferGeometry（position / normal / color）
function mergeBaked(items){
  let nv = 0;
  for(const [g] of items) nv += g.index ? g.index.count : g.attributes.position.count;
  if(!nv) return null;
  const P = new Float32Array(nv*3), N = new Float32Array(nv*3), C = new Float32Array(nv*3);
  let o = 0;
  for(const [g, m] of items){
    const e = m.elements, pa = g.attributes.position.array, na = g.attributes.normal ? g.attributes.normal.array : null;
    const ca = g.attributes.color ? g.attributes.color.array : null, cs = g.attributes.color ? g.attributes.color.itemSize : 3;
    const idx = g.index ? g.index.array : null, cnt = idx ? idx.length : g.attributes.position.count;
    for(let n=0;n<cnt;n++){
      const v = idx ? idx[n] : n, x = pa[v*3], y = pa[v*3+1], z = pa[v*3+2];
      P[o]   = e[0]*x + e[4]*y + e[8]*z  + e[12];
      P[o+1] = e[1]*x + e[5]*y + e[9]*z  + e[13];
      P[o+2] = e[2]*x + e[6]*y + e[10]*z + e[14];
      if(na){ const a = na[v*3], b = na[v*3+1], c = na[v*3+2];   // 只有旋转+等比缩放，法线直接用旋转部分
        let nx = e[0]*a + e[4]*b + e[8]*c, ny = e[1]*a + e[5]*b + e[9]*c, nz = e[2]*a + e[6]*b + e[10]*c;
        const l = Math.hypot(nx,ny,nz) || 1; N[o] = nx/l; N[o+1] = ny/l; N[o+2] = nz/l; }
      else N[o+2] = 1;
      if(ca){ C[o] = ca[v*cs]; C[o+1] = ca[v*cs+1]; C[o+2] = ca[v*cs+2]; } else { C[o] = C[o+1] = C[o+2] = 1; }
      if(m.floorSurface && window.SceneStyle){
        const shade = SceneStyle.floorShade(m.floorSurface,P[o],-P[o+1]);
        C[o]*=shade[0]; C[o+1]*=shade[1]; C[o+2]*=shade[2];
      }
      o += 3;
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(P, 3));
  geo.setAttribute('normal', new T.BufferAttribute(N, 3));
  geo.setAttribute('color', new T.BufferAttribute(C, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}
function avgColor(c){
  let r = 0, g = 0, b = 0; const n = c.count, s = Math.max(1, (n/64)|0); let k = 0;
  for(let i=0;i<n;i+=s){ r += c.getX(i); g += c.getY(i); b += c.getZ(i); k++; }
  const m = Math.max(r,g,b)/k || 1;   // 归一化到最亮通道 = 1，作为辉光色
  return [r/k/m, g/k/m, b/k/m];
}
function styleMat(m){
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\nvarying vec3 vStyleWp;\nvarying vec3 vStyleNormal;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 stylePosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        stylePosition = instanceMatrix * stylePosition;
      #endif
      vStyleWp = (modelMatrix * stylePosition).xyz;
      vStyleNormal = normalize(transformedNormal);`);
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vStyleWp;\nvarying vec3 vStyleNormal;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // 低强度的边缘辉光：让体素轮廓在阴影里仍保留魔法感，不改变原有材质颜色。
      // 本项目使用固定正交投影；Lambert 不提供 vViewPosition。
      float styleFacing = abs(dot(normalize(vStyleNormal), normalize(vec3(0.0, -38.0, 32.0))));
      float styleRim = pow(1.0 - styleFacing, 3.2);
      float stylePulse = 0.72 + 0.28 * sin(uTime * 1.15 + vStyleWp.x * 0.18 + vStyleWp.y * 0.13);
      diffuseColor.rgb += vec3(0.035, 0.075, 0.11) * styleRim * stylePulse;
      diffuseColor.rgb *= 0.985 + 0.015 * sin(uTime * 0.7 + vStyleWp.x * 0.08 - vStyleWp.y * 0.06);`);
  };
  m.customProgramCacheKey = () => 'style-rim-v2';
  return m;
}

// 给材质注入时间动画（世界坐标相位，静态合批网格的 modelMatrix = 单位阵）
function animMat(m, mode){
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\nvarying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
      ${mode==='sway' ? 'float sw = max(transformed.z, 0.0); transformed.x += sin(uTime*1.6 + vWp.x*1.3 + vWp.y*0.7)*0.035*sw; transformed.y += cos(uTime*1.3 + vWp.x*0.6 + vWp.y*1.1)*0.025*sw;' : ''}
      ${mode==='water' ? 'transformed.z += sin(uTime*2.0 + vWp.x*3.1 + vWp.y*2.3)*0.012;' : ''}`);
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWp;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      ${mode==='glow' ? 'float br = 0.82 + 0.22*sin(uTime*1.7 + vWp.x*1.1 + vWp.y*0.8) + 0.08*sin(uTime*5.3 + vWp.x*4.0 - vWp.y*3.0); diffuseColor.rgb *= br; diffuseColor.rgb += diffuseColor.rgb*diffuseColor.rgb*0.25*(br-0.8);' : ''}
      ${mode==='water' ? 'float rp = sin(uTime*1.8 + vWp.x*6.0 + vWp.y*4.0)*sin(uTime*1.3 - vWp.x*3.5 + vWp.y*5.5); diffuseColor.rgb += vec3(0.10,0.14,0.18)*smoothstep(0.55,1.0,rp);' : ''}`);
    if(mode==='crystal') sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance *= 0.7 + 0.6*(0.5+0.5*sin(uTime*2.2 + vWp.x*0.9 + vWp.y*1.3));`);
  };
  m.customProgramCacheKey = () => 'anim-' + mode;
  return m;
}
function wallParts(kind, k){
  const key = 'wall/'+kind+'/'+k;
  let p = partCache.get(key);
  if(!p){
    const v = new L.DungeonModel(101 + k*17), h = WALL_HEIGHTS[k % WALL_HEIGHTS.length];
    (WALL_BUILDERS[kind] || WALL_BUILDERS.dungeon)(v, L, h, k);
    p = extractParts(v.build(key)); partCache.set(key, p);
  }
  return p;
}

// A low, irregular cushion and a few feathered fronds, rather than green cubes.
// Canonical footprint stays inside radius 8 voxels; instances share three meshes.
function buildMoss(v,variant,ox=0,oy=0,oz=0,scale=1){
  const colors=[0x35473d,0x455746,0x56674b,0x64754f];
  const cell=(x,y,z,w,d,h,c)=>v.box(Math.round(ox+x*scale),Math.round(oy+y*scale),oz+Math.round(z*scale),Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(d*scale)),Math.max(1,Math.round(h*scale)),c);
  for(let y=-7;y<=7;y++)for(let x=-7;x<=7;x++){
    const lobes=Math.min(Math.hypot(x+2,y+1)-4.8,Math.hypot(x-2,y-2)-4.2,Math.hypot(x-1,y+3)-3.5);
    if(lobes>0||Math.hypot(x+.5,y+.5)>7.25||h32(x,y,variant+91)<.10)continue;
    cell(x,y,0,1,1,1,colors[(h32(x,y,variant+93)*3)|0]);
  }
  if(variant===0)return;
  for(let stem=0;stem<3;stem++){
    const x=-3+stem*3,y=(stem===1?-2:1),height=variant===2?6-stem:3+stem%2;
    cell(x,y,1,1,1,height,colors[1]);
    for(let z=2;z<height;z+=2){
      const reach=Math.max(1,Math.min(3,height-z));
      cell(x-reach,y,z,reach,1,1,colors[2]);cell(x+1,y,z+1,reach,1,1,colors[3]);
    }
  }
}
function mossParts(variant){
  const key='ground-moss/'+variant;let p=partCache.get(key);
  if(!p){const v=new L.DungeonModel(137+variant);buildMoss(v,variant);p=extractParts(v.build(key));partCache.set(key,p);}
  return p;
}

// ---------------------------------------------------------------------
//  初始化
// ---------------------------------------------------------------------
function init(){
  if(ok) return true; if(failed) return false;
  try {
    T = window.THREE; L = window.VOXLIB;
    if(!T || !L) throw Error('THREE / VOXLIB 未加载（检查 vendor/voxel-world.js）');
    const cv = document.getElementById('c');
    glc = document.createElement('canvas'); glc.id = 'gl3d';
    for(const c of [glc, cv]){ c.style.position = 'fixed'; c.style.left = '0'; c.style.top = '0'; }
    glc.style.zIndex = '0'; cv.style.zIndex = '1'; glc.style.pointerEvents = 'none';
    cv.parentNode.insertBefore(glc, cv);
    renderer = new T.WebGLRenderer({canvas:glc, antialias:true, alpha:true, powerPreference:'high-performance'});
    // Three 默认只记录编译错误；让 frame() 捕获它并通知主画布回退。
    renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
      const detail = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertexShader), gl.getShaderInfoLog(fragmentShader)].filter(Boolean).join('\n');
      throw new Error('[World3D] shader 编译失败：' + detail);
    };
    // 统一 Three 与 Canvas 的色彩空间，避免 3D 地面/墙体在高分屏上发灰；新旧 Three 版本均兼容。
    if(T.SRGBColorSpace && 'outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
    else if(T.sRGBEncoding && 'outputEncoding' in renderer) renderer.outputEncoding = T.sRGBEncoding;
    if(T.ACESFilmicToneMapping !== undefined){ renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; }
    glc.addEventListener('webglcontextlost', e => { e.preventDefault(); glLost = true; glc.style.visibility = 'hidden'; console.warn('[World3D] WebGL 上下文丢失，暂时回退 2D'); }, false);
    glc.addEventListener('webglcontextrestored', () => { glLost = false; glFailG = null; builtFor = null; builtTheme = null; wlAlphaOK = null; console.warn('[World3D] WebGL 上下文已恢复，重建场景'); }, false);
    renderer.sortObjects = true;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
    wl = document.createElement('canvas'); wlctx = wl.getContext('2d');
    scene = new T.Scene();
    camera = new T.Camera(); camera.matrixAutoUpdate = false; camera.matrixWorldAutoUpdate = false;
    mats = {
      solid: styleMat(new T.MeshLambertMaterial({vertexColors:true})),
      crystal: animMat(new T.MeshLambertMaterial({vertexColors:true, emissive:0x1a4f9a, emissiveIntensity:0.6}), 'crystal'),
      glow: animMat(new T.MeshBasicMaterial({vertexColors:true}), 'glow'),
      water: animMat(new T.MeshLambertMaterial({vertexColors:true, transparent:true, opacity:0.82, depthWrite:false}), 'water'),
      sway: animMat(new T.MeshLambertMaterial({vertexColors:true}), 'sway'),
    };
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, PR_CAP));
    hemi = new T.HemisphereLight(0xffffff, 0x404040, 1.2); hemi.position.set(0,0,1);
    sun = new T.DirectionalLight(0xfff2dc, 1.2); sun.position.set(-0.45,-0.75,1.0); sun.target.position.set(0,0,0);
    // 阴影：西北方向的斜射光，让墙/道具的影子落向镜头一侧（可见）
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -SHADOW_R; sc.right = SHADOW_R; sc.top = SHADOW_R; sc.bottom = -SHADOW_R; sc.near = 0.5; sc.far = 60; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    scene.add(hemi, sun, sun.target);
    for(let n=0;n<MAX_TORCH_LIGHTS;n++){ const l = new T.PointLight(0xffa040, 0, 6.5, 1.4); torchLights.push(l); scene.add(l); }
    playerLight = new T.PointLight(0xfff0d8, 2.2, 9, 1.2); scene.add(playerLight);
    exitLight = new T.PointLight(0xb070ff, 0, 7, 1.3); scene.add(exitLight);
    for(const l of [hemi, sun, playerLight, exitLight, ...torchLights]) l.layers.enableAll();
    sun.shadow.camera.layers.enable(SHADOW_LAYER);
    const shMat = new T.MeshBasicMaterial({colorWrite:false, depthWrite:false, side:T.DoubleSide});
    shadowProxy = new T.InstancedMesh(new T.BoxGeometry(1,1,1), shMat, MAX_SHADOW_BOXES);
    shadowProxy.layers.set(SHADOW_LAYER); shadowProxy.castShadow = true; shadowProxy.frustumCulled = false; shadowProxy.count = 0;
    scene.add(shadowProxy);
    resize(); addEventListener('resize', resize);
    ok = true; console.log('[World3D] ready · three r' + T.REVISION);
    return true;
  } catch(e){
    console.warn('[World3D] 初始化失败，回退 2D：', e); failed = true;
    if(glc && glc.parentNode) glc.parentNode.removeChild(glc);
    return false;
  }
}
function resize(){
  if(!renderer) return;
  W = innerWidth; H = innerHeight; PR = Math.min(devicePixelRatio || 1, PR_CAP);
  renderer.setPixelRatio(PR); renderer.setSize(W, H, true);
  wl.width = Math.round(W*PR); wl.height = Math.round(H*PR);
}

// ---------------------------------------------------------------------
//  地图装饰（genFloor 内调用，房间角落加阻挡道具）
// ---------------------------------------------------------------------
function decorate(o){
  cornerProps = new Map();
  if(!init()) return;
  const cfg = THEME3D[o.theme && o.theme.name] || THEME3D[FALLBACK_THEME];
  if(!cfg.corner || !cfg.corner.length) return;
  const {G, roomId, rooms, GW, GH} = o, id = (i,j) => j*GW+i;
  const solid = (i,j) => i<0||j<0||i>=GW||j>=GH||G[id(i,j)]===0;
  for(const r of rooms){
    if(r.type==='boss' || r.type==='shop') continue;
    let placed = 0; const want = r.type==='start' ? 1 : 2 + (h32(r.id, o.seed)*2|0);
    const tiles = r.tiles.slice().sort((a,b)=>h32(a[0],a[1],o.seed)-h32(b[0],b[1],o.seed));
    for(const [i,j] of tiles){
      if(placed >= want) break;
      if(G[id(i,j)]!==1 || roomId[id(i,j)]!==r.id) continue;
      const n = solid(i-1,j)+solid(i+1,j)+solid(i,j-1)+solid(i,j+1);
      if(n < 2 || !(solid(i,j-1)||solid(i,j+1))) continue;          // 角落：至少两面贴墙
      if(Math.abs(i-r.cx)<3 || Math.abs(j-r.cy)<3) continue;
      if(r.gates.some(g=>Math.abs(g[0]-i)+Math.abs(g[1]-j)<5)) continue;
      // 不能堵死：放置后四邻中的地面格仍须互相连通（简单判据：不允许把通道夹成 1 格）
      if(!solid(i-1,j) && !solid(i+1,j) && solid(i,j-1) && solid(i,j+1)) continue;
      if(!solid(i,j-1) && !solid(i,j+1) && solid(i-1,j) && solid(i+1,j)) continue;
      G[id(i,j)] = 0; cornerProps.set(id(i,j), cfg.corner[(h32(i,j,o.seed)*cfg.corner.length)|0]); placed++;
    }
    r.tiles = r.tiles.filter(([a,b])=>G[id(a,b)]===1);
  }
}

// ---------------------------------------------------------------------
//  构建整层的 3D 场景（G 变化时调用一次）
// ---------------------------------------------------------------------
function build(o){
  const t0 = performance.now();
  if(world){ scene.remove(world); world.traverse(n=>{ if(n.isMesh && n.geometry) n.geometry.dispose(); }); }
  world = new T.Group(); scene.add(world);
  const {G, GW, GH, roomId, torches} = o, id = (i,j) => j*GW+i;
  builtGW = GW;
  const cfg = THEME3D[o.theme && o.theme.name] || THEME3D[FALLBACK_THEME];
  const isF = (i,j) => i>=0&&j>=0&&i<GW&&j<GH&&G[id(i,j)]!==0;
  const solid = (i,j) => !isF(i,j);
  tileExt = new Float32Array(GW*GH); tileSouth = new Float32Array(GW*GH);
  const buckets = new Map();   // key -> {parts, occ, mats:{chunk -> Matrix4[]}}
  const m4 = new T.Matrix4(), q = new T.Quaternion(), zAxis = new T.Vector3(0,0,1), pos = new T.Vector3(), scl = new T.Vector3(1,1,1);
  const put = (key, partsObj, occ, x, y, z, yaw=0, s=1, surface=null) => {
    let b = buckets.get(key); if(!b){ b = {p:partsObj, occ, chunks:new Map()}; buckets.set(key, b); }
    const ck = ((y/CHUNK)|0)*1000 + ((x/CHUNK)|0);
    let arr = b.chunks.get(ck); if(!arr){ arr = []; b.chunks.set(ck, arr); }
    q.setFromAxisAngle(zAxis, yaw); pos.set(x, -y, z); scl.set(s,s,s);
    const instance=m4.compose(pos, q, scl).clone();instance.floorSurface=surface;arr.push(instance);
  };
  const torchAt = new Set(torches.map(t=>id(t.i,t.j)));
  const seedOf = (i,j,salt) => 7 + ((h32(i,j,salt)*3)|0);
  // 地面成片：主地面占大头，次要材质成团出现，稀有材质只零星点缀
  const FL = cfg.floors.slice().sort((a,b)=>b[2]-a[2]);
  const floorPick = (i,j) => {
    const v = fbm(i, j, 11), r = h32(i,j,14);
    if(FL.length > 2 && r < 0.04) return FL[2 + ((h32(i,j,15)*(FL.length-2))|0)];
    if(FL.length > 1 && v > (cfg.wall==='dungeon' ? .67 : .6)) return FL[1];
    return FL[0];
  };
  for(let j=0;j<GH;j++) for(let i=0;i<GW;i++){
    const k = id(i,j), cx = i+0.5, cy = j+0.5;
    if(isF(i,j)){
      // ---- 地面 ----
      const f = floorPick(i,j), sd = seedOf(i,j,12);
      const surface=window.SceneStyle ? SceneStyle.floorSurface(o,i,j) : null;
      put('f/'+f[0]+'/'+f[1]+'/'+sd, assetParts(f[0],f[1],sd), false, cx, cy, 0, ((h32(i,j,13)*4)|0)*Math.PI/2,1,surface);
      if(cfg.wall==='dungeon' && window.SceneStyle)for(const patch of SceneStyle.mossPatches(o,i,j)){
        put('c/ground-moss/'+patch.variant,mossParts(patch.variant),false,patch.x,patch.y,.012,patch.yaw,patch.r/(8/24));
      }
      // ---- 贴墙小摆件（不阻挡）----
      if(cfg.clutter && cfg.clutter.length && G[k]===1){
        const nW = solid(i-1,j)||solid(i+1,j)||solid(i,j-1);
        if(nW && h32(i,j,21) < 0.075){
          const c = cfg.clutter[(h32(i,j,22)*cfg.clutter.length)|0], sd2 = seedOf(i,j,23);
          put('c/'+c[0]+'/'+c[1]+'/'+sd2, assetParts(c[0],c[1],sd2), false, cx+(h32(i,j,24)-0.5)*0.2, cy+(h32(i,j,25)-0.5)*0.2, 0, h32(i,j,26)*6.283, 0.8);
        }
      }
      continue;
    }
    // ---- 实心格：只渲染与地面相邻的边缘格 ----
    let edge = false;
    for(let dj=-1;dj<=1&&!edge;dj++) for(let di=-1;di<=1;di++) if(isF(i+di,j+dj)){ edge = true; break; }
    if(!edge) continue;
    const corner = cornerProps.get(k);
    const inRoom = roomId && roomId[k] >= 0;
    if(corner || inRoom){
      // 房内障碍/角落道具：下面先铺地面，再放 3D 道具
      const f = floorPick(i,j), sd = seedOf(i,j,12);
      put('f/'+f[0]+'/'+f[1]+'/'+sd, assetParts(f[0],f[1],sd), false, cx, cy, 0, 0);
      const a = corner || cfg.obstacle[(h32(i,j,31)*cfg.obstacle.length)|0], sd2 = seedOf(i,j,32);
      const P = assetParts(a[0],a[1],sd2);
      const yaw = corner ? (solid(i,j+1) ? Math.PI : 0) : ((h32(i,j,33)*4)|0)*Math.PI/2;
      put('o/'+a[0]+'/'+a[1]+'/'+sd2+'/'+yaw.toFixed(2), P, true, cx, cy, 0, yaw);
      tileExt[k] = Math.max(0.6, P.maxZ) + 0.05; tileSouth[k] = 0.15;
      continue;
    }
    const wk = WH_ORD[Math.min(WALL_HEIGHTS.length-1, Math.max(0, ((fbm(i,j,41)-0.2)*1.6*WALL_HEIGHTS.length)|0))], WP = wallParts(cfg.wall, wk);
    put('w/'+cfg.wall+'/'+wk, WP, true, cx, cy, 0, 0);
    tileExt[k] = WP.maxZ + 0.05; tileSouth[k] = 0.06;
    const southOpen = isF(i,j+1);
    if(torchAt.has(k)){
      const P = assetParts(cfg.torch[0], cfg.torch[1], 7);
      put('t/'+cfg.torch.join('/'), P, true, cx, j+1, 0, 0);
      tileExt[k] = Math.max(tileExt[k], P.maxZ + 0.1); tileSouth[k] = Math.max(tileSouth[k], P.south + 0.05);
    } else if(southOpen && solid(i,j-1) && cfg.wallDeco && cfg.wallDeco.length && h32(i,j,51) < 0.12){
      const d = cfg.wallDeco[(h32(i,j,52)*cfg.wallDeco.length)|0], P = assetParts(d[0], d[1], 7);
      put('d/'+d.join('/'), P, true, cx, j+1+0.02, 0, 0);
      tileSouth[k] = Math.max(tileSouth[k], P.south + 0.05); tileExt[k] = Math.max(tileExt[k], P.maxZ + 0.05);
    }
  }
  // ---- 合批：同一 (分块, 材质, 遮挡) 的所有实例烘焙成一个静态网格 ----
  //      原来每个 (资源×分块×材质) 一个 InstancedMesh（数百个 draw call），现在约数十个
  const groups = new Map();   // key -> {kind, occ, items:[[geo, Matrix4]]}
  let inst = 0;
  glowSpots = [];
  for(const [key, b] of buckets){
    const sway = SWAY_RE.test(key);
    for(const arr of b.chunks.values()){
      inst += arr.length;
      for(const part of b.p.parts){
        let kind = part.kind; if(kind==='solid' && sway) kind = 'sway';
        const ck = arr[0].elements[12]/CHUNK|0, cj = -arr[0].elements[13]/CHUNK|0;
        const gk = ck+','+cj+'|'+kind+'|'+(b.occ?1:0);
        let g = groups.get(gk); if(!g){ g = {kind, occ:b.occ, items:[]}; groups.set(gk, g); }
        for(const m of arr) g.items.push([part.geo, m]);
      }
      // 发光部件 → 2D 辉光点（假 Bloom）
      const gp = b.p.parts.find(pt=>pt.kind==='glow' || pt.kind==='crystal');
      if(gp && key[0] !== 'f' && key[0] !== 'w'){
        const bb = gp.geo.boundingBox || (gp.geo.computeBoundingBox(), gp.geo.boundingBox);
        const c = gp.geo.attributes.color, col = c ? avgColor(c) : [1,0.6,0.2];
        for(const m of arr){ const e = m.elements; glowSpots.push({x:e[12], y:-e[13], z:(bb.min.z+bb.max.z)/2, r:Math.min(1.6, 0.6 + (bb.max.z-bb.min.z)*0.6), col, ph:Math.random()*6.28, t:key[0]}); }
      }
    }
  }
  let draws = 0;
  for(const g of groups.values()){
    const geo = mergeBaked(g.items); if(!geo) continue;
    const mesh = new T.Mesh(geo, mats[g.kind] || mats.solid);
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;   // 自定义投影下不依赖 Three 的视锥裁剪（批次很少，开销可忽略）
    if(g.occ) mesh.layers.enable(WALL_LAYER);
    mesh.castShadow = g.occ && g.kind !== 'glow' && g.kind !== 'water';
    mesh.receiveShadow = g.kind !== 'glow';
    if(g.kind==='water') mesh.renderOrder = 2;
    world.add(mesh); draws++;
  }
  // ---- 主题光照 ----
  const lc = cfg.light;
  hemi.color.setHex(lc.sky); hemi.groundColor.setHex(lc.ground); hemi.intensity = lc.hemi;
  sun.intensity = lc.sun;
  if(T.ACESFilmicToneMapping !== undefined) renderer.toneMappingExposure = lc.exposure || 1.08;
  for(const l of torchLights) l.color.setHex(lc.torch);
  console.log(`[World3D] 构建完成 ${o.theme && o.theme.name} · ${inst} 实例 / ${draws} 批次 · ${(performance.now()-t0).toFixed(0)}ms`);
}

// ---------------------------------------------------------------------
//  每帧：对齐投影 → 遮挡层 → 主画面
// ---------------------------------------------------------------------
function setProjection(ox, oy, zoom){
  // 游戏投影（缩放前）：sx = ox + x*SX ; sy = oy + y*SY - z*SZ ；Three 世界坐标 X=x, Y=-y, Z=z
  const a = 2*zoom/W, b = 2*zoom/H;
  // 深度：沿视线方向 (0, SZ, SY)（游戏坐标），越靠南/越高越近
  const n = Math.hypot(SZc, SYc), mMin = -8, mMax = 110, R = mMax - mMin;
  const kz = -2/(n*R), bz = 1 + 2*mMin/R;
  camera.projectionMatrix.set(
    a*SXc, 0,       0,       a*ox - 1,
    0,     b*SYc,   b*SZc,   1 - b*oy,
    0,     -kz*SZc, kz*SYc,  bz,
    0,     0,       0,       1);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
const nearD = new Float64Array(MAX_TORCH_LIGHTS + 1), nearT = new Array(MAX_TORCH_LIGHTS + 1);
function updateLights(o){
  const p = o.player, now = performance.now();
  // 阴影相机跟随镜头，按阴影贴图像素对齐，避免移动时影子边缘抖动
  const texel = SHADOW_R*2/sun.shadow.mapSize.x;
  const tx = Math.round(o.cam.x/texel)*texel, ty = Math.round(-o.cam.y/texel)*texel, d = 20;
  sun.target.position.set(tx, ty, 0); sun.position.set(tx + SUN_DIR[0]*d, ty + SUN_DIR[1]*d, SUN_DIR[2]*d);
  sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  playerLight.position.set(p.x, -p.y, 1.3);
  playerLight.intensity = 1.65 * Math.max(0.6, Math.min(1.8, 1 + 0.08*((p.G && p.G.light)||0)));
  // 选最近的 N 个火把（插入排序到固定数组，不分配）
  let cnt = 0;
  for(const t of o.torches){
    const d = (t.x-o.cam.x)**2 + (t.y-o.cam.y)**2; if(d > 22*22) continue;
    let k = Math.min(cnt, torchLights.length); if(k === torchLights.length && d >= nearD[k-1]) continue;
    if(k === torchLights.length) k--; else cnt++;
    while(k > 0 && nearD[k-1] > d){ nearD[k] = nearD[k-1]; nearT[k] = nearT[k-1]; k--; }
    nearD[k] = d; nearT[k] = t;
  }
  for(let n=0;n<torchLights.length;n++){
    const l = torchLights[n], e = n < cnt ? {t:nearT[n]} : null;
    if(!e){ l.intensity = 0; continue; }
    const fl = 0.85 + 0.15*Math.sin(now/90 + e.t.ph) + 0.05*Math.sin(now/37 + e.t.ph*3);
    l.position.set(e.t.i+0.5, -(e.t.j+1.25), 1.15); l.intensity = 4.25*fl;
  }
  if(o.exitOpen && o.exitPos){ exitLight.position.set(o.exitPos.x, -o.exitPos.y, 0.8); exitLight.intensity = 4.2 + Math.sin(now/200); }
  else exitLight.intensity = 0;
}
function frame(o){
  if(!init()) return false;
  if(!o.G || glLost || glFailG === o.G){ if(glc) glc.style.visibility = 'hidden'; return false; }
  try { const rendered = frameInner(o); glFailG = null; return rendered; }
  catch(e){ glFailG = o.G; glc.style.visibility = 'hidden'; console.error('[World3D] 渲染异常，本层回退 2D：', e); return false; }
}
function frameInner(o){
  glc.style.visibility = 'visible';
  if(builtFor !== o.G || builtTheme !== o.theme){ build(o); builtFor = o.G; builtTheme = o.theme; }
  ZOOMc = o.zoom; uTime.value = performance.now()/1000;
  setProjection(o.ox, o.oy, o.zoom);
  updateLights(o);
  if(wlAlphaOK === null && /wlbad/.test(location.search)) wlAlphaOK = false;   // 测试开关
  if(wlAlphaOK === null){   // 一次性自检：空场景 + 透明清屏 → 读回 alpha
    camera.layers.set(30); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    wl.width = glc.width; wl.height = glc.height; wlctx.clearRect(0,0,wl.width,wl.height); wlctx.drawImage(glc, 0, 0);
    let a = 0; try { const d = wlctx.getImageData(0, 0, Math.min(8,wl.width), Math.min(8,wl.height)).data; for(let q=3;q<d.length;q+=4) a = Math.max(a, d[q]); } catch(e){ a = 0; }
    wlAlphaOK = a < 8;
    if(!wlAlphaOK) console.warn('[World3D] 读回背景不透明（alpha='+a+'），关闭墙体遮挡贴回以免地面变黑');
  }
  // Pass 1：仅遮挡物（墙/道具/火把）→ 透明遮挡层
  renderer.shadowMap.enabled = shadowsOn; renderer.shadowMap.needsUpdate = shadowsOn;   // 每帧只在第一遍更新一次阴影贴图
  camera.layers.set(WALL_LAYER);
  renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, camera);
  wlctx.clearRect(0, 0, wl.width, wl.height); wlctx.drawImage(glc, 0, 0);
  // Pass 2：完整场景 → 可见画布
  camera.layers.set(0);
  renderer.setClearColor(0x05050a, 1); renderer.clear();
  renderer.render(scene, camera);
  return true;
}
// 把格子 (i,j) 的遮挡物像素按画家顺序贴回 2D 画布（ctx 已处于 ZOOM 变换下，P 为游戏投影函数）
function blit(ctx, P, i, j, alpha){
  if(!tileExt) return false;
  const k = j*builtGW + i, h = tileExt[k]; if(!h) return false;
  if(wlAlphaOK === false) return true;   // 驱动不支持透明读回：墙已由 3D 画布绘制，跳过贴回
  const s = tileSouth[k] || 0;
  const a = P(i-0.12, j, h), b = P(i+1.12, j+1+s, 0);
  let x0 = a[0], y0 = a[1], x1 = b[0], y1 = b[1];
  const sc = ZOOMc*PR;
  let sx = x0*sc, sy = y0*sc, sw = (x1-x0)*sc, sh = (y1-y0)*sc;
  if(sx < 0){ x0 -= sx/sc; sw += sx; sx = 0; } if(sy < 0){ y0 -= sy/sc; sh += sy; sy = 0; }
  if(sx+sw > wl.width) sw = wl.width - sx; if(sy+sh > wl.height) sh = wl.height - sy;
  if(sw <= 0 || sh <= 0) return true;
  ctx.globalAlpha = alpha; ctx.drawImage(wl, sx, sy, sw, sh, x0, y0, sw/sc, sh/sc); ctx.globalAlpha = 1;
  return true;
}
// 2D 方块骨骼 → 阴影代理（drawRig 在世界渲染阶段调用；下一帧的阴影贴图使用）
function beginShadows(){ shN = 0; shRec = !!(ok && shadowsOn && shadowProxy); }
function endShadows(){ if(!shadowProxy) return; shadowProxy.count = shN; shadowProxy.instanceMatrix.needsUpdate = true; shRec = false; }
function pushShadow(e, boxes, k, z0, applyFn){
  if(!shRec) return;
  const arr = shadowProxy.instanceMatrix.array;
  for(const b of boxes){
    if(shN >= MAX_SHADOW_BOXES) return;
    const M = b.M, c = applyFn(M, b.c[0], b.c[1], b.c[2]), sx = b.s[0]*k, sy = b.s[1]*k, sz = b.s[2]*k, o = shN*16;
    // 列主序；Three 坐标 Y = -游戏 y
    arr[o]   = M[0]*sx; arr[o+1] = -M[3]*sx; arr[o+2]  = M[6]*sx; arr[o+3]  = 0;
    arr[o+4] = M[1]*sy; arr[o+5] = -M[4]*sy; arr[o+6]  = M[7]*sy; arr[o+7]  = 0;
    arr[o+8] = M[2]*sz; arr[o+9] = -M[5]*sz; arr[o+10] = M[8]*sz; arr[o+11] = 0;
    arr[o+12] = e.x + c[0]*k; arr[o+13] = -(e.y + c[1]*k); arr[o+14] = z0 + c[2]*k; arr[o+15] = 1;
    shN++;
  }
}
// 空闲时预生成各主题的 3D 资源，切层/换主题时不再卡顿
let warmQ = null;
function prewarm(){
  if(!init() || warmQ) return;
  warmQ = [];
  for(const [name, cfg] of Object.entries(THEME3D)){
    for(const f of cfg.floors) for(let sd=7; sd<10; sd++) warmQ.push(()=>assetParts(f[0], f[1], sd));
    for(let k=0;k<WALL_HEIGHTS.length;k++) warmQ.push(()=>wallParts(cfg.wall, k));
    for(const a of [...(cfg.obstacle||[]), ...(cfg.corner||[])]) for(let sd=7; sd<10; sd++) warmQ.push(()=>assetParts(a[0], a[1], sd));
    for(const a of [...(cfg.clutter||[])]) for(let sd=7; sd<10; sd++) warmQ.push(()=>assetParts(a[0], a[1], sd));
    for(const a of [...(cfg.wallDeco||[]), cfg.torch]) warmQ.push(()=>assetParts(a[0], a[1], 7));
  }
  const ric = window.requestIdleCallback || (cb => setTimeout(()=>cb({timeRemaining:()=>8}), 30));
  const step = dl => { while(warmQ.length && dl.timeRemaining() > 4) warmQ.shift()(); if(warmQ.length) ric(step); };
  ric(step);
}
function hide(){ if(glc) glc.style.visibility = 'hidden'; }
function hasOccluder(i,j){ return !!(tileExt && tileExt[j*builtGW+i]); }

function setShadows(v){ shadowsOn = !!v; if(world) world.traverse(n=>{ if(n.material) n.material.needsUpdate = true; }); for(const m of Object.values(mats||{})) m.needsUpdate = true; }
function diag(px, py){
  const o = {wlAlphaOK, lost:glLost, failed:!!glFailG, ok, vis: glc && glc.style.visibility, gl:'?', size: glc ? glc.width+'x'+glc.height : '-', PR, zoom:ZOOMc, actorRenderer:'canvas'};
  try { const g = renderer.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); o.gl = e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); o.ctxLost = g.isContextLost(); } catch(e){ o.gl = 'ERR '+e.message; }
  let n = 0, near = 0, nearV = 0, verts = 0;
  if(world) world.children.forEach(m => { if(!m.isMesh) return; n++; verts += m.geometry.attributes.position.count;
    const bb = m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox);
    if(bb.max.z < 0.6 && px >= bb.min.x-0.5 && px <= bb.max.x+0.5 && -py >= bb.min.y-0.5 && -py <= bb.max.y+0.5){ near++; if(m.visible) nearV++; } });
  o.meshes = n; o.verts = verts; o.floorNear = near + '/' + nearV; o.calls = renderer ? renderer.info.render.calls : 0; o.tris = renderer ? renderer.info.render.triangles : 0;
  return o;
}
window.World3D = {diag, init, decorate, frame, blit, hide, hasOccluder, setShadows, beginShadows, endShadows, pushShadow, prewarm, get glowSpots(){ return glowSpots; }, THEME3D, get ok(){ return ok; }};
})();
