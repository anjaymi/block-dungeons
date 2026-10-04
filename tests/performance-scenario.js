// Browser-only, repeatable stress workload. Never loaded by the normal game.
(function(){
  'use strict';
  const percentile=(values,p)=>values.slice().sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
  const summary=values=>({median:percentile(values,.5),p95:percentile(values,.95),mean:values.reduce((a,b)=>a+b,0)/values.length});
  let savedLoop=null;
  async function prepare(count=96,seed=7319){
    if(!savedLoop){savedLoop=loop;loop=()=>{};await new Promise(requestAnimationFrame);}
    let randomSeed=seed;Math.random=()=>((randomSeed=Math.imul(randomSeed,1664525)+1013904223>>>0)/4294967296);
    startGame();hudMode='pc';mouse.l=mouse.r=false;for(const k in keys)delete keys[k];
    for(const r of rooms){r.cleared=true;r.active=false;r.visited=true;}
    const room=rooms.filter(r=>r.type==='combat').sort((a,b)=>b.tiles.length-a.tiles.length)[0];
    player.x=room.cx+.5;player.y=room.cy+.5;player.hp=player.maxhp=100000;player.inv=0;
    cam.x=player.x;cam.y=player.y;cam.kx=cam.ky=0;mouse.wx=player.x;mouse.wy=player.y;
    mobs=[];chests=[];crates=[];items=[];journey=null;bossRef=null;banner.t=0;shake=0;
    const tiles=room.tiles.filter(([x,y])=>isFloor(x-1,y)&&isFloor(x+1,y)&&isFloor(x,y-1)&&isFloor(x,y+1));
    const types=['zombie','skeleton','spider','husk'];
    const voxelTypes=['vm_zombie','vm_skeleton','vm_spider','vm_slime'];
    for(let n=0;n<count;n++){
      const [x,y]=tiles[(n*37)%tiles.length],voxel=n%2===0?voxelTypes[(n/2|0)%4]:null;
      const def=voxel&&VOXMOB[voxel],m=spawnMob(def?def.base:types[n%4],x+.5+Math.random()*.15,y+.5+Math.random()*.15);
      if(def){m.vox=voxel;m.voxStyle=def.style;m.scale=def.sc;m.r=def.r;}
      m.awake=true;m.st='chase';m.hp=m.maxhp=10000;m.dmg=0;m.cd=.4+n*.01;
    }
    flowFrom=-1;state='play';
    withZoom(render);drawHUD();
    return {count:mobs.length,seed,mapSeed:dungeonMap.seed,room:room.id,tiles:room.tiles.length,viewport:[cv.width,cv.height],dpr:devicePixelRatio,renderer:World3D.diag(0,0)};
  }
  async function sample(frames=90,warmup=15){
    const cpu=[],simulation=[],drawing=[],interval=[],viewports=new Set();let previous=0;
    for(let n=-warmup;n<frames;n++){
      const stamp=await new Promise(requestAnimationFrame);
      const t0=performance.now();simStep(STEP);simStep(STEP);const t1=performance.now();
      updateVisual(1/60);withZoom(render);drawHUD();const t2=performance.now();
      if(n>=0){cpu.push(t2-t0);simulation.push(t1-t0);drawing.push(t2-t1);if(previous)interval.push(stamp-previous);}
      previous=stamp;
      viewports.add(cv.width+'x'+cv.height);
    }
    return {frames,alive:mobs.length,viewports:[...viewports],cpuMs:summary(cpu),simulationMs:summary(simulation),drawingMs:summary(drawing),frameIntervalMs:summary(interval),displayFps:1000/summary(interval).median,hp:player.hp,renderer:World3D.diag(0,0)};
  }
  async function profile(frames=12){
    const names=['stepMob','drawNormalFace','drawTexFace','drawBox','mobRig','collideCircle','los'];
    const restore=[],stats={};
    for(const name of names){
      const fn=window[name];stats[name]={ms:0,calls:0};
      window[name]=function(...args){const t=performance.now();try{return fn.apply(this,args);}finally{stats[name].ms+=performance.now()-t;stats[name].calls++;}};
      restore.push(()=>window[name]=fn);
    }
    try{await sample(frames,0);}finally{for(const f of restore)f();}
    for(const v of Object.values(stats)){v.msPerFrame=v.ms/frames;v.callsPerFrame=v.calls/frames;}
    return stats;
  }
  window.GamePerformance={prepare,sample,profile};
})();
