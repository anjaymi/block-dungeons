// Actual game rigs and production skins on native Canvas. This is not a GPU capture.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {prepare,Canvas,root}=require('./render-inventory.cjs');
Canvas.GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
const font='"Microsoft YaHei",sans-serif';
const out=path.join(root,'assets/render-qa');
const chars=['akane','yoru','yuki','midori'],weapons=['greatsword','sickles','staff','spear'];
async function sheet(){
  const {g,canvas}=await prepare(1600,1200,false),ctx=canvas.getContext('2d');
  assert.equal(g.run('Object.values(MCIMG).every(im=>im.width&&im.complete!==false)'),true);
  ctx.fillStyle='#0d1019';ctx.fillRect(0,0,1600,1200);
  const poses=['正面待机','背面行走','攻击姿态'];
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const x=col*400,y=row*400;ctx.fillStyle=(row+col)%2?'#171b27':'#141823';ctx.fillRect(x+8,y+8,384,384);
    ctx.save();ctx.beginPath();ctx.rect(x+8,y+8,384,384);ctx.clip();
    g.run(`player.char='${chars[col]}';player.eq.weapon=newBase('weapon',0,'${weapons[col]}');recalc();
      player.x=player.y=player.z=0;player.st='move';player.walk=1;player.speedFrac=${row===1?'.8':'0'};
      player.ang=${row===1?'4.04':'.9'};player.flash=player.inv=0;delete player.an;
      ${row===2?"startAttack();player.ph='act';player.pt=player.T.act*.48;":''}
      ox=${x+185};oy=${y+305};drawSoftRig(player,playerRig(player),PX*2.7,0);`);
    ctx.restore();ctx.fillStyle='#ead9b8';ctx.font='bold 22px '+font;ctx.textAlign='left';ctx.fillText(g.run('CHAR_INFO[player.char].n'),x+24,y+40);
    ctx.fillStyle='#929fb7';ctx.font='16px '+font;ctx.fillText(poses[row],x+24,y+68);
  }
  fs.writeFileSync(path.join(out,'characters.png'),canvas.toBuffer('image/png'));
}
async function dungeon(name,width,height,mobile){
  const {g,canvas}=await prepare(width,height,mobile);
  // Use the actual vendored monster adapter, without loading the WebGL renderer.
  for(const file of ['vendor/voxel-world.js','voxmobs.js','fantasy-hud.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),g.context,{filename:file});
  for(let i=0;i<100&&!g.run('FantasyHUD.ready()');i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(g.run('FantasyHUD.ready()'),true);
  g.run(`const p=player;chests=[];crates=[];items=[];corpses=[];mobs=[];
    p.x=rooms[0].x+rooms[0].w/2;p.y=rooms[0].y+rooms[0].h/2;p.ang=.9;p.rig=playerRig(p);
    cam.x=p.x;cam.y=p.y;
    const placements=[['zombie',-1.5,.4],['skeleton',2,-.8],['creeper',-2.7,-1.4]];
    for(const [kind,dx,dy]of placements){const m=spawnMob(kind,p.x+dx,p.y+dy);m.awake=true;m.hp=m.maxhp;}
    withZoom(render);drawHUD();`);
  fs.writeFileSync(path.join(out,name+'.png'),canvas.toBuffer('image/png'));
  return {name,width,height,actors:g.run('mobs.length+1')};
}
async function statuses(){
  const {g,canvas}=await prepare(1600,400,false),ctx=canvas.getContext('2d');
  ctx.fillStyle='#151a26';ctx.fillRect(0,0,1600,400);
  const settings=[['原贴图',''],['受击变色','player.flash=.12;'],['冰冻色调','player.frozen=1;'],['透明度 45%','player.alpha=.45;']];
  for(let col=0;col<4;col++){
    const x=col*400;g.run(`player.x=player.y=player.z=0;player.flash=player.frozen=0;player.alpha=1;player.ang=.9;delete player.an;${settings[col][1]}ox=${x+190};oy=340;drawSoftRig(player,playerRig(player),PX*3.4,0);`);
    ctx.fillStyle='#e7d7b7';ctx.font='bold 22px '+font;ctx.textAlign='left';ctx.fillText(settings[col][0],x+24,40);
  }
  // The textured head itself must carry the cold status, beyond the untextured sword.
  assert.notDeepEqual(ctx.getImageData(155,185,90,85).data,ctx.getImageData(955,185,90,85).data,'Frozen skin must be tinted');
  fs.writeFileSync(path.join(out,'character-statuses.png'),canvas.toBuffer('image/png'));
}
async function main(){
  fs.mkdirSync(out,{recursive:true});await sheet();await statuses();
  const captures=[await dungeon('dungeon-pc',1280,760,false),await dungeon('dungeon-mobile',844,390,true)];
  fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({renderer:'Actual game Canvas functions and decoded production PNGs; dungeon uses the existing 2D terrain fallback. These are not Edge screenshots or GPU validation.',captures,skins:chars},null,2));
  console.log('Character rendering artifacts: '+out);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
