const test=require('node:test'),assert=require('node:assert/strict');
const Style=require('../scene-style.js'),{loadGame}=require('./game-harness.cjs');
function room(){
  const GW=24,GH=18,G=new Uint8Array(GW*GH);
  for(let y=1;y<GH-1;y++)for(let x=1;x<GW-1;x++)G[y*GW+x]=1;
  G[8*GW+1]=2; // closed gate
  return {G,GW,GH,exitPos:{x:22,y:8}};
}
function patches(m,density){
  const p=[];for(let y=0;y<m.GH;y++)for(let x=0;x<m.GW;x++)p.push(...Style.mossPatches(m,x,y,37,density));return p;
}
test('苔藓同种子确定，密度增加只增补稳定候选，不改变既有形状和位置',()=>{
  const m=room(),low=patches(m,.3),mid=patches(m,.6),high=patches(m,1);
  assert.ok(low.length>0&&mid.length>low.length&&high.length>mid.length);
  assert.deepEqual(high,patches(m,1));
  for(const [smaller,larger] of [[low,mid],[mid,high]]){
    const byId=new Map(larger.map(p=>[p.id,p]));for(const p of smaller)assert.deepEqual(byId.get(p.id),p);
  }
});
test('苔藓完整占地避让墙体、门与出口，房间中央和狭窄通道留白',()=>{
  const m=room(),all=patches(m,1);assert.ok(all.length>10);
  for(const p of all){
    for(let y=Math.floor(p.y-p.r);y<=Math.floor(p.y+p.r);y++)for(let x=Math.floor(p.x-p.r);x<=Math.floor(p.x+p.r);x++)assert.equal(m.G[y*m.GW+x],1);
    assert.ok(Math.hypot(p.x-m.exitPos.x,p.y-m.exitPos.y)>=1.15+p.r);
    assert.ok(p.x<2||p.x>22||p.y<2||p.y>16);
  }
  assert.deepEqual(Style.mossPatches(m,12,9,37,1),[]);
  const corridor={GW:3,GH:12,G:new Uint8Array(36)};for(let y=0;y<12;y++)corridor.G[y*3+1]=1;
  assert.deepEqual(patches(corridor,1),[]);
});
test('墙脚渐暗由世界位置决定，旋转石板或跨合批分块仍连续',()=>{
  const m=room(),a=Style.floorSurface(m,1,4),b=Style.floorSurface(m,1,5);
  assert.ok(Style.floorShade(a,1.02,4.5)[0]<Style.floorShade(a,1.5,4.5)[0]*.85);
  const first=Style.floorShade(a,1.1,5),second=Style.floorShade(b,1.1,5);
  assert.ok(Math.abs(first[0]-second[0])<.02);
});
test('环境光采样不修改火把集合，只取附近八盏；隔墙火把不能染色角色',()=>{
  const torches=Array.from({length:16},(_,i)=>({x:i+.5,y:5,ph:i})),original=JSON.stringify(torches);
  const field=Style.actorLights({theme:'苔石地牢',torches,cam:{x:4,y:5},time:1});
  assert.equal(field.lights.length,8);assert.equal(JSON.stringify(torches),original);
  const actor={x:4,y:5,z:0},blocked=Style.sampleActor(actor,field,()=>false);
  assert.equal(blocked.energy,0);assert.deepEqual(blocked.warm,[0,0,0]);
  assert.ok(Style.sampleActor(actor,field).energy>0);
});
test('角色面朝向产生冷暖明暗，离开火把回到冷色环境光',()=>{
  const field=Style.actorLights({theme:'苔石地牢',torches:[{x:2,y:0}],cam:{x:0,y:0}});
  const light=Style.sampleActor({x:0,y:0},field),toward=Style.faceLight(light,1,0,0),away=Style.faceLight(light,-1,0,0);
  assert.ok(toward.gain>away.gain);assert.equal(toward.tone,'#ffc17d');assert.equal(away.tone,'#9bb8df');
  assert.equal(Style.faceLight(Style.sampleActor({x:10,y:0},field),1,0,0).tone,'#9bb8df');
});
test('冰霜与治疗光随原光效寿命衰减，过期不残留，不改写效果或穿墙',()=>{
  for(const [flag,color,life] of [['frost','#a8dcff',.8],['heal','#8dffc1',.22]]){
    const glow={x:0,y:0,r:1.6,t:0,[flag]:true},saved=JSON.stringify(glow),actor={x:0,y:0,z:0};
    const sample=t=>Style.sampleActor(actor,Style.actorLights({theme:'苔石地牢',glows:[{...glow,t}],cam:actor}));
    assert.equal(sample(0).colors.warm,color);assert.ok(sample(life*.5).energy<sample(0).energy);
    assert.equal(sample(life+.01).energy,0);assert.equal(JSON.stringify(glow),saved);
    const field=Style.actorLights({theme:'苔石地牢',glows:[glow],cam:actor});
    assert.equal(Style.sampleActor(actor,field,()=>false).energy,0);
  }
});
test('渲染结束及异常都归还环境光，背包角色继续使用独立光照',()=>{
  const g=loadGame();g.run('player.renderLight={sentinel:true};const savedLight=player.renderLight;drawSoftRig(player,[],PX,0,null,{colors:{cool:"#9bb8df",warm:"#ffc17d"},energy:0,warm:[0,0,0]});');
  assert.equal(g.run('player.renderLight===savedLight'),true);
  g.run('drawRig=()=>{throw new Error("lighting fixture failure");};');
  assert.throws(()=>g.run('drawSoftRig(player,[],PX,0,null,{});'),/lighting fixture failure/);
  assert.equal(g.run('player.renderLight===savedLight'),true);
});
test('冰冻和受击贴图优先于火把色调，常亮细部不被环境染色',()=>{
  const g=loadGame();g.run(`const litSkinCube=playerRig(player).find(b=>b.tx);let litSkinSample;texShaded=(...args)=>{litSkinSample=args;return null;};
    const litSkinPoints=Array.from({length:8},()=>[0,0]),litSkinLamp={tone:'#ffc17d',amount:.3};
    drawTexFace({frozen:1},litSkinCube,0,1,litSkinPoints,.8,litSkinLamp);`);
  assert.equal(g.run('litSkinSample[2]'),'#8fd8ff');assert.equal(g.run('litSkinSample[3]'),.4);
  g.run('drawTexFace({tint:1,frozen:1},litSkinCube,0,1,litSkinPoints,.8,litSkinLamp);');
  assert.equal(g.run('litSkinSample[2]'),'#ff3a1a');
  g.run('drawTexFace({frozen:1},{...litSkinCube,nf:true},0,1,litSkinPoints,.8,litSkinLamp);');
  assert.equal(g.run('litSkinSample[2]'),'');assert.equal(g.run('litSkinSample[1]'),10);
});
