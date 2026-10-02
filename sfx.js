// =====================================================================
//  方块地牢 · 合成音效（Web Audio，零素材）
//  在主脚本之后加载：包装全局函数挂接音效，不修改游戏逻辑
// =====================================================================
(function(){
'use strict';
const SFX = window.SFX = { vol: +(localStorage.getItem('bd_vol') ?? 0.6), muted: localStorage.getItem('bd_mute') === '1' };
let ac = null, master = null, comp = null, noiseBuf = null;
const last = {};                    // 同类音效节流
function init(){
  if(ac) return ac.state === 'suspended' && ac.resume();
  const C = window.AudioContext || window.webkitAudioContext; if(!C) return;
  ac = new C();
  comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
  master = ac.createGain(); master.gain.value = SFX.muted ? 0 : SFX.vol;
  master.connect(comp); comp.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
}
['pointerdown','keydown','touchstart'].forEach(ev => addEventListener(ev, init, {capture:true}));
SFX.setVol = v => { SFX.vol = Math.max(0, Math.min(1, v)); localStorage.setItem('bd_vol', SFX.vol); if(master && !SFX.muted) master.gain.value = SFX.vol; };
SFX.toggle = () => { SFX.muted = !SFX.muted; localStorage.setItem('bd_mute', SFX.muted ? '1' : '0'); if(master) master.gain.value = SFX.muted ? 0 : SFX.vol; return SFX.muted; };

// ---------- 基础发声单元 ----------
const R = (a,b) => a + Math.random()*(b-a);
function env(g, t, a, peak, dec){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function pan(node, x){   // 根据相对玩家的位置左右声像
  if(x === undefined || !ac.createStereoPanner) return node;
  const p = ac.createStereoPanner(); p.pan.value = Math.max(-0.8, Math.min(0.8, x)); node.connect(p); return p;
}
function out(node, vol, px){ const g = ac.createGain(); g.gain.value = vol; node.connect(g); pan(g, px).connect(master); }
function tone({type='sine', f=440, f2, dur=0.15, a=0.005, vol=0.3, t=0, px, det=0}){
  const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + t;
  o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = det;
  if(f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + a + dur);
  env(g, t0, a, 1, dur); o.connect(g); out(g, vol, px); o.start(t0); o.stop(t0 + a + dur + 0.05);
}
function noise({dur=0.12, a=0.003, vol=0.3, t=0, type='bandpass', f=1200, f2, q=1, px}){
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), t0 = ac.currentTime + t;
  s.buffer = noiseBuf; s.playbackRate.value = R(0.8, 1.2);
  fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t0); if(f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + a + dur);
  env(g, t0, a, 1, dur); s.connect(fl); fl.connect(g); out(g, vol, px); s.start(t0, Math.random()*0.5); s.stop(t0 + a + dur + 0.05);
}
function ok(name, gap){ const now = performance.now(); if(last[name] && now - last[name] < gap) return false; last[name] = now; return true; }
function relX(x){ try{ return x === undefined || typeof player === 'undefined' || !player ? undefined : (x - player.x) / 8; }catch(e){ return undefined; } }
function ready(){ return ac && master && ac.state === 'running'; }

// ---------- 音效库 ----------
const S = SFX.lib = {
  swing(kind){ if(!ok('swing', 40)) return;
    const heavy = /greatsword|claymore|hammer|axe/.test(kind), fast = /dagger|fist/.test(kind);
    noise({dur: heavy ? 0.22 : fast ? 0.07 : 0.13, a: heavy ? 0.04 : 0.01, vol: heavy ? 0.32 : 0.22, f: heavy ? 500 : fast ? 2600 : 1400, f2: heavy ? 1600 : fast ? 4200 : 3000, q: 1.4}); },
  hit(px, crit, heavy){ if(!ok('hit', 28)) return;
    noise({dur:0.06, vol:0.45, type:'lowpass', f: heavy ? 1400 : 2600, px});
    tone({type:'square', f: heavy ? 120 : 190, f2: 50, dur: heavy ? 0.14 : 0.08, vol: heavy ? 0.3 : 0.2, px});
    if(crit){ tone({type:'triangle', f:1500, f2:900, dur:0.12, vol:0.16, t:0.01, px}); noise({dur:0.1, vol:0.2, f:5000, q:3, t:0.01, px}); } },
  backstab(px){ tone({type:'sawtooth', f:900, f2:2400, dur:0.08, vol:0.12, px}); noise({dur:0.14, vol:0.3, f:3800, f2:1200, q:2, px}); },
  execute(px){ tone({type:'square', f:220, f2:55, dur:0.3, vol:0.3, px}); noise({dur:0.3, vol:0.4, type:'lowpass', f:900, f2:200, px}); tone({type:'triangle', f:1200, f2:400, dur:0.2, vol:0.12, t:0.03, px}); },
  kill(px, big){ if(!ok('kill', 40)) return;
    noise({dur: big ? 0.5 : 0.18, vol: big ? 0.45 : 0.25, type:'lowpass', f: big ? 900 : 1600, f2: 150, px});
    tone({type:'square', f: big ? 160 : 300, f2: big ? 40 : 90, dur: big ? 0.4 : 0.14, vol:0.16, px}); },
  hurt(){ if(!ok('hurt', 120)) return; tone({type:'sawtooth', f:260, f2:90, dur:0.18, vol:0.26}); noise({dur:0.12, vol:0.3, type:'lowpass', f:800}); },
  shieldHit(){ if(!ok('shh', 80)) return; tone({type:'sine', f:1400, f2:700, dur:0.18, vol:0.18}); tone({type:'triangle', f:2100, f2:1200, dur:0.12, vol:0.1}); },
  block(){ if(!ok('blk', 60)) return; tone({type:'square', f:900, f2:600, dur:0.06, vol:0.18}); noise({dur:0.08, vol:0.3, f:3500, q:4}); },
  death(){ tone({type:'sawtooth', f:300, f2:40, dur:1.2, vol:0.3}); tone({type:'sine', f:150, f2:30, dur:1.4, vol:0.3, t:0.1}); },
  roll(){ if(!ok('roll', 80)) return; noise({dur:0.2, a:0.03, vol:0.18, type:'lowpass', f:700, f2:300}); },
  dash(){ noise({dur:0.2, a:0.01, vol:0.25, f:800, f2:3000, q:1.2}); },
  jump(){ tone({type:'square', f:220, f2:420, dur:0.08, vol:0.08}); },
  bowDraw(){ tone({type:'triangle', f:180, f2:260, dur:0.35, a:0.05, vol:0.06}); },
  bow(full){ tone({type:'triangle', f: full ? 520 : 400, f2: 160, dur:0.1, vol:0.2}); noise({dur:0.14, vol:0.2, f:2500, f2:5000, q:2}); },
  staff(){ tone({type:'sine', f:700, f2:1300, dur:0.12, vol:0.12}); tone({type:'triangle', f:1050, f2:1800, dur:0.1, vol:0.06, t:0.02}); },
  fireball(){ noise({dur:0.35, a:0.02, vol:0.35, type:'lowpass', f:400, f2:1500}); tone({type:'sawtooth', f:110, f2:220, dur:0.3, vol:0.1}); },
  frost(){ for(let i=0;i<4;i++) tone({type:'sine', f:R(1800,3200), f2:R(900,1400), dur:0.25, vol:0.07, t:i*0.03}); noise({dur:0.4, vol:0.2, type:'highpass', f:4000}); },
  zap(px){ if(!ok('zap', 50)) return; noise({dur:0.15, vol:0.25, f:3000, q:0.6, px}); tone({type:'sawtooth', f:R(700,1100), f2:200, dur:0.12, vol:0.12, px}); },
  boom(px, big){ if(!ok('boom', 60)) return;
    noise({dur: big ? 0.9 : 0.5, a:0.005, vol: big ? 0.7 : 0.5, type:'lowpass', f: big ? 1200 : 1800, f2: 80, px});
    tone({type:'sine', f: big ? 90 : 130, f2: 30, dur: big ? 0.8 : 0.4, vol: big ? 0.6 : 0.4, px}); },
  missile(){ if(!ok('mis', 45)) return; tone({type:'sine', f:R(900,1200), f2:R(1600,2000), dur:0.09, vol:0.09}); tone({type:'triangle', f:600, f2:1200, dur:0.06, vol:0.05}); },
  shieldUp(){ [523,659,784,1047].forEach((f,i)=>tone({type:'sine', f, dur:0.5, a:0.02, vol:0.08, t:i*0.04})); noise({dur:0.5, a:0.1, vol:0.12, type:'highpass', f:3000}); },
  shieldBreak(){ for(let i=0;i<6;i++) tone({type:'triangle', f:R(1500,3000), f2:R(400,800), dur:0.2, vol:0.08, t:i*0.02}); noise({dur:0.3, vol:0.3, f:4000, q:1}); },
  meteorCast(){ tone({type:'sawtooth', f:80, f2:300, dur:0.5, a:0.1, vol:0.12}); },
  meteorFall(px){ noise({dur:0.75, a:0.5, vol:0.3, f:300, f2:2500, q:0.8, px}); },
  blink(){ tone({type:'sine', f:1600, f2:400, dur:0.18, vol:0.14}); noise({dur:0.2, vol:0.2, type:'highpass', f:5000}); },
  skill(){ tone({type:'square', f:330, f2:660, dur:0.15, vol:0.12}); noise({dur:0.25, vol:0.2, f:1500, f2:400}); },
  potion(){ for(let i=0;i<4;i++) tone({type:'sine', f:R(300,600), f2:R(700,1000), dur:0.06, vol:0.1, t:i*0.06}); tone({type:'sine', f:880, dur:0.25, vol:0.08, t:0.25}); },
  coin(){ if(!ok('coin', 50)) return; tone({type:'square', f:988, dur:0.05, vol:0.08}); tone({type:'square', f:1319, dur:0.12, vol:0.08, t:0.05}); },
  pickup(){ tone({type:'triangle', f:440, f2:880, dur:0.12, vol:0.14}); },
  chest(){ noise({dur:0.15, vol:0.25, type:'lowpass', f:600}); [523,659,784,1047,1319].forEach((f,i)=>tone({type:'square', f, dur:0.1, vol:0.06, t:0.12+i*0.06})); },
  crate(px){ if(!ok('crate', 50)) return; noise({dur:0.18, vol:0.4, type:'lowpass', f:900, f2:200, px}); tone({type:'square', f:140, f2:60, dur:0.1, vol:0.14, px}); },
  levelUp(){ [392,523,659,784,1047].forEach((f,i)=>{ tone({type:'square', f, dur:0.18, vol:0.08, t:i*0.08}); tone({type:'triangle', f:f*2, dur:0.18, vol:0.05, t:i*0.08}); }); },
  stairs(){ [784,659,523,392,262].forEach((f,i)=>tone({type:'triangle', f, dur:0.25, vol:0.1, t:i*0.09})); },
  enemyShot(px){ if(!ok('es', 70)) return; tone({type:'square', f:R(380,460), f2:160, dur:0.08, vol:0.07, px}); },
  bossRoar(px){ tone({type:'sawtooth', f:90, f2:55, dur:0.9, a:0.08, vol:0.3, px}); noise({dur:0.9, a:0.1, vol:0.3, type:'lowpass', f:500, f2:200, px}); },
  denied(){ if(!ok('deny', 200)) return; tone({type:'square', f:180, dur:0.08, vol:0.08}); tone({type:'square', f:140, dur:0.1, vol:0.08, t:0.09}); },
  click(){ tone({type:'square', f:660, dur:0.03, vol:0.05}); },
};

// ---------- 挂接 ----------
function wrap(name, fn){
  const orig = window[name]; if(typeof orig !== 'function') return console.warn('[sfx] 未找到', name);
  window[name] = function(...args){
    let before; if(fn.pre && ready()) try{ before = fn.pre(...args); }catch(e){}
    const r = orig.apply(this, args);
    if(ready()) try{ fn.post ? fn.post(r, before, ...args) : fn(r, ...args); }catch(e){}
    return r; };
}
const P = () => (typeof player !== 'undefined' ? player : null);   // let 声明，不在 window 上
const kind = () => { try{ return WEAPONS[P().weapon].kind; }catch(e){ return 'sword'; } };

wrap('startAttack', () => { const p = P(); if(p.st === 'atk') S.swing(kind()); });
wrap('startRoll', () => { if(P().st === 'roll') S.roll(); });
wrap('startDash', () => { if(P().st === 'dash') S.dash(); });
wrap('startBow', () => S.bowDraw());
wrap('fireBow', { pre: () => P().charge >= 0.82, post: (r, full) => S.bow(full) });
wrap('releaseStaffVolley', () => S.staff());
wrap('releaseSpell', () => { const sp = P().spell; sp === 'fireball' ? S.fireball() : sp === 'frost' ? S.frost() : S.zap(); });
wrap('usePotion', { pre: () => P().hp, post: (r, hp0) => P().hp > hp0 ? S.potion() : S.denied() });
wrap('useClassSkill', { pre: () => P().mana, post: (r, m0) => { if(P().mana < m0) P().cls === 'mage' ? S.blink() : S.skill(); } });
wrap('useArtifact', () => S.skill());
wrap('useMageSkill', { pre: () => P().st, post: (r, st0) => { const p = P(); if(p.st === 'mcast' && st0 !== 'mcast'){ if(p.mSk === 'meteor') S.meteorCast(); } else if(p.cls === 'mage') S.denied(); } });
wrap('releaseMageSkill', () => { const p = P(); if(p.mSk === 'shield') S.shieldUp(); });
wrap('meleeHit', { pre: (m) => m.bleed || 0, post: (r, b0, m) => { const p = P(), d = p.atkDef || {}; S.hit(relX(m.x), false, d.kb >= 9 || !!d.shock); if(d.execute && b0 > 0 && !(m.bleed > 0)) S.execute(relX(m.x)); } });
wrap('damageMob', (r, m, dmg, ang, kb, poise, crit, heavy) => { if(crit) S.hit(relX(m.x), true, heavy); });
wrap('killMob', (r, m) => S.kill(relX(m.x), !!(m.boss || m.elite || m.scale > 1.4)));
wrap('hurtPlayer', { pre: () => [P().hp, P().mana, P().inv], post: (r, b) => { const p = P(); if(p.hp <= 0 && b[0] > 0) S.death(); else if(p.hp < b[0]) S.hurt(); else if(p.mana < b[1]) S.shieldHit(); else if(r === false && b[2] <= 0) S.block(); } });
wrap('fireBoom', (r, x) => S.boom(relX(x)));
wrap('lightning', (r, m) => S.zap(relX(m && m.x)));
wrap('breakCrate', (r, cr) => S.crate(relX(cr.x)));
wrap('openChest', () => S.chest());
wrap('pickupGear', () => S.pickup());
wrap('gainXP', { pre: () => P().lvl, post: (r, l0) => { if(P().lvl > l0) S.levelUp(); } });
wrap('chooseUpgrade', { pre: () => floorN, post: (r, f0) => { floorN > f0 ? S.stairs() : S.pickup(); } });
wrap('startGame', () => S.click());

// ---------- 轮询：分散在各处的事件（敌方弹体 / 陨石 / 护盾破碎 / 文字提示） ----------
const seen = new WeakSet();
let shieldWas = 0, lastT = 0;
function poll(){
  requestAnimationFrame(poll);
  if(!ready() || typeof state === 'undefined' || state !== 'play') return;
  const p = P(); if(!p) return;
  try{
    for(const s of shots){ if(seen.has(s)) continue; seen.add(s);
      if(!s.friendly) S.enemyShot(relX(s.x)); else if(s.arcane) S.missile(); }
    if(typeof meteors !== 'undefined') for(const M of meteors){
      if(!seen.has(M)){ seen.add(M); M._sfxFall = false; }
      if(!M._sfxFall && M.t > M.delay - 0.75){ M._sfxFall = true; S.meteorFall(relX(M.x)); }
      if(M.hit && !M._sfxBoom){ M._sfxBoom = true; S.boom(relX(M.x), true); } }
    if(typeof booms !== 'undefined') for(const b of booms){ if(seen.has(b)) continue; seen.add(b); if(b.t < 0.05) S.boom(relX(b.x)); }
    if(shieldWas > 0.05 && !(p.mShieldT > 0) && p.mana <= 0.6) S.shieldBreak();
    shieldWas = p.mShieldT || 0;
    if(typeof texts !== 'undefined') for(const t of texts){ if(seen.has(t)) continue; seen.add(t);
      if(t.txt === '背刺!' || t.txt === '影袭!') S.backstab(relX(t.x)); }
    for(const m of mobs){ if(m.boss && m.awake && !m._sfxRoar){ m._sfxRoar = true; S.bossRoar(relX(m.x)); } }
  }catch(e){}
}
requestAnimationFrame(poll);

// ---------- 快捷键：N 静音，[ / ] 调音量 ----------
addEventListener('keydown', e => {
  if(e.code === 'KeyN'){ const m = SFX.toggle(); try{ addText(player.x, player.y, 1.8, m ? '🔇 静音' : '🔊 音效开', '#ffffff', 1); }catch(_){} }
  else if(e.code === 'BracketLeft' || e.code === 'BracketRight'){ SFX.setVol(SFX.vol + (e.code === 'BracketRight' ? 0.1 : -0.1)); if(SFX.muted) SFX.toggle(); try{ addText(player.x, player.y, 1.8, '🔊 ' + Math.round(SFX.vol*100) + '%', '#ffffff', 1); }catch(_){} S.click(); }
});
})();

