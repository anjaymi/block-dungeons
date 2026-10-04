// Offline conversion of user-supplied static GLBs. No runtime GLTF loader needed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=process.argv[2]||'G:/ces/voxel-basebody/public';
const sandbox={console,setTimeout(){},setInterval(){}};sandbox.window=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root,'vendor/voxel-world.js'),'utf8'),sandbox);
const T=sandbox.THREE;
const roster=[['tree','trees/seasonal-r001/summer/young.glb',2.6],['stump','nature/r001/stump.glb',1.8],['log','nature/r001/log.glb',1.8],['daisy','flowers/r001/daisy-growing.glb',.75]];
function convert(file,scale){
  const bytes=fs.readFileSync(path.join(source,file));
  if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2)throw Error('Invalid GLB '+file);
  let json,bin;for(let at=12;at<bytes.length;){const size=bytes.readUInt32LE(at),kind=bytes.readUInt32LE(at+4),data=bytes.subarray(at+8,at+8+size);if(kind===0x4e4f534a)json=JSON.parse(data);if(kind===0x004e4942)bin=data;at+=size+8;}
  if(!json||!bin||json.skins?.length||json.animations?.length||json.images?.length||json.extensionsRequired?.length)throw Error('Only static, untextured GLBs supported: '+file);
  const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},reads={5120:['readInt8',1,127],5121:['readUInt8',1,255],5122:['readInt16LE',2,32767],5123:['readUInt16LE',2,65535],5125:['readUInt32LE',4,4294967295],5126:['readFloatLE',4,1]};
  function accessor(id){const a=json.accessors[id],v=json.bufferViews[a.bufferView],r=reads[a.componentType],n=sizes[a.type];if(!v||a.sparse||v.buffer!==0||!r)throw Error('Unsupported accessor');const start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||n*r[1],out=[];for(let i=0;i<a.count;i++)for(let j=0;j<n;j++){let x=bin[r[0]](start+i*stride+j*r[1]);if(a.normalized)x=Math.max(-1,x/r[2]);out.push(x);}return {data:out,n,count:a.count};}
  const P=[],N=[],C=[],bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};let sourceTriangles=0,removedDisplayBlocks=0;
  const axis=new T.Matrix4().set(scale,0,0,0,0,0,-scale,0,0,scale,0,0,0,0,0,1);
  function visit(id,parent){const node=json.nodes[id],local=new T.Matrix4();if(node.matrix)local.fromArray(node.matrix);else local.compose(new T.Vector3(...(node.translation||[0,0,0])),new T.Quaternion(...(node.rotation||[0,0,0,1])),new T.Vector3(...(node.scale||[1,1,1])));const world=parent.clone().multiply(local);
    if(node.mesh!==undefined)for(const primitive of json.meshes[node.mesh].primitives){if((primitive.mode??4)!==4)throw Error('Non triangle primitive');let pos=accessor(primitive.attributes.POSITION),normal=primitive.attributes.NORMAL===undefined?null:accessor(primitive.attributes.NORMAL),color=primitive.attributes.COLOR_0===undefined?null:accessor(primitive.attributes.COLOR_0),indices=primitive.indices===undefined?Array.from({length:pos.count},(_,i)=>i):accessor(primitive.indices).data;
      sourceTriangles+=indices.length/3;
      // The source's little display soil cubes must not become raised flowerpots.
      if(/^soil_voxel_/.test(node.name||'')){removedDisplayBlocks++;continue;}
      // These four authored models consist of colored block meshes. At the game
      // camera distance their rounded-box bevels are subpixel: preserve every
      // block's local extents, node transform and color with a twelve-face LOD.
      if(pos.count>36&&!color){const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];for(let i=0;i<pos.count;i++)for(let k=0;k<3;k++){low[k]=Math.min(low[k],pos.data[i*3+k]);high[k]=Math.max(high[k],pos.data[i*3+k]);}const cube=new T.BoxGeometry(...low.map((x,k)=>high[k]-x)).toNonIndexed();cube.translate(...low.map((x,k)=>(high[k]+x)/2));pos={data:Array.from(cube.attributes.position.array),n:3,count:36};normal={data:Array.from(cube.attributes.normal.array),n:3,count:36};indices=Array.from({length:36},(_,i)=>i);cube.dispose();}
      const material=json.materials?.[primitive.material]?.pbrMetallicRoughness;if(material?.baseColorTexture)throw Error('Textured primitive');const tint=material?.baseColorFactor||[1,1,1,1];if(tint[3]<.99)throw Error('Transparent primitive');const matrix=axis.clone().multiply(world),nm=new T.Matrix3().getNormalMatrix(matrix);
      for(const i of indices){const p=new T.Vector3(...pos.data.slice(i*3,i*3+3)).applyMatrix4(matrix),n=normal?new T.Vector3(...normal.data.slice(i*3,i*3+3)).applyNormalMatrix(nm):new T.Vector3(0,0,1);for(let k=0;k<3;k++){const value=[p.x,p.y,p.z][k];P.push(value);N.push([n.x,n.y,n.z][k]);C.push(Math.round(Math.max(0,Math.min(1,tint[k]*(color?color.data[i*color.n+k]:1)))*255));bounds.min[k]=Math.min(bounds.min[k],value);bounds.max[k]=Math.max(bounds.max[k],value);}}
    }for(const child of node.children||[])visit(child,world);
  }
  for(const id of json.scenes[json.scene||0].nodes)visit(id,new T.Matrix4());
  if(P.some(x=>!Number.isFinite(x))||P.length%9)throw Error('Invalid geometry');
  const ground=bounds.min[2];for(let i=2;i<P.length;i+=3)P[i]-=ground;bounds.max[2]-=ground;bounds.min[2]=0;
  const encode=(a,Type)=>{const b=new Type(a);return Buffer.from(b.buffer).toString('base64');};
  return {model:{p:encode(P,Float32Array),n:encode(N,Float32Array),c:encode(C,Uint8Array),bounds},receipt:{source:path.resolve(source,file),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,sourceTriangles,triangles:P.length/9,removedDisplayBlocks,lod:'Block bounds and node transforms retained; subpixel rounded bevels omitted',bounds,scale,sourceGround:ground/scale,axis:'source Y up -> runtime Z up; [X,-Z,Y]',textures:0}};
}
const models={},receipts={};for(const [id,file,scale]of roster){const result=convert(file,scale);models[id]=result.model;receipts[id]=result.receipt;}
const dest=path.join(root,'assets/scenes/frontier');fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'ces-models.js'),'// Derived from user-supplied G:/ces static models. See source-manifest.json.\n(function(root){const models='+JSON.stringify(models)+';if(typeof module==="object"&&module.exports)module.exports=models;else root.FrontierModels=models;})(typeof window!=="undefined"?window:globalThis);\n');
fs.writeFileSync(path.join(dest,'source-manifest.json'),JSON.stringify({revision:'frontier-1',origin:'User-supplied local voxel-basebody project; not an official Minecraft asset pack',license:'No separate license found; provenance retained for this local project',models:receipts},null,2));
console.log(JSON.stringify(receipts,null,2));
