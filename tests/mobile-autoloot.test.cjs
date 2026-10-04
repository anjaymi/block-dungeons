const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
function game(mobile=true){const g=loadGame();g.run(`hudMode='${mobile?'mobile':'pc'}';explored=new Uint8Array(G.length);roomId=new Int16Array(G.length).fill(-1);flow=new Int16Array(G.length).fill(-1);`);return g;}
function phone(){return game();}
const drops="const a=newBase('ring',0),b=newBase('ring',0),shop=newBase('helm',0);items=[{type:'gear',it:a,x:5.3,y:5,z:0,vz:0,t:1},{type:'gear',it:b,x:5.6,y:5,z:0,vz:0,t:1},{type:'gear',it:shop,x:5.1,y:5,z:0,vz:0,t:1,price:20}];";
test('实际游戏模拟自动拾取免费装备，只收进背包，不购买或换装',()=>{
  const g=phone();g.run(drops+"player.emeralds=100;const eq=player.eq.weapon;simStep(.016);simStep(.016);");
  assert.equal(g.run('player.bag.length'),2);assert.equal(g.run('items.length'),1);assert.equal(g.run('items[0].it===shop'),true);
  assert.equal(g.run('player.emeralds'),100);assert.equal(g.run('player.eq.weapon===eq'),true);
  g.run('interact();simStep(.016)');assert.equal(g.run('player.emeralds'),80);assert.equal(g.run('player.bag.length'),3);
});
test('攻击过程中自动拾取不打断当前动作或改变已捕获的武器',()=>{
  const g=phone();g.run(drops+'startAttack();const source=player.atkSource;const uid=player.eq.weapon.uid;simStep(.016);');
  assert.equal(g.run('player.st'),'atk');assert.equal(g.run('player.atkSource===source'),true);assert.equal(g.run('player.eq.weapon.uid'),g.run('uid'));assert.equal(g.run('player.bag.length'),2);
});
test('装备未落地、超过范围、隔墙或跨越高台时不会自动拾取',()=>{
  const g=phone();g.run("items=[{type:'gear',it:newBase('ring',0),x:5.2,y:5,z:.5,vz:1,t:1},{type:'gear',it:newBase('ring',0),x:7,y:5,z:0,vz:0,t:1}];stepMobileLoot(.2)");
  assert.equal(g.run('player.bag.length'),0);
  g.run('items[0].z=items[0].vz=0;const oldLOS=los;los=()=>false;stepMobileLoot(.2)');assert.equal(g.run('player.bag.length'),0);
  g.run('los=()=>true;terrain={GW,GH,corners:new Float32Array((GW+1)*(GH+1))};for(let y=0;y<=GH;y++)for(let x=6;x<=GW;x++)terrain.corners[y*(GW+1)+x]=4;stepMobileLoot(.2)');assert.equal(g.run('player.bag.length'),0);
  g.run('terrain=null;los=oldLOS;stepMobileLoot(.2)');assert.equal(g.run('player.bag.length'),1);
});
test('背包满只提示一次，腾出位置后自动重试且不重复入包',()=>{
  const g=phone();g.run("for(let i=0;i<40;i++)addToBag(makeRune(0));items=[{type:'gear',it:makeRune(1),x:5.3,y:5,z:0,vz:0,t:1}];for(let i=0;i<20;i++)stepMobileLoot(.2)");
  assert.equal(g.run("texts.filter(t=>t.txt==='背包已满').length"),1);assert.equal(g.run('items[0].dead'),undefined);
  g.run('player.bag.pop();stepMobileLoot(.2);stepMobileLoot(.2)');assert.equal(g.run('player.bag.length'),40);assert.equal(g.run('items[0].dead'),true);
});
test('大装备装不下时继续收取小物品，保留大装备和商品',()=>{
  const g=phone();g.run("for(let i=0;i<39;i++)addToBag(makeRune(0));items=[{type:'gear',it:newBase('helm',0),x:5.1,y:5,z:0,vz:0,t:1},{type:'gear',it:makeRune(1),x:5.3,y:5,z:0,vz:0,t:1}];stepMobileLoot(.2)");
  assert.equal(g.run('player.bag.length'),40);assert.equal(g.run('items[0].dead'),undefined);assert.equal(g.run('items[1].dead'),true);
});
test('主动丢弃的物品不会被自动收回，可点按拾回',()=>{
  const g=phone();g.run("const it=newBase('ring',0);addToBag(it);requestBag();inventoryState.selection={it};inventoryAction({kind:'itemDrop'});closeBag();const dropped=items[0];dropped.z=dropped.vz=0;dropped.t=1;stepMobileLoot(.2)");
  assert.equal(g.run('player.bag.length'),0);assert.equal(g.run('dropped.manualPickup'),true);assert.equal(g.run('mobileInteraction().label'),'拾回');
  g.run("hudAction('interact')");assert.equal(g.run('player.bag.length'),1);assert.equal(g.run('player.bag[0].it===it'),true);
});
test('暂停、背包和空中不会自动拾取，恢复地面冒险后继续',()=>{
  const g=phone();g.run(drops+"openHUDModal('settings');stepMobileLoot(.2)");assert.equal(g.run('player.bag.length'),0);
  g.run('closeHUDModal();requestBag();stepMobileLoot(.2)');assert.equal(g.run('player.bag.length'),0);
  g.run('closeBag();player.z=.5;stepMobileLoot(.2)');assert.equal(g.run('player.bag.length'),0);
  g.run('player.z=player.vz=0;stepMobileLoot(.2)');assert.equal(g.run('player.bag.length'),2);
});
test('PC保持手动拾取最近一件，不触发手机自动拾取',()=>{
  const g=game(false);g.run(drops+'simStep(.016)');assert.equal(g.run('player.bag.length'),0);
  g.run('player.emeralds=100;interact()');assert.equal(g.run('player.bag.length'),1);assert.equal(g.run('player.emeralds'),80);
});
