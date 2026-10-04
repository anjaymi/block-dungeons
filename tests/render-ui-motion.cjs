// Native Canvas captures of the production animation; no browser/device claims.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {prepare,Canvas,sharp,root,out}=require('./render-inventory.cjs');
async function gif(target,frames,w,h,delay=40){
  const pixels=Buffer.concat(frames.map(c=>Buffer.from(c.getContext('2d').getImageData(0,0,w,h).data)));
  await sharp(pixels,{raw:{width:w,height:h*frames.length,channels:4,pageHeight:h}}).gif({loop:0,delay:Array(frames.length).fill(delay),effort:3,dither:.5}).toFile(target);
  // GIF encoding merges identical frames; verify playback duration instead.
  const meta=await sharp(target,{animated:true}).metadata();assert.ok(meta.pages>1);assert.equal(meta.delay.reduce((a,b)=>a+b,0),frames.length*delay);return meta;
}
async function capture(name,w,h,mobile){
  const {canvas,g}=await prepare(w,h,mobile);
  vm.runInContext(fs.readFileSync(path.join(root,'fantasy-hud.js'),'utf8'),g.context,{filename:'fantasy-hud.js'});
  for(let i=0;i<100&&!g.run('FantasyHUD.ready()');i++)await new Promise(r=>setTimeout(r,20));
  assert.equal(g.run('FantasyHUD.ready()'),true);
  let time=1000;g.context.performance.now=()=>time;
  const ctx=canvas.getContext('2d'),world=Canvas.createCanvas(w,h),play=Canvas.createCanvas(w,h);
  g.run('withZoom(render);');world.getContext('2d').drawImage(canvas,0,0);g.run('drawHUD();');play.getContext('2d').drawImage(canvas,0,0);
  const key=()=>g.events.keydown[0]({code:'KeyI',repeat:false,preventDefault(){}});
  const frames=[],samples=[],strip=[];let button,point;
  for(let ms=0;ms<=1720;ms+=40){
    time=1000+ms;
    if(ms===120)key();
    if(ms===520){
      button=JSON.parse(g.run("JSON.stringify(inventoryLayout().bagActions.find(b=>b.kind==='sort'))"));point={x:button.x+button.w/2,y:button.y+button.h/2};
      if(mobile)g.events.touchstart[0]({type:'touchstart',preventDefault(){},changedTouches:[{identifier:7,clientX:point.x,clientY:point.y}]});
      else g.events.mousedown[0]({button:0,clientX:point.x,clientY:point.y});
    }
    if(ms===720){
      if(mobile)g.events.touchend[0]({type:'touchend',preventDefault(){},changedTouches:[{identifier:7,clientX:point.x,clientY:point.y}]});
      else g.events.mouseup[0]({button:0,clientX:point.x,clientY:point.y});
    }
    if([1000,1080,1200].includes(ms))key();
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.drawImage(g.run('state')==='bag'?world:play,0,0);
    g.run('if(state==="bag")drawBag();else inventoryDrawExit();');
    const frame=Canvas.createCanvas(w,h+30),fc=frame.getContext('2d');fc.drawImage(canvas,0,0);fc.fillStyle='#17151e';fc.fillRect(0,h,w,30);fc.fillStyle='#eee4ca';fc.font='bold 14px "Microsoft YaHei"';fc.textBaseline='middle';
    const label=ms<120?'冒险画面':ms<360?(mobile?'打开背包':'I · 打开背包'):ms<520?'展开完成':ms<720?'按住「整理」':ms<960?'松开 · 回弹':ms<1080?(mobile?'关闭背包':'I · 收起背包'):ms<1360?'快速开关 · 从当前画面折返':'继续冒险';
    fc.fillText(label,14,h+15);frames.push(frame);
    samples.push({ms,state:g.run('state'),opacity:g.run("UIMotion.value('inventory')"),press:button?g.run(`UIMotion.amount(UIMotion.inventoryKey(${JSON.stringify(button)}))`):0});
    if([160,360,600,800,1040,1160].includes(ms))strip.push(frame);
    if(ms===440||ms===600){
      const b=button||JSON.parse(g.run("JSON.stringify(inventoryLayout().bagActions.find(b=>b.kind==='sort'))"));
      const crop=Canvas.createCanvas(Math.ceil(b.w+16),Math.ceil(b.h+16));crop.getContext('2d').drawImage(canvas,b.x-8,b.y-8,b.w+16,b.h+16,0,0,crop.width,crop.height);
      fs.writeFileSync(path.join(out,name+(ms===440?'-button-rest.png':'-button-down.png')),crop.toBuffer('image/png'));
    }
  }
  assert.ok(samples.find(s=>s.ms===160).opacity>0&&samples.find(s=>s.ms===160).opacity<1);
  assert.equal(samples.find(s=>s.ms===600).press,1);assert.equal(samples.find(s=>s.ms===960).press,0);assert.equal(samples.at(-1).state,'play');assert.equal(samples.at(-1).opacity,0);
  assert.notDeepEqual(fs.readFileSync(path.join(out,name+'-button-rest.png')),fs.readFileSync(path.join(out,name+'-button-down.png')));
  const target=path.join(out,name+'.gif'),meta=await gif(target,frames,w,h+30);
  const contact=Canvas.createCanvas(w*3/2,(h+30));strip.forEach((f,i)=>contact.getContext('2d').drawImage(f,(i%3)*w/2,Math.floor(i/3)*(h+30)/2,w/2,(h+30)/2));
  fs.writeFileSync(path.join(out,name+'-frames.png'),contact.toBuffer('image/png'));
  return {path:target,width:w,height:h,frames:meta.pages,samples};
}
async function main(){
  const captures=[];captures.push(await capture('mobile-motion',844,390,true));captures.push(await capture('pc-motion',1280,760,false));
  fs.writeFileSync(path.join(out,'motion-captures.json'),JSON.stringify({renderer:'Actual game Canvas inventory + HUD and production PNGs; native Skia frame sequence. Frozen 2D world fixture. Not an Edge or real-device recording.',frameDuration:40,captures},null,2));
  console.log(JSON.stringify(captures.map(({path,width,height,frames})=>({path,width,height,frames})),null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
