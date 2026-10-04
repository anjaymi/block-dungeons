const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../scene-assets.js'),root=path.resolve(__dirname,'..'),out=path.join(root,'assets/scenes/moss-stone-v2');
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function pointInPolygon(q,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
}return inside;}
function pointInStone(p,q){
  if(q[2]<p.z||q[2]>p.z+p.h)return false;
  const t=Math.max(0,(q[2]-(p.z+p.h-p.bevel))/p.bevel);
  return pointInPolygon(q,p.outline.map((v,i)=>v.map((x,a)=>x+(p.inset[i][a]-x)*t)));
}
function world(withAssets=true,withStone=true){
  const canvas=()=>({width:1,height:1,style:{},addEventListener(){},getContext:()=>({clearRect(){},drawImage(){},getImageData:()=>({data:new Uint8Array(4)})})});
  const main=canvas();main.parentNode={insertBefore(){}};
  const s={console:{log(){},warn(){},error(){}},performance:{now:()=>1000},setTimeout(){},addEventListener(){},innerWidth:1280,innerHeight:720,devicePixelRatio:1,location:{search:''},document:{createElement:canvas,getElementById:()=>main}};
  s.window=s;s.SceneStyle=require('../scene-style.js');s.DungeonMap=require('../dungeon-map.js');if(withAssets)s.SceneAssets=A;
  if(withStone)s.StoneMaterial=require('../stone-material.js');
  const context=vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(root,'vendor/voxel-world.js'),'utf8'),context);
  const T=s.THREE;
  class Renderer{constructor(){this.shadowMap={};this.debug={};this.info={render:{calls:0,triangles:0}};}setPixelRatio(){}setSize(){}setClearColor(){}clear(){}render(){}getContext(){return {getExtension:()=>null,getParameter:()=> 'fixture',isContextLost:()=>false};}}
  s.THREE={...T,WebGLRenderer:Renderer};
  vm.runInContext(fs.readFileSync(path.join(root,'world3d.js'),'utf8').replace(/\}\)\(\);\s*$/,`window.assetProbe={assetParts,wallParts,materials:()=>mats,meshes:()=>world.children,shadow:()=>shadowProxy};})();`),context);
  s.World3D.init();return {s,T};
}
test('六种场景素材的每个实体闭合、法线向外，缺角与倒角不产生反面',()=>{
  for(const id of A.ids)for(let seed=0;seed<10;seed++)for(const p of A.pieces(id,seed)){
    assert.ok(p.vertices.every(v=>v.length===3&&v.every(Number.isFinite)));
    const center=p.vertices.reduce((a,v)=>a.map((x,i)=>x+v[i]/p.vertices.length),[0,0,0]),edges=new Map();
    for(const f of p.faces){
      assert.ok(A.palette[f.color]);assert.ok(f.v.length>=3&&f.v.length<=4);
      for(let i=1;i<f.v.length-1;i++){
        const [a,b,c]=[f.v[0],f.v[i],f.v[i+1]].map(k=>p.vertices[k]),n=cross(sub(b,a),sub(c,a));
        assert.ok(Math.hypot(...n)>1e-8,id+'/'+p.name+' degenerate face');
        if(p.outline){
          const length=Math.hypot(...n),mid=a.map((x,k)=>(x+b[k]+c[k])/3),epsilon=.00001;
          assert.ok(pointInStone(p,mid.map((x,k)=>x-n[k]/length*epsilon)),id+'/'+p.name+' inward sample');
          assert.ok(!pointInStone(p,mid.map((x,k)=>x+n[k]/length*epsilon)),id+'/'+p.name+' outward sample');
        }else assert.ok(dot(n,sub(a,center))>1e-8,id+'/'+p.name+' inward face');
      }
      for(let i=0;i<f.v.length;i++){
        const a=f.v[i],b=f.v[(i+1)%f.v.length],key=[Math.min(a,b),Math.max(a,b)].join(',');
        const e=edges.get(key)||[];e.push(a<b?1:-1);edges.set(key,e);
      }
    }
    for(const e of edges.values())assert.deepEqual(e.sort(),[-1,1],id+'/'+p.name+' open or reversed edge');
  }
});
test('石板顶面保持角色地平面，断裂处有完整铺底，所有部件留在原格占地内',()=>{
  for(const id of A.ids.filter(x=>x.endsWith('flagstone')))for(let seed=0;seed<10;seed++){
    const p=A.pieces(id,seed),b=A.bounds(p);
    assert.deepEqual(b.min,[-12,-12,-2]);assert.deepEqual(b.max,[12,12,0]);
    const grout=A.bounds([p.find(x=>x.name==='grout')]);assert.deepEqual(grout.min,[-12,-12,-2]);
    assert.equal(grout.max[2],-1.45);assert.ok(p.length>1);
  }
});
test('破损口露出土层，碎片位于缺口内并贴着铺底，不悬浮在角色脚面',()=>{
  for(const id of ['split_flagstone','worn_flagstone'])for(let seed=0;seed<10;seed++){
    const parts=A.pieces(id,seed),bed=parts[0],main=parts[1];
    assert.ok(bed.faces.every(f=>f.color.startsWith('earth')));
    for(const fragment of parts.slice(2)){
      const b=A.bounds([fragment]);assert.equal(b.min[2],A.bounds([bed]).max[2]);assert.ok(b.max[2]<0);
      for(const v of fragment.vertices)assert.ok(!pointInPolygon(v,main.outline),id+'/'+fragment.name+' overlaps surviving stone');
    }
  }
});
function room(w=60,h=44){
  const G=new Uint8Array(w*h),roomId=new Int16Array(w*h).fill(-1);
  for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){G[y*w+x]=1;roomId[y*w+x]=0;}
  return {G,GW:w,GH:h,roomId};
}
test('破损集中在墙边，宽阔房间中央保持完整；分布与遍历顺序无关',()=>{
  const m=room(),positions=[];let edge=0,edgeDamage=0,center=0,centerDamage=0;
  for(let y=3;y<m.GH-3;y++)for(let x=3;x<m.GW-3;x++){
    const result=A.floorTreatment(m,x,y);positions.push({x,y,result});
    if(Math.min(x-3,y-3,m.GW-4-x,m.GH-4-y)<2){edge++;if(result.damaged)edgeDamage++;}
    else{center++;if(result.damaged)centerDamage++;}
  }
  assert.ok(centerDamage/center<.02);assert.ok(edgeDamage/edge>.12);assert.ok(edgeDamage/edge>centerDamage/center*10);
  for(const {x,y,result} of positions.reverse())assert.deepEqual(A.floorTreatment(m,x,y),result);
  const before=JSON.stringify(m);A.floorTreatment(m,6,6);assert.equal(JSON.stringify(m),before);
});
test('门前、出口与一格窄通道保留完整地面；保护区不改变石材变体',()=>{
  const m=room(),variants=[];for(let y=8;y<=12;y++)for(let x=8;x<=12;x++)variants.push([x,y,A.floorTreatment(m,x,y).seed]);
  m.G[10*m.GW+10]=2;
  for(let y=9;y<=11;y++)for(let x=9;x<=11;x++)assert.equal(A.floorTreatment(m,x,y).damaged,false);
  m.exitPos={x:4.5,y:18.5};
  for(let y=17;y<=20;y++)for(let x=3;x<=6;x++)if(Math.hypot(x+.5-m.exitPos.x,y+.5-m.exitPos.y)<1.8)assert.equal(A.floorTreatment(m,x,y).damaged,false);
  for(const [x,y,seed] of variants)assert.equal(A.floorTreatment(m,x,y).seed,seed);
  const corridor={G:new Uint8Array(30*7),GW:30,GH:7};for(let x=1;x<29;x++)corridor.G[3*30+x]=1;
  for(let x=1;x<29;x++)assert.equal(A.floorTreatment(corridor,x,3).damaged,false);
});
test('两种缺口都有三个不同轮廓；墙体、柱台与旧碎石几何保持一致',()=>{
  for(const id of ['split_flagstone','worn_flagstone'])assert.equal(new Set([7,8,9].map(seed=>JSON.stringify(A.pieces(id,seed)[1].outline))).size,3);
  const previous={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/render-qa/floor-damage-v2/scene-assets-before.js'),'utf8'),previous);
  for(const id of ['wall','pillar','rubble'])for(const seed of [7,8,9])assert.equal(JSON.stringify(A.pieces(id,seed)),JSON.stringify(previous.module.exports.pieces(id,seed)));
});
test('墙脚、柱台和墙顶保留明确接触及原遮挡高度，不侵入相邻可行走格',()=>{
  for(const h of [28,31,34,30,33,29])for(let seed=0;seed<6;seed++){
    const b=A.bounds(A.pieces('wall',seed,h));assert.deepEqual(b.min,[-12,-12,0]);assert.deepEqual(b.max,[12,12,h+2]);
  }
  const pillar=A.pieces('pillar'),b=A.bounds(pillar);assert.deepEqual(b.min,[-10,-10,0]);assert.equal(b.max[2],33.5);
  // Sample the vertical structural core: footing, shaft mortar and capitals meet.
  for(let z=0;z<=33.5;z+=.1)assert.ok(pillar.some(p=>{const q=A.bounds([p]);return q.min[0]<=0&&q.max[0]>=0&&q.min[1]<=0&&q.max[1]>=0&&z>=q.min[2]-1e-8&&z<=q.max[2]+1e-8;}),'floating pillar at '+z);
});
test('实际地形适配器使用共享素材；资源缺失时保留旧地面与墙体回退',()=>{
  const {s}=world();assert.equal(s.assetProbe.assetParts('scene','flagstone',7).parts.length,1);
  const wall=s.assetProbe.wallParts('dungeon',0);assert.ok(Math.abs(wall.maxZ-30/24)<1e-6);
  const {s:fallback}=world(false);assert.ok(fallback.assetProbe.assetParts('scene','flagstone',7).parts.length>0);
  assert.ok(fallback.assetProbe.wallParts('dungeon',0).parts.length>0);
});
test('地形石材使用独立 shader，普通道具保持原材质；模块缺失时仍可绘制石材',()=>{
  const {s}=world(),materials=s.assetProbe.materials();assert.equal(materials.stone.name,'dry-dungeon-stone');
  assert.equal(materials.solid.customProgramCacheKey(),'style-rim-v2');assert.notEqual(materials.stone,materials.solid);
  const {s:fallback}=world(true,false);assert.equal(fallback.assetProbe.assetParts('scene','flagstone',7).parts[0].kind,'stone');
  assert.equal(fallback.assetProbe.materials().stone.vertexColors,true);
});
test('新场景绘制不改写地图、房间归属、出口或火把',()=>{
  const {s}=world(),G=new Uint8Array(100),roomId=new Int16Array(100).fill(-1);
  for(let y=2;y<8;y++)for(let x=2;x<8;x++)G[y*10+x]=1;
  const o={G,GW:10,GH:10,roomId,theme:{name:'苔石地牢'},torches:[{i:4,j:1,x:4.5,y:2.25,ph:0}],exitPos:{x:7,y:7},exitOpen:true,player:{x:4.5,y:5,G:{}},cam:{x:4.5,y:5},zoom:1,ox:200,oy:200};
  const before=JSON.stringify(o);assert.equal(s.World3D.frame(o),true);assert.equal(JSON.stringify(o),before);
  assert.equal(s.World3D.hasOccluder(4,1),true);assert.equal(s.World3D.hasOccluder(4,4),false);
});
test('五个主题共享粗石板，主题颜色缓存独立；其他主题的道具和光照保持一致',()=>{
  const {s}=world(),baseline={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets/render-qa/scene-style/world3d-before.js'),'utf8'),baseline);
  const variants=[];
  for(const name of Object.keys(A.palettes)){
    const cfg=s.World3D.THEME3D[name];assert.ok(cfg.floors.every(f=>f[0]==='scene'));
    if(name!=='苔石地牢')for(const key of ['wall','torch','wallDeco','clutter','obstacle','corner','light'])assert.equal(JSON.stringify(cfg[key]),JSON.stringify(baseline.window.World3D.THEME3D[name][key]));
    const parts=s.assetProbe.assetParts('scene','flagstone',7,name);variants.push(parts);assert.ok(parts.parts[0].geo.attributes.color.array.every(Number.isFinite));
    assert.equal(s.assetProbe.assetParts('scene','flagstone',7,name),parts);
  }
  assert.equal(new Set(variants.map(v=>Array.from(v.parts[0].geo.attributes.color.array).join(','))).size,5);
});
test('实际 GPU 地形烘焙高度场，不改写数据；高台地板、底座和角色阴影使用相同高度',()=>{
  const {s}=world();const m=s.DungeonMap.generate({seed:41,nMain:7,nSide:3}),terrain=s.DungeonMap.buildTerrain(m),r=m.rooms.find(r=>r.height>0);
  const o={...m,terrain,theme:{name:'幽深矿井'},torches:[],player:{x:r.cx+.5,y:r.cy+.5,G:{}},cam:{x:r.cx+.5,y:r.cy+.5},ox:100,oy:100,zoom:1};
  const before=JSON.stringify(m);assert.equal(s.World3D.frame(o),true);assert.equal(JSON.stringify(m),before);
  assert.equal(s.World3D.hasOccluder(r.cx,r.cy),false);assert.ok(s.World3D.diag(r.cx+.5,r.cy+.5).verts>0);
  assert.notEqual(s.World3D.diag(r.cx+.5,r.cy+.5).floorNear,'0/0','raised floors remain visible to diagnostics');
  let top=false,bedrock=false;
  for(const mesh of s.assetProbe.meshes()){const p=mesh.geometry.attributes.position.array,n=mesh.geometry.attributes.normal.array;
    assert.ok(p.every(Number.isFinite));assert.ok(n.every(Number.isFinite));
    for(let i=0;i<p.length;i+=3){if(Math.abs(p[i+2]+.16)<.00001)bedrock=true;
      if(p[i]>r.cx+.01&&p[i]<r.cx+.99&&-p[i+1]>r.cy+.01&&-p[i+1]<r.cy+.99&&Math.abs(p[i+2]-s.DungeonMap.heightAt(terrain,p[i],-p[i+1]))<.00001)top=true;}
  }
  assert.ok(top,'raised stone top follows the terrain');assert.ok(bedrock,'foundation reaches common bedrock');
  s.World3D.beginShadows();s.World3D.pushShadow(o.player,[{M:[1,0,0,0,1,0,0,0,1,0,0,0],c:[0,0,1],s:[1,1,1]}],.1,.25,(M,x,y,z)=>[x,y,z]);s.World3D.endShadows();
  assert.ok(Math.abs(s.assetProbe.shadow().instanceMatrix.array[14]-(.35+s.DungeonMap.heightAt(terrain,o.player.x,o.player.y)))<.00001);
});
test('Blockbench 原生导出在五位小数精度内逐顶点、逐面一致，重导入保留网格与贴图',()=>{
  const source=JSON.parse(fs.readFileSync(path.join(out,'source-layout.json'))),model=JSON.parse(fs.readFileSync(path.join(out,'moss-stone-v2.bbmodel'))),audit=JSON.parse(fs.readFileSync(path.join(out,'native-audit.json')));
  assert.equal(model.elements.length,source.elements.length);assert.equal(audit.meshes.length,source.elements.length);
  assert.equal(model.textures.length,1);assert.equal(audit.textures.length,1);
  for(let i=0;i<source.elements.length;i++){
    const wanted=source.elements[i],saved=model.elements[i],native=audit.meshes[i],keys=source.nativeKeys[i].vertexKeys,faceKeys=source.nativeKeys[i].faceKeys;
    assert.equal(saved.name,wanted.name);assert.equal(native.name,wanted.name);
    for(const got of [keys.map(k=>saved.vertices[k]),keys.map(k=>native.vertices[k])]){
      assert.equal(got.length,wanted.vertices.length);
      // The native project codec serializes authored coordinates to five decimals.
      got.forEach((v,j)=>v.forEach((x,a)=>assert.ok(Math.abs(x-wanted.vertices[j][a])<=.0000051,wanted.name+' vertex mismatch')));
    }
    assert.deepEqual(saved.origin,[0,0,0]);assert.deepEqual(saved.rotation,[0,0,0]);
    faceKeys.map(k=>saved.faces[k]).forEach((f,j)=>{
      assert.deepEqual(f.vertices.map(k=>keys.indexOf(k)),wanted.faces[j]);assert.equal(f.texture,0);
      for(const uv of Object.values(f.uv))assert.equal(Math.floor(uv[0]/8),source.faceColors[i][j]);
    });
    faceKeys.map(k=>native.faces[k]).forEach((f,j)=>{
      assert.deepEqual(f.vertices.map(k=>keys.indexOf(k)),wanted.faces[j]);assert.equal(f.texture,audit.textures[0].uuid);
      for(const uv of Object.values(f.uv))assert.equal(Math.floor(uv[0]/8),source.faceColors[i][j]);
    });
  }
  assert.ok(audit.projects.some(p=>p.uuid==='db211a0b-0fbe-fc23-1fdc-2bec497cf6ce'&&p.save_path===''),'user unsaved tree project must survive');
});
test('Blockbench 素材布局使用当前游戏几何源，防止交付模型与运行时脱节',()=>{
  const source=JSON.parse(fs.readFileSync(path.join(out,'source-layout.json')));let index=0;
  for(const {id,seed,offset} of source.source)for(const part of A.pieces(id,seed)){
    assert.deepEqual(source.elements[index],{name:id+'/'+part.name,vertices:part.vertices.map(v=>[v[0]+offset[0],v[2]+offset[2],-(v[1]+offset[1])]),faces:part.faces.map(f=>f.v)});
    assert.deepEqual(source.faceColors[index],part.faces.map(f=>Object.keys(A.palette).indexOf(f.color)));index++;
  }
  assert.equal(index,source.elements.length);
});
test('导出贴图尺寸与 UV 配套，嵌入 PNG 与调色板像素相同',async()=>{
  const {loadImage,createCanvas}=require('C:/Users/anjaymi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
  const model=JSON.parse(fs.readFileSync(path.join(out,'moss-stone-v2.bbmodel'))),t=model.textures[0];
  assert.equal(t.uv_width,128);assert.equal(t.uv_height,16);assert.equal(model.resolution.width,128);
  const images=await Promise.all([loadImage(t.source),loadImage(path.join(out,'palette.png'))]);
  const pixels=images.map(im=>{assert.equal(im.width,128);assert.equal(im.height,16);const c=createCanvas(128,16),ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,128,16).data;});
  assert.deepEqual(pixels[0],pixels[1]);
});
