const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame,mobCode}=require('./game-harness.cjs');

test('连续命中的血条尾迹从当前可见血量继续，最终归于实际 HP',()=>{
  const g=loadGame();g.run(`mobs=[${mobCode}];damageMob(mobs[0],20,0,0,0);`);
  assert.equal(g.run('mobs[0].hp'),80);
  assert.equal(g.run('healthTrailValue(mobs[0],1.1)'),100);
  assert.equal(g.run('healthTrailValue(mobs[0],1.37)'),90);
  g.context.performance.now=()=>1400;
  g.run('damageMob(mobs[0],20,0,0,0);');
  assert.equal(g.run('mobs[0].hp'),60);
  assert.ok(Math.abs(g.run('mobs[0].hpTrail')-88.8)<1e-8);
  assert.equal(g.run('healthTrailValue(mobs[0],2.1)'),60);
});

test('已死亡目标不能重置血条尾迹或重复生成命中文字',()=>{
  const g=loadGame();g.run(`const dead={...${mobCode},hp:0,deathSettled:true,hpTrail:20,hpTrailAt:.5};damageMob(dead,10,0,0,0);`);
  assert.equal(g.run('dead.hpTrailAt'),.5);assert.equal(g.run('texts.length'),0);
});

test('普通伤害数字快速退场，打断与拾取说明保留原有阅读时间',()=>{
  const g=loadGame();g.run(`const target=${mobCode};addText(6,5,1.4,'20','#fff',1,target);addText(6,5,1.6,'打断!','#9fe8ff',1,target);addText(5,5,1.6,'绿宝石 +3','#7affaa');updateVisual(.96);`);
  assert.equal(g.run('texts.length'),2);
  assert.equal(g.run('texts.some(t=>t.txt==="20")'),false);
  g.run('updateVisual(.25);');assert.equal(g.run('texts.length'),1);
  assert.equal(g.run('texts[0].txt'),'打断!');
});

test('PC 移动保留可见鼠标，手机不会在 HUD 触点绘制 PC 指针',()=>{
  const g=loadGame();g.run('let filled=0;ctx.fill=()=>filled++;hudMode="pc";drawCursor();');
  assert.equal(g.run('filled'),1);
  g.run('hudMode="mobile";drawCursor();');assert.equal(g.run('filled'),1);
});
