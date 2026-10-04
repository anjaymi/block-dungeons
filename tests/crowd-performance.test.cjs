const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const CrowdGrid=require('../crowd-grid.js');
const {loadGame,mobCode}=require('./game-harness.cjs');
function oldSeparation(entities,constrain){
  for(let i=0;i<entities.length;i++)for(let j=i+1;j<entities.length;j++){
    const a=entities[i],b=entities[j],d=Math.hypot(b.x-a.x,b.y-a.y),rr=a.r+b.r;
    if(d<rr&&d>.001){const push=(rr-d)/2,ux=(b.x-a.x)/d,uy=(b.y-a.y)/d,wa=b.mass/(a.mass+b.mass),wb=1-wa;
      a.x-=ux*push*2*wa;a.y-=uy*push*2*wa;b.x+=ux*push*2*wb;b.y+=uy*push*2*wb;constrain(a);constrain(b);}
  }
}
test('空间索引在负坐标、跨格移动与新召唤单位后不漏掉邻居，保持原顺序',()=>{
  const grid=new CrowdGrid(2),a={x:-2.01,y:0,r:.4},b={x:2.01,y:0,r:.8};grid.build([a,b]);
  b.x=-1.9;grid.update(b);const c={x:-2,y:.1,r:1.3};grid.add(c);
  assert.deepEqual(grid.query(-2,0,.2),[a,b,c]);assert.equal(grid.maxRadius,1.3);
  b.x=100;grid.update(b);assert.deepEqual(grid.query(-2,0,.2),[a,c]);
  c.r=3;grid.update(c);assert.equal(grid.maxRadius,3);
});
test('200 个随机密集布局与原逐对碰撞结果一致，包括跨格推挤和墙体修正',()=>{
  let seed=391;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let run=0;run<200;run++){
    const input=Array.from({length:30},()=>({x:rnd()*8-4,y:rnd()*8-4,r:.15+rnd()*.65,mass:.5+rnd()*4}));
    const a=structuredClone(input),b=structuredClone(input),constrain=e=>{e.x=Math.max(-3.8+e.r,Math.min(3.8-e.r,e.x));};
    oldSeparation(a,constrain);new CrowdGrid(2).separate(b,constrain);
    for(let i=0;i<a.length;i++){assert.ok(Math.abs(a[i].x-b[i].x)<1e-10,`x ${run}:${i}`);assert.ok(Math.abs(a[i].y-b[i].y)<1e-10,`y ${run}:${i}`);}
  }
});
test('大范围分散怪物只返回局部候选，敌人仍全部留在模拟中',()=>{
  const entities=Array.from({length:500},(_,n)=>({x:n*4,y:0,r:.3,mass:1})),grid=new CrowdGrid(2);grid.build(entities);
  assert.equal(grid.records.size,500);assert.ok(grid.query(100,0,1).length<3);
});
test('屏幕外怪物跳过模型构建，回到画面后恢复绘制，模拟生命状态保留',()=>{
  const g=loadGame();vm.runInContext(fs.readFileSync(path.join(__dirname,'../scenefx.js'),'utf8'),g.context);
  g.run(`startGame();cam.x=player.x;cam.y=player.y;mobs=[${mobCode}];mobs[0].x=player.x+90;mobs[0].y=player.y;let builds=0;const build=mobRig;mobRig=m=>{builds++;return build(m);};withZoom(render);`);
  assert.equal(g.run('builds'),0);assert.equal(g.run('mobs.length'),1);assert.equal(g.run('mobs[0].hp'),100);
  g.run('mobs[0].x=player.x+1;withZoom(render);');assert.equal(g.run('builds'),1);
});
test('高大怪物和跳跃中的身体仍有部分位于屏幕时不会被剔除',()=>{
  const g=loadGame();g.run('terrain=null;ox=oy=0;');
  assert.equal(g.run('sceneActorVisible({x:2,y:(VH+200)/SY,scale:2,z:1})'),true);
  assert.equal(g.run('sceneActorVisible({x:2,y:(VH+900)/SY,scale:1,z:0})'),false);
});
test('体素细纹复用材质，只提交一次图像，亮度变化仍生成对应材质',()=>{
  const g=loadGame();g.run(`let pixelFills=0,images=0,uploads=0;ctx.fillRect=()=>pixelFills++;ctx.drawImage=()=>images++;ctx.putImageData=()=>uploads++;
    const box={M:mat(),nm:.62,nms:34},points=[[0,0],[10,0],[10,10],[0,10]];
    drawNormalFace(box,2,1,[0,1,2,3],points,.7,'#667788');drawNormalFace(box,2,1,[0,1,2,3],points,.7,'#667788');`);
  assert.equal(g.run('pixelFills'),0);assert.equal(g.run('images'),2);assert.equal(g.run('uploads'),1);
  g.run(`drawNormalFace(box,2,1,[0,1,2,3],points,.9,'#667788');`);assert.equal(g.run('uploads'),2);
});
function voxFixture(){
  const sandbox={console,window:{},Map,Math};const context=vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../vendor/voxel-world.js'),'utf8'),context);
  const T=sandbox.window.THREE||sandbox.THREE;
  const root=new T.Group(),geometry=new T.BoxGeometry(2/24,3/24,4/24);geometry.translate(1/24,1.5/24,2/24);
  root.add(new T.Mesh(geometry,new T.MeshBasicMaterial({color:0x779988})));
  sandbox.window.VOXLIB={monsters:{build:()=>({root,def:{}}),pose(){}}};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../voxmobs.js'),'utf8'),context);return sandbox.window.VoxMobs;
}
test('表面掩码保留源模型六个外表面，交换坐标后完整传入动画方块',()=>{
  const vox=voxFixture(),entry=vox.prepare('fixture');assert.ok(entry.nBoxes>0);
  const rig=vox.rig({vox:'fixture',ang:0},{},(M,c,s,col,nf)=>({M,c,s,col,nf}),()=>[1,0,0,0,1,0,0,0,1,0,0,0],(a,b)=>b);
  assert.equal(rig.reduce((faces,b)=>faces|b.faces,0),63);
  assert.ok(rig.every(b=>Number.isInteger(b.faces)));
});
test('未标记的旧模型照常绘制，已屏蔽的内部面不提交绘制',()=>{
  const g=loadGame();g.run(`let calls=0;ctx.fill=()=>calls++;const entity={x:5,y:5};const box=BX(mat(),[0,0,2],[3,3,3],'#778899');drawBox(entity,box,PX,0);`);
  assert.ok(g.run('calls')>0);g.run('calls=0;box.faces=0;drawBox(entity,box,PX,0);');assert.equal(g.run('calls'),0);
});
