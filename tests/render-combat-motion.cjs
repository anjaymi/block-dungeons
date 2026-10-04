// Real production skins, weapons and animation on native Canvas; not a GPU recording.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare,Canvas,sharp,root}=require('./render-inventory.cjs');
Canvas.GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
const out=path.join(root,'assets/render-qa/combat-motion');
const titles={greatsword:'巨剑 · 沉肩蓄力 / 横斩 / 支撑收势',sickles:'双镰 · 左右换手 / 守势衔接 / 旋身',hammer:'战锤 · 后坐蓄力 / 横砸 / 压身重击'};
async function capture(){
  fs.mkdirSync(out,{recursive:true});
  const cell=480,w=cell*3,h=450,{g,canvas}=await prepare(w,h,false),ctx=canvas.getContext('2d');
  assert.ok(g.run('Object.values(MCIMG).every(im=>im.width&&im.complete!==false)'));
  g.run(`const actor=player;const fighters=['greatsword','sickles','hammer'].map((kind,i)=>{
    const p=newPlayer();p.char='akane';p.eq.weapon=newBase('weapon',0,kind);p.eq.weapon.weaponStyle='steel';player=p;recalc();
    p.x=p.y=p.z=0;p.ang=.9;p.walk=0;p.speedFrac=0;p.visualTime=0;p.attackId=0;p.flash=p.inv=0;p.gv=null;
    p.delay=.2;p.captured=false;p.visualRig=playerRig(p);return p;
  });player=actor;
  function animateFighter(p,dt){
    player=p;p.visualTime+=dt;p.delay-=dt;
    if(p.st==='move'&&p.delay<=0){
      p.st='atk';p.ph='wind';p.pt=0;p.attackId++;p.combo=(p.attackId-1)%WEAPONS[p.weapon].combo.length;
      p.atkDef=WEAPONS[p.weapon].combo[p.combo];p.T={w:p.atkDef.w,act:p.atkDef.act,rec:p.atkDef.rec};
    }else if(p.st==='atk'){
      p.pt+=dt;
      if(p.ph==='wind'&&p.pt>=p.T.w){p.pt-=p.T.w;p.ph='act';}
      if(p.ph==='act'&&p.pt>=p.T.act){p.pt-=p.T.act;p.ph='rec';}
      if(p.ph==='rec'&&p.pt>=p.T.rec){p.st='move';p.delay=.045;}
    }
    p.visualRig=playerRig(p);
  }`);
  let clock=0;g.context.performance.now=()=>1000+clock*1000;
  const frames=[],snapshots=new Map(),phases=['wind','act','rec'];
  for(let frame=0;frame<100;frame++){
    for(let step=0;step<4;step++){
      clock+=1/120;
      g.run('for(const p of fighters)animateFighter(p,1/120);');
    }
    ctx.fillStyle='#0e131c';ctx.fillRect(0,0,w,h);
    for(let i=0;i<3;i++){
      const x=i*cell;ctx.fillStyle=i%2?'#171c28':'#141a24';ctx.fillRect(x+6,6,cell-12,438);
      ctx.save();ctx.beginPath();ctx.rect(x+6,6,cell-12,438);ctx.clip();
      ctx.fillStyle='#252936';ctx.beginPath();ctx.ellipse(x+235,370,105,24,0,0,Math.PI*2);ctx.fill();
      g.run(`player=fighters[${i}];ox=${x+227};oy=368;drawSoftRig(player,player.visualRig,PX*2.2,0);`);
      ctx.restore();ctx.textAlign='left';ctx.fillStyle='#efd7a3';ctx.font='bold 16px "Microsoft YaHei"';ctx.fillText(titles[kinds[i]],x+20,33);
      const ph=g.run('player.st==="atk"?player.ph:"idle"');
      ctx.fillStyle='#9ba8bd';ctx.font='14px "Microsoft YaHei"';ctx.fillText({wind:'蓄力',act:'出手',rec:'收势',idle:'衔接'}[ph]+' · 第 '+g.run('(player.combo||0)+1')+' 段',x+20,61);
      const u=g.run('player.st==="atk"?player.pt/(player.ph==="wind"?player.T.w:player.ph==="act"?player.T.act:player.T.rec):0');
      const key=kinds[i]+'-'+ph;
      if(phases.includes(ph)&&u>.48&&!snapshots.has(key)){
        const tile=Canvas.createCanvas(cell,h);tile.getContext('2d').drawImage(canvas,x,0,cell,h,0,0,cell,h);snapshots.set(key,tile);
      }
    }
    const f=Canvas.createCanvas(w,h);f.getContext('2d').drawImage(canvas,0,0);frames.push(f);
  }
  const pixels=Buffer.concat(frames.map(f=>Buffer.from(f.getContext('2d').getImageData(0,0,w,h).data)));
  const target=path.join(out,'three-weapons.gif');
  const delays=frames.map((_,i)=>i%3===2?40:30); // GIF ticks are 10 ms; preserve the 30 Hz timeline.
  await sharp(pixels,{raw:{width:w,height:h*frames.length,channels:4,pageHeight:h}}).gif({loop:0,delay:delays,effort:3,dither:.35}).toFile(target);
  const meta=await sharp(target,{animated:true}).metadata();assert.ok(meta.pages>1);
  assert.equal(meta.delay.reduce((a,b)=>a+b,0),delays.reduce((a,b)=>a+b,0));
  const sheet=Canvas.createCanvas(w,1350);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const key=kinds[i]+'-'+phases[j];assert.ok(snapshots.has(key),key);sheet.getContext('2d').drawImage(snapshots.get(key),i*cell,j*450);
  }
  fs.writeFileSync(path.join(out,'pose-sheet.png'),sheet.toBuffer('image/png'));
  fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({renderer:'Production character rigs, skins, weapons and CombatMotion. Native Skia Canvas, controlled stationary actors, fixed 120 Hz animation sampling. This is not browser/GPU footage or a frame-rate measurement.',frameRate:30,frames:meta.pages,duration:meta.delay.reduce((a,b)=>a+b,0),files:['three-weapons.gif','pose-sheet.png']},null,2));
  console.log('Combat animation captures: '+out);
}
const kinds=['greatsword','sickles','hammer'];
if(require.main===module)capture().catch(e=>{console.error(e);process.exitCode=1;});
