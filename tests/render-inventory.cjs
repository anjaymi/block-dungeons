// Render the actual Canvas inventory with decoded production PNGs.
// This checks composition independently of browser/GPU/device verification.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const runtime='C:/Users/anjaymi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const Canvas=require(runtime+'/@napi-rs/canvas'),sharp=require(runtime+'/sharp');
const {loadGame}=require('./game-harness.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/inventory/qa');
fs.mkdirSync(out,{recursive:true});
class LocalImage {
  constructor(){
    const image=Canvas.createCanvas(1,1);image.complete=false;
    Object.defineProperties(image,{naturalWidth:{get:()=>image.width},naturalHeight:{get:()=>image.height}});
    Object.defineProperty(image,'src',{set(url){
      const input=url.startsWith('data:')?Buffer.from(url.slice(url.indexOf(',')+1),'base64'):fs.readFileSync(path.resolve(root,url));
      // Decode PNG metadata with libvips, then pass unchanged RGBA pixels to Skia.
      // The production asset files are never modified.
      sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true}).then(({data,info})=>{
        image.width=info.width;image.height=info.height;
        image.getContext('2d').putImageData(new Canvas.ImageData(new Uint8ClampedArray(data),info.width,info.height),0,0);
        image.complete=true;image.onload?.();
      }).catch(e=>image.onerror?.(e));
    }});return image;
  }
}
async function prepare(width,height,mobile,pane='bag'){
  const canvas=Canvas.createCanvas(width,height),g=loadGame({width,height,canvas,createCanvas:Canvas.createCanvas,Image:LocalImage});
  for(const file of ['weapon-models.js','scenefx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),g.context,{filename:file});
  for(let i=0;i<100&&!g.run('InventoryAssets.ready()');i++)await new Promise(resolve=>setTimeout(resolve,20));
  if(!g.run('InventoryAssets.ready()'))throw new Error('Production PNGs failed to decode: '+g.run('JSON.stringify(InventoryAssets.errors)'));
  g.run(`selW=0;selC=0;selK=0;startGame();hudMode='${mobile?'mobile':'pc'}';
    player.xp=44;player.emeralds=18;player.idScrolls=3;player.pts=5;
    player.eq.armor=null;player.eq.helm=null;player.bag=[];
    const armor=newBase('armor',0);armor.q='magic';
    const helm=newBase('helm',0);helm.q='magic';
    player.bag=[{it:armor,x:0,y:0},{it:helm,x:2,y:0},{it:makeRune(0),x:4,y:0}];
    recalc();player.hp=player.maxhp;player.mana=player.maxMana;
    inventoryState.pane='${pane}';mouse.x=-100;mouse.y=-100;cam.x=player.x;cam.y=player.y;`);
  return {canvas,g};
}
async function capture(name,width,height,mobile,drawer=null,pane='bag'){
  const {canvas,g}=await prepare(width,height,mobile,pane);
  g.run(`requestBag();inventoryState.pane='${pane}';`);g.context.performance.now=()=>1250;
  g.run(`withZoom(render);
    ${drawer==='item'?"inventorySelect({kind:'grid',cx:0,cy:0});":drawer?`inventoryAction({kind:'drawer',drawer:'${drawer}'});`:''}
    drawBag();`);
  const target=path.join(out,name+'.png');fs.writeFileSync(target,canvas.toBuffer('image/png'));
  return {name,path:target,width,height};
}
async function compare(name,source,width,height){
  const left=await sharp(source).resize(width,height,{fit:'fill'}).png().toBuffer();
  const right=path.join(out,name+'.png');
  await sharp({create:{width:width*2+12,height,channels:4,background:'#35313d'}}).composite([{input:left,left:0,top:0},{input:right,left:width+12,top:0}]).png().toFile(path.join(out,name+'-comparison.png'));
}
async function main(){
  const captures=[];
  for(const [name,w,h,m,drawer,pane]of [
    ['pc-1317x1194',1317,1194,false],['pc-1280x760',1280,760,false],
    ['mobile-844x390',844,390,true],['mobile-667x375-bag',667,375,true],
    ['mobile-667x375-gear',667,375,true,null,'gear'],['portrait-390x844',390,844,true],
    ['mobile-item',844,390,true,'item'],['mobile-stats',844,390,true,'stats'],
    ['mobile-cube',844,390,true,'cube'],['mobile-appearance',844,390,true,'appearance']
  ])captures.push(await capture(name,w,h,m,drawer,pane));
  await compare('pc-1317x1194',path.join(root,'assets/inventory-concepts/equipment-backpack-pc-selected.png'),1317,1194);
  await compare('mobile-844x390',path.join(root,'assets/inventory-concepts/equipment-backpack-mobile-concept.png'),844,390);
  fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({renderer:'Production game Canvas functions, native Skia Canvas, real PNGs, controlled game fixture. World uses its existing 2D fallback. Browser/GPU/touch verification is separate.',captures},null,2));
  console.log(JSON.stringify(captures,null,2));
}
module.exports={prepare,Canvas,sharp,root,out};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
