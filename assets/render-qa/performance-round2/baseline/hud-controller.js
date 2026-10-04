// Runtime bridge: all displayed values and button actions come from the live game.
let hudMode=new URLSearchParams(location.search).get('hud')||'auto';
if(!['auto','pc','mobile'].includes(hudMode))hudMode='auto';
let hudModal=null,hudMouseAction=null;
let hudSafe={left:0,right:0,top:0,bottom:0};
function refreshHUDSafe(){
  if(typeof getComputedStyle!=='function')return;
  const css=getComputedStyle(document.documentElement);
  for(const side of ['left','right','top','bottom'])hudSafe[side]=parseFloat(css.getPropertyValue('--safe-'+side))||0;
}
addEventListener('resize',refreshHUDSafe);refreshHUDSafe();
function hudLayout(){return HUDLayout.layout(cv.width,cv.height,touchUIEnabled(),hudSafe);}
function hudPoint(x,y){return HUDLayout.point(hudLayout(),x,y);}
function releaseHUDInput(){
  UIMotion.releaseAll();
  mouse.l=mouse.r=false;player.buf=null;
  for(const k in keys)keys[k]=false;
  for(const k of ['moveId','aimId','attackId','bowId','rollId','skillId','potionId','runId','spellId'])touch[k]=null;
  touch.moveX=touch.moveY=0;touch.moveOrigin=touch.aimOrigin=null;touch.run=false;touch.aimPower=0;hudMouseAction=null;
  if(weaponGameplay)weaponGameplay.cancelInput();
}
function openHUDModal(kind){
  releaseHUDInput();hudModal={kind,previous:state};state='pause';
}
function closeHUDModal(){
  const previous=hudModal?.previous;hudModal=null;releaseHUDInput();state=previous==='pause'?'pause':'play';
}
function hudModalData(){
  if(!hudModal)return null;
  if(hudModal.kind==='quest'){
    const total=rooms.filter(r=>r.type!=='start').length,cleared=rooms.filter(r=>r.type!=='start'&&r.cleared).length;
    const lines=[`第 ${floorN} 层 · ${theme.name}`,exitOpen?'入口已开启，靠近后交互进入下一层':'探索地牢，清理房间，找到下一层入口',`已清理房间 ${cleared} / ${total} · 击败敌人 ${stats.kills}`,`冒险时间 ${Math.floor(stats.time/60)} 分 ${Math.floor(stats.time%60)} 秒`];
    lines.splice(1,1,...journeyLines());
    for(const id of Object.keys(RESONANCE)){const R=RESONANCE[id];lines.push(`${R.n} · ${resonanceEnabled(id)?'已激活':resonanceProgress(id)+'/2'} · ${R.d}`);}
    return {kind:'quest',title:'地牢任务',lines};
  }
  if(hudModal.kind==='more')return {kind:'more',title:'战斗快捷操作',items:['bow','spell','art0','art1','art2','swap','jump','skill','potion'].map(action=>({...hudActionData(action),action}))};
  return {kind:'settings',title:'设置与菜单',items:[
    {action:'fullscreen',icon:'compass',label:document.fullscreenElement?'退出全屏':'全屏游戏'},
    {action:'mute',icon:'settings',label:window.SFX?.muted?'开启声音':'静音'},
    {action:'quiet',icon:'settings',label:'音量 −'},
    {action:'loud',icon:'settings',label:'音量 ＋'},
    {action:'hudpc',icon:'attack',label:'PC 布局'},
    {action:'hudmobile',icon:'roll',label:'手机布局'},
    {action:'hudauto',icon:'compass',label:'自动布局'},
    {action:'return',icon:'interact',label:'继续冒险'}
  ]};
}
function hudActionData(action){
  const p=player,CI=CLASS_INFO[p.cls],SP=SPELLS[p.spell],base={icon:action,label:action,cd:0,full:1,disabled:false};
  if(action==='skill')return {...base,icon:'skill',label:'技能',cd:Math.max(0,p.clsCD),full:CI.sk.cd,cost:CI.sk.mana||CI.sk.sta||0,disabled:!!((CI.sk.mana&&p.mana<CI.sk.mana)||(CI.sk.sta&&p.sta<CI.sk.sta))};
  if(action==='spell')return {...base,icon:touchUIEnabled()?'spell':p.spell,label:'法术',cd:Math.max(0,p.spellCD),full:SP.cd,cost:SP.cost,disabled:p.mana<SP.cost};
  if(action==='potion')return {...base,icon:touchUIEnabled()?'potion':'potionGreen',label:'药水',cd:Math.max(0,p.potCD),full:18*(1-.3*L('potion')),disabled:p.hp>=p.maxhp};
  if(action==='roll')return {...base,label:'翻滚',cd:Math.max(0,p.rollCD),full:1.05*(1-.3*L('dodge')),disabled:p.sta<STA_ROLL*.5};
  if(/^art[0-2]$/.test(action)){const i=+action.at(-1),A=ARTS[i];return {...base,label:A.n,cd:Math.max(0,p.artCD[i]),full:A.cd*(1-.25*L('artcd')),cost:A.cost||0,disabled:!!A.cost&&p.souls<A.cost};}
  if(action==='interact')return {...base,label:journeyActionLabel()};
  return {...base,label:({attack:'普通攻击',jump:'跳跃',bow:'弓箭',swap:'换组',interact:'交互',bag:'背包',quest:'任务',settings:'设置',more:'更多'})[action]||action};
}
function hudAction(action,down=true){
  if(!down){if(action==='attack')mouse.l=false;if(action==='bow')mouse.r=false;if(action==='roll')touch.run=false;return;}
  if(state!=='play')return;
  UIMotion.pulse('hud:'+action);
  if(['quest','settings','more'].includes(action)){openHUDModal(action);return;}
  if(action==='bag'){requestBag();return;}
  if(action==='map'){releaseHUDInput();state='map';return;}
  if(action==='attack'||action==='bow'){touchAction(action,true);return;}
  if(action==='roll'){touch.run=true;touchAction('roll',true);return;}
  if(action==='skill'){useClassSkill();return;}
  if(action==='potion'){usePotion();return;}
  if(action==='interact'){interact();return;}
  if(action==='spell'){player.buf={type:'cast',t:BUF};return;}
  if(action==='jump'){player.buf={type:'jump',t:BUF};return;}
  if(action==='swap'){swapWeapons();return;}
  if(/^art[0-2]$/.test(action))useArtifact(+action.at(-1));
}
function hudModalClick(x,y){
  const layout=hudLayout(),point=HUDLayout.point(layout,x,y);
  if(HUDLayout.contains(layout.close,point.x,point.y)){closeHUDModal();return;}
  const M=hudModalData();
  for(let i=0;i<(M.items||[]).length;i++){
    if(!HUDLayout.contains(layout.modalButtons[i],point.x,point.y))continue;
    const action=M.items[i].action;
    if(M.kind==='more'){closeHUDModal();hudAction(action);if(['bow','attack','roll'].includes(action))hudMouseAction=action;return;}
    if(action==='return')closeHUDModal();
    else if(action==='mute')window.SFX?.toggle();
    else if(action==='quiet')window.SFX?.setVol(SFX.vol-.1);
    else if(action==='loud')window.SFX?.setVol(SFX.vol+.1);
    else if(action==='fullscreen'){
      const p=document.fullscreenElement?document.exitFullscreen?.():cv.requestFullscreen?.();
      if(p&&p.catch)p.catch(()=>{});
    }else if(action.startsWith('hud')){hudMode={hudpc:'pc',hudmobile:'mobile',hudauto:'auto'}[action];releaseHUDInput();}
    return;
  }
}
function hudPointerDown(e){
  if(hudModal){hudModalClick(e.clientX,e.clientY);return true;}
  if(state!=='play'||e.button!==0)return false;
  const point=hudPoint(e.clientX,e.clientY),action=HUDLayout.hit(hudLayout(),point.x,point.y);
  if(!action)return false;
  hudAction(action);if(['attack','bow','roll'].includes(action))hudMouseAction=action;
  return true;
}
function hudDraw(){
  const layout=hudLayout(),p=player,CI=CLASS_INFO[p.cls],actions={};
  for(const key of ['attack','roll','skill','potion','spell','interact','more','bag','quest','settings','bow','swap','jump','art0','art1','art2'])actions[key]=hudActionData(key);
  const keycodes={skill:['KeyQ'],potion:['KeyE'],spell:['KeyR'],roll:['ShiftLeft','ShiftRight','KeyC'],jump:['Space'],interact:['KeyF'],swap:['KeyX'],art0:['Digit1'],art1:['Digit2'],art2:['Digit3']};
  const pressed=k=>hudMouseAction===k||touch[k+'Id']!=null||(k==='attack'&&mouse.l)||(k==='bow'&&mouse.r)||(keycodes[k]||[]).some(code=>keys[code]);
  for(const k of Object.keys(actions))UIMotion.sync('hud:'+k,state==='play'&&pressed(k));
  const buffKeys=Object.keys(p.ench||{}).filter(k=>p.ench[k]>0&&ENCH[k]);
  const buffs=buffKeys.map(k=>({name:ENCH[k].n,level:p.ench[k],icon:/health|leech|potion/.test(k)?'heal':/dodge|guard|shield/.test(k)?'shield':/swift/.test(k)?'boot':/fire|sharp|crit|power/.test(k)?'attack':'star'}));
  const point=hudPoint(mouse.x,mouse.y),idx=layout.buffs.findIndex(b=>HUDLayout.contains(b,point.x,point.y));
  const lr=lockedRoom(),remaining=lr?mobs.filter(m=>m.hp>0&&m.room===lr.id).length:0;
  FantasyHUD.draw(ctx,layout,{
    p,actions,buffs,floor:floorN,theme:theme.name,className:CI.n,classColor:CI.col,kills:stats.kills,
    combo:p.comboKeep>0||p.st==='atk'?p.combo+1:0,xpNeed:xpNeed(p.lvl),
    boss:bossRef&&bossRef.hp>0&&bossRef.awake?{hp:bossRef.hp,maxhp:bossRef.maxhp,name:bossRef.voxName||'深渊徘徊者',enraged:bossRef.enraged}:null,
    objective:DungeonJourney.objective(journey,curRoom),
    mapCols:GCOLS,mapRows:GROWS,map:(x,y,cw,ch)=>drawRoomMap(x,y,cw,ch,false),portrait:drawPortrait,
    touch,pressed,feedback:k=>UIMotion.amount('hud:'+k),modal:hudModalData(),
    banner:banner.t>0?banner:null,locked:lr?`房间封锁 · 剩余敌人 ${remaining}${lr.wavesLeft>0?' · '+lr.wavesLeft+' 波':''}`:null,
    swapPending:p.swapPending,buffTip:idx>=0&&buffs[idx]?`${buffs[idx].name} · ${buffs[idx].level} 级`:null
  });
}
addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='block-dungeons-hud')return;
  if(!['auto','pc','mobile'].includes(e.data.mode))return;
  hudMode=e.data.mode;releaseHUDInput();
});
