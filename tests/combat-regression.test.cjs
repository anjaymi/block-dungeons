const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, mobCode } = require('./game-harness.cjs');

test('匕首非致死命中后生命值保持有限', () => {
  const g = loadGame();
  g.run(`mobs = [${mobCode}]; meleeHit(mobs[0],6,5); stepPlayer(.1);`);
  assert.equal(g.run('Number.isFinite(mobs[0].hp)'), true);
});
test('重武器后摇必须经过最短恢复才能接招', () => {
  const g = loadGame();
  g.run(`player.weapon='greatsword'; player.st='atk'; player.ph='rec'; player.pt=0; player.T={rec:.26,attackAt:.10};`);
  assert.equal(g.run('canAttack()'), false);
  g.run('player.pt=.11');
  assert.equal(g.run('canAttack()'), true);
});
test('重复死亡请求只结算一次击杀与掉落', () => {
  const g = loadGame();
  g.run(`const m=${mobCode}; m.hp=0; killMob(m); const drops=items.length; killMob(m);`);
  assert.equal(g.run('stats.kills'), 1);
  assert.equal(g.run('items.length === drops'), true);
});
test('攻击中换组等待合法恢复点', () => {
  const g = loadGame();
  g.run(`player.alt.weapon=newBase('weapon',0,'sword'); player.alt.weapon.uid=72; player.st='atk'; player.ph='wind'; player.pt=0; swapWeapons();`);
  assert.equal(g.run('player.eq.weapon.uid'), 71);
  assert.equal(g.run('player.swapPending'), true);
});
test('法杖普攻声明奥术通道并冻结发起装备', () => {
  const g = loadGame();
  g.run(`player.weapon='staff'; player.eq.weapon=newBase('weapon',0,'staff'); player.eq.weapon.uid=73; startAttack(); releaseStaffVolley();`);
  assert.equal(g.run('shots[0].damageType'), 'arcane');
  assert.equal(g.run('shots[0].source.uid'), 73);
});
test('手机长矛不会用宽扇形绕过刀身判定', () => {
  const g = loadGame();
  g.run(`touchUIEnabled=()=>true; mobileAttackSector=()=>true; player.weapon='spear'; player.atkDef=WEAPONS.spear.combo[0]; mobs=[${mobCode}]; mobs[0].y=6; const line=[{hx:5,hy:5,tx:7,ty:5}]; bladeHits(line,line);`);
  assert.equal(g.run('mobs[0].hp'), 100);
});
