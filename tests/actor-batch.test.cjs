const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {loadGame,mobCode}=require('./game-harness.cjs');
const root=path.resolve(__dirname,'..');
function batch(){
  const sandbox={console,setTimeout(){},setInterval(){},document:{createElement:()=>({width:1,height:1,addEventListener(){},getContext:()=>({drawImage(){},clearRect(){}})})}};sandbox.window=sandbox;
  const context=vm.createContext(sandbox);
  for(const file of ['vendor/voxel-world.js','actor-batch.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  const T={...sandbox.THREE,WebGLRenderer:class{constructor(){this.capabilities={maxTextureSize:8192};this.debug={};}setPixelRatio(){}setSize(){}setClearColor(){}clear(){}render(){}}};
  const scene=new T.Scene(),b=new sandbox.ActorBatch(T,scene);
  b.setImages({skin:{width:512,height:512,complete:true}});return {b,T,scene};
}
const box={M:[0,-1,0,1,0,0,0,0,1,2,3,4],c:[1,2,3],s:[4,5,6],col:'#804020',nm:.7,nms:11,faces:45};
test('合批保持完整骨骼变换、游戏 Y 轴和地形高低差',()=>{
  const {b,T}=batch();b.begin();b.add({x:7,y:8},[box],.1,.2,()=>.8);
  const m=new T.Matrix4();b.mesh.getMatrixAt(0,m);
  for(const q of [[0,0,0],[.5,-.5,.5],[-.5,.5,-.5]]){
    const point=new T.Vector3(...q).applyMatrix4(m),x=box.c[0]+q[0]*box.s[0],y=box.c[1]+q[1]*box.s[1],z=box.c[2]+q[2]*box.s[2];
    assert.ok(Math.abs(point.x-(7+(-y+2)*.1))<1e-6);
    assert.ok(Math.abs(point.y-(-8-(x+3)*.1))<1e-6);
    assert.ok(Math.abs(point.z-(1+(z+4)*.1))<1e-6);
  }
  assert.equal(b.attributes.aData.array[1],45);assert.equal(b.attributes.aData.array[3],3);
});
test('同一贴图按六个面独立映射，眨眼仅替换正面且复用元数据',()=>{
  const {b}=batch(),tx={k:'skin',r:{front:[0,0,16,8],back:[16,0,16,8],left:[32,0,16,8],right:[48,0,16,8],top:[64,0,16,8],bottom:[80,0,16,8]},blink:[0,8,16,8]};
  const normal=b.rectRow(tx,false),blink=b.rectRow(tx,true);assert.notEqual(normal,blink);
  assert.equal(b.rectRow(tx,false),normal);assert.equal(b.rectRow(tx,true),blink);assert.equal(b.metaCount,3);
  for(let face=0;face<6;face++){
    const a=(normal*6+face)*4,c=(blink*6+face)*4;
    assert.equal(b.rectData[a],face*16/2048);assert.equal(b.rectData[c],b.rectData[a]);
    assert.equal(b.rectData[c+1],face===0?8/512:0);
  }
});
test('倒地透明度、冻结色、玩家提亮和常亮细部独立保存',()=>{
  const {b}=batch(),e={x:1,y:1,alpha:.8,frozen:1,softShader:true,actorPlayer:true,renderLight:{warm:[.2,.3,.4],energy:.6,colors:{warm:'#ffc17d',cool:'#9bb8df'}}};
  b.add(e,[box,{...box,nf:true}],1,0,()=>0,.5);
  assert.equal(b.attributes.aAppearance.array[1],1);assert.ok(Math.abs(b.attributes.aAppearance.array[3]-.1)<1e-6);
  assert.ok(Math.abs(b.attributes.aStatus.array[3]-.4)<1e-6);assert.equal(b.attributes.aStatus.array[7],0);
  assert.ok(Math.abs(b.attributes.aWarm.array[3]-.6)<1e-6);
});
test('受击闪光停用皮肤材质，不污染原骨骼与下一帧皮肤',()=>{
  const {b}=batch(),tx={k:'skin',r:Object.fromEntries(['front','back','left','right','top','bottom'].map(k=>[k,[0,0,16,16]]))},source={...box,tx};
  b.add({x:0,y:0,flash:.1},[source],1,0,()=>0);assert.equal(b.attributes.aData.array[0],0);assert.equal(source.tx,tx);
  b.begin();b.add({x:0,y:0},[source],1,0,()=>0);assert.ok(b.attributes.aData.array[0]>0);
});
test('合批图集为重叠角色分配独立区域，画布仍按原顺序与透明度合成',()=>{
  const {b,T}=batch(),e={x:0,y:0},other={x:0,y:0};b.begin();b.add(e,[box],1,0,()=>0);b.add(other,[box],1,0,()=>0);b.render(new T.Camera(),1280,720,10,20,2);
  assert.equal(b.mesh.count,2);assert.equal(b.mesh.instanceMatrix.updateRanges[0].count,32);
  const a=b.records.get(e),c=b.records.get(other);assert.ok(a.x+a.width<=c.x||a.y+a.height<=c.y);
  const ctx={globalAlpha:.4,drawImage(...args){this.args=args;}};assert.equal(b.paint(e,ctx),true);
  assert.equal(ctx.args[5],a.screenX/2);assert.equal(ctx.args[7],a.width/2);assert.equal(ctx.globalAlpha,.4);
  assert.equal(Object.keys(b.attributes).length+4+3,16,'低于 WebGL 保证的顶点属性上限');
  b.begin();b.upload();assert.equal(b.mesh.visible,false);assert.equal(b.mesh.count,0);
});
test('超出容量明确回退，绝不静默删除怪物身体',()=>{
  const {b}=batch();b.count=32768;assert.throws(()=>b.add({x:0,y:0},[box],1,0,()=>0),/capacity/);assert.equal(b.count,32768);
  b.disable(Error('fixture'));assert.equal(b.mesh.visible,false);assert.equal(b.mesh.count,0);assert.equal(b.failed,true);
});
test('图集容纳完整旋转包围盒，高分辨率下不缩减身体像素',()=>{
  const {b,T}=batch(),e={x:7,y:8};b.add(e,[box],.1,.2,()=>.8);b.render(new T.Camera(),1920,1080,12,15,3);
  const r=b.records.get(e);assert.equal(b.zoom,3);
  const m=new T.Matrix4();b.mesh.getMatrixAt(0,m);
  for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
    const p=new T.Vector3(x,y,z).applyMatrix4(m),px=(p.x*44+12)*3,py=(-p.y*32-p.z*38+15)*3;
    assert.ok(px>=r.screenX&&px<=r.screenX+r.width);assert.ok(py>=r.screenY&&py<=r.screenY+r.height);
  }
  b.maxSize=1;assert.throws(()=>b.render(new T.Camera(),1920,1080,12,15,3),/capacity/);
});
function captureScene(){
  const g=loadGame();vm.runInContext(fs.readFileSync(path.join(root,'scenefx.js'),'utf8'),g.context);
  g.run(`startGame();mobs=[${mobCode}];mobs[0].awake=true;cam.x=player.x;cam.y=player.y;occluded=()=>false;
    const captured=new Set();let captureMode=false,rendered=false,captures=0,boxesDrawn=0,rigBuilds=0,failCapture=false;
    const realBox=drawBox,realMobRig=mobRig;drawBox=(...a)=>{boxesDrawn++;return realBox(...a)};mobRig=m=>{rigBuilds++;return realMobRig(m)};
    window.World3D={beginActorCapture(){captured.clear();captureMode=true;rendered=false;return true},captureRig(e){if(captureMode){captured.add(e);captures++;return true}return rendered&&captured.has(e)},endActorCapture(){captureMode=false;if(failCapture)captured.clear()},frame(){rendered=true;return true},blit(){},beginShadows(){},endShadows(){},pushShadow(){},glowSpots:[]};`);return g;
}
test('角色捕获复用当帧姿态，GPU 成功后不再逐方块画身体',()=>{
  const g=captureScene();g.run('withZoom(render);');assert.equal(g.run('rigBuilds'),1);assert.equal(g.run('boxesDrawn'),0);
  assert.equal(g.run('captured.has(mobs[0])&&captured.has(player)'),true);
  g.run('drawingTerrain=false;drawRig(player,playerRig(player),1);');assert.ok(g.run('boxesDrawn')>0,'世界合批不能吞掉背包或头像的画布绘制');
});
test('捕获遵守无敌闪烁，失败时当帧恢复 Canvas 身体',()=>{
  const g=captureScene();g.run('player.inv=.36;player.st="move";withZoom(render);');assert.equal(g.run('captured.has(player)'),false);
  g.run('player.inv=0;failCapture=true;boxesDrawn=0;withZoom(render);');assert.ok(g.run('boxesDrawn')>0);
});
test('捕获异常归还原画布和柔光状态，并传递回退原因',()=>{
  const g=captureScene();g.run(`let failure;const realCtx=ctx;drawingTerrain=true;World3D.endActorCapture=e=>failure=e;World3D.captureRig=()=>{ctx.globalAlpha=.3;throw Error('fixture capture failure')};collectSceneActors([{capture:true,f:()=>drawSoftRig(player,[],1,0,null,{})}]);`);
  assert.equal(g.run('ctx===realCtx'),true);assert.match(g.run('failure.message'),/fixture capture failure/);assert.equal(g.run('player.softShader'),undefined);
});
