// Production skins/rigs under the actual per-face light sampler. Canvas proof,
// separate from the browser's WebGL terrain captures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare,Canvas,root}=require('./render-inventory.cjs');
const Style=require('../scene-style.js'),out=path.join(root,'assets/render-qa/scene-character');
Canvas.GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const {g,canvas}=await prepare(1920,1500,false),ctx=canvas.getContext('2d');
  const titles=['独立预览光','地牢冷色环境光','近火把 · 暖色受光面','冰霜技能 · 短暂冷光'];
  const chars=['akane','yoru','yuki'],weapons=['greatsword','sickles','hammer'];
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const x=col*480,y=row*500;
    ctx.fillStyle=col===2?'#242228':'#181e2a';ctx.fillRect(x,y,480,500);
    g.run(`player.char='${chars[row]}';player.eq.weapon=newBase('weapon',0,'${weapons[row]}');player.eq.weapon.weaponStyle='steel';recalc();
      player.x=player.y=player.z=0;player.ang=.9;player.flash=player.frozen=player.inv=0;player.st='move';player.speedFrac=0;delete player.an;
      ox=${x+218};oy=${y+320};`);
    const field=Style.actorLights({theme:'苔石地牢',torches:col===2?[{x:1.4,y:1,ph:0}]:[],glows:col===3?[{x:.4,y:.4,r:2,t:.02,frost:true}]:[],cam:{x:0,y:0}});
    g.context.previewLighting=col===0?null:Style.sampleActor({x:0,y:0},field);
    g.run('shadow(player,.34);drawSoftRig(player,playerRig(player),PX*3.5,0,null,previewLighting);');
    ctx.fillStyle='#dfdbd3';ctx.font='bold 21px "Microsoft YaHei"';ctx.textAlign='left';ctx.fillText(titles[col],x+22,y+34);
    ctx.fillStyle='#8d9db2';ctx.font='16px "Microsoft YaHei"';ctx.fillText(g.run('CHAR_INFO[player.char].n'),x+22,y+62);
  }
  assert.notDeepEqual(ctx.getImageData(480+160,125,120,90).data,ctx.getImageData(960+160,125,120,90).data,'实际头部贴图必须响应环境光');
  fs.writeFileSync(path.join(out,'character-lighting.png'),canvas.toBuffer('image/png'));

  const plan=Canvas.createCanvas(1440,450),pc=plan.getContext('2d');
  const m={GW:24,GH:17,G:new Uint8Array(24*17),exitPos:{x:22,y:8}};
  for(let y=1;y<16;y++)for(let x=1;x<23;x++)m.G[y*24+x]=1;
  const densities=[.3,.6,1],counts=[];
  for(let col=0;col<3;col++){
    const x0=col*480+20,y0=72,s=18;let count=0;
    pc.fillStyle='#10151e';pc.fillRect(col*480,0,480,450);
    for(let y=0;y<17;y++)for(let x=0;x<24;x++){
      pc.fillStyle=m.G[y*24+x]?'#383e49':'#222735';pc.fillRect(x0+x*s,y0+y*s,s-1,s-1);
      for(const p of Style.mossPatches(m,x,y,37,densities[col])){count++;pc.fillStyle='#7c9a65';pc.beginPath();pc.arc(x0+p.x*s,y0+p.y*s,p.r*s,0,Math.PI*2);pc.fill();}
    }
    pc.fillStyle='#bd91f4';pc.beginPath();pc.arc(x0+22*s,y0+8*s,1.15*s,0,Math.PI*2);pc.strokeStyle='#bd91f4';pc.stroke();
    pc.fillStyle='#e1ded5';pc.font='bold 22px "Microsoft YaHei"';pc.fillText(['低密度','中密度','高密度'][col]+' · '+count+' 簇',col*480+22,38);
    counts.push(count);
  }
  fs.writeFileSync(path.join(out,'moss-distribution.png'),plan.toBuffer('image/png'));
  fs.writeFileSync(path.join(out,'canvas-proof.json'),JSON.stringify({renderer:'Actual production Canvas rigs; distribution diagram is a placement plan, not a GPU render.',densityCounts:counts,skins:chars,weapons},null,2));
  console.log('Scene/character Canvas proof: '+out);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
