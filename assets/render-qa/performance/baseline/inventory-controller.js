let inventoryState={pane:'bag',bagPage:0,drawer:null,selection:null,press:null,scroll:0};
function inventoryReset(){inventoryState={pane:'bag',bagPage:0,drawer:null,selection:null,press:null,scroll:0};}
function inventoryLayout(){return InventoryLayout.layout(cv.width,cv.height,touchUIEnabled(),hudSafe,inventoryState);}
function inventoryLocate(it){
  for(const slot of EQ_SLOTS)if(player.eq[slot]===it)return {kind:'slot',slot};
  const b=player.bag.find(b=>b.it===it);if(b)return {kind:'grid',cx:b.x,cy:b.y};
  const i=player.cube.indexOf(it);return i>=0?{kind:'cube',i}:null;
}
function inventoryDrawer(){
  if(!inventoryState.drawer)return null;
  const L=inventoryLayout(),F=L.frame,w=Math.min(L.mobile?380:450,F.w-24),h=Math.min(F.h-20,L.mobile?480:710);
  const b={x:F.x+F.w-w-10,y:F.y+10,w,h};
  const close={x:b.x+b.w-48,y:b.y+4,w:44,h:44,kind:'drawerClose'};
  const type=inventoryState.drawer,buttons=[];
  if(type==='item'){
    const sel=inventoryState.selection,hit=sel&&inventoryLocate(sel.it);
    if(!hit){inventoryState.drawer=null;inventoryState.selection=null;return null;}
    buttons.push({x:b.x+12,y:b.y+b.h-104,w:(w-30)/2,h:44,kind:'itemUse'},
      {x:b.x+18+(w-30)/2,y:b.y+b.h-104,w:(w-30)/2,h:44,kind:'itemMove'},
      {x:b.x+12,y:b.y+b.h-54,w:(w-30)/2,h:44,kind:'itemCube'},
      {x:b.x+18+(w-30)/2,y:b.y+b.h-54,w:(w-30)/2,h:44,kind:'itemDrop'});
  }else if(type==='stats'&&player.pts>0){
    for(let i=0;i<4;i++)buttons.push({x:b.x+b.w-58,y:b.y+60+i*48,w:44,h:44,kind:'stat',i});
  }else if(type==='appearance'){
    buttons.push({x:b.x+12,y:b.y+54,w:w-24,h:44,kind:'rawSkin'});
    const count=Math.max(1,Math.floor((b.h-160)/46));inventoryState.scroll=Math.min(inventoryState.scroll,Math.max(0,VIS_SLOTS.length-count));
    VIS_SLOTS.slice(inventoryState.scroll,inventoryState.scroll+count).forEach((slot,i)=>{const y=b.y+106+i*46;
      ['eye','dye','tmog'].forEach((kind,j)=>buttons.push({x:b.x+12+j*(w-24)/3,y,w:(w-30)/3,h:44,kind,slot}));});
  }else if(type==='cube'){
    const s=Math.min(64,(w-34)/4);
    for(let i=0;i<4;i++)buttons.push({x:b.x+12+i*(s+3),y:b.y+60,w:s,h:s,kind:'cube',i});
    buttons.push({x:b.x+12,y:b.y+68+s,w:w-24,h:44,kind:'transmute'});
  }
  const reserve=type==='item'?156:type==='appearance'?b.h:54;
  const rows=type==='stats'&&player.pts>0?Math.max(1,Math.floor((b.h-316)/20)):
    type==='cube'?Math.max(1,Math.floor((b.h-244)/20)):
    type==='appearance'?Math.max(1,Math.floor((b.h-160)/46)):Math.max(1,Math.floor((b.h-reserve-48)/20));
  const pages=[{x:b.x+12,y:b.y+b.h-(type==='item'?150:52),w:72,h:44,kind:'scroll',delta:-rows},
    {x:b.x+90,y:b.y+b.h-(type==='item'?150:52),w:72,h:44,kind:'scroll',delta:rows}];
  return {b,close,type,buttons,pages,rows};
}
function inventoryHit(x=mouse.x,y=mouse.y){
  ({x,y}=UIMotion.point(x,y,cv.width,cv.height));
  const D=inventoryDrawer();if(D){
    for(const b of [D.close,...D.buttons,...D.pages])if(InventoryLayout.contains(b,x,y))return b;
    return {kind:'drawerBody'};
  }
  return InventoryLayout.hit(inventoryLayout(),x,y);
}
function inventorySelect(h){const it=hoverItem(h);if(it){inventoryState.selection={it};inventoryState.drawer='item';inventoryState.scroll=0;}}
function inventoryAction(h,button=0,shift=false,ctrl=false){
  if(!h){if(!touchUIEnabled())bagClick(button,shift,ctrl,null);return;}
  const S=inventoryState,p=player,n=texts.length;
  try{
  if(h.kind==='drawer'){S.drawer=h.drawer;S.scroll=0;return;}
  if(h.kind==='drawerClose'){S.drawer=null;return;}
  if(h.kind==='drawerBody')return;
  if(h.kind==='scroll'){S.scroll=Math.max(0,S.scroll+h.delta);return;}
  if(h.kind==='pane'){S.pane=h.pane;S.drawer=null;return;}
  if(h.kind==='page'){S.bagPage=1-S.bagPage;return;}
  if(h.kind==='rawSkin'){setRawSkin(!rawSkin);return;}
  if(h.kind.startsWith('item')){
    const it=S.selection?.it,from=it&&inventoryLocate(it);if(!from||p.cursor)return;
    if(h.kind==='itemUse')bagClick(2,false,false,from);
    else if(h.kind==='itemMove'){bagClick(0,false,false,from);S.drawer=null;}
    else if(h.kind==='itemCube'){
      const i=p.cube.indexOf(null);if(i<0){addText(p.x,p.y,1.6,'方块已满','#ff8a6a',.9);return;}
      bagClick(0,false,false,from);bagClick(0,false,false,{kind:'cube',i});S.drawer='cube';S.scroll=0;
    }else if(h.kind==='itemDrop'){
      bagClick(0,false,false,from);if(p.cursor){dropItemAt(p.cursor,p.x,p.y);p.cursor=null;recalc();}S.drawer=null;
    }
    return;
  }
  if(h.kind==='stat'&&p.pts<=0)return;
  bagClick(button,shift,ctrl,h);
  if(['sort','junk','idall','transmute','close'].includes(h.kind))S.selection=null;
  }finally{
    // The inventory covers world messages; surface the same real action result here.
    if(texts.length>n){const t=texts[texts.length-1];S.notice={text:t.txt,col:t.col,until:performance.now()+2400};}
  }
}
function inventoryBegin(id,x,y){
  if(inventoryState.press)return;
  mouse.x=x;mouse.y=y;
  inventoryState.press={id,x,y,sx:x,sy:y,start:performance.now(),hit:inventoryHit(x,y),drag:false};
  UIMotion.down(UIMotion.inventoryKey(inventoryState.press.hit),'inventory:'+id);
}
function inventoryHold(){
  const q=inventoryState.press;if(!q||q.drag||performance.now()-q.start<320||inventoryState.drawer)return;
  if(q.hit&&['grid','slot','cube'].includes(q.hit.kind)&&hoverItem(q.hit)&&!player.cursor){bagClick(0,false,false,q.hit);q.drag=true;}
}
function inventoryMove(id,x,y){
  const q=inventoryState.press;if(!q||q.id!==id)return;
  mouse.x=q.x=x;mouse.y=q.y=y;inventoryHold();
}
function inventoryEnd(id,x,y,cancel=false){
  const q=inventoryState.press;if(!q||q.id!==id)return;
  UIMotion.up('inventory:'+id,cancel);
  if(!cancel){inventoryMove(id,x,y);inventoryHold();}
  inventoryState.press=null;if(cancel)return;
  const h=inventoryHit(x,y);
  if(q.drag){if(h&&['grid','slot','cube'].includes(h.kind))inventoryAction(h);return;}
  if(Math.hypot(x-q.sx,y-q.sy)>14)return;
  // Capture the tap target on press: the opening transition may move it under a still finger.
  const tapped=q.hit;
  if(tapped&&['grid','slot','cube'].includes(tapped.kind)&&!player.cursor&&hoverItem(tapped))inventorySelect(tapped);else inventoryAction(tapped);
}
function inventoryPointerDown(e){
  if(state!=='bag')return false;
  if(touchUIEnabled()&&e.button===0)inventoryBegin('mouse',e.clientX,e.clientY);
  else{const h=inventoryHit(e.clientX,e.clientY);if(e.button===0)UIMotion.down(UIMotion.inventoryKey(h),'inventory:mouse');inventoryAction(h,e.button,e.shiftKey,e.ctrlKey||e.metaKey);}
  mouse.l=mouse.r=false;return true;
}
