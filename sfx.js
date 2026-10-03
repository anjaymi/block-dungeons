// =====================================================================
//  方块地牢 · 合成音效（Web Audio，零素材）
//  在主脚本之后加载：包装全局函数挂接音效，不修改游戏逻辑
// =====================================================================
(function(){
'use strict';
const SFX = window.SFX = { vol: +(localStorage.getItem('bd_vol') ?? 0.6), mvol: +(localStorage.getItem('bd_mvol') ?? 0.5), avol: +(localStorage.getItem('bd_avol') ?? 0.6), muted: localStorage.getItem('bd_mute') === '1' };
let ac = null, master = null, comp = null, noiseBuf = null, sfxBus = null, musBus = null, ambBus = null, verb = null, verbIn = null;
const last = {};                    // 同类音效节流
function init(){
  if(ac) return ac.state === 'suspended' && ac.resume();
  const C = window.AudioContext || window.webkitAudioContext; if(!C) return;
  ac = new C();
  comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
  master = ac.createGain(); master.gain.value = SFX.muted ? 0 : 1;
  master.connect(comp); comp.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = SFX.vol; sfxBus.connect(master);
  musBus = ac.createGain(); musBus.gain.value = SFX.mvol*0.55; musBus.connect(master);
  ambBus = ac.createGain(); ambBus.gain.value = SFX.avol*0.7; ambBus.connect(master);
  // 生成式混响（音乐与环境音共用）
  verb = ac.createConvolver(); const L2 = ac.sampleRate*2.6, ir = ac.createBuffer(2, L2, ac.sampleRate);
  for(let ch=0; ch<2; ch++){ const d2 = ir.getChannelData(ch); for(let i=0;i<L2;i++) d2[i] = (Math.random()*2-1)*Math.pow(1-i/L2, 2.6); }
  verb.buffer = ir; verbIn = ac.createGain(); verbIn.gain.value = 0.5; verbIn.connect(verb); const vOut = ac.createGain(); vOut.gain.value = 0.55; verb.connect(vOut); vOut.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
}
['pointerdown','keydown','touchstart'].forEach(ev => addEventListener(ev, init, {capture:true}));
SFX.setVol = v => { SFX.vol = Math.max(0, Math.min(1, v)); localStorage.setItem('bd_vol', SFX.vol); if(sfxBus) sfxBus.gain.value = SFX.vol; };
SFX.setMVol = v => { SFX.mvol = Math.max(0, Math.min(1, v)); localStorage.setItem('bd_mvol', SFX.mvol); if(musBus) musBus.gain.setTargetAtTime(SFX.mvol*0.55, ac.currentTime, 0.05); };
SFX.setAVol = v => { SFX.avol = Math.max(0, Math.min(1, v)); localStorage.setItem('bd_avol', SFX.avol); if(ambBus) ambBus.gain.setTargetAtTime(SFX.avol*0.7, ac.currentTime, 0.05); };
SFX.toggle = () => { SFX.muted = !SFX.muted; localStorage.setItem('bd_mute', SFX.muted ? '1' : '0'); if(master) master.gain.value = SFX.muted ? 0 : 1; return SFX.muted; };

// ---------- 基础发声单元 ----------
const R = (a,b) => a + Math.random()*(b-a);
function env(g, t, a, peak, dec){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function pan(node, x){   // 根据相对玩家的位置左右声像
  if(x === undefined || !ac.createStereoPanner) return node;
  const p = ac.createStereoPanner(); p.pan.value = Math.max(-0.8, Math.min(0.8, x)); node.connect(p); return p;
}
function out(node, vol, px, bus){ const g = ac.createGain(); g.gain.value = vol; node.connect(g); pan(g, px).connect(bus || sfxBus); }
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
  monsterAlert(type,px){
    if(!ok('ma:'+type,900)) return;
    if(type==='golem'){ tone({type:'triangle',f:72,f2:42,dur:0.55,vol:0.2,px}); noise({dur:0.5,a:0.08,vol:0.24,type:'lowpass',f:260,f2:90,px}); }
    else if(type==='slime'){ tone({type:'sine',f:150,f2:55,dur:0.22,vol:0.13,px}); noise({dur:0.16,vol:0.16,type:'lowpass',f:700,f2:180,px}); }
    else if(type==='bat'||type==='cavespider'){ tone({type:'triangle',f:900,f2:1800,dur:0.12,vol:0.09,px}); tone({type:'sine',f:1500,f2:700,dur:0.1,vol:0.06,t:0.08,px}); }
    else if(type==='skeleton'||type==='stray'){ noise({dur:0.16,vol:0.16,type:'bandpass',f:1900,f2:800,q:4,px}); tone({type:'square',f:460,f2:180,dur:0.12,vol:0.08,px}); }
    else if(type==='creeper'){ noise({dur:0.32,a:0.04,vol:0.14,type:'highpass',f:1800,f2:4200,q:2,px}); }
    else if(type==='blaze'){ noise({dur:0.24,vol:0.14,type:'bandpass',f:1200,f2:2600,q:2,px}); tone({type:'sawtooth',f:240,f2:480,dur:0.2,vol:0.06,px}); }
    else { tone({type:'sawtooth',f:180,f2:90,dur:0.18,vol:0.1,px}); noise({dur:0.12,vol:0.1,type:'lowpass',f:900,f2:250,px}); }
  },
  monsterAttack(type,px){
    if(!ok('mx:'+type,260)) return;
    const fast=type==='bat'||type==='spider'||type==='cavespider', heavy=type==='golem'||type==='zombie'||type==='husk';
    noise({dur:fast?0.07:heavy?0.2:0.12,a:0.006,vol:heavy?0.2:0.12,type:'bandpass',f:fast?2400:heavy?280:900,f2:fast?900:heavy?90:260,px});
    tone({type:heavy?'sawtooth':'square',f:heavy?80:fast?520:230,f2:heavy?42:fast?980:110,dur:heavy?0.2:0.09,vol:heavy?0.16:0.07,px});
  },
  monsterHurt(type,px){
    if(!ok('mh:'+type,130)) return;
    const high=type==='bat'||type==='cavespider'||type==='stray';
    tone({type:high?'triangle':'sawtooth',f:high?1100:220,f2:high?520:80,dur:0.11,vol:0.09,px});
  },
  monsterDeath(type,px){
    if(!ok('md:'+type,180)) return;
    if(type==='slime'){ noise({dur:0.35,vol:0.2,type:'lowpass',f:900,f2:120,px}); tone({type:'sine',f:260,f2:55,dur:0.35,vol:0.12,px}); }
    else if(type==='golem'){ noise({dur:0.65,a:0.03,vol:0.3,type:'lowpass',f:420,f2:55,px}); tone({type:'triangle',f:110,f2:35,dur:0.6,vol:0.2,px}); }
    else if(type==='skeleton'||type==='stray'){ noise({dur:0.3,vol:0.24,type:'bandpass',f:2600,f2:700,q:3,px}); }
    else { noise({dur:0.28,vol:0.18,type:'lowpass',f:700,f2:110,px}); tone({type:'sawtooth',f:180,f2:45,dur:0.25,vol:0.1,px}); }
  },
  denied(){ if(!ok('deny', 200)) return; tone({type:'square', f:180, dur:0.08, vol:0.08}); tone({type:'square', f:140, dur:0.1, vol:0.08, t:0.09}); },
  click(){ tone({type:'square', f:660, dur:0.03, vol:0.05}); },
  ready(i){ if(!ok('ready'+i, 300)) return; const f = [880, 988, 1175][i]||880; tone({type:'sine', f, dur:0.18, vol:0.07}); tone({type:'sine', f:f*1.5, dur:0.25, vol:0.05, t:0.07}); },
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
wrap('damageMob', { pre: (m) => m.hp, post: (r, hp0, m, dmg, ang, kb, poise, crit, heavy) => { if(crit) S.hit(relX(m.x), true, heavy); if(m && m.hp < hp0 && m.hp > 0) S.monsterHurt(m.type, relX(m.x)); } });
wrap('killMob', (r, m) => { S.kill(relX(m.x), !!(m.boss || m.elite || m.scale > 1.4)); if(m && !m._sfxDeath){ m._sfxDeath = true; S.monsterDeath(m.type, relX(m.x)); } });
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
const mobSeen = new WeakMap();
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
    for(const m of mobs){
      const old = mobSeen.get(m), now = {hp:m.hp, st:m.st, awake:!!m.awake};
      if(!old){ if(m.awake && !m.boss) S.monsterAlert(m.type, relX(m.x)); }
      else {
        if(old.hp > 0 && m.hp <= 0 && !m._sfxDeath){ m._sfxDeath = true; S.monsterDeath(m.type, relX(m.x)); }
        if(m.awake && !old.awake && !m.boss) S.monsterAlert(m.type, relX(m.x));
        if(m.hp > 0 && m.st !== old.st && /^(skill|wind|aim|aimw|crouch|bitew|bite|dive|fuse|blink|spit|touchw|claww|chargew|punchw|wavew|slamw|swinge|rootw|pop)$/.test(m.st||'')) S.monsterAttack(m.type, relX(m.x));
      }
      mobSeen.set(m, now);
      if(m.boss && m.awake && !m._sfxRoar){ m._sfxRoar = true; S.bossRoar(relX(m.x)); }
    }
  }catch(e){}
}
requestAnimationFrame(poll);


// =====================================================================
//  生成式 BGM + 环境音
// =====================================================================
const mtof = m => 440*Math.pow(2, (m-69)/12);
function voice(bus, {type='triangle', f, t0, dur=0.4, a=0.005, vol=0.2, lp, q=0.7, det=0, rev=0.3, px, f2}){
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = det;
  if(f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dur);
  let n = o; if(lp){ const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; o.connect(fl); n = fl; }
  n.connect(g); const pn = pan(g, px); pn.connect(bus); if(rev) { const s2 = ac.createGain(); s2.gain.value = rev; pn.connect(s2); s2.connect(verbIn); }
  o.start(t0); o.stop(t0 + a + dur + 0.05);
}
function nz(bus, {t0, dur=0.1, a=0.002, vol=0.2, type='bandpass', f=1000, q=1, f2, rev=0.1, px}){
  const s2 = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s2.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q; if(f2) fl.frequency.exponentialRampToValueAtTime(f2, t0+dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dur);
  s2.connect(fl); fl.connect(g); const pn = pan(g, px); pn.connect(bus); if(rev){ const r = ac.createGain(); r.gain.value = rev; pn.connect(r); r.connect(verbIn); }
  s2.start(t0, Math.random()*0.5); s2.stop(t0 + a + dur + 0.05);
}
const I = {   // 乐器
  pluck: (f, t0, v=0.12, dur=0.6, lp=2200) => { voice(musBus, {type:'triangle', f, t0, dur, vol:v, lp, rev:0.35}); voice(musBus, {type:'sawtooth', f, t0, dur:dur*0.4, vol:v*0.25, lp:lp*0.7, det:7, rev:0.2}); },
  bell:  (f, t0, v=0.08, dur=2.2) => { voice(musBus, {type:'sine', f, t0, dur, vol:v, rev:0.7}); voice(musBus, {type:'sine', f:f*2.76, t0, dur:dur*0.5, vol:v*0.3, rev:0.7}); voice(musBus, {type:'sine', f:f*5.4, t0, dur:dur*0.2, vol:v*0.12, rev:0.6}); },
  pad:   (fs, t0, dur, v=0.045, lp=900) => fs.forEach((f,i) => { voice(musBus, {type:'sawtooth', f, t0, dur, a:dur*0.35, vol:v, lp, det:-8, rev:0.6, px:(i-1)*0.3}); voice(musBus, {type:'sawtooth', f, t0, dur, a:dur*0.35, vol:v*0.8, lp, det:9, rev:0.6, px:(1-i)*0.3}); }),
  bass:  (f, t0, dur=0.4, v=0.16, lp=380) => voice(musBus, {type:'sawtooth', f, t0, dur, a:0.01, vol:v, lp, q:4, rev:0.05}),
  sub:   (f, t0, dur=1, v=0.14) => voice(musBus, {type:'sine', f, t0, dur, a:0.04, vol:v, rev:0}),
  kick:  (t0, v=0.35) => { voice(musBus, {type:'sine', f:120, f2:40, t0, dur:0.28, vol:v, rev:0.02}); nz(musBus, {t0, dur:0.03, vol:v*0.3, type:'lowpass', f:900}); },
  snare: (t0, v=0.16) => { nz(musBus, {t0, dur:0.16, vol:v, type:'bandpass', f:1800, q:0.8, rev:0.25}); voice(musBus, {type:'triangle', f:190, f2:120, t0, dur:0.08, vol:v*0.6, rev:0.1}); },
  hat:   (t0, v=0.05) => nz(musBus, {t0, dur:0.04, vol:v, type:'highpass', f:7000, rev:0.05}),
  tom:   (t0, f=110, v=0.22) => voice(musBus, {type:'sine', f, f2:f*0.55, t0, dur:0.35, vol:v, rev:0.3}),
  frame: (t0, v=0.14, hi) => { voice(musBus, {type:'sine', f: hi ? 260 : 95, f2: hi ? 200 : 70, t0, dur: hi ? 0.1 : 0.25, vol:v, rev:0.3}); nz(musBus, {t0, dur:0.05, vol:v*0.4, f: hi ? 2500 : 600, q:1.2, rev:0.2}); },
};
// 每首曲子：bpm、根音、音阶、和弦级数进行；step(i,t,chord) 在每个 16 分音符被调用
const SC = { dorian:[0,2,3,5,7,9,10], phryg:[0,1,3,5,7,8,10], minor:[0,2,3,5,7,8,10], harm:[0,2,3,5,7,8,11], hijaz:[0,1,4,5,7,8,10], lyd:[0,2,4,6,7,9,11], major:[0,2,4,5,7,9,11] };
const deg = (tr, d, oct=0) => { const sc = SC[tr.scale], n = sc.length; const o = Math.floor(d/n); return tr.root + sc[((d%n)+n)%n] + 12*(o+oct); };
const chordOf = (tr, d) => [deg(tr,d), deg(tr,d+2), deg(tr,d+4)];
const R01 = (i, k) => { let h = (i*374761393 + k*668265263)|0; h = (h^(h>>>13))*1274126177; return ((h^(h>>>16))>>>0)/4294967296; };
const TRACKS = {
  title: { bpm:72, root:57, scale:'minor', prog:[0,5,2,6], step(i,t,c,tr){ const s = i%16, bar = Math.floor(i/16);
      if(s===0) I.pad(chordOf(tr,c).map(n=>mtof(n-12)), t, tr.bar*0.98, 0.03, 700);
      if(s===0) I.sub(mtof(deg(tr,c,-2)), t, tr.bar*0.9, 0.08);
      const pat = [0,2,4,7, 4,2,9,4][(s/2)|0]; if(s%2===0) I.pluck(mtof(deg(tr, c + pat, 0)), t, s%8===0 ? 0.1 : 0.065, 0.9, 1800);
      if(s===14 && bar%2) I.bell(mtof(deg(tr, c+7, 1)), t, 0.035); } },
  dungeon: { bpm:76, root:50, scale:'dorian', prog:[0,0,3,4, 0,5,3,4], step(i,t,c,tr){ const s = i%16;
      if(s===0) { I.pad(chordOf(tr,c).map(n=>mtof(n)), t, tr.bar, 0.035, 650); I.sub(mtof(deg(tr,c,-1)), t, tr.bar*0.9, 0.1); }
      if(s%4===0) I.bass(mtof(deg(tr,c,-1)), t, 0.3, 0.07, 300);
      if([0,3,6,10,12].includes(s) && R01(i,1)<0.8) I.pluck(mtof(deg(tr, c + [0,2,4,7,4][[0,3,6,10,12].indexOf(s)] + (R01(i,2)<0.25?1:0), 1)), t, 0.06, 0.7, 1600);
      if(s===0) I.tom(t, 70, 0.12); if(s===8) I.tom(t, 62, 0.08); } },
  mine: { bpm:68, root:45, scale:'phryg', prog:[0,1,0,6], step(i,t,c,tr){ const s = i%16;
      if(s===0){ I.pad([mtof(deg(tr,c,-1)), mtof(deg(tr,c+4,-1))], t, tr.bar, 0.04, 420); I.sub(mtof(deg(tr,0,-2)), t, tr.bar, 0.12); }
      if(s%3===0 && R01(i,3)<0.7) voice(musBus, {type:'square', f:mtof(deg(tr, c + Math.floor(R01(i,4)*5), 1)), t0:t, dur:0.25, vol:0.035, lp:2600, rev:0.6});
      if(s===0 || s===10) I.tom(t, 55, 0.14); if(s===6 && R01(i,5)<0.5) nz(musBus, {t0:t, dur:0.08, vol:0.06, f:3200, q:8, rev:0.7}); } },
  ice: { bpm:60, root:52, scale:'lyd', prog:[0,1,0,4], step(i,t,c,tr){ const s = i%16;
      if(s===0){ I.pad(chordOf(tr,c).map(n=>mtof(n+12)), t, tr.bar*1.1, 0.022, 1600); I.sub(mtof(deg(tr,c,-1)), t, tr.bar, 0.07); }
      if(s%4===0 || (s%2===0 && R01(i,6)<0.3)) I.bell(mtof(deg(tr, c + [0,4,2,6][(s/4)|0] + (R01(i,7)<0.3 ? 7 : 0), 1)), t, 0.045, 2.6); } },
  nether: { bpm:96, root:48, scale:'harm', prog:[0,0,5,4], step(i,t,c,tr){ const s = i%16;
      if(s===0){ I.pad(chordOf(tr,c).map(n=>mtof(n-12)), t, tr.bar, 0.03, 500); }
      if([0,3,6,8,11,14].includes(s)) I.bass(mtof(deg(tr,c,-1) + (s===14?1:0)), t, 0.2, 0.12, 420);
      if(s===0 || s===6 || s===8) I.tom(t, 80, 0.2); if(s===12) I.tom(t, 120, 0.16); if(s%2===1) I.hat(t, 0.025);
      if(s===4 && R01(i,8)<0.6) I.pluck(mtof(deg(tr,c+7,0)), t, 0.06, 0.5, 1200); } },
  desert: { bpm:84, root:50, scale:'hijaz', prog:[0,0,6,0], step(i,t,c,tr){ const s = i%16;
      if(s===0){ I.sub(mtof(deg(tr,0,-2)), t, tr.bar, 0.1); I.pad([mtof(deg(tr,0,-1)), mtof(deg(tr,4,-1))], t, tr.bar, 0.025, 600); }
      if([0,6,8,11].includes(s)) I.frame(t, 0.13, false); if([3,10,14].includes(s)) I.frame(t, 0.08, true);
      if(s%2===0 && R01(i,9)<0.65){ const run = [0,1,2,1,0,-1,0,2][(s/2)|0]; I.pluck(mtof(deg(tr, c + run + 4, 0)), t, 0.07, 0.35, 2600); } } },
  boss: { bpm:136, root:45, scale:'minor', prog:[0,5,3,4], step(i,t,c,tr){ const s = i%16;
      if(s===0) I.pad(chordOf(tr,c).map(n=>mtof(n)), t, tr.bar, 0.03, 1100);
      if(s%2===0) I.bass(mtof(deg(tr,c,-1) + (s%4===2 ? 12 : 0)), t, 0.14, 0.13, 600);
      if(s===0 || s===8 || s===10) I.kick(t, 0.3); if(s===4 || s===12) I.snare(t, 0.14); I.hat(t, s%4===2 ? 0.04 : 0.02);
      if(s%4===0) I.pluck(mtof(deg(tr, c + [0,2,4,6][(s/4)|0], 1)), t, 0.06, 0.25, 3000); } },
};
const THEME_TRACK = ['dungeon','mine','ice','nether','desert'];
const AMB = {   // 环境音：持续底噪 + 随机事件
  title:   { bed:{f:500, q:0.4, v:0.03}, ev(t){ if(Math.random()<0.5) nz(ambBus, {t0:t+Math.random()*0.2, dur:rnd2(0.01,0.04), vol:rnd2(0.05,0.14), type:'highpass', f:rnd2(1500,4000), rev:0.1});   // 篝火噼啪
      if(Math.random()<0.08) for(let k=0;k<3;k++) voice(ambBus, {type:'sine', f:4200+Math.random()*300, t0:t+k*0.06, dur:0.03, vol:0.01, rev:0.2}); } },   // 虫鸣
  dungeon: { bed:{f:300, q:0.5, v:0.045}, ev(t){ if(Math.random()<0.06){ const f = rnd2(900,1600); voice(ambBus, {type:'sine', f, f2:f*1.6, t0:t, dur:0.08, vol:0.05, rev:0.9, px:rnd2(-0.8,0.8)}); } } },   // 滴水
  mine:    { bed:{f:120, q:0.6, v:0.07}, ev(t){ if(Math.random()<0.02) nz(ambBus, {t0:t, dur:1.4, a:0.4, vol:0.08, type:'lowpass', f:180, rev:0.4});
      if(Math.random()<0.025) voice(ambBus, {type:'square', f:rnd2(1800,2600), t0:t, dur:0.05, vol:0.015, lp:3000, rev:0.95, px:rnd2(-0.9,0.9)}); } },   // 远处矿镐
  ice:     { bed:{f:1400, q:2.5, v:0.03, wind:true}, ev(t){ if(Math.random()<0.05) voice(ambBus, {type:'sine', f:rnd2(2500,4200), t0:t, dur:0.4, vol:0.012, rev:0.9, px:rnd2(-0.8,0.8)}); } },
  nether:  { bed:{f:160, q:0.8, v:0.07}, ev(t){ if(Math.random()<0.12){ const f = rnd2(90,220); voice(ambBus, {type:'sine', f, f2:f*1.8, t0:t, dur:0.1, vol:0.05, rev:0.3, px:rnd2(-0.8,0.8)}); } } },   // 岩浆冒泡
  desert:  { bed:{f:900, q:0.7, v:0.04, wind:true}, ev(t){ if(Math.random()<0.07) nz(ambBus, {t0:t, dur:rnd2(0.8,1.8), a:0.25, vol:0.04, type:'bandpass', f:rnd2(700,1300), f2:rnd2(240,500), q:0.6, rev:0.55, px:rnd2(-0.85,0.85)}); } },   // 沙丘风啸
};
const rnd2 = (a,b) => a + Math.random()*(b-a);
let curMus = null, musStart = 0, musStep = 0, musGain = null, curAmb = null, ambNodes = null, schedT = 0;
function startAmb(key){
  if(curAmb === key) return; curAmb = key;
  if(ambNodes){ const old = ambNodes; old.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.6); setTimeout(()=>{ try{ old.src.stop(); old.lfo && old.lfo.stop(); }catch(e){} }, 3000); ambNodes = null; }
  const A = AMB[key]; if(!A) return;
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = A.bed.f; fl.Q.value = A.bed.q;
  const g = ac.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(A.bed.v, ac.currentTime, 1.2);
  let lfo = null; if(A.bed.wind){ lfo = ac.createOscillator(); lfo.frequency.value = 0.09; const lg = ac.createGain(); lg.gain.value = A.bed.f*0.5; lfo.connect(lg); lg.connect(fl.frequency); lfo.start(); }
  src.connect(fl); fl.connect(g); g.connect(ambBus); const r = ac.createGain(); r.gain.value = 0.3; g.connect(r); r.connect(verbIn); src.start();
  ambNodes = {src, g, lfo};
}
function startMus(key){
  if(curMus === key) return;
  if(musGain){ const old = musGain; old.gain.setTargetAtTime(0.0001, ac.currentTime, 0.5); setTimeout(()=>{ try{ old.disconnect(); }catch(e){} }, 4000); }
  curMus = key; if(!key){ musGain = null; return; }
  musGain = ac.createGain(); musGain.gain.value = 0.0001; musGain.gain.setTargetAtTime(1, ac.currentTime + 0.3, 0.8); musGain.connect(musBus);
  musStart = ac.currentTime + 0.4; musStep = 0;
}
function schedule(){
  if(!ready()) return;
  const now = ac.currentTime;
  if(curMus && musGain){
    const tr = TRACKS[curMus], sp = 60/tr.bpm/4; tr.bar = sp*16;
    const saved = musBus; musBus = musGain;   // 让乐器输出到当前曲目的淡入淡出节点
    try{ while(musStart + musStep*sp < now + 0.35){ const t = musStart + musStep*sp; if(t >= now - 0.05){ const bar = Math.floor(musStep/16), c = tr.prog[bar % tr.prog.length]; tr.step(musStep, t, c, tr); } musStep++; } }
    finally { musBus = saved; }
  }
  if(curAmb && AMB[curAmb] && now - schedT > 0.25){ schedT = now; try{ AMB[curAmb].ev(now + 0.05); }catch(e){} }
}
setInterval(schedule, 90);
function musicTick(){
  if(!ready()) return;
  let mus = null, amb = null;
  try{
    if(state === 'title'){ mus = 'title'; amb = 'title'; }
    else if(state === 'dead'){ mus = null; amb = curAmb; }
    else { const ti = Math.max(0, THEMES.indexOf(theme)); amb = THEME_TRACK[ti] || 'dungeon';
      const boss = typeof bossRef !== 'undefined' && bossRef && bossRef.hp > 0 && bossRef.awake;
      mus = boss ? 'boss' : amb; }
  }catch(e){}
  startMus(mus); startAmb(amb);
  // 背包/地图/暂停时音乐压低
  if(musBus){ const duck = (state === 'bag' || state === 'map' || state === 'pause') ? 0.45 : 1; musBus.gain.setTargetAtTime(SFX.mvol*0.55*duck, ac.currentTime, 0.2); }
}
setInterval(musicTick, 400);
SFX.debug = () => ({mus: curMus, amb: curAmb, state: ac && ac.state});

// ---------- 快捷键：N 静音，[ / ] 调音量 ----------
addEventListener('keydown', e => {
  if(e.code === 'KeyN'){ const m = SFX.toggle(); try{ addText(player.x, player.y, 1.8, m ? '🔇 静音' : '🔊 音效开', '#ffffff', 1); }catch(_){} }
  else if(e.code === 'BracketLeft' || e.code === 'BracketRight'){ SFX.setVol(SFX.vol + (e.code === 'BracketRight' ? 0.1 : -0.1)); if(SFX.muted) SFX.toggle(); try{ addText(player.x, player.y, 1.8, '🔊 ' + Math.round(SFX.vol*100) + '%', '#ffffff', 1); }catch(_){} S.click(); }
});
})();
