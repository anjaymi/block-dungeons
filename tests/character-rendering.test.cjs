const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {loadGame,mobCode}=require('./game-harness.cjs');
const root=path.resolve(__dirname,'..');
function scene(){
  const g=loadGame();vm.runInContext(fs.readFileSync(path.join(root,'scenefx.js'),'utf8'),g.context);g.run(`startGame();mobs=[${mobCode}];mobs[0].awake=true;cam.x=player.x;cam.y=player.y;let drawn=[],rigBuilds=0;const realDraw=drawSoftRig,realMobRig=mobRig;drawSoftRig=(...args)=>{drawn.push(args[0]);return realDraw(...args);};mobRig=(m)=>{rigBuilds++;return realMobRig(m);};occluded=()=>false;
    window.World3D={frame:()=>true,actorsActive:true,prepareActors(){},setActorImages(){},blit:()=>true,beginShadows(){},endShadows(){},pushShadow(){},glowSpots:[]};`);return g;
}
function world(withActors=false){
  const canvases=[];const canvas=()=>{const c={width:1,height:1,style:{},addEventListener(){},getContext:()=>({clearRect(){},drawImage(){},getImageData:()=>({data:new Uint8Array(4)})})};canvases.push(c);return c;};
  const main=canvas();main.parentNode={insertBefore(){},removeChild(){}};
  const sandbox={console:{log(){},warn(){},error(){}},performance:{now:()=>1000},setTimeout(){},setInterval(){},innerWidth:1280,innerHeight:760,devicePixelRatio:1,addEventListener(){},location:{search:''},document:{createElement:canvas,getElementById:()=>main}};sandbox.window=sandbox;
  sandbox.SceneStyle=require('../scene-style.js');
  const context=vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'vendor/voxel-world.js'),'utf8'),context);
  if(withActors)vm.runInContext(fs.readFileSync(path.join(root,'actor-batch.js'),'utf8'),context);
  const T=sandbox.THREE;let renderer;const renderers=[];
  class Renderer{
    constructor(){renderer=this;renderers.push(this);this.shadowMap={};this.debug={};this.capabilities={maxAttributes:16,maxTextureSize:8192};this.info={render:{calls:0,triangles:0}};}
    setPixelRatio(){}setSize(){}setClearColor(){}clear(){}render(scene,camera){if(this.fail||(renderers[0].failActor&&scene.children.some(m=>m.isInstancedMesh&&m.visible&&m.count>0&&m.material.isShaderMaterial&&m.layers.test(camera.layers)))){if(this.debug.onShaderError)this.debug.onShaderError({getProgramInfoLog:()=> 'fixture compile failure',getShaderInfoLog:()=> 'fixture varying error'}, {},{},{});}}
    getContext(){return {getExtension:()=>null,getParameter:()=> 'fixture renderer',isContextLost:()=>false};}
  }
  sandbox.THREE={...T,WebGLRenderer:Renderer};
  const src=fs.readFileSync(path.join(root,'world3d.js'),'utf8');
  vm.runInContext(src.replace(/\}\)\(\);\s*$/,`window.worldProbe={styleMat,buildMoss,mergeBaked,wallBuilders:WALL_BUILDERS,useWorld(o){builtFor=o.G;builtTheme=o.theme;builtGW=o.GW;world=new T.Group();}};})();`),context,{filename:'world3d.js'});
  sandbox.World3D.init();return {context,T,probe:sandbox.worldProbe,World3D:sandbox.World3D,renderer};
}
test('GPU 地形成功时玩家和怪物仍进入同一贴图绘制链路',()=>{
  const g=scene();g.run('withZoom(render);');assert.equal(g.run('drawn.filter(e=>e===player).length'),1);assert.equal(g.run('drawn.filter(e=>e===mobs[0]).length'),1);
});
test('活体怪物每帧只建模一次，遮挡轮廓复用同一姿态',()=>{
  const g=scene();g.run('occluded=()=>true;withZoom(render);');assert.equal(g.run('rigBuilds'),1);
  g.run('withZoom(render);');assert.equal(g.run('rigBuilds'),2);
});
test('受击闪烁跳过玩家实体，下一帧恢复，不误用另一条渲染链路',()=>{
  const g=scene();g.run('player.inv=.36;player.st="move";withZoom(render);');assert.equal(g.run('drawn.filter(e=>e===player).length'),0);
  g.run('player.inv=0;drawn=[];withZoom(render);');assert.equal(g.run('drawn.filter(e=>e===player).length'),1);
});
test('柔光渲染异常后归还角色状态，背包和下一帧不会被污染',()=>{
  const g=loadGame();g.run('const e={softShader:false};const oldDraw=drawRig;drawRig=()=>{throw new Error("fixture render failure");};');
  assert.throws(()=>g.run('drawSoftRig(e,[],1);'),/fixture render failure/);assert.equal(g.run('e.softShader'),false);
});
test('状态贴图在持续变色与切换皮肤后复用，并限制缓存容量',()=>{
  const g=loadGame();g.run('for(const im of Object.values(MCIMG)){im.width=im.height=64;im.complete=true;}');
  assert.equal(g.run('texShaded("akane",8,"#8fd8ff",.4)===texShaded("akane",8,"#8fd8ff",.4)'),true);
  g.run('for(const skin of Object.keys(MCIMG))for(let lv=4;lv<=12;lv++)for(let i=0;i<=13;i++)texShaded(skin,lv,"#ff3a1a",i*.05);');
  assert.ok(g.run('TEX_SHADE.size<=256'));
  assert.equal(g.run('texShaded("akane",8,"#8fd8ff",.4).width'),64);
});
test('倒地与受击变形仍保留原贴图、法线和细部标记',()=>{
  const g=scene();g.run('corpses=[{...mobs[0],t:1,fall:.6}];let fallen;const original=drawRig;drawRig=(e,b,...args)=>{if(e===corpses[0])fallen=b;return original(e,b,...args);};withZoom(render);');
  assert.equal(g.run('fallen.every(b=>b.tx&&b.tx.k==="zombie")'),true);
  assert.equal(g.run(`(()=>{const b={...fallen[0],nm:.7,nms:3,sm:true,emissive:true};const [m]=transformRig([b],mat(.3,0,0));return m!==b&&m.M!==b.M&&m.tx===b.tx&&m.nm===.7&&m.nms===3&&m.sm&&m.emissive;})()`),true);
});
test('地牢柔光 shader 与项目实际 Three r186 Lambert 输入一致',()=>{
  const {T,probe}=world();const shader={uniforms:{},vertexShader:T.ShaderLib.lambert.vertexShader,fragmentShader:T.ShaderLib.lambert.fragmentShader};probe.styleMat(new T.MeshLambertMaterial()).onBeforeCompile(shader);
  // Lambert does not declare Phong's vViewPosition. Referring to it fails linking.
  const fragment=shader.fragmentShader.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'');
  assert.ok(!fragment.includes('vViewPosition')||/varying\s+vec3\s+vViewPosition\s*;/.test(fragment));
  assert.match(shader.vertexShader,/#ifdef USE_INSTANCING\s+stylePosition = instanceMatrix \* stylePosition;/);
  assert.match(shader.vertexShader,/vStyleNormal = normalize\(transformedNormal\)/);
});
test('shader 编译失败会通知上层回退，避免返回成功却留下空画面',()=>{
  const {World3D,renderer,probe}=world();renderer.fail=true;
  const o={G:new Uint8Array(9),GW:3,GH:3,theme:{name:'苔石地牢'},player:{x:1,y:1,G:{}},cam:{x:1,y:1},torches:[],zoom:1,ox:100,oy:100};probe.useWorld(o);
  assert.equal(World3D.frame(o),false);assert.equal(World3D.diag(1,1).failed,true);assert.equal(World3D.diag(1,1).vis,'hidden');
  renderer.fail=false;assert.equal(World3D.frame(o),false); // 不重复提交已失败地图的坏程序。
  const next={...o,G:new Uint8Array(9)};probe.useWorld(next);assert.equal(World3D.frame(next),true);assert.equal(World3D.diag(1,1).vis,'visible');assert.equal(World3D.diag(1,1).failed,false);
});
test('角色 shader 单独失败时保留 GPU 地形，并归还当帧 Canvas 绘制',()=>{
  const {World3D,renderer,probe}=world(true),o={G:new Uint8Array(9),GW:3,GH:3,theme:{name:'苔石地牢'},player:{x:1,y:1,G:{}},cam:{x:1,y:1},torches:[],zoom:1,ox:100,oy:100};probe.useWorld(o);
  const e={x:1,y:1},box={M:[1,0,0,0,1,0,0,0,1,0,0,0],c:[0,0,0],s:[1,1,1],col:'#ffffff'};
  assert.equal(World3D.beginActorCapture({skin:{width:512,height:512,complete:true}},o.G),true);
  assert.equal(World3D.captureRig(e,[box],1,0,()=>0,1),true);World3D.endActorCapture();renderer.failActor=true;
  const rendered=World3D.frame(o);assert.equal(rendered,true,JSON.stringify(World3D.diag(1,1)));assert.equal(World3D.captureRig(e,[box],1,0,()=>0,1),false);
  assert.equal(World3D.diag(1,1).actorRenderer,'canvas');assert.equal(World3D.diag(1,1).failed,false);
  assert.match(World3D.diag(1,1).actorError,/fixture compile failure/);
  assert.equal(World3D.beginActorCapture({skin:{width:512,height:512,complete:true}},o.G),false);
});
test('GPU 对象初始化不消耗游戏随机序列，并恢复原随机函数',()=>{
  const {World3D,context}=world(true);vm.runInContext('let gameRandomCalls=0;const gameRandomFixture=()=>{gameRandomCalls++;return .25};Math.random=gameRandomFixture;',context);
  assert.equal(World3D.beginActorCapture({skin:{width:512,height:512,complete:true}},new Uint8Array(9)),true);
  assert.equal(vm.runInContext('gameRandomCalls',context),0);assert.equal(vm.runInContext('Math.random===gameRandomFixture',context),true);
});

