const test=require('node:test');
const assert=require('node:assert/strict');
const gameplay=require('../weapon-gameplay.js');
const {loadGame,mobCode}=require('./game-harness.cjs');
function second(kind='greatsword'){
  const g=loadGame({lab:true,weapon:kind});
  g.run(`player.weapon='${kind}';player.eq.weapon=newBase('weapon',0,'${kind}');mouse.wx=10;mouse.wy=5;weaponGameplay.sync();startAttack();player.ph='rec';player.pt=.2;startAttack();player.ph='rec';player.pt=0;onActEnd();`);
  return g;
}
function branch(kind){const g=second(kind);g.run(`mouse.l=false;stepPlayer(.15);player.attackPress=1;player.buf={type:'atk',t:.2,press:1};mouse.l=true;stepPlayer(.008);player.ph='act';player.pt=0;`);return g;}
test('持续按住第二击后仍走基础连段',()=>{
  const g=second();g.run('mouse.l=true;stepPlayer(.11);stepPlayer(.008);');assert.equal(g.run('player.atkDef.branch'),undefined);assert.equal(g.run('player.combo'),2);
});
test('第二击后连续松手并重新按下才触发重劈',()=>{
  const g=branch('greatsword');assert.equal(g.run('player.atkDef.branch'),'cleave');assert.equal(g.run('player.atkDef.shock'),undefined);
});
test('快速连点不能累计分散的松手时间',()=>{
  const g=second();g.run(`for(let i=0;i<3;i++){mouse.l=false;weaponGameplay.step(.05);mouse.l=true;weaponGameplay.step(.01);}`);
  assert.equal(g.run('weaponGameplay.status().ready'),false);
});
test('就绪前的缓冲按键不能触发变招',()=>{
  const g=second();g.run(`player.attackPress=2;player.buf={type:'atk',t:.3,press:2};mouse.l=false;weaponGameplay.step(.15);player.pt=.2;startAttack();`);
  assert.equal(g.run('player.atkDef.branch'),undefined);
});
test('自动按住缓冲不能消费已经就绪的变招',()=>{
  const g=second();g.run(`mouse.l=false;weaponGameplay.step(.15);player.buf={type:'atk',t:.2};player.pt=.2;startAttack();`);
  assert.equal(g.run('player.atkDef.branch'),undefined);
});
test('窗口从第二击后摇开始并会失效',()=>{
  const g=second();g.run('weaponGameplay.step(.86)');assert.equal(g.run('weaponGameplay.status().waiting'),false);
});
for(const action of ['startRoll()','doJump()','state="pause";weaponGameplay.sync()','floorN++;weaponGameplay.sync()','player.eq.weapon.uid++;weaponGameplay.sync()']){
  test(`中断准备状态：${action}`,()=>{const g=second();g.run(`mouse.l=false;weaponGameplay.step(.15);${action}`);assert.equal(g.run('weaponGameplay.status().ready'),false);});
}
test('失焦清理按住状态、输入缓冲和变招',()=>{
  const g=second();g.run(`mouse.l=false;weaponGameplay.step(.15);player.buf={type:'atk',t:1,press:2};`);g.events.blur.forEach(f=>f());
  assert.equal(g.run('player.buf'),null);assert.equal(g.run('weaponGameplay.status().ready'),false);
});
test('手机攻击按钮使用相同的新按下事件',()=>{
  const g=second('sickles');g.run(`touchAction('attack',false);stepPlayer(.15);touchAction('attack',true);stepPlayer(.008);`);
  assert.equal(g.run('player.atkDef.branch'),'hook');
});
test('巨剑重劈只命中前方窄线并保留一次命中限制',()=>{
  const g=branch('greatsword');g.run(`mobs=[${mobCode},${mobCode},${mobCode}];mobs[1].x=4;mobs[2].y=7;bladeHits([],[]);const hp=mobs[0].hp;bladeHits([],[]);`);
  assert.ok(g.run('mobs[0].hp<100'));assert.equal(g.run('mobs[0].hp'),g.run('hp'));assert.equal(g.run('mobs[1].hp'),100);assert.equal(g.run('mobs[2].hp'),100);
});
test('重劈不会越墙造成伤害',()=>{
  const g=branch('greatsword');g.run(`mobs=[${mobCode}];mobs[0].x=7.5;G[idx(6,5)]=0;bladeHits([],[]);`);assert.equal(g.run('mobs[0].hp'),100);
});
test('勾回剪击通过连续移动拉近轻敌，最大 1.5 单位',()=>{
  const g=branch('sickles');g.run(`mobs=[${mobCode}];mobs[0].x=7.3;const origin=mobs[0].x;bladeHits([],[]);weaponGameplay.step(.04);const partial=mobs[0].x;weaponGameplay.step(.10);`);
  assert.ok(g.run('partial<origin && partial>origin-1.5'));assert.ok(g.run('origin-mobs[0].x<=1.5000001'));assert.ok(g.run('mobs[0].hp<100'));
});
test('重型前排挡住后排轻敌，重型不会被拉动或停掉 AI',()=>{
  const g=branch('sickles');g.run(`mobs=[${mobCode},${mobCode}];mobs[0].type='treant';mobs[0].mass=3;mobs[1].x=7.5;const origin=mobs[0].x;bladeHits([],[]);const controlled=weaponGameplay.controls(mobs[0]);weaponGameplay.step(.2);`);
  assert.equal(g.run('mobs[0].x'),g.run('origin'));assert.equal(g.run('mobs[1].x'),7.5);assert.equal(g.run('controlled'),false);
});
test('勾回时翻滚立即中断拉动',()=>{
  const g=branch('sickles');g.run(`mobs=[${mobCode}];mobs[0].x=7;bladeHits([],[]);startRoll();const origin=mobs[0].x;weaponGameplay.step(.1);`);
  assert.equal(g.run('mobs[0].x'),g.run('origin'));assert.equal(g.run('weaponGameplay.status().hook'),false);
});
test('拉动期间目标死亡不会继续位移',()=>{
  const g=branch('sickles');g.run(`mobs=[${mobCode}];mobs[0].x=7;bladeHits([],[]);mobs[0].hp=0;const origin=mobs[0].x;weaponGameplay.step(.1);`);
  assert.equal(g.run('mobs[0].x'),g.run('origin'));
});
test('战锤直接击杀不会抛飞尸体',()=>{
  const g=branch('hammer');g.run(`mobs=[${mobCode}];mobs[0].hp=1;bladeHits([],[]);`);assert.equal(g.run('weaponGameplay.status().throws'),0);assert.equal(g.run('stats.kills'),1);
});
test('战锤打飞撞墙只结算一次，碰撞伤害冻结装备来源',()=>{
  const g=branch('hammer');g.run(`mobs=[${mobCode}];bladeHits([],[]);const hp=mobs[0].hp;player.G.wMin=player.G.wMax=10000;G[idx(8,5)]=0;for(let i=0;i<10;i++)weaponGameplay.step(.05);const after=mobs[0].hp;weaponGameplay.step(1);`);
  assert.ok(g.run('hp-after>0 && hp-after<20'));assert.equal(g.run('mobs[0].hp'),g.run('after'));assert.equal(g.run('weaponGameplay.status().throws'),0);assert.ok(g.run('mobs[0].x<8-mobs[0].r'));
});
test('撞到另一敌人不递归产生第二次打飞',()=>{
  const g=branch('hammer');g.run(`mobs=[${mobCode},${mobCode}];mobs[1].x=7.7;bladeHits([],[]);const otherX=mobs[1].x;for(let i=0;i<10;i++)weaponGameplay.step(.05);`);
  assert.ok(g.run('mobs[1].hp<100'));assert.equal(g.run('mobs[1].x'),g.run('otherX'));assert.equal(g.run('weaponGameplay.status().throws'),0);
});
test('打飞最大距离受限，换层清空位移',()=>{
  const g=branch('hammer');g.run(`mobs=[${mobCode}];const origin=mobs[0].x;bladeHits([],[]);weaponGameplay.step(.5);const end=mobs[0].x;`);
  assert.ok(Math.abs(g.run('end-origin')-2.8)<1e-8);
  const h=branch('hammer');h.run(`mobs=[${mobCode}];bladeHits([],[]);floorN++;weaponGameplay.sync();`);assert.equal(h.run('weaponGameplay.status().throws'),0);
});
test('Boss 可受变招伤害，动作计时和位移不被改写',()=>{
  const g=branch('hammer');g.run(`mobs=[${mobCode}];Object.assign(mobs[0],{boss:true,st:'wind',t:.4,vx:2,vy:1,poise:0});bladeHits([],[]);`);
  assert.ok(g.run('mobs[0].hp<100'));assert.equal(g.run('mobs[0].st'),'wind');assert.equal(g.run('mobs[0].t'),.4);assert.equal(g.run('mobs[0].vx'),2);assert.equal(g.run('weaponGameplay.status().throws'),0);
});
test('圆形扫掠不能穿墙角、箱子、玩家或其他单位',()=>{
  const p={x:1,y:1,r:.3}, m={x:3,y:3,r:.3,hp:100};let crates=[],mobs=[m];
  const world={player:()=>p,mobs:()=>mobs,crates:()=>crates,isFloor:(i,j)=>!(i===4&&j===4)};
  const corner=gameplay.sweep(m,2,2,world);assert.equal(corner.hit.kind,'wall');assert.ok(m.x<4);
  m.x=3;m.y=3;crates=[{x:4,y:3,r:.4}];assert.equal(gameplay.sweep(m,2,0,world).hit.kind,'crate');
  m.x=3;m.y=3;crates=[];mobs=[m,{x:4,y:3,r:.3,hp:100}];assert.equal(gameplay.sweep(m,2,0,world).hit.kind,'mob');
  m.x=3;m.y=1;mobs=[m];assert.equal(gameplay.sweep(m,-3,0,world).hit.kind,'player');
});
test('免疫列表包含首领、幽灵、树人、空中与传送敌人',()=>{
  for(const type of ['golem','treant','wraith','enderman','blaze','bat'])assert.equal(gameplay.movable({type,hp:100,mass:1,z:0}),false);
  assert.equal(gameplay.movable({type:'zombie',hp:100,mass:1,z:.5}),false);
});
test('Boss 面对变招词缀、相位共鸣和狂暴仍保留原动作',()=>{
  const g=branch('hammer');g.run(`mobs=[${mobCode}];Object.assign(mobs[0],{boss:true,elite:true,hp:42,maxhp:100,st:'wind',t:.4,vx:2,vy:1,cd:2,poise:0});player.ench.dodge=1;player.ench.freeze=1;player.phaseReady=true;player.phaseT=1;player.G.coldDmg=2;player.atkSource=CombatRules.snapshot(player,player.attackId);bladeHits([],[]);`);
  assert.equal(g.run('mobs[0].st'),'wind');assert.equal(g.run('mobs[0].t'),.4);assert.equal(g.run('mobs[0].vx'),2);assert.equal(g.run('mobs[0].cd'),2);assert.equal(g.run('mobs[0].frozen'),0);
});
test('高攻速变招也保留 0.18 秒恢复',()=>{
  const g=second('hammer');g.run(`player.G.effIas=120;player.ench.swiftAtk=3;player.rageT=1;mouse.l=false;stepPlayer(.15);player.attackPress=1;player.buf={type:'atk',t:.2,press:1};mouse.l=true;stepPlayer(.008);`);
  assert.equal(g.run('player.atkDef.branch'),'launch');assert.ok(g.run('player.T.rec>=.18'));assert.equal(g.run('player.T.attackAt'),.18);
});
