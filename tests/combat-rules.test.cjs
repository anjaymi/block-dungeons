const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../combat-rules.js');
const {loadGame,mobCode} = require('./game-harness.cjs');

test('匕首流血与装备伤口独立计时、并行伤害',()=>{
  const g=loadGame();g.run(`mobs=[${mobCode}]; player.G.ow=100; meleeHit(mobs[0],6,5); const before=mobs[0].hp; const stacks=mobs[0].bleed; const bleedDamage=mobs[0].bleedDmg; const woundDamage=mobs[0].woundD; stepMobStatuses(.5);`);
  assert.equal(g.run('mobs[0].bleedT'),3);assert.equal(g.run('mobs[0].woundT'),2.5);
  assert.ok(g.run('Math.abs(before-mobs[0].hp-stacks*bleedDamage-woundDamage*.5)<1e-9'));
});
test('仅装备伤口也能正确结算，无匕首层数',()=>{
  const g=loadGame();g.run(`mobs=[${mobCode}]; player.G.ow=100; gearProcs(mobs[0],10); stepMobStatuses(.5);`);
  assert.equal(g.run('mobs[0].hp'),99.4);assert.equal(g.run('mobs[0].bleed'),undefined);
});
test('状态不因玩家更新再次计时',()=>{
  const g=loadGame();g.run(`mobs=[${mobCode}]; meleeHit(mobs[0],6,5); stepMobStatuses(.1); stepPlayer(.1);`);
  assert.equal(g.run('mobs[0].bleedT'),3.4);
});
test('长帧保留多个流血 tick，结算只覆盖有效持续时间',()=>{
  const m={hp:100,bleed:2,bleedDmg:3,bleedT:1,woundT:.2,woundD:5};
  const hits=rules.stepStatuses(m,1.2,1);
  assert.deepEqual(hits.map(h=>h.damage),[1,6,6]);assert.equal(m.bleedT,0);assert.equal(m.woundT,0);assert.equal(m.bleed,0);
});
test('暂停不会推进伤害状态',()=>{
  const g=loadGame();g.run(`mobs=[${mobCode}]; mobs[0].bleed=2; mobs[0].bleedT=3.5; mobs[0].bleedDmg=1; state='pause'; simStep(.5);`);
  assert.equal(g.run('mobs[0].hp'),100);assert.equal(g.run('mobs[0].bleedT'),3.5);
});
test('伤口、毒素、流血同帧致死只提交一次奖励',()=>{
  const g=loadGame();g.run(`mobs=[${mobCode}]; Object.assign(mobs[0],{hp:1,woundT:1,woundD:20,poisonT:1,poisonD:20,bleedT:1,bleed:2,bleedDmg:10}); stepMobStatuses(.5); stepMobStatuses(.5); killMob(mobs[0]);`);
  assert.equal(g.run('stats.kills'),1);
});
test('非有限伤害在边界直接报错，不被静默吞掉',()=>{
  assert.throws(()=>rules.applyDamage({hp:100},NaN),RangeError);
  assert.throws(()=>rules.applyDamage({hp:NaN},10),RangeError);
});
test('高攻速下许可不晚于动作实际后摇',()=>{
  for(const kind of ['greatsword','sickles','hammer','daggers','staff']) assert.ok(rules.attackAt(kind,{},.01)<=.01);
  assert.equal(rules.attackAt('hammer',{branch:'launch'},.3),.18);
});
test('按住与点击经过相同接招许可',()=>{
  const g=loadGame();g.run(`player.weapon='hammer'; player.eq.weapon=newBase('weapon',0,'hammer'); startAttack(); player.ph='rec'; player.pt=0; const original=player.attackId; player.buf={type:'atk',t:.2}; mouse.l=true; stepPlayer(.01);`);
  assert.equal(g.run('player.attackId'),g.run('original'));
  g.run('player.pt=.11; stepPlayer(.01)');assert.equal(g.run('player.attackId'),g.run('original+1'));
});
test('换组排队到恢复点生效、清除连段',()=>{
  const g=loadGame();g.run(`player.weapon='daggers'; player.alt.weapon=newBase('weapon',0,'sword'); player.alt.weapon.uid=72; startAttack(); swapWeapons(); player.ph='rec';player.pt=.1;stepPlayer(.01);`);
  assert.equal(g.run('player.eq.weapon.uid'),72);assert.equal(g.run('player.swapPending'),false);assert.equal(g.run('player.combo'),-1);
});
test('重复换组请求取消排队，不复制状态',()=>{
  const g=loadGame();g.run(`startAttack();swapWeapons();swapWeapons();`);assert.equal(g.run('player.swapPending'),false);
});
test('背包换装不能绕过攻击承诺',()=>{
  const g=loadGame();g.run(`startAttack();requestBag();`);assert.equal(g.run('state'),'play');assert.equal(g.run('player.bagPending'),true);
  g.run('player.ph="rec";player.pt=.1;stepPlayer(.01)');assert.equal(g.run('state'),'bag');
});
test('同类武器也用 UID 保存发起伤害属性',()=>{
  const g=loadGame();g.run(`startAttack();const source=player.atkSource;player.G.wMin=player.G.wMax=1000;player.G.fireDmg=1000;const damage=rollWDmg(source);`);
  assert.equal(g.run('damage'),10);assert.equal(g.run('source.uid'),71);assert.equal(g.run('source.G.fireDmg'),undefined);
});
test('旧法杖弹体的装备效果不会读取新装备',()=>{
  const g=loadGame();g.run(`player.weapon='staff'; player.eq.weapon=newBase('weapon',0,'staff');player.G.fireDmg=3; startAttack(); releaseStaffVolley();player.G.fireDmg=1000;player.G.ow=100;const m=${mobCode};const dealt=gearProcs(m,10,shots[0].source);`);
  assert.ok(g.run('dealt>=11 && dealt<=13'));assert.equal(g.run('m.woundT'),undefined);
});
test('法杖齐射命中多个目标只消费一次奥能充能',()=>{
  const g=loadGame();g.run(`selW=START_W.indexOf('staff');startGame();player.ench.arcane=1;player.ench.artcd=1;player.arcaneArtReady=true;player.arcaneArtT=4;player.artCD=[5,5,5];startAttack();player.atkDef=WEAPONS.staff.combo[2];releaseStaffVolley();mobs=[-1,0,1].map(offset=>spawnMob('zombie',player.x+2,player.y+offset));for(let i=0;i<3;i++){mobs[i].hp=mobs[i].maxhp=1000;mobs[i].frozen=1;shots[i].x=mobs[i].x-.1;shots[i].y=mobs[i].y;shots[i].vx=0;shots[i].vy=0;}simStep(.01);`);
  assert.ok(Math.abs(g.run('player.artCD[0]')-3.59)<1e-9);assert.equal(g.run('player.arcaneArtReady'),false);
  assert.ok(g.run('mobs.every(m=>m.hp<1000)'));
});
test('高攻速仍保留重武器与分支最短恢复',()=>{
  const g=loadGame();g.run(`player.weapon='hammer';player.eq.weapon=newBase('weapon',0,'hammer');player.G.effIas=120;player.ench.swiftAtk=3;player.rageT=1;startAttack();`);
  assert.ok(g.run('player.T.rec>=.1'));assert.equal(g.run('player.T.attackAt'),.1);
});
