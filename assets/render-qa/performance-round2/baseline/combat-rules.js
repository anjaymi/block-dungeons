(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CombatRules = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const RECOVERY = { greatsword: .10, claymore: .10, hammer: .10, sickles: .07, axe: .08, spear: .06, staff: .07, shieldblade: .08, sword: .045, daggers: .025, fist: .04 };
  function attackAt(kind, def, rec) { return Math.min(rec, def.branch ? .18 : RECOVERY[kind] ?? .06); }
  function recovered(p) { return p.ph === 'rec' && p.pt + 1e-9 >= (p.T?.attackAt ?? .06); }
  function canSwap(p) { return p.st === 'move' || p.st === 'bowrec' || (p.st === 'atk' && recovered(p)) || (p.st === 'dash' && p.ph === 'rec' && p.pt >= .08) || (p.st === 'jrec' && p.pt >= .12); }
  function snapshot(p, id) { return Object.freeze({ id, uid: p.eq.weapon?.uid ?? null, kind: p.weapon, G: Object.freeze({ ...p.G }), ench: Object.freeze({ ...p.ench }), rage: p.rageT > 0 ? 1.3 : 1, perfect: p.perfectT > 0 ? 1.6 : 1 }); }
  function applyDamage(m, damage) {
    if (!Number.isFinite(damage) || damage < 0 || !Number.isFinite(m.hp)) throw new RangeError('Non-finite or negative combat damage');
    if (m.hp <= 0 || m.deathSettled) return false;
    m.hp -= damage; return true;
  }
  // Each status has one timer owner. Dagger stacks and equipment wounds coexist.
  function stepStatuses(m, dt, floor) {
    if (m.hp <= 0 || m.deathSettled) return [];
    const hits = [];
    for (const [timer, rate, kind] of [['poisonT', 'poisonD', 'poison'], ['woundT', 'woundD', 'wound']]) {
      if (!(m[timer] > 0)) continue;
      const active = Math.min(dt, m[timer]); m[timer] = Math.max(0, m[timer] - dt);
      hits.push({ kind, damage: m[rate] * active });
    }
    for (const kind of ['bleed', 'burn']) {
      const timer = kind === 'bleed' ? 'bleedT' : 'burn';
      if (!(m[timer] > 0) || (kind === 'bleed' && !(m.bleed > 0))) continue;
      const tick = kind + 'Tick', active = Math.min(dt, m[timer]);
      m[timer] = Math.max(0, m[timer] - dt); m[tick] = (m[tick] || 0) + active;
      const damage = kind === 'bleed' ? m.bleed * m.bleedDmg : 1.2 * m.burnLv * (1 + .15 * (floor - 1));
      while (m[tick] + 1e-9 >= .5) { m[tick] = Math.max(0, m[tick] - .5); hits.push({ kind, damage }); }
      if (m[timer] === 0) { m[tick] = 0; if (kind === 'bleed') { m.bleed = 0; m.bleedDmg = 0; } }
    }
    return hits;
  }
  return { attackAt, recovered, canSwap, snapshot, applyDamage, stepStatuses };
});
