(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WeaponGameplay = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const BRANCHES = {
    greatsword: { branch: 'cleave', name: '破阵重劈', a: 'slam', w: .24, act: .12, rec: .34, m: 2.6, kb: 12, lunge: 0, stop: .12, reach: 2.7, width: .36 },
    sickles: { branch: 'hook', name: '勾回剪击', a: 'cross', w: .10, act: .18, rec: .27, m: 1.45, kb: 5, lunge: 0, stop: .07, reach: 3.1, width: .28 },
    hammer: { branch: 'launch', name: '撞阵横砸', a: 'slash', s: -1, w: .25, act: .14, rec: .38, m: 1.65, kb: 12, lunge: 0, stop: .12, reach: 1.85, width: .42 }
  };
  for (const d of Object.values(BRANCHES)) Object.freeze(d);
  const EXCLUDED = new Set(['golem', 'treant', 'wraith', 'enderman', 'blaze', 'bat']);
  function movable(m) { return m.hp > 0 && !m.boss && !EXCLUDED.has(m.type) && m.mass <= 1.6 && (m.z || 0) <= .1 && !['leap', 'teleport', 'burrow'].includes(m.st); }
  function inLine(p, m, angle, reach, width) {
    const dx = m.x - p.x, dy = m.y - p.y, c = Math.cos(angle), s = Math.sin(angle);
    const forward = dx * c + dy * s, side = Math.abs(-dx * s + dy * c);
    return forward >= 0 && forward <= reach + m.r && side <= width + m.r;
  }
  function circleWall(x, y, r, isFloor) {
    for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++) for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
      if (isFloor(i, j)) continue;
      const nx = Math.max(i, Math.min(i + 1, x)), ny = Math.max(j, Math.min(j + 1, y));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r - 1e-8) return true;
    }
    return false;
  }
  function obstruction(m, x, y, world) {
    if (circleWall(x, y, m.r, world.isFloor)) return { kind: 'wall' };
    for (const cr of world.crates()) if (!cr.dead && Math.hypot(x - cr.x, y - cr.y) < m.r + cr.r - 1e-8) return { kind: 'crate', target: cr };
    for (const o of world.mobs()) if (o !== m && o.hp > 0 && Math.hypot(x - o.x, y - o.y) < m.r + o.r - 1e-8) return { kind: 'mob', target: o };
    const p = world.player();
    if (Math.hypot(x - p.x, y - p.y) < m.r + p.r + .06) return { kind: 'player' };
    return null;
  }
  // Substeps bound a swept circle's travel, including wall corners and low frame rates.
  function sweep(m, dx, dy, world) {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .04));
    let moved = 0;
    for (let k = 0; k < n; k++) {
      const x = m.x + dx / n, y = m.y + dy / n, hit = obstruction(m, x, y, world);
      if (hit) return { moved, hit };
      m.x = x; m.y = y; moved += Math.hypot(dx, dy) / n;
    }
    return { moved, hit: null };
  }
  function create(host) {
    let window = null, hook = null, throws = [], owner = null, floor = null, uid = null, kind = null;
    function cancelInput() { window = null; hook = null; host.player().weaponCueT = 0; }
    function reset() { cancelInput(); throws = []; owner = null; }
    function sync() {
      const p = host.player();
      if (p !== owner || host.floor() !== floor || p.eq.weapon?.uid !== uid || p.weapon !== kind) {
        if (p !== owner || host.floor() !== floor) throws = [];
        cancelInput(); owner = p; floor = host.floor(); uid = p.eq.weapon?.uid; kind = p.weapon;
      }
      if (host.state() !== 'play') cancelInput();
    }
    function nearest(reach, width) {
      const p = host.player();
      return host.mobs().filter(m => m.hp > 0 && inLine(p, m, p.atkAng, reach, width) && host.los(p, m))
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - a.r - (Math.hypot(b.x - p.x, b.y - p.y) - b.r))[0] || null;
    }
    function step(dt) {
      sync();
      const p = host.player();
      if (host.state() !== 'play') return;
      if (p.z > .001 || p.vz > 0 || !['atk', 'move'].includes(p.st)) cancelInput();
      if (window) {
        window.left -= dt;
        if (window.left <= 0) window = null;
        else if (!window.ready) {
          window.release = host.held() ? 0 : window.release + dt;
          if (window.release + 1e-9 >= .14) { window.ready = true; window.press = p.attackPress || 0; host.cue('变招就绪 · 再按攻击', '#ffe09a'); }
        }
      }
      if (hook) {
        if (p.atkSource?.id !== hook.id || p.st !== 'atk' || p.ph !== 'act' || hook.target.hp <= 0) hook = null;
        else {
          const h = hook, m = h.target;
          h.time -= dt;
          if (movable(m) && h.left > 0) {
            const dx = p.x - m.x, dy = p.y - m.y, gap = Math.hypot(dx, dy), travel = Math.min(h.left, 1.5 * dt / h.duration, Math.max(0, gap - m.r - p.r - .12));
            if (travel > 0) { const result = sweep(m, dx / gap * travel, dy / gap * travel, host); h.left -= result.moved; if (result.hit) h.left = 0; }
            m.vx = m.vy = 0;
          }
          if (h.time <= 0) resolveHook();
        }
      }
      for (const t of throws) {
        const m = t.target;
        if (!movable(m) || !host.mobs().includes(m)) { t.done = true; continue; }
        const travel = Math.min(t.left, 8 * dt), r = sweep(m, Math.cos(t.angle) * travel, Math.sin(t.angle) * travel, host);
        t.left -= r.moved; m.vx = m.vy = 0;
        if (r.hit) {
          t.done = true;
          if (r.hit.kind === 'wall' || r.hit.kind === 'mob' || r.hit.kind === 'crate') {
            host.damage(m, t.damage, t.angle, 0, 8, false, true);
            const other = r.hit.kind === 'mob' ? r.hit.target : null;
            if (other?.hp > 0) host.damage(other, t.damage * .6, t.angle, 0, other.boss || other.type === 'golem' ? 0 : 5, false, false);
            host.impact(m);
          }
        } else if (t.left <= 1e-8) t.done = true;
      }
      throws = throws.filter(t => !t.done);
    }
    function takeBranch() {
      const p = host.player(), w = window;
      cancelInput();
      return w?.ready && p.buf?.press > w.press && BRANCHES[p.weapon] ? BRANCHES[p.weapon] : null;
    }
    function started() {
      const p = host.player();
      if (p.atkDef.branch) host.cue(p.atkDef.name, '#ffc77e');
    }
    function finished() {
      const p = host.player();
      if (hook) resolveHook();
      if (p.atkDef.branch) { p.comboKeep = 0; p.combo = -1; }
      else if (BRANCHES[p.weapon] && p.combo === 1) {
        window = { left: .85, release: 0, ready: false, press: p.attackPress || 0 };
        host.cue('第二击 · 松手收势可变招', '#b9d0dc');
      }
    }
    function direct(m) {
      const p = host.player();
      if (m.hp <= 0 || p.hitSet.has(m)) return;
      p.hitSet.add(m); host.meleeHit(m, m.x, m.y);
    }
    function resolveHook() {
      const p = host.player(), m = hook.target;
      hook = null;
      if (inLine(p, m, p.atkAng, 1.35, .48) && host.los(p, m)) direct(m);
    }
    function hitBranch() {
      const p = host.player(), d = p.atkDef;
      if (d.branch === 'hook') {
        if (!p.branchPicked) {
          p.branchPicked = true;
          const target = nearest(d.reach, d.width);
          if (target) { const duration = Math.max(.015, Math.min(.12, p.T.act * .65)); hook = { target, id: p.atkSource.id, left: 1.5, time: duration, duration }; }
        }
        return;
      }
      if (d.branch === 'launch') { if (!p.branchPicked) { p.branchPicked = true; const m = nearest(d.reach, d.width); if (m) direct(m); } }
      else for (const m of host.mobs()) if (m.hp > 0 && inLine(p, m, p.atkAng, d.reach, d.width) && host.los(p, m)) direct(m);
    }
    function afterHit(m, damage) {
      const p = host.player();
      if (p.atkDef.branch === 'launch' && movable(m)) {
        // A target owns at most one launch. Collision damage never re-enters procs.
        throws = throws.filter(t => t.target !== m);
        throws.push({ target: m, angle: p.atkAng, left: 2.8, damage: damage * .32, source: p.atkSource, done: false });
        m.vx = m.vy = 0;
      }
    }
    function controls(m) { return (hook?.target === m && movable(m)) || throws.some(t => t.target === m && !t.done); }
    function status() { return { ready: !!window?.ready, waiting: !!window, hook: !!hook, throws: throws.length, name: BRANCHES[host.player().weapon]?.name || '' }; }
    return { step, sync, reset, cancelInput, takeBranch, started, finished, hitBranch, afterHit, controls, status };
  }
  return { BRANCHES, movable, inLine, circleWall, sweep, create };
});
