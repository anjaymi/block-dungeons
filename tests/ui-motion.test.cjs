const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
function fixture(options={}){let time=1000;const g=loadGame(options);g.context.performance.now=()=>time;g.at=t=>{time=t;};return g;}
function key(g,code='KeyI',repeat=false){g.events.keydown[0]({code,repeat,preventDefault(){}});}
function read(g,s){return JSON.parse(g.run(`JSON.stringify(${s})`));}
function visualCentre(g,b){const v=read(g,'UIMotion.view(cv.width,cv.height)');return {x:(b.x+b.w/2)*v.scale+v.x,y:(b.y+b.h/2)*v.scale+v.y};}
function touch(g,type,p,id=7){g.events[type][0]({type,preventDefault(){},changedTouches:[{identifier:id,clientX:p.x,clientY:p.y}]});}

test('I 键立即切换状态，画面展开与收起，不等待动画处理装备',()=>{
  const g=fixture();key(g);assert.equal(g.run('state'),'bag');assert.equal(g.run("UIMotion.value('inventory')"),0);
  g.at(1050);assert.ok(g.run("UIMotion.value('inventory')>0&&UIMotion.value('inventory')<1"));
  g.at(1250);assert.equal(g.run("UIMotion.value('inventory')"),1);
  g.run('const it=makeRune(0);player.cursor=it;');key(g);
  assert.equal(g.run('state'),'play');assert.equal(g.run('player.cursor'),null);assert.equal(g.run('player.bag.filter(b=>b.it===it).length'),1);
  assert.equal(g.run("UIMotion.value('inventory')"),1);g.at(1330);assert.ok(g.run("UIMotion.value('inventory')>0&&UIMotion.value('inventory')<1"));
  g.at(1450);g.run('inventoryDrawExit();');assert.equal(g.run("UIMotion.value('inventory')"),0);assert.equal(g.run('state'),'play');assert.equal(g.run('player.bag.filter(b=>b.it===it).length'),1);
});
test('快速反复按 I 从当前画面折返，长按键盘不会反复开关',()=>{
  const g=fixture();key(g);g.at(1030);const opening=g.run("UIMotion.value('inventory')");key(g);
  assert.equal(g.run("UIMotion.value('inventory')"),opening);g.at(1045);const closing=g.run("UIMotion.value('inventory')");assert.ok(closing<opening);
  key(g);assert.equal(g.run("UIMotion.value('inventory')"),closing);key(g,'KeyI',true);assert.equal(g.run('state'),'bag');
  g.at(1400);assert.equal(g.run("UIMotion.value('inventory')"),1);assert.equal(g.run('state'),'bag');
});
test('背包展开中的按钮和格子按当前显示位置命中，独立于镜头缩放',()=>{
  for(const [w,h,mobile]of [[1280,760,false],[844,390,true],[667,375,true],[390,844,true]]){
    const g=fixture({width:w,height:h});g.run(`hudMode='${mobile?'mobile':'pc'}';setZoom(2.2);requestBag();`);g.at(1032);
    const b=read(g,"inventoryLayout().bagActions.find(b=>b.kind==='sort')"),p=visualCentre(g,b);
    assert.equal(g.run(`inventoryHit(${p.x},${p.y}).kind`),'sort');
    const grid=read(g,'inventoryLayout().grid'),cell={x:grid.x,y:grid.y,w:grid.cell,h:grid.cell},q=visualCentre(g,cell);
    assert.equal(g.run(`inventoryHit(${q.x},${q.y}).cx`),0);assert.equal(g.run(`inventoryHit(${q.x},${q.y}).cy`),0);
  }
});
test('PC 极快点击仍有按压反馈，整理即时完成且不重复执行',()=>{
  const g=fixture();g.run("requestBag();const it=makeRune(0);player.bag=[{it,x:9,y:3}];");g.at(1250);
  const b=read(g,"inventoryLayout().bagActions.find(b=>b.kind==='sort')"),p=visualCentre(g,b);
  g.events.mousedown[0]({button:0,clientX:p.x,clientY:p.y});g.events.mouseup[0]({button:0,clientX:p.x,clientY:p.y});
  assert.equal(g.run('player.bag[0].x'),0);assert.equal(g.run('player.bag[0].it===it'),true);
  g.at(1290);assert.ok(g.run(`UIMotion.amount(UIMotion.inventoryKey(${JSON.stringify(b)}))>0`));
  g.at(1600);assert.equal(g.run(`UIMotion.amount(UIMotion.inventoryKey(${JSON.stringify(b)}))`),0);assert.equal(g.run('player.bag.length'),1);
});
test('手机按钮随手指保持按下，松手整理一次，取消不整理',()=>{
  const g=fixture({width:844,height:390});g.run("hudMode='mobile';requestBag();const it=makeRune(0);player.bag=[{it,x:9,y:3}];");g.at(1250);
  const b=read(g,"inventoryLayout().bagActions.find(b=>b.kind==='sort')"),p=visualCentre(g,b);
  touch(g,'touchstart',p);g.at(1650);g.run('inventoryHold();');assert.equal(g.run('player.bag[0].x'),9);
  assert.equal(g.run(`UIMotion.amount(UIMotion.inventoryKey(${JSON.stringify(b)}))`),1);
  touch(g,'touchcancel',p);assert.equal(g.run('player.bag[0].x'),9);assert.equal(g.run('mouse.l'),false);
  g.at(2000);assert.equal(g.run(`UIMotion.amount(UIMotion.inventoryKey(${JSON.stringify(b)}))`),0);
  touch(g,'touchstart',p);g.at(2100);touch(g,'touchend',p);assert.equal(g.run('player.bag[0].x'),0);assert.equal(g.run('player.bag[0].it===it'),true);assert.equal(g.run('player.bag.length'),1);
});
test('动效中手机轻点装备仍只转移一个真实物品',()=>{
  const g=fixture({width:844,height:390});g.run("hudMode='mobile';requestBag();const it=newBase('helm',0);addToBag(it);inventorySelect({kind:'grid',cx:0,cy:0});");g.at(1040);
  const b=read(g,"inventoryDrawer().buttons.find(b=>b.kind==='itemUse')"),p=visualCentre(g,b);
  touch(g,'touchstart',p);touch(g,'touchend',p);assert.equal(g.run('player.eq.helm===it'),true);assert.equal(g.run('player.bag.length'),0);
});
test('失焦解除手机与键盘按住，反馈会回到静止',()=>{
  const g=fixture();g.run("hudMode='mobile';touch.attackId=8;touch.rollId=9;touch.run=true;mouse.l=true;UIMotion.down('hud:attack','live:hud:attack');");key(g,'KeyQ');g.at(1080);
  g.events.blur[0]();assert.equal(g.run('touch.attackId'),null);assert.equal(g.run('touch.rollId'),null);assert.equal(g.run('touch.run'),false);assert.equal(g.run('keys.KeyQ'),false);assert.equal(g.run('player.buf'),null);
  g.at(1450);assert.equal(g.run("UIMotion.amount('hud:attack')"),0);assert.equal(g.run("UIMotion.amount('hud:skill')"),0);
});
test('展开时手指停在格子边缘，松手仍选择按下时的物品',()=>{
  const g=fixture({width:844,height:390});g.run("hudMode='mobile';requestBag();const it=makeRune(0);player.bag=[{it,x:7,y:0}];");g.at(1010);
  const grid=read(g,'inventoryLayout().grid'),v=read(g,'UIMotion.view(cv.width,cv.height)'),p={x:(grid.x+7*grid.cell+1)*v.scale+v.x,y:(grid.y+22)*v.scale+v.y};
  touch(g,'touchstart',p);assert.equal(g.run('inventoryState.press.hit.cx'),7);g.at(1250);
  assert.notEqual(g.run(`inventoryHit(${p.x},${p.y}).cx`),7);touch(g,'touchend',p);
  assert.equal(g.run('inventoryState.selection.it===it'),true);assert.equal(g.run('player.bag[0].x'),7);assert.equal(g.run('player.cursor'),null);
});
test('减少动态效果模式保留淡入与按键颜色反馈，界面不移动或缩放',()=>{
  const g=fixture({reducedMotion:true});key(g);g.at(1040);const v=read(g,'UIMotion.view(cv.width,cv.height)');
  assert.ok(v.opacity>0&&v.opacity<1);assert.equal(v.scale,1);assert.equal(v.x,0);assert.equal(v.y,0);
  g.run("UIMotion.pulse('bag:sort:');");g.at(1080);assert.ok(g.run("UIMotion.amount('bag:sort:')>0"));
  g.at(1120);assert.equal(g.run("UIMotion.value('inventory')"),1);key(g);g.at(1240);assert.equal(g.run("UIMotion.value('inventory')"),0);
});
test('攻击承诺期间排队打开背包，不提前播放打开动画',()=>{
  const g=fixture();g.run("startAttack();requestBag();");assert.equal(g.run('state'),'play');assert.equal(g.run('player.bagPending'),true);assert.equal(g.run("UIMotion.value('inventory')"),0);
  g.run('for(let i=0;i<120&&state!=="bag";i++)stepPlayer(1/120);');assert.equal(g.run('state'),'bag');g.at(1300);assert.equal(g.run("UIMotion.value('inventory')"),1);
});
test('背包渲染失败也会归还游戏画布，后续世界绘制不串层',()=>{
  const g=fixture();g.run("requestBag();const gameContext=ctx;inventoryContent=()=>{throw new Error('fixture draw failure');};");
  assert.throws(()=>g.run('inventoryRenderLayer();'),/fixture draw failure/);assert.equal(g.run('ctx===gameContext'),true);
});
