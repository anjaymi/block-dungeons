const test=require('node:test'),assert=require('node:assert/strict');
const Layout=require('../inventory-layout.js');
const {loadGame}=require('./game-harness.cjs');
function game(mobile=true,w=844,h=390){const g=loadGame();g.context.performance.now=()=>700;g.run(`innerWidth=${w};innerHeight=${h};resize();hudMode='${mobile?'mobile':'pc'}';requestBag();`);g.context.performance.now=()=>1000;return g;}
function centre(b){return{x:b.x+b.w/2,y:b.y+b.h/2};}
function event(g,name,p,id=9,type=name){g.events[name][0]({type,preventDefault(){},changedTouches:[{identifier:id,clientX:p.x,clientY:p.y}]});}
function tap(g,p){event(g,'touchstart',p);event(g,'touchend',p);}
for(const [w,h,mobile]of [[844,390,true],[800,450,true],[667,375,true],[390,844,true],[360,800,true],[1280,720,false],[1280,760,false],[1317,1194,false]])test(`背包布局 ${w}×${h}：操作区域在屏内，格子准确命中`,()=>{
  for(const pane of ['bag','gear','cube']){
    const L=Layout.layout(w,h,mobile,{}, {pane});
    for(const b of L.controls){assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=w+.01&&b.y+b.h<=h+.01,JSON.stringify(b));if(mobile)assert.ok(b.w>=44&&b.h>=44,JSON.stringify(b));}
    if(L.grid){const b=L.grid;for(let y=0;y<4;y++)for(let x=0;x<b.cols;x++){const hit=Layout.hit(L,b.x+(x+.5)*b.cell,b.y+(y+.5)*b.cell);assert.equal(hit.kind,'grid');assert.equal(hit.cx,x+b.colStart);assert.equal(hit.cy,y);}if(mobile)assert.equal(b.cell,44);}
    if(L.gear)assert.equal(Object.keys(L.slots).length,10);
    if(L.cube)for(const b of L.cube){const h=Layout.hit(L,b.x+b.w/2,b.y+b.h/2);assert.equal(h.kind,'cube');assert.equal(h.i,b.i);}
  }
});
test('手机安全区移动整个背包，格子保持 44px',()=>{
  const L=Layout.layout(844,390,true,{left:32,right:16,top:8,bottom:8});
  for(const b of L.controls)assert.ok(b.x>=32&&b.x+b.w<=828&&b.y>=8&&b.y+b.h<=382);
  assert.equal(L.grid.cell,44);
});
test('轻点手机物品只查看详情，不从背包取走或触发攻击',()=>{
  const g=game();g.run(`const it=newBase('helm',0);addToBag(it);`);const grid=JSON.parse(g.run('JSON.stringify(inventoryLayout().grid)'));
  tap(g,{x:grid.x+22,y:grid.y+22});assert.equal(g.run('inventoryState.drawer'),'item');assert.equal(g.run('player.bag.length'),1);assert.equal(g.run('player.cursor'),null);assert.equal(g.run('mouse.l'),false);assert.equal(g.run('player.buf'),null);
});
test('手机详情按钮装备真实物品，使用同一对象且重新计算装备属性',()=>{
  const g=game();g.run(`const it=newBase('helm',0);addToBag(it);inventorySelect({kind:'grid',cx:0,cy:0});`);
  const b=JSON.parse(g.run(`JSON.stringify(inventoryDrawer().buttons.find(b=>b.kind==='itemUse'))`));tap(g,centre(b));
  assert.equal(g.run('player.eq.helm===it'),true);assert.equal(g.run('player.bag.length'),0);assert.equal(g.run('inventoryLocate(it).kind'),'slot');
});
test('长按物品拖入新格子，所有权仅转移一次',()=>{
  const g=game();g.run(`const it=makeRune(0);addToBag(it);`);const b=JSON.parse(g.run('JSON.stringify(inventoryLayout().grid)'));
  event(g,'touchstart',{x:b.x+22,y:b.y+22});g.context.performance.now=()=>1400;g.run('inventoryHold();');assert.equal(g.run('player.cursor===it'),true);
  event(g,'touchmove',{x:b.x+4.5*b.cell,y:b.y+2.5*b.cell});event(g,'touchend',{x:b.x+4.5*b.cell,y:b.y+2.5*b.cell});
  assert.equal(g.run('player.cursor'),null);assert.equal(g.run('player.bag.length'),1);assert.equal(g.run('player.bag[0].it===it&&player.bag[0].x===4&&player.bag[0].y===2'),true);
});
test('触摸取消不点击目标、不丢弃长按拿起的物品',()=>{
  const g=game();g.run('const it=makeRune(0);addToBag(it);');const b=JSON.parse(g.run('JSON.stringify(inventoryLayout().grid)'));
  event(g,'touchstart',{x:b.x+22,y:b.y+22});g.context.performance.now=()=>1400;g.run('inventoryHold();');event(g,'touchcancel',{x:0,y:0});
  assert.equal(g.run('player.cursor===it'),true);assert.equal(g.run('items.length'),0);g.run('closeBag();');assert.equal(g.run('player.bag.length'),1);assert.equal(g.run('player.cursor'),null);
});
test('打开和关闭背包清除双指战斗输入，当前楼层与装备保持',()=>{
  const g=loadGame();g.run(`hudMode='mobile';floorN=3;touch.moveId=7;touch.moveX=1;touch.attackId=8;mouse.l=true;const uid=player.eq.weapon.uid;requestBag();simStep(.2);closeBag();`);
  assert.equal(g.run('touch.moveId'),null);assert.equal(g.run('touch.attackId'),null);assert.equal(g.run('mouse.l'),false);assert.equal(g.run('floorN'),3);assert.equal(g.run('player.eq.weapon.uid'),g.run('uid'));
});
test('手机版合成入口收放四个真实物品，配方生成一次且不复制',()=>{
  const g=game();g.run(`for(let i=0;i<3;i++)addToBag(makeGem('ruby',0));const original=player.bag.map(b=>b.it);`);
  for(let i=0;i<3;i++)g.run(`inventoryState.selection={it:original[${i}]};inventoryAction({kind:'itemCube'});`);
  assert.equal(g.run('player.bag.length'),0);assert.equal(g.run('player.cube.filter(Boolean).length'),3);
  g.run(`inventoryAction({kind:'transmute'});`);assert.equal(g.run('player.cube.filter(Boolean).length'),1);assert.equal(g.run('player.cube[0].g'),1);
  g.run('closeBag();');assert.equal(g.run('player.bag.length'),1);assert.equal(g.run('player.cube.filter(Boolean).length'),0);
});
test('手机属性加点与鉴定消耗真实资源，不能消耗负数',()=>{
  const g=game();g.run(`player.pts=1;const strength=player.attr.str;inventoryAction({kind:'stat',i:0});inventoryAction({kind:'stat',i:0});`);
  assert.equal(g.run('player.pts'),0);assert.equal(g.run('player.attr.str-strength'),1);
  g.run(`const it=newBase('helm',0);it.ident=false;addToBag(it);player.idScrolls=1;inventoryAction({kind:'idall'});inventoryAction({kind:'idall'});`);
  assert.equal(g.run('it.ident'),true);assert.equal(g.run('player.idScrolls'),0);
});
test('PC 右键装备和左键格子移动保留真实占格，整理不遗失物品',()=>{
  const g=game(false);g.run(`const it=newBase('helm',0);addToBag(it);`);const b=JSON.parse(g.run('JSON.stringify(inventoryLayout().grid)'));
  g.events.mousedown[0]({button:2,clientX:b.x+22,clientY:b.y+22});assert.equal(g.run('player.eq.helm===it'),true);
  g.run(`inventoryAction({kind:'slot',slot:'helm'},2);inventoryAction({kind:'sort'});`);assert.equal(g.run('player.bag.length'),1);assert.equal(g.run('player.bag[0].it===it'),true);
});
test('竖屏两个背包分页可访问全部 40 格，切页不改物品坐标',()=>{
  const g=game(true,390,844);g.run(`const it=makeRune(0);player.bag=[{it,x:9,y:3}];inventoryAction({kind:'page'});`);
  const b=JSON.parse(g.run('JSON.stringify(inventoryLayout().grid)'));
  assert.equal(b.colStart,5);tap(g,{x:b.x+4.5*b.cell,y:b.y+3.5*b.cell});assert.equal(g.run('inventoryState.selection.it===it'),true);assert.equal(g.run('player.bag[0].x'),9);
});
test('PNG 背包完整绘制并展开真实属性和配方，未加载图片时给出状态',()=>{
  const g=game();g.run(`drawBag();inventoryAction({kind:'drawer',drawer:'stats'});drawBag();inventoryAction({kind:'drawer',drawer:'recipes'});drawBag();`);
  assert.equal(g.run('inventoryState.drawer'),'recipes');assert.equal(g.run('state'),'bag');
});
test('手机双手武器拒绝副手时保留物品，并在背包内给出原因',()=>{
  const g=game();g.run(`player.eq.weapon=newBase('weapon',0,'greatsword');recalc();const shield=newBase('shield',0);addToBag(shield);inventorySelect({kind:'grid',cx:0,cy:0});inventoryAction({kind:'itemUse'});drawBag();`);
  assert.equal(g.run('player.eq.offhand'),null);assert.equal(g.run('player.bag[0].it===shield'),true);
  assert.equal(g.run('inventoryState.notice.text'),'双手/双持武器无法使用副手');assert.equal(g.run('player.cursor'),null);
});
test('属性详情翻页不跳过未显示的属性，最后一点分配后切换为完整列表',()=>{
  const g=game();g.run(`player.pts=1;inventoryAction({kind:'drawer',drawer:'stats'});`);
  const rows=g.run('inventoryDrawer().rows');assert.equal(rows,1);
  g.run(`inventoryAction(inventoryDrawer().pages[1]);drawBag();`);assert.equal(g.run('inventoryState.scroll'),1);
  g.run(`inventoryAction({kind:'stat',i:0});drawBag();`);assert.equal(g.run('player.pts'),0);assert.ok(g.run('inventoryDrawer().rows')>1);
});
