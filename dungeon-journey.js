// Floor objectives and optional encounters. No renderer or game globals here.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DungeonJourney=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const styles={
    '苔石地牢':{accent:'#74ead0',rgb:'116,234,208',stone:'#778b88',dark:'#344b4a',name:'林地符印',trial:'荆棘祭坛'},
    '幽深矿井':{accent:'#ffc179',rgb:'255,193,121',stone:'#7b7771',dark:'#3b414a',name:'矿脉符印',trial:'矿心祭坛'},
    '冰封洞窟':{accent:'#9edfff',rgb:'158,223,255',stone:'#abc8dc',dark:'#566b86',name:'霜晶符印',trial:'寒霜祭坛'},
    '下界要塞':{accent:'#ff956c',rgb:'255,149,108',stone:'#816578',dark:'#3e2d47',name:'余烬符印',trial:'余烬祭坛'},
    '沙海遗迹':{accent:'#ffe293',rgb:'255,226,147',stone:'#c1a47b',dark:'#77614b',name:'日轮符印',trial:'日轮祭坛'}
  };
  function position(map,r,kind){
    const width=kind==='portal'||kind==='shrine'?1:0;
    const walk=(x,y)=>x>=0&&y>=0&&x<map.GW&&y<map.GH&&map.G[y*map.GW+x]===1;
    // The broad arch needs three clear tiles. Other props sit away from landings.
    const candidates=r.tiles.filter(([x,y])=>{
      for(let dy=-1;dy<=1;dy++)for(let dx=-width;dx<=width;dx++)if(!walk(x+dx,y+dy))return false;
      return !r.gates.some(([a,b])=>Math.hypot(x-a,y-b)<2.6);
    });
    const target={x:r.cx,y:r.cy-(kind==='portal'?0:2)};
    const tiles=candidates.length?candidates:r.tiles;
    const tile=tiles.slice().sort((a,b)=>Math.hypot(a[0]-target.x,a[1]-target.y)-Math.hypot(b[0]-target.x,b[1]-target.y)||a[1]-b[1]||a[0]-b[0])[0];
    return {x:tile[0]+.5,y:tile[1]+.5};
  }
  function create(map,theme,floor){
    const style=styles[theme]||styles['苔石地牢'];
    const combat=map.rooms.filter(r=>r.type==='combat'||r.type==='elite');
    const chosen=combat.length>1?[combat[0],combat[combat.length-1]]:combat;
    const fixtures=[];
    const add=(r,kind)=>{const f={id:fixtures.length,room:r.id,kind,phase:'dormant',...position(map,r,kind)};fixtures.push(f);return f;};
    add(map.rooms[0],'waystone');
    for(const r of chosen)add(r,'beacon');
    const trial=map.rooms.find(r=>r.type==='shrine');if(trial)add(trial,'shrine');
    add(map.rooms.find(r=>r.type==='exit'||r.type==='boss'),'portal');
    const journey={floor,style,fixtures,needed:chosen.length,seals:0,exitCleared:false,trial:'unstarted',pulse:null};
    sync(journey);return journey;
  }
  function clear(j,room){
    for(const f of j.fixtures)if(f.room===room.id&&f.kind==='beacon'&&f.phase==='dormant')f.phase='ready';
    if(room.type==='exit'||room.type==='boss')j.exitCleared=true;
    if(room.type==='shrine'&&j.trial==='active'){
      j.trial='complete';j.pulse=null;const f=j.fixtures.find(f=>f.kind==='shrine');f.phase='complete';
    }
    sync(j);
  }
  function sync(j){const f=j.fixtures.find(f=>f.kind==='portal');if(f)f.phase=j.exitCleared&&j.seals>=j.needed?'open':'sealed';}
  function activate(j,f){
    if(!j.fixtures.includes(f))return null;
    if(f.kind==='beacon'&&f.phase==='ready'){f.phase='lit';j.seals++;sync(j);return 'seal';}
    if(f.kind==='shrine'&&f.phase==='dormant'&&j.trial==='unstarted'){f.phase='active';j.trial='active';j.pulse={phase:'waiting',t:3.2,r:3.6};return 'trial';}
    if(f.kind==='waystone'&&f.phase==='dormant'){f.phase='spent';return 'rest';}
    return null;
  }
  function target(j,p,rooms,visible){
    if(!j)return null;
    return j.fixtures.filter(f=>rooms[f.room]?.visited&&Math.hypot(p.x-f.x,p.y-f.y)<1.75&&(!visible||visible(p,f)))
      .sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0]||null;
  }
  function prompt(j,f){
    if(!f)return '';
    if(f.kind==='beacon')return f.phase==='lit'?'符印已点亮':f.phase==='ready'?'点亮'+j.style.name:'击败守卫解锁符印';
    if(f.kind==='shrine')return f.phase==='dormant'?'开启祭坛挑战 · 两波守卫':f.phase==='active'?'击败祭坛守卫':'挑战完成 · 击打宝箱取奖励';
    if(f.kind==='waystone')return f.phase==='spent'?'旅途石已使用':'旅途石 · 恢复生命与补给';
    return f.phase==='open'?'进入下一层':j.seals<j.needed?`出口封印 · 符印 ${j.seals}/${j.needed}`:'击败出口守卫';
  }
  function objective(j,room){
    if(!j)return '探索地牢，找到下一层的入口';
    if(j.trial==='active')return j.pulse?.phase==='charge'?'祭坛蓄能 · 跳跃或翻滚躲避':'祭坛挑战 · 击败两波守卫';
    const ready=j.fixtures.find(f=>f.kind==='beacon'&&f.room===room?.id&&f.phase==='ready');
    if(ready)return `点亮房间符印 · ${j.seals}/${j.needed}`;
    if(j.seals<j.needed)return `寻找并点亮符印 · ${j.seals}/${j.needed}`;
    return j.exitCleared?'封印解除 · 前往下一层':'符印已齐 · 击败出口守卫';
  }
  return {create,position,clear,activate,sync,target,prompt,objective,styles};
});
