// =====================================================================
//  UIK —— 方块像素风 UI 组件（Canvas 2D）
//  风格：MC 式斜面（亮边左上 / 暗边右下）+ 缺角黑描边，暗石配色 + 金色强调
//  所有坐标会取整到像素，保证边缘锐利。依赖全局 ctx（运行时读取）。
// =====================================================================
(function(){
'use strict';
const C = {
  face:'#2a2a32', face2:'#33333d', hi:'#5a5a66', hi2:'#7a7a88', lo:'#131318', ink:'#07070a',
  slot:'#17171c', slotLo:'#0d0d10', slotHi:'#45454f',
  gold:'#ffd75e', goldD:'#a87a24', text:'#efeadc', dim:'#9c98aa', mute:'#6c6878',
  hp:'#e8463c', hpHi:'#ff8a6e', hpLo:'#8e1c18',
  mp:'#7a62ff', mpHi:'#b0a0ff', mpLo:'#3a2a9a',
  st:'#ffcc3a', stHi:'#fff0a0', stLo:'#a07810',
  soul:'#4ad8ff', soulHi:'#b0f0ff', soulLo:'#167a9a',
  xp:'#7ce050', xpHi:'#c8ffa0', xpLo:'#3a7a20',
};
const FONT = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC","Source Han Sans SC",sans-serif';
const R = Math.round;

// ---------- 斜面块 ----------
// o.inset: 内凹（格子）；o.face: 面色；o.alpha；o.outline: 缺角黑描边（默认开）；o.b: 斜面宽
function bevel(x, y, w, h, o = {}){
  x = R(x); y = R(y); w = R(w); h = R(h);
  const b = o.b ?? 2, a0 = ctx.globalAlpha;
  if(o.alpha !== undefined) ctx.globalAlpha = a0*o.alpha;
  if(o.outline !== false){
    ctx.fillStyle = C.ink;
    ctx.fillRect(x, y-b, w, b); ctx.fillRect(x, y+h, w, b);       // 上下
    ctx.fillRect(x-b, y, b, h); ctx.fillRect(x+w, y, b, h);       // 左右（四角留空 = 像素圆角）
  }
  ctx.fillStyle = o.face || (o.inset ? C.slot : C.face); ctx.fillRect(x, y, w, h);
  const tl = o.inset ? (o.lo || C.slotLo) : (o.hi || C.hi), br = o.inset ? (o.hi || C.slotHi) : (o.lo || C.lo);
  ctx.fillStyle = tl; ctx.fillRect(x, y, w, b); ctx.fillRect(x, y, b, h);
  ctx.fillStyle = br; ctx.fillRect(x, y+h-b, w, b); ctx.fillRect(x+w-b, y, b, h);
  ctx.globalAlpha = a0;
}

// ---------- 文字（硬阴影）----------
function text(s, x, y, size = 14, col = C.text, align = 'left', o = {}){
  ctx.font = `${o.weight || 'bold'} ${size}px ${o.font || FONT}`;
  ctx.textAlign = align; ctx.textBaseline = o.base || 'middle';
  const sh = o.shadow ?? Math.max(1, R(size/9));
  if(sh){ ctx.fillStyle = o.shadowCol || 'rgba(0,0,0,.85)'; ctx.fillText(s, R(x)+sh, R(y)+sh); }
  ctx.fillStyle = col; ctx.fillText(s, R(x), R(y));
}
function measure(s, size = 14, weight = 'bold'){ ctx.font = `${weight} ${size}px ${FONT}`; return ctx.measureText(s).width; }

// ---------- 面板（可带标题条）----------
function panel(x, y, w, h, o = {}){
  bevel(x, y, w, h, {alpha: o.alpha ?? 0.94, face: o.face});
  // 面板内缘高光：让半透明石板在不同主题背景上仍有清晰的材质边界。
  ctx.save(); ctx.globalAlpha = (o.alpha ?? 0.94) * 0.58;
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
  ctx.strokeRect(R(x)+3.5, R(y)+3.5, Math.max(0,R(w)-7), Math.max(0,R(h)-7));
  ctx.restore();
  // 金属框四角铆钉：补足参考图里强烈的金色边框与装备感。
  ctx.save(); ctx.globalAlpha = (o.alpha ?? 0.94) * 0.9; ctx.fillStyle = '#d99b3d';
  const rr = Math.max(3, Math.min(5, R(Math.min(w,h)*.045)));
  for(const p of [[R(x)+6,R(y)+6],[R(x+w)-6,R(y)+6],[R(x)+6,R(y+h)-6],[R(x+w)-6,R(y+h)-6]]){
    ctx.beginPath(); ctx.moveTo(p[0],p[1]-rr); ctx.lineTo(p[0]+rr,p[1]); ctx.lineTo(p[0],p[1]+rr); ctx.lineTo(p[0]-rr,p[1]); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if(o.title){
    const th = o.th || 26;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(R(x)+2, R(y)+2, R(w)-4, th);
    ctx.fillStyle = C.goldD; ctx.fillRect(R(x)+2, R(y)+2+th, R(w)-4, 2);
    text(o.title, x + w/2, y + 2 + th/2 + 1, o.ts || 15, C.gold, 'center');
  }
}

// ---------- 图标格 ----------
// o: {icon, key, cd(0..1), cdText, col(就绪边框色), disabled, active, count, size(图标字号)}
function slot(x, y, s, o = {}){
  x = R(x); y = R(y);
  bevel(x, y, s, s, {inset:true, alpha:o.alpha ?? 0.96});
  if(o.active){ ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.strokeRect(x+1, y+1, s-2, s-2); }
  else if(o.col && !(o.cd > 0) && !o.disabled){
    ctx.fillStyle = o.col; ctx.globalAlpha = 0.9; ctx.fillRect(x+2, y+s-4, s-4, 2);
    ctx.globalAlpha = 0.42; ctx.strokeStyle = o.col; ctx.lineWidth = 1; ctx.strokeRect(x+2.5, y+2.5, s-5, s-5); ctx.globalAlpha = 1;
  }
  if(o.icon){
    ctx.globalAlpha = o.disabled ? 0.35 : 1;
    ctx.font = `${o.size || R(s*0.52)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(o.icon, x + s/2, y + s/2 + 1); ctx.globalAlpha = 1;
  }
  if(o.cd > 0){
    const hh = R((s-4)*Math.min(1, o.cd));
    ctx.fillStyle = 'rgba(0,0,0,.68)'; ctx.fillRect(x+2, y+2 + (s-4-hh), s-4, hh);
    if(o.cdText) text(o.cdText, x + s/2, y + s/2 + 1, R(s*0.34), '#fff', 'center');
  }
  if(o.key){
    const kw = Math.max(13, R(measure(o.key, 10)) + 6);
    ctx.fillStyle = C.ink; ctx.fillRect(x-1, y-1, kw+1, 14);
    ctx.fillStyle = o.disabled ? C.mute : C.gold; ctx.fillRect(x, y, kw, 13);
    text(o.key, x + kw/2, y + 7, 10, C.ink, 'center', {shadow:0});
  }
  if(o.count !== undefined && o.count !== null) text(String(o.count), x + s - 4, y + s - 9, 12, '#fff', 'right');
}

// ---------- 数值条 ----------
// o: {col, hi, lo, ghost(残影比例), seg(分段数), icon, iconCol, label(左内), value(右内), flash}
function bar(x, y, w, h, frac, o = {}){
  x = R(x); y = R(y); w = R(w); h = R(h);
  bevel(x, y, w, h, {inset:true, alpha:0.95, b: h >= 10 ? 2 : 1});
  const ix = x+2, iy = y+2, iw = w-4, ih = h-4; if(iw <= 0 || ih <= 0) return;
  if(o.ghost !== undefined && o.ghost > frac){ ctx.fillStyle = 'rgba(255,240,220,.55)'; ctx.fillRect(ix, iy, R(iw*Math.min(1,o.ghost)), ih); }
  const fw = R(iw*clamp01(frac));
  if(fw > 0){
    ctx.fillStyle = o.col || C.hp; ctx.fillRect(ix, iy, fw, ih);
    const hs = Math.max(1, R(ih*0.34));
    ctx.fillStyle = o.hi || C.hpHi; ctx.fillRect(ix, iy, fw, hs);
    ctx.fillStyle = o.lo || C.hpLo; ctx.fillRect(ix, iy+ih-Math.max(1,R(ih*0.22)), fw, Math.max(1,R(ih*0.22)));
    if(o.flash){ ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(ix, iy, fw, ih); }
  }
  if(o.seg > 1){ ctx.fillStyle = 'rgba(0,0,0,.4)'; for(let k=1;k<o.seg;k++) ctx.fillRect(ix + R(iw*k/o.seg), iy, 1, ih); }
  if(o.mark !== undefined){ ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(ix + R(iw*o.mark), iy-1, 1, ih+2); }
  const ts = o.ts || Math.max(9, Math.min(14, ih + 1));
  if(o.label) text(o.label, ix + 5, y + h/2 + 1, ts, '#fff', 'left');
  if(o.value) text(o.value, ix + iw - 5, y + h/2 + 1, ts, '#fff', 'right');
  if(o.icon){
    const s = h + 6, bx = x - s - 4, by = y + h/2 - s/2;
    bevel(bx, by, s, s, {inset:true, alpha:0.95});
    ctx.font = `${R(s*0.62)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = o.iconCol || '#fff';
    ctx.fillText(o.icon, bx + s/2, by + s/2 + 1);
  }
}
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// ---------- 按钮 ----------
function button(x, y, w, h, label, o = {}){
  const face = o.primary ? (o.hover ? '#d8a43a' : '#b8862e') : (o.hover ? C.face2 : C.face);
  bevel(x, y, w, h, {face, hi: o.primary ? '#ffe08a' : C.hi2, lo: o.primary ? '#6a4a10' : C.lo});
  if(o.hover && !o.primary){ ctx.strokeStyle = C.gold; ctx.lineWidth = 1; ctx.strokeRect(R(x)+2.5, R(y)+2.5, R(w)-5, R(h)-5); }
  text(label, x + w/2, y + h/2 + 1, o.size || 14, o.primary ? '#1a1206' : (o.col || C.text), 'center', {shadow: o.primary ? 0 : undefined});
}

// ---------- 状态小签（返回宽度）----------
function chip(x, y, label, o = {}){
  const size = o.size || 12, w = R(measure(label, size)) + (o.icon ? size + 16 : 14), h = size + 10;
  const X = o.align === 'center' ? x - w/2 : o.align === 'right' ? x - w : x;
  bevel(X, y, w, h, {alpha:0.92, face: o.face});
  if(o.col){ ctx.fillStyle = o.col; ctx.fillRect(R(X)+2, R(y)+2, 3, h-4); }
  let tx = X + 9;
  if(o.icon){ ctx.font = `${size+1}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(o.icon, R(tx), R(y + h/2 + 1)); tx += size + 6; }
  text(label, tx, y + h/2 + 1, size, o.textCol || C.text, 'left');
  return w;
}

// ---------- 像素道具图标（12×12 像素图，按材质/品质着色）----------
// o 描边 · h 高光 · m 主色 · s 暗部 · a 点缀（品质色/宝石）
const ICON = {
  helm:  ['............','...oooooo...','..ohhhhhmo..','.ohmmmmmmso.','.ohmmmmmmso.','.omaaaaaaao.','.omsoooosmo.','.oms....smo.','.oso....oso.','..o......o..','............','............'],
  armor: ['.oo......oo.','ohmo....omso','ohmmoooommso','.ohmmmmmmso.','..ohmmmmso..','..ohmamaso..','..ohmmmmso..','..ohmamaso..','..ohmmmmso..','..osssssso..','..oooooooo..','............'],
  gloves:['............','..o.o.o.....','.ohohohoo...','.ohmhmhmo...','.ohmmmmmoo..','.ohmmmmmhmo.','.ohmmmmmmso.','.ohmmmmmso..','.oaaaaaao...','.ossssso....','.oooooooo...','............'],
  boots: ['............','...ooooo....','...ohmmo....','...ohmmo....','...ohmmo....','...ohmmo....','...oaaao....','...ohmmmooo.','..ohmmmmmmso','..ohmmmmmmso','..oooooooooo','............'],
  belt:  ['............','............','............','oooooooooooo','hmmmmoaaommm','mmmmmoa.ommm','sssssoaaosss','oooooooooooo','............','............','............','............'],
  ring:  ['............','....oaao....','...oaaaao...','....oaao....','...ohmmso...','..oho..oso..','..om....so..','..om....so..','..oso..oso..','...osssso...','....oooo....','............'],
  amulet:['o..........o','.o........o.','..o......o..','...o....o...','....o..o....','.....oo.....','....ohho....','...ohaaso...','...oaaaso...','....osso....','.....oo.....','............'],
  shield:['.oooooooooo.','.ohhhhhhhmo.','.ohmmammmso.','.ohmmammmso.','.ohaaaaaaso.','.ohmmammmso.','.ohmmammmso.','..ohmammso..','..ohmmmmso..','...ohmmso...','....osso....','.....oo.....'],
  charm: ['....oooo....','...o....o...','....oooo....','...ohhmmo...','..ohmaamso..','..ohaaaaso..','..ohmaamso..','..ohmmmmso..','..ohmaamso..','...osssso...','....oooo....','............'],
  gem:   ['............','.....oo.....','....ohho....','...ohhmmo...','..ohhmmmso..','.ohmmmmmsso.','.ommmmmssso.','..ommmssso..','...omssso...','....osso....','.....oo.....','............'],
};
const MAT = [ // 皮革 · 铁 · 金 · 钻石 · 下界合金
  {m:'#9a6a3c', h:'#c89a64', s:'#5e3a1c'}, {m:'#a8adb5', h:'#e6eaf0', s:'#666a74'}, {m:'#e0b040', h:'#fff0a0', s:'#9a6a10'},
  {m:'#46d4cc', h:'#b8fff8', s:'#1a8682'}, {m:'#4e444c', h:'#857882', s:'#2a2228'}];
const QACC = {inferior:'#6a6a6a', normal:'#9a9aa2', superior:'#d8d8e0', magic:'#6a7aff', rare:'#ffe050', set:'#40e040', unique:'#e0a850', runeword:'#e0a850'};
function shade(hex, f){ const n = parseInt(hex.slice(1),16); const c = [n>>16, (n>>8)&255, n&255].map(v=>Math.max(0,Math.min(255,Math.round(f>1 ? v+(255-v)*(f-1) : v*f)))); return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join(''); }
// o: {tier, q, col(主色覆盖，如宝石色), acc}
function itemIcon(type, x, y, w, h, o = {}){
  const map = ICON[type]; if(!map) return false;
  let pal;
  if(o.col) pal = {m:o.col, h:shade(o.col,1.55), s:shade(o.col,0.55)};
  else if(type==='ring' || type==='amulet') pal = MAT[2];
  else if(type==='belt') pal = MAT[0];
  else if(type==='charm') pal = {m:'#8a7a5a', h:'#c8b890', s:'#4a3e2a'};
  else pal = MAT[Math.max(0, Math.min(4, o.tier|0))];
  const P = {o:'#0a0a0e', h:pal.h, m:pal.m, s:pal.s, a: o.acc || QACC[o.q] || '#c8c8c8'};
  if(type==='ring' || type==='amulet'){ P.a = o.acc || (o.q==='normal'||o.q==='inferior'||o.q==='superior' ? '#e84a4a' : QACC[o.q]); }
  const px = Math.max(1, Math.floor(Math.min(w, h)*0.82/12)), ox = Math.round(x + (w - px*12)/2), oy = Math.round(y + (h - px*12)/2);
  for(let r=0;r<12;r++){ const row = map[r]; for(let c=0;c<12;c++){ const k = row[c]; if(k==='.' || k===' ' || !P[k]) continue; ctx.fillStyle = P[k]; ctx.fillRect(ox + c*px, oy + r*px, px, px); } }
  return true;
}

window.UIK = {C, FONT, bevel, text, measure, panel, slot, bar, button, chip, itemIcon, shade, QACC};
})();

