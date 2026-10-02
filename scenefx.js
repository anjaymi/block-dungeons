// =====================================================================
//  SceneFX —— 场景氛围效果（2D 画布层，叠在 Three.js 场景之上）
//  under(dt)：光照遮罩之前绘制（会被黑暗遮罩压暗）—— 雾、灰尘、雪、沙
//  over()   ：光照遮罩之后、叠加混合（自发光）—— 光柱、余烬、火星、辉光(假 Bloom)
//  依赖游戏全局：ctx, P, VW, VH, cam, theme, G, GW, GH, idx, torches, SX, SY
//  全部使用预渲染精灵 + fillRect，每帧零渐变创建
// =====================================================================
(function(){
'use strict';

// ---------------- 主题配置 ----------------
const CFG = {
  '苔石地牢': { fog:[150,170,150], fogA:0.24, fogScale:1.0,
    parts:[{kind:'dust', n:112, col:[230,225,200]}],
    shafts:{n:0.018, col:[255,240,200], a:0.34}, glints:null },
  '幽深矿井': { fog:[150,130,110], fogA:0.22, fogScale:0.8,
    parts:[{kind:'dust', n:88, col:[220,200,170]}, {kind:'drip', n:7, col:[150,210,255]}],
    shafts:{n:0.011, col:[255,220,170], a:0.26}, glints:{col:[140,220,255], n:0.03} },
  '冰封洞窟': { fog:[200,225,255], fogA:0.38, fogScale:1.2,
    parts:[{kind:'snow', n:240, col:[240,248,255]}],
    shafts:{n:0.011, col:[200,230,255], a:0.26}, glints:{col:[210,240,255], n:0.06} },
  '下界要塞': { fog:[255,90,40], fogA:0.24, fogScale:0.9,
    parts:[{kind:'ember', n:112, col:[255,150,50]}, {kind:'ash', n:72, col:[90,80,80]}],
    shafts:null, glints:null },
  '沙海遗迹': { fog:[255,215,150], fogA:0.26, fogScale:1.4,
    parts:[{kind:'sand', n:176, col:[235,205,150]}],
    shafts:{n:0.022, col:[255,225,160], a:0.39}, glints:{col:[255,240,190], n:0.02} },
};
const FALLBACK = '苔石地牢';

// ---------------- 精灵缓存 ----------------
const sprites = new Map();
function radial(key, size, stops){
  let c = sprites.get(key); if(c) return c;
  c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  for(const [o,col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0,0,size,size); sprites.set(key, c); return c;
}
const glowSprite = (r,g,b) => radial(`g${r},${g},${b}`, 128, [[0,`rgba(${r},${g},${b},1)`],[0.25,`rgba(${r},${g},${b},.45)`],[1,`rgba(${r},${g},${b},0)`]]);
const dotSprite  = (r,g,b) => radial(`d${r},${g},${b}`, 32,  [[0,`rgba(${r},${g},${b},1)`],[0.4,`rgba(${r},${g},${b},.6)`],[1,`rgba(${r},${g},${b},0)`]]);
// 光柱：竖向渐变的梯形（顶部宽、底部落点椭圆）
function shaftSprite(r,g,b){
  const key = `s${r},${g},${b}`; let c = sprites.get(key); if(c) return c;
  c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const x = c.getContext('2d');
  const lg = x.createLinearGradient(0,0,0,512);
  lg.addColorStop(0,`rgba(${r},${g},${b},0)`); lg.addColorStop(0.35,`rgba(${r},${g},${b},.55)`); lg.addColorStop(0.92,`rgba(${r},${g},${b},.9)`); lg.addColorStop(1,`rgba(${r},${g},${b},0)`);
  x.fillStyle = lg; x.beginPath(); x.moveTo(8,0); x.lineTo(120,0); x.lineTo(92,512); x.lineTo(36,512); x.closePath(); x.fill();
  // 边缘柔化
  x.globalCompositeOperation = 'destination-in';
  const hg = x.createLinearGradient(0,0,128,0); hg.addColorStop(0,'rgba(0,0,0,0)'); hg.addColorStop(0.3,'rgba(0,0,0,1)'); hg.addColorStop(0.7,'rgba(0,0,0,1)'); hg.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle = hg; x.fillRect(0,0,128,512);
  sprites.set(key, c); return c;
}
// 可平铺的值噪声雾纹理（每个颜色一份）
function fogTex(rgb){
  const key = 'f'+rgb.join(','); let c = sprites.get(key); if(c) return c;
  const N = 256, cell = 32, gN = N/cell, grid = [];
  let sd = 1234567; const rr = () => (sd = (sd*16807) % 2147483647) / 2147483647;
  for(let k=0;k<gN*gN;k++) grid.push(rr());
  const at = (i,j) => grid[((j%gN+gN)%gN)*gN + ((i%gN+gN)%gN)];
  const sm = t => t*t*(3-2*t);
  const noise = (x,y,sc) => { const gx = x/sc, gy = y/sc, i = Math.floor(gx), j = Math.floor(gy), fx = sm(gx-i), fy = sm(gy-j);
    const a = at(i,j), b = at(i+1,j), c2 = at(i,j+1), d = at(i+1,j+1); return a + (b-a)*fx + (c2-a)*fy + (a-b-c2+d)*fx*fy; };
  c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), im = x.createImageData(N,N);
  for(let y=0;y<N;y++) for(let xx=0;xx<N;xx++){
    // 两个八度（第二八度用不同采样间隔以保持可平铺：cell/2 也整除 N）
    let v = noise(xx,y,cell)*0.65 + noise(xx*2+57,y*2+91,cell)*0.35;
    v = Math.max(0, Math.min(1, (v-0.35)*1.9));
    const o = (y*N+xx)*4; im.data[o] = rgb[0]; im.data[o+1] = rgb[1]; im.data[o+2] = rgb[2]; im.data[o+3] = v*255;
  }
  x.putImageData(im,0,0); sprites.set(key, c); return c;
}

// ---------------- 状态 ----------------
// 氛围强度：让参考图里的深色空间、漂浮尘粒和主题雾真正参与画面，而不是只剩一层滤镜。
const FOG_K = 0.58, DUST_K = 0.72, DUST_N = 0.82;
let builtFor = null, cfg = null, parts = [], shafts = [], glints = [], splashes = [], fogPat = null, fogCan = null;
const rnd = (a,b) => a + Math.random()*(b-a);
function viewBounds(){
  // 视野对应的世界坐标范围（含余量）
  return { x0: (-ox)/SX - 2, x1: (VW-ox)/SX + 2, y0: (-oy)/SY - 2, y1: (VH-oy)/SY + 4 };
}
function isFloor(i,j){ return i>=0 && j>=0 && i<GW && j<GH && G[idx(i,j)] !== 0; }
function newPart(kind, col, b, anywhere){
  const q = {kind, col, x:rnd(b.x0,b.x1), y:rnd(b.y0,b.y1), z:0, vx:0, vy:0, vz:0, life:0, max:1, ph:Math.random()*6.28, sz:1};
  switch(kind){
    case 'dust':  q.z = rnd(0.2,2.2); q.vx = rnd(-0.08,0.08); q.vy = rnd(-0.05,0.05); q.vz = rnd(-0.03,0.03); q.max = rnd(5,10); q.sz = rnd(1.2,2.4); break;
    case 'snow':  q.z = anywhere ? rnd(0,3.5) : rnd(3,3.6); q.vx = rnd(0.25,0.45); q.vy = rnd(0.05,0.2); q.vz = rnd(-0.7,-0.45); q.max = 9; q.sz = rnd(1.6,3.2); break;
    case 'ember': q.z = anywhere ? rnd(0,2.5) : rnd(0,0.3); q.vx = rnd(-0.15,0.15); q.vy = rnd(-0.1,0.1); q.vz = rnd(0.35,0.8); q.max = rnd(2.5,5); q.sz = rnd(1.5,3); break;
    case 'ash':   q.z = anywhere ? rnd(0,3) : rnd(2.5,3.2); q.vx = rnd(-0.1,0.2); q.vy = rnd(0,0.15); q.vz = rnd(-0.35,-0.15); q.max = 10; q.sz = rnd(1.5,2.5); break;
    case 'sand':  q.z = rnd(0.05,1.2); q.vx = rnd(1.4,2.6); q.vy = rnd(0.1,0.35); q.vz = rnd(-0.05,0.05); q.max = rnd(2,4); q.sz = rnd(1,2); if(!anywhere) q.x = b.x0 + rnd(0,1.5); break;
    case 'drip':  q.z = rnd(2.4,3); q.vz = 0; q.max = 99; q.wait = rnd(0, 3); break;
  }
  if(anywhere) q.life = Math.random()*q.max;
  return q;
}
function rebuild(){
  builtFor = G; cfg = CFG[theme && theme.name] || CFG[FALLBACK];
  parts = []; splashes = [];
  const b = viewBounds();
  for(const pc of cfg.parts) for(let n=0;n<(pc.kind==='dust' ? Math.round(pc.n*DUST_N) : pc.n);n++) parts.push(newPart(pc.kind, pc.col, b, true));
  // 光柱 / 地面闪光：按地图格子哈希固定位置（同一层稳定）
  shafts = []; glints = [];
  const H = (i,j,s) => { let h = Math.imul(i,374761393) ^ Math.imul(j,668265263) ^ Math.imul(s,1274126177); h = Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
  for(let j=1;j<GH-1;j++) for(let i=1;i<GW-1;i++){
    if(!isFloor(i,j)) continue;
    if(cfg.shafts && H(i,j,77) < cfg.shafts.n && isFloor(i+1,j) && isFloor(i,j+1) && isFloor(i-1,j)) shafts.push({x:i+0.5, y:j+0.5, ph:H(i,j,78)*6.28, w:0.9 + H(i,j,79)*0.8});
    if(cfg.glints && H(i,j,88) < cfg.glints.n) glints.push({x:i+H(i,j,89), y:j+H(i,j,90), ph:H(i,j,91)*6.28, sp:1.5 + H(i,j,92)*2});
  }
  fogCan = fogTex(cfg.fog); fogPat = ctx.createPattern(fogCan, 'repeat');
}

// ---------------- 更新 + 绘制 ----------------
let last = performance.now();
function under(){
  if(!G) return;
  if(builtFor !== G) rebuild();
  const now = performance.now(), dt = Math.min(0.05, (now - last)/1000); last = now;
  const t = now/1000, b = viewBounds();

  // 2) 非发光粒子（灰尘/雪/沙/灰烬/水滴）
  for(let n=0;n<parts.length;n++){
    let q = parts[n];
    q.life += dt;
    if(q.kind === 'drip'){
      if(q.wait > 0){ q.wait -= dt; if(q.wait <= 0){ q.z = rnd(2.4,3); q.vz = 0; } }
      else { q.vz -= 9.8*dt; q.z += q.vz*dt; if(q.z <= 0){ splashes.push({x:q.x, y:q.y, t:0, col:q.col}); parts[n] = q = newPart('drip', q.col, b, false); q.wait = rnd(0.5, 3); } }
    } else {
      q.x += q.vx*dt; q.y += q.vy*dt; q.z += q.vz*dt;
      if(q.kind === 'dust'){ q.vx += Math.sin(t*0.7 + q.ph)*0.02*dt; q.vz += Math.cos(t*0.9 + q.ph)*0.02*dt; }
      if(q.kind === 'snow' || q.kind === 'ash'){ q.x += Math.sin(t*1.3 + q.ph)*0.15*dt; }
    }
    const out = q.x < b.x0-1 || q.x > b.x1+1 || q.y < b.y0-1 || q.y > b.y1+1;
    if(out || q.life > q.max || q.z < -0.05 || q.z > 4){ if(q.kind !== 'ember' && q.kind !== 'drip'){ parts[n] = newPart(q.kind, q.col, b, q.kind==='dust'); } else if(q.kind==='ember'){ parts[n] = newPart('ember', q.col, b, false); } continue; }
    if(q.kind === 'ember') continue;          // 余烬在 over() 中叠加绘制
    if(q.kind === 'drip' && q.wait > 0) continue;
    const s = P(q.x, q.y, q.z), u = q.life/q.max;
    if(s[0] < -10 || s[0] > VW+10 || s[1] < -10 || s[1] > VH+10) continue;
    const fade = Math.min(1, q.life*2, (q.max - q.life)*1.5);
    const [r,g,bl] = q.col;
    if(q.kind === 'sand'){ ctx.strokeStyle = `rgba(${r},${g},${bl},${0.7*fade})`; ctx.lineWidth = q.sz*1.6; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[0] - q.vx*12, s[1] - q.vy*8); ctx.stroke(); continue; }
    if(q.kind === 'drip'){ ctx.fillStyle = `rgba(${r},${g},${bl},.8)`; ctx.fillRect(s[0]-1, s[1]-4, 2, 6); continue; }
    const a = q.kind==='dust' ? 0.7*DUST_K*fade*(0.6+0.4*Math.sin(t*2+q.ph)) : q.kind==='snow' ? 0.85*fade : 0.6*fade;
    ctx.fillStyle = `rgba(${r},${g},${bl},${a})`;
    const z = q.sz*2; ctx.fillRect(s[0]-z/2, s[1]-z/2, z, z);
    if(q.kind === 'snow'){ const sh = P(q.x, q.y, 0); ctx.fillStyle = `rgba(0,0,0,${0.08*fade})`; ctx.fillRect(sh[0]-z/2, sh[1]-z/4, z, z/2); }
  }
  // 水滴溅射
  for(let n=splashes.length-1;n>=0;n--){
    const sp = splashes[n]; sp.t += dt; if(sp.t > 0.45){ splashes.splice(n,1); continue; }
    const s = P(sp.x, sp.y, 0), u = sp.t/0.45, [r,g,bl] = sp.col;
    ctx.strokeStyle = `rgba(${r},${g},${bl},${0.7*(1-u)})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(s[0], s[1], 3 + u*12, (3 + u*12)*0.55, 0, 0, 7); ctx.stroke();
  }
}

function over(){
  if(!G || !cfg) return;
  const t = performance.now()/1000, b = viewBounds();
  {
  // 1) 漂浮雾（两层不同速度，锚定世界坐标 → 随镜头视差）
  if(fogPat){
    const sc = cfg.fogScale;
    for(let L=0; L<2; L++){
      const s = sc*(L ? 1.7 : 1.0), spd = L ? 9 : 5;
      const offX = (ox*(L ? 0.9 : 0.75) + t*spd) % (256*s), offY = (oy*(L ? 0.9 : 0.75) + t*spd*0.35) % (256*s);
      ctx.save(); ctx.globalAlpha = cfg.fogA*FOG_K*(L ? 0.6 : 1)*(0.85 + 0.15*Math.sin(t*0.4 + L));
      ctx.translate(offX, offY); ctx.scale(s, s);
      ctx.fillStyle = fogPat; ctx.fillRect(-offX/s - 256, -offY/s - 256, VW/s + 512, VH/s + 512);
      ctx.restore();
    }
  }

  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';

  // 1) 光柱（天顶裂缝透下的光，内含缓慢闪烁）
  if(cfg.shafts){
    const [r,g,bl] = cfg.shafts.col, spr = shaftSprite(r,g,bl);
    for(const sh of shafts){
      if(sh.x < b.x0 || sh.x > b.x1 || sh.y < b.y0 || sh.y > b.y1) continue;
      const base = P(sh.x, sh.y, 0), top = P(sh.x - 0.9, sh.y - 0.4, 6);
      const w = SX*1.3*sh.w, h = base[1] - top[1];
      ctx.globalAlpha = cfg.shafts.a*(0.75 + 0.25*Math.sin(t*0.8 + sh.ph));
      ctx.save(); ctx.translate(base[0], base[1]); ctx.rotate(Math.atan2(base[0]-top[0], h)*-1);
      ctx.drawImage(spr, -w/2, -h, w, h); ctx.restore();
      // 落点光斑
      const gs = glowSprite(r,g,bl); ctx.globalAlpha *= 0.9; ctx.drawImage(gs, base[0]-w*0.7, base[1]-w*0.35, w*1.4, w*0.7);
    }
  }

  // 2) 发光物辉光（岩浆晶体、火盆、水晶 … 来自 World3D.glowSpots）
  const spots = window.World3D && World3D.glowSpots;
  if(spots && spots.length){
    for(const sp of spots){
      if(sp.x < b.x0 || sp.x > b.x1 || sp.y < b.y0 || sp.y > b.y1) continue;
      const s = P(sp.x, sp.y, sp.z), R = SX*sp.r*(1 + 0.08*Math.sin(t*2.1 + sp.ph));
      const c = sp.col, spr = glowSprite((c[0]*255)|0, (c[1]*255)|0, (c[2]*255)|0);
      ctx.globalAlpha = 0.55 + 0.12*Math.sin(t*1.7 + sp.ph);
      ctx.drawImage(spr, s[0]-R, s[1]-R, R*2, R*2);
    }
  }

  // 3) 火把火星（每个可见火把周期性冒出）
  if(typeof torches !== 'undefined'){
    const spr = dotSprite(255,170,70);
    for(const tc of torches){
      const s0 = P(tc.x, tc.y, 0.7); if(s0[0] < -40 || s0[0] > VW+40 || s0[1] < -60 || s0[1] > VH+40) continue;
      for(let k=0;k<3;k++){
        const u = ((t*0.7 + k/3 + tc.ph*0.17) % 1), sx = Math.sin((t*0.7 + k/3)*9 + tc.ph + k)*5*u;
        ctx.globalAlpha = (1-u)*0.9;
        const z = 3*(1-u) + 1.5; ctx.drawImage(spr, s0[0] + sx - z, s0[1] - u*34 - z, z*2, z*2);
      }
    }
  }

  // 4) 余烬（下界）
  for(const q of parts){
    if(q.kind !== 'ember') continue;
    const s = P(q.x + Math.sin(t*2 + q.ph)*0.15, q.y, q.z); if(s[0] < -10 || s[0] > VW+10 || s[1] < -10 || s[1] > VH+10) continue;
    const fade = Math.min(1, q.life*3, (q.max - q.life)*0.8), fl = 0.7 + 0.3*Math.sin(t*12 + q.ph*5);
    ctx.globalAlpha = fade*fl; const z = q.sz*3.6;
    ctx.drawImage(dotSprite(255, 120 + ((q.ph*20)|0), 40), s[0]-z, s[1]-z, z*2, z*2);
  }

  // 5) 地面闪光（冰晶 / 矿石 / 沙中云母）
  if(cfg.glints){
    const [r,g,bl] = cfg.glints.col, spr = dotSprite(r,g,bl);
    for(const gl of glints){
      if(gl.x < b.x0 || gl.x > b.x1 || gl.y < b.y0 || gl.y > b.y1) continue;
      const v = Math.sin(t*gl.sp + gl.ph); if(v < 0.85) continue;
      const a = (v - 0.85)/0.15, s = P(gl.x, gl.y, 0.02), z = 2 + a*4;
      ctx.globalAlpha = a; ctx.drawImage(spr, s[0]-z, s[1]-z, z*2, z*2);
      ctx.fillStyle = `rgba(${r},${g},${bl},${a*0.8})`; ctx.fillRect(s[0]-z*1.6, s[1]-0.5, z*3.2, 1); ctx.fillRect(s[0]-0.5, s[1]-z*1.6, 1, z*3.2);
    }
  }
  ctx.restore();
}

window.SceneFX = { under, over, glowSprite, radial };
})();
