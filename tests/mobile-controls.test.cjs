const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
function phone(){const g=loadGame({width:844,height:390});g.run("hudMode='mobile'");return g;}
function event(g,name,points){g.events[name][0]({type:name,preventDefault(){},changedTouches:points});}
function stick(g,power,id=7){return JSON.parse(g.run(`JSON.stringify({identifier:${id},clientX:(hudLayout().move.x+hudLayout().move.r*.72*${power})*hudLayout().scale,clientY:hudLayout().move.y*hudLayout().scale})`));}
function button(g,action,id=8){return JSON.parse(g.run(`JSON.stringify({identifier:${id},clientX:hudLayout().buttons.${action}.x*hudLayout().scale,clientY:hudLayout().buttons.${action}.y*hudLayout().scale})`));}
const loot=`const a=newBase('ring',0),b=newBase('ring',0),shop=newBase('helm',0);items=[{type:'gear',it:shop,x:5.1,y:5,t:1,price:20},{type:'gear',it:a,x:5.6,y:5,t:1},{type:'gear',it:b,x:6,y:5,t:1}];`;
test('摇杆内圈走路、外圈奔跑，有回差且松手取消',()=>{
  const g=phone();event(g,'touchstart',[stick(g,.55)]);assert.equal(g.run('touch.run'),false);
  event(g,'touchmove',[stick(g,.95)]);assert.equal(g.run('touch.run'),true);
  event(g,'touchmove',[stick(g,.83)]);assert.equal(g.run('touch.run'),true);
  event(g,'touchmove',[stick(g,.72)]);assert.equal(g.run('touch.run'),false);
  event(g,'touchmove',[stick(g,.08)]);assert.equal(g.run('touch.moveX'),0);
  event(g,'touchmove',[stick(g,1)]);event(g,'touchcancel',[stick(g,1)]);
  assert.equal(g.run('touch.run'),false);assert.equal(g.run('touch.moveId'),null);
});
test('奔跑实际消耗耐力，停止后恢复，力竭不能继续加速',()=>{
  const g=phone();event(g,'touchstart',[stick(g,1)]);g.run('stepPlayer(.1)');
  assert.equal(g.run('player.running'),true);assert.ok(g.run('player.sta')<100);
  event(g,'touchmove',[stick(g,.5)]);g.run('stepPlayer(.7)');assert.equal(g.run('player.running'),false);assert.equal(g.run('player.sta'),100);
  event(g,'touchmove',[stick(g,1)]);g.run('player.sta=.5;stepPlayer(.1);stepPlayer(.01)');assert.equal(g.run('player.exh'),true);assert.equal(g.run('player.running'),false);
});
test('摇杆奔跑与翻滚独立，释放右手不会关闭左手奔跑',()=>{
  const g=phone();event(g,'touchstart',[stick(g,1),button(g,'roll')]);event(g,'touchend',[button(g,'roll')]);
  assert.equal(g.run('touch.run'),true);assert.equal(g.run('touch.moveId'),7);
  g.run("openHUDModal('settings')");assert.equal(g.run('touch.run'),false);assert.equal(g.run('touch.moveId'),null);
});
test('跳跃无需打开菜单，可移动跳跃并接空中下砸，取消清理指针',()=>{
  const g=phone();event(g,'touchstart',[stick(g,.55),button(g,'jump')]);
  assert.equal(g.run('state'),'play');assert.equal(g.run('hudModal'),null);assert.equal(g.run('player.buf.type'),'jump');
  g.run('stepPlayer(.016)');assert.ok(g.run('player.z')>0);
  event(g,'touchcancel',[button(g,'jump')]);assert.equal(g.run('touch.jumpId'),null);
  event(g,'touchstart',[button(g,'attack',9)]);g.run('stepPlayer(.016)');assert.equal(g.run('player.st'),'jatk');
});
test('手机一键收取免费装备，邻近商品不会被顺带购买或自动装备',()=>{
  const g=phone();g.run(loot+"player.emeralds=100;const equipped=player.eq.weapon;interact();");
  assert.equal(g.run('player.bag.length'),2);assert.equal(g.run('player.emeralds'),100);assert.equal(g.run('items[0].dead'),undefined);
  assert.equal(g.run('player.eq.weapon===equipped'),true);assert.equal(g.run('mobileInteraction().label'),'购买 · 20 绿宝石');
  g.run('interact();interact()');assert.equal(g.run('player.bag.length'),3);assert.equal(g.run('player.emeralds'),80);
});
test('没有目标或只有免费装备时交互隐藏，有商品时显示购买',()=>{
  const g=phone();assert.equal(g.run('hudLayout().buttons.interact.hidden'),true);
  assert.equal(g.run('const B=hudLayout().buttons.interact;HUDLayout.hit(hudLayout(),B.x+B.w/2,B.y+B.h/2)'),null);
  g.run(loot);assert.equal(g.run('mobileInteraction().label'),'购买 · 20 绿宝石');assert.equal(g.run('hudLayout().buttons.interact.hidden'),false);
  g.run('items=items.filter(g=>!g.price)');assert.equal(g.run('hudLayout().buttons.interact.hidden'),true);
});
test('背包部分装满时只收取能装下的物品，其余留在原地',()=>{
  const g=phone();g.run("for(let i=0;i<39;i++)addToBag(makeRune(0));items=[0,1].map(i=>({type:'gear',it:makeRune(i),x:5.3+i*.2,y:5,t:1}));interact();");
  assert.equal(g.run('player.bag.length'),40);assert.equal(g.run('items.filter(g=>g.dead).length'),1);
  g.run('interact()');assert.equal(g.run('items.filter(g=>g.dead).length'),1);assert.equal(g.run('player.bag.length'),40);
});
test('付费装备不足余额或背包满时保留物品与绿宝石',()=>{
  const g=phone();g.run("items=[{type:'gear',it:newBase('helm',0),x:5.2,y:5,t:1,price:20}];player.emeralds=10;interact();");
  assert.equal(g.run('items[0].dead'),undefined);assert.equal(g.run('player.emeralds'),10);
  g.run('player.emeralds=100;for(let i=0;i<40;i++)addToBag(makeRune(0));interact()');assert.equal(g.run('items[0].dead'),undefined);assert.equal(g.run('player.emeralds'),100);
});
test('剩余空间放不下大装备时仍收取可以装下的小物品',()=>{
  const g=phone();g.run("for(let i=0;i<39;i++)addToBag(makeRune(0));items=[{type:'gear',it:newBase('helm',0),x:5.2,y:5,t:1},{type:'gear',it:makeRune(1),x:5.6,y:5,t:1}];interact();");
  assert.equal(g.run('player.bag.length'),40);assert.equal(g.run('items[0].dead'),undefined);assert.equal(g.run('items[1].dead'),true);
});
test('手机隔墙与未落定装备不可拾取，PC仍逐件收取最近物品',()=>{
  const g=phone();g.run("items=[{type:'gear',it:newBase('ring',0),x:5.4,y:5,t:.1},{type:'gear',it:newBase('ring',0),x:5.8,y:5,t:1}];const originalLOS=los;los=()=>false;interact();");
  assert.equal(g.run('player.bag.length'),0);g.run("los=originalLOS;hudMode='pc';items[0].t=1;interact()");assert.equal(g.run('player.bag.length'),1);
  assert.equal(g.run('items[0].dead'),true);assert.equal(g.run('items[1].dead'),undefined);
});
test('更多去除重复动作，PC Shift仍保留翻滚和按住奔跑',()=>{
  const g=phone();g.run("openHUDModal('more')");assert.deepEqual(Array.from(g.run('hudModalData().items.map(i=>i.action)')),['art0','art1','art2','bow','swap']);
  g.run("closeHUDModal();hudMode='pc';");g.events.keydown[0]({code:'ShiftLeft',preventDefault(){}});assert.equal(g.run('player.buf.type'),'roll');
  g.run('player.buf=null;keys.KeyD=true;stepPlayer(.016)');assert.equal(g.run('player.running'),true);
});
