/* Block Dungeons: opt-in weapon gameplay lab v0.1.
 * Baseline: 2b1f934. No save migration, new currency, or default-entry change.
 * Geometry and input gate are exported for dependency-free Node tests.
 */
(function (root) {
  'use strict';
  const TYPES = new Set(['greatsword', 'sickles', 'hammer']);
  const READY_AFTER = 0.14, EXPIRES_AFTER = 0.85;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  class BranchGate {
    constructor() { this.identity = null; this.reset(); }
    reset() { this.node = false; this.age = 0; this.rest = 0; this.ready = false; this.used = false; this.requested = false; this.lastHeld = false; }
    observe(s, dt) {
      if (!s || !Number.isFinite(dt) || dt < 0) { this.reset(); return; }
      if (s.identity !== this.identity) { this.reset(); this.identity = s.identity; }
      if (!TYPES.has(s.weapon) || !s.play || !s.grounded || s.special || !['atk', 'move'].includes(s.st)) { this.reset(); return; }
      const node = s.st === 'atk' && s.ph === 'rec' && s.combo === 1;
      if (!this.node && node && !this.used) this.node = true;
      if (!this.node) return;
      if (s.st === 'atk' && !node) { this.reset(); return; }
      this.age += dt;
      if (!s.held) this.rest += dt;
      else if (!this.ready) this.rest = 0; // ordinary rapid clicks never accumulate a pause
      this.ready = this.rest + 1e-9 >= READY_AFTER && this.age <= EXPIRES_AFTER;
      if (s.held && !this.lastHeld) this.press();
      this.lastHeld = !!s.held;
      if (this.age > EXPIRES_AFTER) { this.reset(); this.used = true; }
    }
    press() { if (this.ready) this.requested = true; }
    consume() { const ready = this.ready && this.requested; this.reset(); return ready; }
  }
  function corridorTarget(origin, angle, range, width, entities, visible) {
    const ux = Math.cos(angle), uy = Math.sin(angle);
    return entities.filter(m => Number.isFinite(m.hp) && m.hp > 0).map(m => {
      const dx = m.x - origin.x, dy = m.y - origin.y;
      return {m, along: dx * ux + dy * uy, side: Math.abs(dx * uy - dy * ux)};
    }).filter(q => q.along >= 0 && q.along <= range + q.m.r && q.side <= width + q.m.r && visible(origin, q.m))
      .sort((a, b) => (a.along - a.m.r) - (b.along - b.m.r))[0]?.m || null;
  }
  function circleBlocked(x, y, r, wall) {
    for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
      for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++) {
        if (!wall(i + 0.5, j + 0.5)) continue;
        const cx = Math.max(i, Math.min(i + 1, x)), cy = Math.max(j, Math.min(j + 1, y));
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r - 1e-9) return true;
      }
    }
    return false;
  }
  function sweep(m, dx, dy, wall, obstacles) {
    if (![m.x, m.y, m.r, dx, dy].every(Number.isFinite)) return {reason: 'invalid'};
    const length = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(length / 0.06));
    if (n > 256) return {reason: 'invalid'};
    for (let i = 0; i < n; i++) {
      const x = m.x + dx / n, y = m.y + dy / n;
      if (circleBlocked(x, y, m.r, wall)) return {reason: 'wall'};
      for (const o of obstacles) {
        if (o === m || o.dead || (o.hp !== undefined && o.hp <= 0)) continue;
        const rr = m.r + o.r;
        const next = Math.hypot(x - o.x, y - o.y), prev = Math.hypot(m.x - o.x, m.y - o.y);
        // Permit separation from a pre-existing overlap, never deeper penetration.
        if (next < rr - 0.015 && next < prev - 1e-8) return {reason: 'body', other: o};
      }
      m.x = x; m.y = y;
    }
    return {reason: null};
  }
  const movable = m => !m.boss && !['golem', 'treant', 'enderman', 'wraith'].includes(m.type) && (m.mass || 1) <= 2.5 && (m.z || 0) < 0.2;
  const recovery = (weapon, special) => special ? 0.18 : weapon === 'sickles' ? 0.07 : 0.10;
  const core = {BranchGate, corridorTarget, circleBlocked, sweep, movable, recovery, READY_AFTER, EXPIRES_AFTER};
  if (typeof module === 'object' && module.exports) { module.exports = core; return; }
  if (root.WeaponGameplay) return;
  // Classic script must be injected into the game's own global realm, after its scripts.
  if (typeof WEAPONS === 'undefined' || typeof stepPlayer !== 'function' || typeof bladeHits !== 'function' || typeof stepMob !== 'function') {
    throw new Error('Weapon gameplay lab: game hooks unavailable');
  }
  const gate = new BranchGate(), motions = new Map();
  const base = {startAttack, canAttack, stepPlayer, bladeHits, onActEnd, stepMob, playerPose, swapWeapons};
  const names = {greatsword: '破阵重劈', sickles: '勾回剪击', hammer: '撞阵横砸'};
  const defs = {
    greatsword: {a:'slam', w:0.23, act:0.14, rec:0.35, m:2.3, kb:9, lunge:0.30, stop:0.10},
    sickles: {a:'cross', w:0.12, act:0.32, rec:0.24, m:1.7, kb:2, lunge:0, stop:0.055},
    hammer: {a:'slash', s:1, w:0.24, act:0.16, rec:0.37, m:1.65, kb:4, lunge:0.18, stop:0.10}
  };
  const counts = {greatsword:0, sickles:0, hammer:0, pulls:0, wallImpacts:0, bodyImpacts:0};
  let owner = null, floor = null, serial = 0, active = null, pendingSwap = false;
  function clearMotion(m) { motions.delete(m); m.vx = m.vy = m.mvx = m.mvy = 0; }
  function reset() {
    gate.reset(); for (const m of motions.keys()) clearMotion(m);
    active = null; pendingSwap = false;
  }
  function hit(m) {
    const boss = !!m.boss;
    const keep = boss ? {st:m.st, t:m.t, stunT:m.stunT, vx:m.vx, vy:m.vy, mvx:m.mvx, mvy:m.mvy} : null;
    player.hitSet.add(m);
    meleeHit(m, m.x, m.y); // existing damage, enchantments, feedback; no duplicate proc chain
    if (keep && m.hp > 0) Object.assign(m, keep); // never create a new Boss knockback/interrupt
  }
  function inLine(m, range, width) {
    const p = player, dx = m.x - p.x, dy = m.y - p.y, a = p.atkAng;
    const along = dx * Math.cos(a) + dy * Math.sin(a);
    return along >= 0 && along <= range + m.r && Math.abs(dx * Math.sin(a) - dy * Math.cos(a)) <= width + m.r && los(p, m);
  }
  function stagger(m, seconds) {
    if (!movable(m) || m.hp <= 0) return;
    m.st = 'stun'; m.t = 0; m.stunT = seconds;
  }
  function impact(m, motion, obstacle) {
    // Remove BEFORE damage callbacks: deaths and procs cannot re-trigger this launch.
    clearMotion(m);
    if (m.hp <= 0) return;
    if (obstacle.reason === 'wall') {
      counts.wallImpacts++;
      damageMob(m, motion.damage * 0.55, motion.angle, 0, 0, false, false);
      stagger(m, 0.42); addText(m.x, m.y, 1.6 * m.scale, '撞墙!', '#ffd080', 1.1);
    } else if (obstacle.other && obstacle.other !== player && obstacle.other.hp > 0) {
      counts.bodyImpacts++;
      const o = obstacle.other;
      damageMob(m, motion.damage * 0.25, motion.angle, 0, 0, false, false);
      damageMob(o, motion.damage * 0.55, motion.angle, 0, 0, false, false);
      stagger(m, 0.24); stagger(o, 0.24);
      addText(o.x, o.y, 1.6 * o.scale, '撞阵!', '#ffd080', 1.1);
    }
    rings.push({x:m.x,y:m.y,r:0.85,t:0,col:'255,190,100'});
    shake = Math.max(shake, 5); hitStop = Math.max(hitStop, 0.045);
  }
  canAttack = function () {
    if (!base.canAttack.call(this)) return false;
    const p = player;
    return !(TYPES.has(p.weapon) && p.st === 'atk' && p.ph === 'rec' && p.pt < recovery(p.weapon, !!p.atkDef?.wgKind));
  };
  startAttack = function () {
    const p = player, special = TYPES.has(p.weapon) && gate.consume();
    base.startAttack.call(this);
    active = null;
    if (TYPES.has(p.weapon)) p.T.rec = Math.max(p.T.rec,recovery(p.weapon,false));
    if (!special) { gate.reset(); return; }
    const d = Object.assign({}, defs[p.weapon], {wgKind:p.weapon, wgSerial:++serial});
    const sp = atkSpeed();
    p.atkDef = d; p.combo = WEAPONS[p.weapon].combo.length - 1;
    p.T = {w:d.w*sp, act:d.act*sp, rec:Math.max(d.rec*sp,recovery(p.weapon,true))};
    p.lungeV = d.lunge / (p.T.w + p.T.act);
    if (p.weapon === 'sickles') { const a = computeAim(3.2); p.atkAng = p.ang = a.ang; }
    active = {id:serial, kind:p.weapon, hook:false, strike:false, damage:rollWDmg() * (1+0.3*L('sharp')) * (p.rageT>0?1.3:1)};
    counts[p.weapon]++;
    addText(p.x,p.y,1.7,names[p.weapon],'#ffe0a0',1.0);
  };
  stepPlayer = function (dt) {
    const p = player;
    if (owner !== p || floor !== floorN) { reset(); owner = p; floor = floorN; }
    gate.observe({identity:p.eq?.weapon?.uid ?? p.weapon, weapon:p.weapon, play:state==='play', grounded:grounded(),
      special:!!(p.st==='atk' && p.atkDef?.wgKind), st:p.st, ph:p.ph, combo:p.combo, held:!!mouse.l}, dt);
    if (pendingSwap && (p.st === 'move' || (p.st==='atk' && p.ph==='rec' && p.pt>=0.18))) {
      pendingSwap = false; gate.reset(); base.swapWeapons.call(this);
    }
    base.stepPlayer.call(this,dt);
    for (const m of motions.keys()) if (!(m.hp>0) || !mobs.includes(m)) clearMotion(m);
    if (active && (p.st !== 'atk' || p.atkDef?.wgSerial !== active.id)) {
      for (const [m,motion] of motions) if (motion.kind==='pull') clearMotion(m);
      active = null;
    }
  };
  bladeHits = function (cur, prev) {
    const p = player, kind = p.atkDef?.wgKind;
    if (!kind || !active || active.id !== p.atkDef.wgSerial) return base.bladeHits.call(this,cur,prev);
    const u = p.pt / p.T.act;
    if (kind === 'sickles') {
      if (!active.hook) {
        active.hook = true;
        const m = corridorTarget(p,p.atkAng,3.2,0.26,mobs,los);
        if (m) {
          streaks.push({x1:p.x,y1:p.y,x2:m.x,y2:m.y,t:0});
          if (movable(m)) { motions.set(m,{kind:'pull',left:1.5,time:0.22,id:active.id}); counts.pulls++; }
          else addText(m.x,m.y,1.5*m.scale,'无法拉动','#bbbbbb',0.85);
        }
      }
      if (u < 0.60 || active.strike) return;
      active.strike = true;
      for (const m of mobs.slice()) if (m.hp>0 && !p.hitSet.has(m) && inLine(m,weaponReach()+0.25,0.6)) hit(m);
    } else if (kind === 'greatsword') {
      if (u < 0.45 || active.strike) return;
      active.strike = true;
      for (const m of mobs.slice()) if (m.hp>0 && !p.hitSet.has(m) && inLine(m,weaponReach()+0.25,0.36)) hit(m);
    } else {
      if (u < 0.35 || active.strike) return;
      active.strike = true;
      const m = corridorTarget(p,p.atkAng,weaponReach(),0.50,mobs,los);
      if (m) {
        hit(m);
        if (m.hp>0 && movable(m)) motions.set(m,{kind:'launch',left:2.8,time:0.40,angle:p.atkAng,damage:active.damage});
      }
    }
    // Props stay interactable, but never become launch projectiles or grant charge.
    if (active.strike) {
      for (const cr of crates) if (!cr.dead && inLine(cr,weaponReach(),0.4)) breakCrate(cr,p.atkAng);
      for (const ch of chests) if (!ch.open && inLine(Object.assign({r:0.4},ch),weaponReach(),0.4)) openChest(ch);
    }
  };
  onActEnd = function () {
    if (player.atkDef?.wgKind) return; // branch replaces, never also emits the normal finisher's shock
    return base.onActEnd.call(this);
  };
  stepMob = function (m, dt) {
    const motion = motions.get(m);
    if (!motion) return base.stepMob.call(this,m,dt);
    if (!(dt>0) || !Number.isFinite(dt)) return;
    if (m.hp<=0 || !Number.isFinite(m.hp) || state!=='play') { clearMotion(m); return; }
    if (motion.kind==='pull' && (!active || active.id!==motion.id || player.st!=='atk')) { clearMotion(m); return base.stepMob.call(this,m,dt); }
    m.vx = m.vy = m.mvx = m.mvy = 0;
    stagger(m,Math.max(0.1,motion.time+0.03));
    base.stepMob.call(this,m,dt); // timers, statuses, animation and wake state still advance
    const budget = Math.min(Math.max(0,dt),motion.time);
    let angle = motion.angle, travel = Math.min(motion.left,9*budget);
    if (motion.kind==='pull') {
      const dx=player.x-m.x,dy=player.y-m.y,d=Math.hypot(dx,dy);
      angle = Math.atan2(dy,dx); travel = Math.min(travel,Math.max(0,d-player.r-m.r-0.22));
    }
    const obstacles = [...mobs,player,...crates.filter(c=>!c.dead)];
    const collision = sweep(m,Math.cos(angle)*travel,Math.sin(angle)*travel,wallAt,obstacles);
    motion.left -= travel; motion.time -= budget;
    if (collision.reason) {
      if (motion.kind==='launch') impact(m,motion,collision); else clearMotion(m);
    } else if (motion.time<=1e-8 || motion.left<=1e-8 || travel<=1e-8) clearMotion(m);
  };
  playerPose = function (p) {
    const pose = base.playerPose.call(this,p);
    if (p.st==='atk' && p.atkDef?.wgKind==='sickles') {
      const u = p.ph==='act' ? clamp01(p.pt/p.T.act) : 0;
      if (p.ph==='wind' || (p.ph==='act' && u<0.6)) {
        pose.armR=[-0.18,-1.55,0,8*(1-u)]; pose.wpR=0;
        pose.armL=[0.2,-0.6,-0.2,0]; pose.wpL=-1.1; pose.lean=0.12;
      }
    }
    return pose;
  };
  swapWeapons = function () {
    const p=player;
    if (p.st==='atk' && (p.ph!=='rec' || p.pt<0.18)) { pendingSwap=true; return; }
    gate.reset(); return base.swapWeapons.call(this);
  };
  root.addEventListener('mousedown',e=>{if(e.button===0 && state==='play')gate.press();});
  if (typeof touchAction === 'function') {
    const oldTouchAction=touchAction;
    touchAction=function(name,down){if(name==='attack' && down && state==='play')gate.press();return oldTouchAction.call(this,name,down);};
  }
  root.addEventListener('blur',()=>gate.reset());
  root.addEventListener('touchcancel',()=>gate.reset());
  root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)gate.reset();});
  root.WeaponGameplay = Object.freeze({
    version:'0.1.0', baseline:'2b1f934', core,
    status:()=>({ready:gate.ready,weapon:typeof player==='undefined'?null:player.weapon,name:names[typeof player==='undefined'?'':player.weapon]||null,
      counts:Object.assign({},counts),activeMotions:motions.size}),
    reset
  });
})(typeof window === 'undefined' ? globalThis : window);