test('苔石墙顶双向分块，砖缝完整铺底且保留原有高度',()=>{
  const {context,probe}=world(),L=context.VOXLIB,v=new L.dungeon.P.DungeonModel(101);
  probe.wallBuilders.dungeon(v,L,28,0);
  assert.notEqual(v.cells.get('-8,-8,29').color,v.cells.get('-8,0,29').color,'长条石必须沿纵向分块');
  for(let y=-12;y<12;y++)for(let x=-12;x<12;x++)assert.ok(v.cells.has(`${x},${y},29`),'压顶不能产生露底洞');
  assert.equal(Math.max(...Array.from(v.cells.values(),c=>c.z)),29);
});

test('苔藓模型连同叶尖留在散布半径内，三种造型都保留低矮足迹',()=>{
  const {context,probe}=world(),L=context.VOXLIB;
  for(let kind=0;kind<3;kind++){
    const v=new L.DungeonModel(137+kind);probe.buildMoss(v,kind);
    assert.ok(v.cells.size>80);
    for(const c of v.cells.values()){
      for(const dx of [0,1])for(const dy of [0,1])assert.ok(Math.hypot(c.x+dx,c.y+dy)<=8,'旋转后叶尖也不能超出允许占地');
      assert.ok(c.z>=0&&c.z<=6);
    }
  }
});
test('墙脚遮蔽烘焙到顶点颜色，保持原模型几何、法线和源颜色不变',()=>{
  const {T,probe}=world(),geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.BufferAttribute(new Float32Array([1.02,-1.5,0,1.5,-1.5,0,1.5,-1.8,0]),3));
  geo.setAttribute('normal',new T.BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1]),3));
  geo.setAttribute('color',new T.BufferAttribute(new Float32Array(9).fill(1),3));
  const matrix=new T.Matrix4();matrix.floorSurface={i:1,j:1,edge:[true,false,false,false],variation:1};
  const baked=probe.mergeBaked([[geo,matrix]]);
  assert.ok(baked.attributes.color.getX(0)<baked.attributes.color.getX(1)*.85);
  assert.deepEqual(Array.from(baked.attributes.position.array),Array.from(geo.attributes.position.array));
  assert.deepEqual(Array.from(baked.attributes.normal.array),Array.from(geo.attributes.normal.array));
  assert.deepEqual(Array.from(geo.attributes.color.array),new Array(9).fill(1));
});
