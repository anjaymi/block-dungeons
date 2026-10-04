// Reproducible Blockbench MCP input; scene-assets.js is the geometry authority.
const fs=require('node:fs'),path=require('node:path'),A=require('../scene-assets.js');
const {createCanvas}=require('C:/Users/anjaymi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/scenes/moss-stone-v2');
function generate(){
  fs.mkdirSync(out,{recursive:true});
  const bridgeDir=path.join(root,'tools/refs/floor-damage-20261004');fs.mkdirSync(bridgeDir,{recursive:true});
  const keys=Object.keys(A.palette),canvas=createCanvas(keys.length*8,16),ctx=canvas.getContext('2d');
  keys.forEach((k,i)=>{ctx.fillStyle='#'+A.palette[k].toString(16).padStart(6,'0');ctx.fillRect(i*8,0,8,16);});
  const png=canvas.toBuffer('image/png');fs.writeFileSync(path.join(out,'palette.png'),png);
  const layout=[];
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)layout.push([
    ['flagstone','split_flagstone','worn_flagstone'][col],7+row,[-38+col*38,-68+row*36,0]]);
  layout.push(['wall',1,[-25,48,0]],['pillar',7,[25,48,0]],['rubble',7,[0,48,0]]);
  const elements=[],faceColors=[],source=[];
  for(const [id,seed,offset] of layout){
    const pieces=A.pieces(id,seed);source.push({id,seed,offset,bounds:A.bounds(pieces),parts:pieces.length});
    for(const p of pieces){
      elements.push({name:id+'/'+p.name,vertices:p.vertices.map(v=>[v[0]+offset[0],v[2]+offset[2],-(v[1]+offset[1])]),faces:p.faces.map(f=>f.v)});
      faceColors.push(p.faces.map(f=>keys.indexOf(f.color)));
    }
  }
  const data={elements,faceColors,source,paletteKeys:keys,width:canvas.width,height:canvas.height};
  fs.writeFileSync(path.join(out,'source-layout.json'),JSON.stringify(data,null,2));
  fs.writeFileSync(path.join(bridgeDir,'texture.args.json'),JSON.stringify({name:'Moss stone v2 palette',width:canvas.width,height:canvas.height,data:'data:image/png;base64,'+png.toString('base64')}));
  fs.writeFileSync(path.join(bridgeDir,'meshes.args.json'),JSON.stringify({elements,texture:'Moss stone v2 palette'}));
  console.log(JSON.stringify({out,meshCount:elements.length,palette:[canvas.width,canvas.height],assets:source.map(x=>x.id)}));
  return data;
}
if(require.main===module)generate();module.exports={generate};
