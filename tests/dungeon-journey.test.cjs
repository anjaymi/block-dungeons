const test=require('node:test'),assert=require('node:assert/strict');
const MapGen=require('../dungeon-map.js'),Journey=require('../dungeon-journey.js');
const {loadGame,mobCode}=require('./game-harness.cjs');

test('200 张地图都有一条可选祭坛支路，符印位置可达、可复现',()=>{
  for(let seed=0;seed<200;seed++){
    const m=MapGen.generate({seed,nMain:7,nSide:4,shrine:true}),a=Journey.create(m,'苔石地牢',1),b=Journey.create(m,'苔石地牢',1);
    assert.deepEqual(a,b);assert.equal(a.needed,2);
    const trial=m.rooms.find(r=>r.type==='shrine');assert.equal(trial.conn.length,1);
    for(const f of a.fixtures)assert.equal(m.G[Math.floor(f.y)*m.GW+Math.floor(f.x)],1);
    const portal=a.fixtures.find(f=>f.kind==='portal');
    for(let x=-1;x<=1;x++)assert.equal(m.G[Math.floor(portal.y)*m.GW+Math.floor(portal.x)+x],1);
    const terrain=MapGen.buildTerrain(m),seen=new Set(),q=[[m.rooms[0].cx,m.rooms[0].cy]];
    seen.add(q[0].join(','));
    for(let h=0;h<q.length;h++){const [x,y]=q[h];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,key=a+','+b;if(!seen.has(key)&&MapGen.canStep(terrain,x,y,a,b)){seen.add(key);q.push([a,b]);}}}
    for(const f of a.fixtures)assert.ok(seen.has(Math.floor(f.x)+','+Math.floor(f.y)));
  }
});
test('搜索回退也生成祭坛；首领层只要求现有主路的一枚符印',()=>{
  const m=MapGen.generate({seed:12,nMain:3,nSide:2,boss:true,shrine:true,layoutLimit:0}),j=Journey.create(m,'沙海遗迹',5);
  assert.equal(m.rooms.find(r=>r.type==='shrine').conn.length,1);assert.equal(j.needed,1);
  assert.equal(j.fixtures.filter(f=>f.kind==='beacon').length,1);
});
test('符印必须先清守卫，再交互；每枚只计一次，出口同时要求守卫和符印',()=>{
  const m=MapGen.generate({seed:71,shrine:true,nSide:3}),j=Journey.create(m,'苔石地牢',1),seals=j.fixtures.filter(f=>f.kind==='beacon'),portal=j.fixtures.find(f=>f.kind==='portal');
  assert.equal(Journey.activate(j,seals[0]),null);
  Journey.clear(j,m.rooms[portal.room]);assert.equal(portal.phase,'sealed');
  for(const f of seals){Journey.clear(j,m.rooms[f.room]);assert.equal(f.phase,'ready');assert.equal(Journey.activate(j,f),'seal');assert.equal(Journey.activate(j,f),null);}
  assert.equal(j.seals,j.needed);assert.equal(portal.phase,'open');
});
test('先齐符印再清出口同样开门；祭坛挑战完全不阻挡主线',()=>{
  const m=MapGen.generate({seed:31,shrine:true,nSide:3}),j=Journey.create(m,'幽深矿井',2),portal=j.fixtures.find(f=>f.kind==='portal');
  for(const f of j.fixtures.filter(f=>f.kind==='beacon')){Journey.clear(j,m.rooms[f.room]);Journey.activate(j,f);}
  assert.equal(portal.phase,'sealed');Journey.clear(j,m.rooms[portal.room]);assert.equal(portal.phase,'open');assert.equal(j.trial,'unstarted');
});
test('五种真实主题与首领层重开会重置任务、挑战和补给',()=>{
  const g=loadGame();
  for(let floor=1;floor<=10;floor++){
    g.run(`floorN=${floor};genFloor();computeFlow(rooms[0].cx,rooms[0].cy,999);`);
    assert.equal(g.run('rooms.every(r=>flow[idx(r.cx,r.cy)]>=0)'),true);
    assert.equal(g.run('journey.seals'),0);assert.equal(g.run('journey.trial'),'unstarted');assert.equal(g.run('exitOpen'),false);
    assert.equal(g.run("journey.fixtures.find(f=>f.kind==='waystone').phase"),'dormant');
    assert.equal(g.run("journey.fixtures.filter(f=>f.kind==='shrine').length"),1);
  }
});
test('真实出口清房后保持封印，最后一次 F 点亮立即开门并进入升级',()=>{
  const g=loadGame();g.run(`genFloor();const er=rooms.find(r=>r.type==='exit');er.cleared=true;roomClearReward(er);`);
  assert.equal(g.run('exitOpen'),false);
  g.run(`for(const f of journey.fixtures.filter(f=>f.kind==='beacon')){const r=rooms[f.room];r.cleared=r.visited=true;roomClearReward(r);player.x=f.x;player.y=f.y;interact();interact();}`);
  assert.equal(g.run('journey.seals===journey.needed&&exitOpen'),true);
  g.run('player.x=exitPos.x;player.y=exitPos.y;rooms[er.id].visited=true;interact();');assert.equal(g.run('state'),'upgrade');
});
test('祭坛由 F 主动开始、锁门、生成两波；结束开门发奖且不可重复领取',()=>{
  const g=loadGame();g.run(`genFloor();const f=journey.fixtures.find(f=>f.kind==='shrine'),r=rooms[f.room];player.x=f.x;player.y=f.y;stepRooms(.01);const before=chests.length;`);
  assert.equal(g.run('r.active'),undefined);assert.equal(g.run('journey.trial'),'unstarted');
  g.run('interact();');assert.equal(g.run('r.active'),true);assert.equal(g.run('r.wavesLeft'),1);assert.equal(g.run('journey.trial'),'active');assert.ok(g.run('mobs.length')>0);
  g.run('mobs.forEach(m=>m.hp=0);stepRooms(1);');assert.equal(g.run('r.wavesLeft'),0);assert.ok(g.run('mobs.some(m=>m.hp>0)'));
  g.run('mobs.forEach(m=>m.hp=0);stepRooms(1);');assert.equal(g.run('journey.trial'),'complete');assert.equal(g.run('r.active'),false);assert.equal(g.run('r.gates.every(([x,y])=>G[idx(x,y)]===1)'),true);
  assert.equal(g.run('chests.length-before'),2);
  g.run('const rewardCount=chests.length;roomClearReward(r);interact();');assert.equal(g.run('chests.length'),g.run('rewardCount'));assert.equal(g.run('journey.trial'),'complete');
});
test('旅途石满补给不消耗，有缺口时只休整一次',()=>{
  const g=loadGame();g.run(`genFloor();const f=journey.fixtures.find(f=>f.kind==='waystone');player.x=f.x;player.y=f.y;interact();`);
  assert.equal(g.run('f.phase'),'dormant');
  g.run('player.hp=1;player.potCD=8;player.arrows=0;interact();');assert.equal(g.run('player.hp'),g.run('player.maxhp'));assert.equal(g.run('player.potCD'),0);assert.equal(g.run('player.arrows'),20);
  g.run('player.hp=1;interact();');assert.equal(g.run('player.hp'),1);assert.equal(g.run('f.phase'),'spent');
});
test('交互不能隔墙、暂停、空中或攻击前摇点亮符印',()=>{
  const g=loadGame();g.run(`genFloor();const f=journey.fixtures.find(f=>f.kind==='beacon');rooms[f.room].visited=true;f.phase='ready';player.x=f.x-1.4;player.y=f.y;G[idx(Math.floor(f.x-1),Math.floor(f.y))]=0;interact();`);
  assert.equal(g.run('journey.seals'),0);
  for(const setting of ["state='pause'","state='play';player.z=.6","player.z=0;player.st='atk';player.ph='wind'"]){g.run(`player.x=f.x;player.y=f.y;${setting};interact();`);assert.equal(g.run('journey.seals'),0);}
  g.run("player.st='move';interact();");assert.equal(g.run('journey.seals'),1);
});
test('任务与交互按钮读取实时符印状态，休整与任务弹窗不会卡住',()=>{
  const g=loadGame();g.run(`genFloor();const f=journey.fixtures.find(f=>f.kind==='beacon');rooms[f.room].visited=true;curRoom=rooms[f.room];DungeonJourney.clear(journey,curRoom);player.x=f.x;player.y=f.y;`);
  assert.match(g.run("hudActionData('interact').label"),/点亮/);assert.match(g.run('DungeonJourney.objective(journey,curRoom)'),/点亮房间/);
  g.run("hudAction('quest');");assert.equal(g.run('state'),'pause');assert.match(g.run("hudModalData().lines.join(' ')"),/主线：点亮符印/);
  g.run('closeHUDModal();interact();');assert.equal(g.run('state'),'play');assert.equal(g.run('journey.seals'),1);
});
test('跳跃下砸命中可见地面目标，不能打穿墙或击中悬空目标',()=>{
  const g=loadGame();g.run(`mobs=[${mobCode},${mobCode},${mobCode}];mobs[0].x=5.8;mobs[0].y=5.5;mobs[1].x=6.9;mobs[1].y=5;mobs[2].x=5.9;mobs[2].y=5.4;mobs[2].z=1.3;G[idx(6,5)]=0;player.z=.5;mouse.wx=8;mouse.wy=5;startJumpAttack();jumpImpact();`);
  assert.ok(g.run('mobs[0].hp<100'));assert.equal(g.run('mobs[1].hp'),100);assert.equal(g.run('mobs[2].hp'),100);
});
test('下砸半径使用起跳装备快照；高台上的地面目标不被低处震波击中',()=>{
  const g=loadGame();g.run(`mobs=[${mobCode}];mobs[0].x=8.1;player.ench.paw=1;player.z=.5;mouse.wx=8;mouse.wy=5;startJumpAttack();player.ench.paw=3;jumpImpact();`);assert.equal(g.run('mobs[0].hp'),100);
  g.run(`player.ench.paw=0;mobs[0].x=6;const H=new Float32Array(G.length);for(let y=0;y<GH;y++)for(let x=6;x<GW;x++)H[idx(x,y)]=1.15;terrain={G,GW,GH,H,corners:new Float32Array((GW+1)*(GH+1)),maxStep:.36,positions:new WeakMap()};for(let y=0;y<=GH;y++)for(let x=6;x<=GW;x++)terrain.corners[y*(GW+1)+x]=1.15;jumpImpact();`);assert.equal(g.run('mobs[0].hp'),100);
});
function activeAltar(){
  const g=loadGame();g.run(`genFloor();const f=journey.fixtures.find(f=>f.kind==='shrine'),r=rooms[f.room];player.x=f.x;player.y=f.y;stepRooms(.01);interact();player.hp=player.maxhp;player.G.block=0;player.inv=0;`);return g;
}
test('祭坛蓄能提前 1.2 秒提示，脉冲只结算一次；停留地面受伤',()=>{
  const g=activeAltar();g.run('stepJourney(3.2);');assert.equal(g.run('journey.pulse.phase'),'charge');assert.equal(g.run('player.hp'),g.run('player.maxhp'));
  assert.match(g.run('DungeonJourney.objective(journey,curRoom)'),/跳跃/);
  g.run('stepJourney(1.19);');assert.equal(g.run('player.hp'),g.run('player.maxhp'));
  g.run('stepJourney(.02);const after=player.hp;stepJourney(.2);');assert.ok(g.run('after<player.maxhp'));assert.equal(g.run('player.hp'),g.run('after'));
});
test('跳跃、翻滚无敌、离开范围、隔墙、其他房间均可避开祭坛脉冲',()=>{
  for(const setup of ['player.z=.8','player.st=\'roll\';player.inv=.3','player.x=f.x+4','G[idx(Math.floor(f.x)+1,Math.floor(f.y))]=0;player.x=f.x+1.4',"player.x=rooms[0].cx+.5;player.y=rooms[0].cy+.5"]){
    const g=activeAltar();g.run(`stepJourney(3.2);${setup};stepJourney(1.3);`);assert.equal(g.run('player.hp'),g.run('player.maxhp'),setup);
  }
});
test('暂停不推进蓄能，挑战结束立即清除脉冲，长帧不会跳过释放',()=>{
  const g=activeAltar();g.run("state='pause';stepJourney(9);");assert.equal(g.run('journey.pulse.phase'),'waiting');assert.equal(g.run('journey.pulse.t'),3.2);
  g.run("state='play';stepJourney(4.5);");assert.ok(g.run('player.hp<player.maxhp'));
  g.run('DungeonJourney.clear(journey,r);const hp=player.hp;stepJourney(9);');assert.equal(g.run('journey.pulse'),null);assert.equal(g.run('player.hp'),g.run('hp'));
});
test('手机交互触摸开始祭坛，松手清理触点，不误触发攻击',()=>{
  const g=loadGame({width:844,height:470});g.run(`genFloor();hudMode='mobile';const f=journey.fixtures.find(f=>f.kind==='shrine');player.x=f.x;player.y=f.y+1.4;stepRooms(.01);const l=hudLayout(),b=l.buttons.interact,t={identifier:91,clientX:b.x*l.scale+l.inset.left,clientY:b.y*l.scale+l.inset.top};touchStart({changedTouches:[t],preventDefault(){}});touchEnd({changedTouches:[t],preventDefault(){}});`);
  assert.equal(g.run('journey.trial'),'active');assert.equal(g.run('mouse.l'),false);assert.equal(g.run('player.st'),'move');
});
