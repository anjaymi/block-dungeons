// Bridge between journey state, room combat and the existing canvas scene.
let journey=null;
const journeyRigCache=new Map();
function initJourney(){
  journey=DungeonJourney.create(dungeonMap,theme.name,floorN);
  dungeonMap.fixtures=journey.fixtures;
  const portal=journey.fixtures.find(f=>f.kind==='portal');exitPos={x:portal.x,y:portal.y};
  // Fixtures are walk-through landmarks; keep fragile crates off their plinths.
  crates=crates.filter(c=>!journey.fixtures.some(f=>dist(c,f)<1.6));
  journeyRigCache.clear();
}
function journeyTarget(){return DungeonJourney.target(journey,player,rooms,los);}
function journeyClear(r){
  if(!journey)return;
  DungeonJourney.clear(journey,r);
  exitOpen=journey.exitCleared&&journey.seals>=journey.needed;
  if(r.type==='exit'||r.type==='boss')showBanner(exitOpen?'封印解除！传送门已开启':`守卫已击败 · 还需点亮 ${journey.needed-journey.seals} 枚符印`);
  if(r.type==='shrine')showBanner('祭坛挑战完成 · 额外宝箱已出现');
}
function journeyInteract(){
  const f=journeyTarget();if(!f)return false;
  if(f.kind==='portal'){
    if(f.phase==='open'){state='upgrade';upgradeChoices=rollUpgrades();return true;}
    addText(f.x,f.y,1.7,DungeonJourney.prompt(journey,f),journey.style.accent,1);return true;
  }
  if(!grounded()||!CombatRules.canSwap(player))return true;
  if(f.kind==='waystone'&&(lockedRoom()||player.hp>=player.maxhp&&player.potCD<=0&&player.arrows>=20)){
    addText(f.x,f.y,1.5,lockedRoom()?'战斗中无法休整':'补给充足 · 可在需要时返回',journey.style.accent,.8);return true;
  }
  const result=DungeonJourney.activate(journey,f);
  if(result==='seal'){
    player.souls+=3;exitOpen=journey.exitCleared&&journey.seals>=journey.needed;
    showBanner(exitOpen?'符印齐备！出口封印已解除':`${journey.style.name}已点亮 · ${journey.seals}/${journey.needed}`);
  }else if(result==='rest'){
    player.hp=player.maxhp;player.potCD=0;player.arrows=Math.max(player.arrows,20);player.healT=1.2;
    showBanner('旅途石 · 生命、药水与箭矢已补充');
  }else if(result==='trial'){
    const r=rooms[f.room];r.active=true;r.cleared=false;r.wavesLeft=2;
    setGates(r,true);spawnWave(r);showBanner(`${journey.style.trial} · 击败两波守卫`);
  }else{
    if(f.kind==='shrine'&&f.phase==='complete')return false;
    if(f.phase==='lit'||f.phase==='spent')return false;
    addText(f.x,f.y,1.6,DungeonJourney.prompt(journey,f),journey.style.accent,.8);return true;
  }
  miniCache=null;
  rings.push({x:f.x,y:f.y,r:1.7,t:0,col:journey.style.rgb});
  for(let k=0;k<16;k++){const a=k/16*Math.PI*2;addPart(f.x,f.y,.5,Math.cos(a)*2,Math.sin(a)*2,2,journey.style.accent,.6,3,true);}
  return true;
}
function journeyLabel(){const f=journeyTarget();return f?DungeonJourney.prompt(journey,f):'交互';}
function journeyActionLabel(){
  const f=journeyTarget();if(!f)return '交互';
  if(f.kind==='beacon')return f.phase==='ready'?'点亮':f.phase==='lit'?'已点亮':'符印';
  if(f.kind==='shrine')return f.phase==='dormant'?'挑战':f.phase==='active'?'战斗中':'奖励';
  if(f.kind==='portal')return f.phase==='open'?'进入':'封印';
  return f.phase==='spent'?'已休整':'休整';
}
function stepJourney(dt){
  if(state!=='play'||!journey||journey.trial!=='active')return;
  const f=journey.fixtures.find(f=>f.kind==='shrine'),pulse=journey.pulse;
  if(!f||!pulse)return;
  // Consume leftover frame time at each transition; a slow frame cannot skip the hit.
  for(let n=0;dt>0&&n<16;n++){
    const take=Math.min(dt,pulse.t);pulse.t-=take;dt-=take;
    if(pulse.t>1e-9)break;
    if(pulse.phase==='waiting'){pulse.phase='charge';pulse.t=1.2;}
    else if(pulse.phase==='charge'){
      pulse.phase='burst';pulse.t=.38;
      if(roomId[idx(Math.floor(player.x),Math.floor(player.y))]===f.room&&dist(player,f)<pulse.r&&player.z<.42&&los(f,player)){
        const kind=theme.name==='冰封洞窟'?'cold':theme.name==='下界要塞'?'fire':'phys';
        hurtPlayer(4+floorN*.7,null,Math.atan2(player.y-f.y,player.x-f.x),kind);
      }
      rings.push({x:f.x,y:f.y,r:pulse.r,t:0,col:journey.style.rgb});
      for(let k=0;k<12;k++){const a=k*Math.PI/6;addPart(f.x+Math.cos(a)*pulse.r,f.y+Math.sin(a)*pulse.r,.04,0,0,1.2,journey.style.accent,.35,3,true);}
    }else{pulse.phase='waiting';pulse.t=4;}
    if(state!=='play')break;
  }
}
function journeyLines(){
  if(!journey)return [];
  const j=journey;return [
    `主线：点亮符印 ${j.seals} / ${j.needed} · ${j.exitCleared?'出口守卫已击败':'出口守卫尚未击败'}`,
    ...j.fixtures.filter(f=>f.kind==='beacon').map(f=>`${j.style.name} · 房间 ${f.room+1} · ${f.phase==='lit'?'已点亮':f.phase==='ready'?'等待点亮':'击败守卫后解锁'}`),
    `支线：${j.style.trial} · ${j.trial==='complete'?'已完成':j.trial==='active'?'挑战中':'可选，两波守卫奖励额外宝箱'}`,
    '祭坛蓄能后释放地面脉冲：离开光圈、跳跃或翻滚躲避。',
    '跳跃后攻击可下砸；打开地图可返回已探索的房间。'
  ];
}
function journeyRig(f){
  const key=f.kind+'/'+f.phase;let rig=journeyRigCache.get(key);if(rig)return rig;
  const S=journey.style,R=mat(0,0,0),out=[];
  const box=(x,y,z,w,d,h,col)=>out.push(BX(R,[x,y,z],[w,d,h],col));
  box(0,0,.8,f.kind==='portal'?38:22,f.kind==='portal'?25:22,1.6,S.dark);
  box(0,0,2,f.kind==='portal'?35:19,f.kind==='portal'?22:19,1.2,S.stone);
  if(f.kind==='portal'){
    for(const side of [-1,1]){
      box(side*27,2,5,11,12,6,S.dark);box(side*27,2,34,8,9,54,S.stone);
      box(side*27,2,63,11,12,4,'#b5a58d');box(side*27,-3,34,1.2,.8,35,f.phase==='open'?S.accent:'#705c70');
    }
    box(0,2,68,65,12,5,S.dark);box(0,-4.2,68,62,.7,1,'#bdac8e');
    box(0,2,73,11,11,6,S.stone);box(0,-4,73,5,1,4,f.phase==='open'?S.accent:'#786477');
  }else if(f.kind==='shrine'){
    box(0,0,5,14,14,5,S.dark);box(0,0,9,18,18,3,S.stone);
    for(const x of [-7,7])for(const y of [-7,7])box(x,y,13,3,3,6,S.dark);
    box(0,0,12,10,10,2,f.phase==='dormant'?'#b795bf':S.accent);
    box(0,0,16,6,6,5,f.phase==='active'?'#ff866f':S.accent);
    for(const side of [-1,1]){box(side*19,5,3,8,9,5,S.dark);box(side*19,5,17,5,6,24,S.stone);box(side*19,5,30,7,8,3,S.dark);box(side*19,1.8,18,1,.7,13,S.accent);}
  }else{
    box(0,0,4,13,13,3,S.dark);box(0,0,12,8,8,14,S.stone);
    box(0,-4.2,12,3,.7,8,f.phase==='lit'||f.kind==='waystone'?S.accent:'#95819b');
    box(0,0,20,11,11,3,S.dark);box(0,0,24,6,6,5,S.stone);
  }
  // Each region uses its own material language around the shared objective shape.
  if(f.kind!=='portal'){
    if(theme.name==='幽深矿井')for(const x of [-10,10]){box(x,3,13,2,3,22,'#835c3c');box(x,-2,7,3,1,1,'#c09661');}
    if(theme.name==='冰封洞窟')for(const [x,y,z] of [[-10,3,9],[10,5,12],[-7,-6,6]]){box(x,y,z,3,3,z,S.accent);box(x,y,z*1.5,1.5,1.5,z*.6,'#e2f9ff');}
    if(theme.name==='下界要塞')for(const x of [-5,5])box(x,-5,6,1,.8,6,'#ff9557');
    if(theme.name==='沙海遗迹'){box(0,-5,12,7,.8,1,'#e6c272');box(0,-5,12,1,.8,7,'#e6c272');}
    if(theme.name==='苔石地牢')for(const [x,y] of [[-7,6],[6,7],[-9,-3]])box(x,y,3.3,5,4,1.4,'#617c53');
  }
  journeyRigCache.set(key,out);return out;
}
function journeyDrawGround(){
  if(!journey)return;
  for(const f of journey.fixtures){
    const r=rooms[f.room];if(!r.visited||dist(f,player)>22)continue;
    const active=['lit','open','active','complete'].includes(f.phase);
    const radius=f.kind==='portal'?1.4:1.05;
    groundCircle(f.x,f.y,radius,`rgba(${journey.style.rgb},${active?.1:.025})`,`rgba(${journey.style.rgb},${active?.6:.2})`);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,x=f.x+Math.cos(a)*radius,y=f.y+Math.sin(a)*radius,s=P(x,y,.025);
      ctx.save();ctx.translate(s[0],s[1]);ctx.rotate(Math.PI/4);ctx.fillStyle=active?journey.style.accent:'#847685';ctx.globalAlpha=active?.75:.35;ctx.fillRect(-2,-2,4,4);ctx.restore();
    }
  }
  const pulse=journey.pulse,f=journey.fixtures.find(f=>f.kind==='shrine');
  if(pulse&&f&&pulse.phase!=='waiting'&&rooms[f.room].visited){
    const u=pulse.phase==='charge'?1-pulse.t/1.2:1;
    groundCircle(f.x,f.y,pulse.r,`rgba(${journey.style.rgb},${.07+u*.12})`,`rgba(${journey.style.rgb},.85)`);
    groundCircle(f.x,f.y,pulse.r*u,'rgba(0,0,0,0)',`rgba(${journey.style.rgb},.6)`);
  }
}
function journeyDrawLandmarks(list,actorLight){
  if(!journey)return;
  for(const f of journey.fixtures){
    if(!rooms[f.room].visited||dist(f,player)>22)continue;
    list.push({k:f.y+groundHeight(f.x,f.y)*VZ,f:()=>{
      shadow(f,f.kind==='portal'?1:.6);
      drawSoftRig(f,journeyRig(f),PX,0,null,actorLight(f));
      if(f.phase==='open'){
        const t=stats.time,pulse=.65+Math.sin(t*2)*.12;
        ctx.save();ctx.globalCompositeOperation='lighter';
        for(let n=0;n<3;n++){
          const pts=[],rx=.72-n*.13,rz=.98-n*.12;
          for(let a=0;a<Math.PI*2;a+=.16)pts.push(P(f.x+Math.cos(a)*rx,f.y+.02,1.17+Math.sin(a)*rz));
          poly(pts,`rgba(${journey.style.rgb},${pulse*(.1+n*.09)})`,journey.style.accent,1);
        }
        ctx.restore();
      }
      if(f.phase==='ready'||f.phase==='lit'||f.kind==='shrine'){
        const s=P(f.x,f.y,1.45),t=stats.time,alpha=.5+Math.sin(t*3)*.15;
        ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=journey.style.accent;ctx.translate(s[0],s[1]+Math.sin(t*2)*3);ctx.rotate(Math.PI/4);ctx.fillRect(-5,-5,10,10);ctx.restore();
      }
    }});
  }
}
function journeyDrawHint(){
  const warning=journey?.pulse?.phase==='charge'&&curRoom?.type==='shrine',f=warning?journey.fixtures.find(f=>f.kind==='shrine'):journeyTarget();if(!f||state!=='play')return;
  const s=P(f.x,f.y,f.kind==='portal'?2.9:1.7),font=touchUIEnabled()?10:11;
  const text=warning?'祭坛蓄能 · 跳跃 / 翻滚 / 离开光圈':(touchUIEnabled()?'交互 · ':'[F] ')+DungeonJourney.prompt(journey,f);
  ctx.save();ctx.font=`600 ${font}px Microsoft YaHei,sans-serif`;
  const width=Math.min(VW-12,ctx.measureText(text).width+16),x=clamp(s[0],width/2+6,VW-width/2-6),y=clamp(s[1],24,VH-32);
  ctx.fillStyle='rgba(9,13,20,.84)';ctx.fillRect(x-width/2,y-10,width,20);
  ctx.strokeStyle=journey.style.accent;ctx.lineWidth=.6;ctx.strokeRect(x-width/2,y-10,width,20);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e8f8f2';ctx.fillText(text,x,y,width-12);ctx.restore();
}
