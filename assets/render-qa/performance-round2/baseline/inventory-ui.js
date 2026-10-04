function inventoryItem(it,b){
  if(!it)return;
  // Item identity and occupied footprint come from the existing inventory renderer.
  drawItemIcon(it,b.x+2,b.y+2,b.w-4,b.h-4);
}
function inventoryCharacter(b,clip,mobile=false){
  const A=InventoryAssets,p=player;
  Object.assign(dollE,{char:p.char,gv:p.gv,weapon:p.weapon,ang:.9,flash:0,st:'move',z:0});
  const rig=playerRig(dollE),vertices=[];
  for(const q of rig)for(const i of [-1,1])for(const j of [-1,1])for(const k of [-1,1]){
    const v=apply(q.M,q.c[0]+i*q.s[0]/2,q.c[1]+j*q.s[1]/2,q.c[2]+k*q.s[2]/2);vertices.push([v[0]*SX,v[1]*SY-v[2]*SZ]);
  }
  const xs=vertices.map(v=>v[0]),ys=vertices.map(v=>v[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const reserve=mobile?8:38,scale=Math.min((b.w-8)/(xmax-xmin),(b.h-reserve)/(ymax-ymin)),rh=(ymax-ymin)*scale;
  const foot=b.y+(b.h-reserve+rh)/2,pw=Math.min(b.w*.76,rh),ph=pw*.24;
  const body=rigModel(dollE,modelPose(dollE,playerPose(dollE)),MODELS[p.char]||MODELS.akane,{gear:p.gv});
  let footY=-Infinity;
  for(const q of body)for(const i of [-1,1])for(const j of [-1,1])for(const k of [-1,1]){
    const v=apply(q.M,q.c[0]+i*q.s[0]/2,q.c[1]+j*q.s[1]/2,q.c[2]+k*q.s[2]/2);footY=Math.max(footY,v[1]*SY-v[2]*SZ);
  }
  const oldX=ox,oldY=oy;
  ctx.save();ctx.beginPath();ctx.rect(clip.x+8,b.y-12,clip.w-16,b.h+24);ctx.clip();
  ox=b.x+b.w/2-(xmin+xmax)*scale/2;oy=foot-ymax*scale;
  A.image('plinth',{x:ox-pw/2,y:oy+footY*scale-ph*.31,w:pw,h:ph},1,[226,197,1322,541]);
  try{drawRig(dollE,rig,scale,0);}finally{ox=oldX;oy=oldY;ctx.restore();}
}
function inventoryGear(L){
  const A=InventoryAssets,p=player,B=L.gear,G=p.G,m=L.mobile;
  A.slice('panel',B,14);
  const I=CHAR_INFO[p.char]||CHAR_INFO.akane;
  if(!L.tight)A.text(I.n+'  ·  '+CLASS_INFO[p.cls].n+' Lv.'+p.lvl,B.x+14,B.y+(m?14:26),m?16:22,'#ffe19a','left',B.w-24);
  const xp={x:B.x+14,y:B.y+(m?27:49),w:B.w-28,h:m?6:9};
  if(!L.tight){ctx.fillStyle='#0a0d0b';ctx.fillRect(xp.x,xp.y,xp.w,xp.h);ctx.fillStyle='#46d957';ctx.fillRect(xp.x,xp.y,xp.w*clamp(p.xp/xpNeed(p.lvl),0,1),xp.h);}
  if(!m)A.text('经验 '+p.xp+' / '+xpNeed(p.lvl),B.x+B.w-16,B.y+26,13,'#b9b5c2','right');
  inventoryCharacter(L.hero,B,m);
  L.swap.forEach(b=>A.button(b,b.set?'II':'I',null,p.swapSet===b.set));
  for(const [slot,b]of Object.entries(L.slots)){
    A.slice('slot',b,3);const it=p.eq[slot],blocked=slot==='offhand'&&p.eq.weapon&&noOffhand(p.eq.weapon.kind);
    if(it)inventoryItem(it,b);
    else A.icon(blocked?'blocked':slot.startsWith('ring')?'ring':slot==='weapon'?'weapon':slot==='offhand'?'vit':slot==='boots'?'boot':slot,b.x+b.w/2,b.y+b.h/2,Math.min(b.w,b.h)*.58,.52);
    if(!m)A.text(blocked?'双手占用':SLOT_N[slot],b.x+b.w/2,b.y+b.h-8,10,'#b0aab4','center',b.w-6);
  }
  A.button(L.appearance,'外观','appearance');
  const S=L.summary;
  if(m){
    A.button(L.stats,'属性');const room=S.w-L.stats.w-12;
    const x=L.stats.x+L.stats.w+15;A.icon('hp',x+7,L.stats.y+22,22);A.text(Math.ceil(p.hp)+'/'+p.maxhp,x+24,L.stats.y+22,14,'#ff666f','left',room*.46-24);
    A.icon('mana',x+room*.5,L.stats.y+22,22);A.text(Math.round(p.mana)+'/'+p.maxMana,x+room*.5+16,L.stats.y+22,14,'#71c1ff','left',room*.48-20);
  }else{
    A.text('基础属性'+(p.pts?' · 可分配 '+p.pts+' 点':''),S.x,S.y+16,17,'#ffe19a');
    [['力量','str'],['敏捷','dex'],['体力','vit'],['精力','ene']].forEach(([n,k],i)=>{const x=S.x+i*S.w/4;A.icon(k,x+15,S.y+50,26);A.text(n,x+34,S.y+42,14);A.text(G[k],x+34,S.y+63,17);});
    A.text('伤害  '+G.wMin+' - '+G.wMax,S.x,S.y+98,16);A.icon('hp',S.x+S.w*.56,S.y+98,25);A.text('生命  '+Math.ceil(p.hp)+' / '+p.maxhp,S.x+S.w*.56+22,S.y+98,15,'#ff6972');
    A.icon('mana',S.x+S.w*.56,S.y+124,25);A.text('法力  '+Math.round(p.mana)+' / '+p.maxMana,S.x+S.w*.56+22,S.y+124,15,'#75c0ff');
    A.button(L.stats,'详细属性');
  }
}
function inventoryBag(L){
  const A=InventoryAssets,p=player,B=L.bag,g=L.grid;
  A.slice('panel',B,14);if(!L.tight)A.text('背包',B.x+14,B.y+(L.mobile?14:28),L.mobile?18:24,'#ffe19a');
  if(L.page)A.button(L.page,g.colStart?'6–10 列':'1–5 列');else if(!L.tight)A.text('10 × 4',B.x+B.w-16,B.y+(L.mobile?14:28),14,'#aaa5b0','right');
  for(let y=0;y<4;y++)for(let x=0;x<g.cols;x++)A.slice('slot',{x:g.x+x*g.cell,y:g.y+y*g.cell,w:g.cell,h:g.cell},2);
  ctx.save();ctx.beginPath();ctx.rect(g.x,g.y,g.w,g.h);ctx.clip();
  for(const b of p.bag)inventoryItem(b.it,{x:g.x+(b.x-g.colStart)*g.cell,y:g.y+b.y*g.cell,w:b.it.w*g.cell,h:b.it.h*g.cell});
  if(p.cursor&&uiHover?.kind==='grid'){
    const it=p.cursor,x=clamp(uiHover.cx-Math.floor((it.w-1)/2),0,10-it.w),y=clamp(uiHover.cy-Math.floor((it.h-1)/2),0,4-it.h);
    ctx.strokeStyle=bagFree(x,y,it.w,it.h)?'#64e8a0':'#ef6e6e';ctx.lineWidth=2;ctx.strokeRect(g.x+(x-g.colStart)*g.cell+1,g.y+y*g.cell+1,it.w*g.cell-2,it.h*g.cell-2);
  }ctx.restore();
  const C=L.currency;A.icon('emerald',C.x+12,C.y+10,25);A.text('绿宝石：'+p.emeralds,C.x+33,C.y+10,16,'#6df797');
  if(L.mobile)A.text(p.cursor?'轻点目标格放置':'轻点查看 · 长按移动',C.x+C.w,C.y+10,12,'#b4aab9','right',Math.max(80,C.w-160));
  const labels={idall:'鉴定 × '+p.idScrolls,junk:'批量分解',sort:'整理'},icons={idall:'scroll',junk:'salvage',sort:'sort'};
  for(const b of L.bagActions)A.button(b,labels[b.kind],icons[b.kind],false,b.kind==='idall'&&p.idScrolls<=0);
}
function inventoryCraft(L){
  const A=InventoryAssets,B=L.craft;A.slice('panel',B,14);A.text('赫拉迪克方块',B.x+14,B.y+26,L.mobile?18:22,'#ffe19a');
  for(const b of L.cube){A.slice('slot',b,3);inventoryItem(player.cube[b.i],b);}A.button(L.transmute,'合成',null,true);A.button(L.recipes,'配方');
  if(B.h>165)A.text('将物品放入方块，按配方合成',B.x+14,Math.max(L.cube[0].y+L.cube[0].h,L.transmute.y+L.transmute.h)+24,14,'#aaa5b0');
}
function inventoryWrapped(lines,width){
  const out=[];ctx.save();ctx.font='14px "Microsoft YaHei UI","Microsoft YaHei",sans-serif';
  for(const [line,col]of lines){let s='';for(const ch of String(line)){if(s&&ctx.measureText(s+ch).width>width){out.push([s,col]);s='';}s+=ch;}out.push([s,col]);}ctx.restore();return out;
}
function inventoryDetails(){
  const D=inventoryDrawer();if(!D)return;const A=InventoryAssets,S=inventoryState,p=player,b=D.b;
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,cv.width,cv.height);A.slice('panel',b,16);
  const titles={item:'物品详情',stats:'详细属性',sets:'套装加成',recipes:'方块配方',appearance:'装备外观',cube:'赫拉迪克方块'};
  A.text(titles[D.type]+(D.type==='stats'&&p.pts>0?' · '+p.pts+' 点可分配':''),b.x+16,b.y+26,19,'#ffe19a','left',b.w-70);A.button(D.close,'','close');let lines=[],startY=b.y+57;
  if(D.type==='item'){lines=itemLines(S.selection.it);if(inventoryLayout().mobile)lines=lines.filter(([s])=>! /^(右键|左键|Shift|Ctrl)/.test(s));}
  else if(D.type==='stats'){
    lines=[['可分配属性点：'+p.pts,'#ffe19a'],...['str','dex','vit','ene'].map((k,i)=>[['力量','敏捷','体力','精力'][i]+'  '+p.G[k],'#eee'])];
    if(p.pts>0)lines=[];
    for(const [n,k,suffix]of [['伤害','wMin',''],['攻击速度','effIas','%'],['施法速度','effFcr','%'],['防御','defense',''],['格挡','block','%'],['火焰抗性','resF','%'],['冰冷抗性','resC','%'],['闪电抗性','resL','%'],['毒素抗性','resP','%'],['移动速度','effFrw','%'],['伤害减少','dr','%'],['偷取生命','ll','%'],['偷取法力','lm','%'],['MF','mf','%'],['绿宝石加成','gf','%'],['技能加成','skills','']])lines.push([n+'  '+(p.G[k]||0)+suffix,'#ccc6d1']);
    if(p.pts>0){startY=b.y+258;for(let i=0;i<4;i++)A.text(['力量','敏捷','体力','精力'][i]+'  '+p.G[['str','dex','vit','ene'][i]],b.x+18,b.y+82+i*48,16);D.rows=Math.max(1,Math.floor((b.y+b.h-58-startY)/20));}
  }else if(D.type==='sets'){
    for(const sid in SETS){const n=countSet(sid);if(!n)continue;lines.push([SETS[sid].n+'（'+n+'/'+SETS[sid].items.length+'）','#77ef91']);for(const c in SETS[sid].bonus)lines.push(['('+c+') '+statLines(SETS[sid].bonus[c]).join('，'),n>=+c?'#77ef91':'#aaa']);}
    if(!lines.length)lines=[['集齐绿色套装可获得额外加成。','#ccc'],['套装与暗金装备需要先鉴定。','#ccc'],['符文按指定顺序镶进同孔数普通装备，可形成符文之语。','#ccc'],['Tir + El（剑/斧）= 钢铁','#ffe19a'],['Tal + Eth（护甲）= 隐密','#ffe19a']];
  }else if(D.type==='recipes'||D.type==='cube'){
    lines=[['3 个同种同级宝石 → 升一级','#ddd'],['3 个同种符文 → 下一个符文','#ddd'],['普通/精良物品 + 3 宝石 → 随机打孔','#ddd'],['魔法物品 + 3 完美宝石 → 重洗','#ddd'],['有孔物品 + Hel → 清空镶孔','#ddd']];
    if(D.type==='cube'){startY=b.y+190;D.rows=Math.max(1,Math.floor((b.y+b.h-54-startY)/20));}
  }
  const wrapped=inventoryWrapped(lines,b.w-32);if(D.type!=='appearance')S.scroll=clamp(S.scroll,0,Math.max(0,wrapped.length-D.rows));
  wrapped.slice(S.scroll,S.scroll+D.rows).forEach(([s,c],i)=>A.text(s,b.x+16,startY+i*20,14,c));
  const sel=S.selection?.it,from=sel&&inventoryLocate(sel),useLabel=from?.kind==='slot'?'卸下':from?.kind==='cube'?'取出':sel&&!sel.ident?'鉴定':sel&&['gem','rune'].includes(sel.type)?'镶嵌':sel?.type==='charm'?'护身符已生效':'装备';
  for(const q of D.buttons){
    if(q.kind==='cube'){A.slice('slot',q,3);inventoryItem(p.cube[q.i],q);continue;}
    const labels={itemUse:useLabel,itemMove:'移动',itemCube:'放入方块',itemDrop:'丢弃',transmute:'合成',stat:'+1',rawSkin:rawSkin?'显示装备外观':'显示角色原皮',eye:'显示',dye:'染色',tmog:'幻化'};
    if(q.kind==='rawSkin'||['eye','dye','tmog'].includes(q.kind)){const n=q.slot?SLOT_N[q.slot]+'·':'';A.button(q,n+labels[q.kind],null,false,q.slot&&!p.eq[q.slot]);}
    else A.button(q,labels[q.kind],null,['itemUse','transmute'].includes(q.kind),q.kind.startsWith('item')&&!!p.cursor);
  }
  if(wrapped.length>D.rows||(D.type==='appearance'&&VIS_SLOTS.length>Math.floor((b.h-160)/46)))for(const q of D.pages)A.button(q,q.delta<0?'上页':'下页');
}
function inventoryTooltip(it){
  const A=InventoryAssets,w=Math.min(350,cv.width-24),lines=inventoryWrapped(itemLines(it),w-24),h=Math.min(cv.height-24,lines.length*20+24);
  const b={x:clamp(mouse.x+18,12,cv.width-w-12),y:clamp(mouse.y-h/2,12,cv.height-h-12),w,h};
  A.slice('panel',b,12);lines.slice(0,Math.floor((h-24)/20)).forEach(([s,c],i)=>A.text(s,b.x+12,b.y+16+i*20,14,c));
}
let inventoryLayer=null,inventoryLayerReady=false;
function inventoryContent(){
  const L=inventoryLayout(),A=InventoryAssets,p=player;
  A.slice('panel',L.frame,L.mobile?18:38);
  if(L.gear)inventoryGear(L);if(L.bag)inventoryBag(L);if(L.craft)inventoryCraft(L);
  for(const b of L.tabs)A.button(b,{gear:'装备',bag:'背包',cube:'方块'}[b.pane],null,L.view===b.pane);
  if(L.cubeToggle)A.button(L.cubeToggle,'赫拉迪克方块','cube');if(L.setToggle)A.button(L.setToggle,'套装加成');
  A.image('title',L.title,1,[51,119,2070,430]);A.text('装备与背包',L.title.x+L.title.w/2,L.title.y+L.title.h*.63,L.mobile?21:29,'#ffe19a','center');A.button(L.close,'','close');
  if(!L.mobile)A.text('右键装备 · X 换组 · I / Esc 关闭',L.frame.x+L.frame.w/2,L.frame.y+L.frame.h+18,14,'#b4aab9','center');
  if(!A.ready())A.text(A.errors.length?'背包图片加载失败':'正在加载背包图片…',L.frame.x+18,L.frame.y+L.frame.h-14,12,'#ffbf7a');
  if(!L.mobile&&!inventoryState.drawer&&!p.cursor&&hoverItem(uiHover)){
    inventoryTooltip(hoverItem(uiHover));
  }else inventoryDetails();
  const notice=inventoryState.notice;
  if(notice&&performance.now()<notice.until){const w=Math.min(480,cv.width-24),b={x:(cv.width-w)/2,y:cv.height-100,w,h:40};A.slice('panel',b,10);A.text(notice.text,b.x+12,b.y+20,14,notice.col,'left',w-24);}
}
function inventoryRenderLayer(){
  if(!inventoryLayer)inventoryLayer=document.createElement('canvas');
  if(inventoryLayer.width!==cv.width||inventoryLayer.height!==cv.height){inventoryLayer.width=cv.width;inventoryLayer.height=cv.height;inventoryLayerReady=false;}
  // Composite the whole UI once, so item renderers cannot overwrite the fade alpha.
  const gameContext=ctx;ctx=inventoryLayer.getContext('2d');ctx.save();
  try{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);inventoryContent();inventoryLayerReady=true;}
  finally{ctx.restore();ctx=gameContext;}
}
function inventoryComposite(){
  const v=UIMotion.view(cv.width,cv.height);if(!inventoryLayerReady||v.opacity<=0)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=`rgba(0,0,0,${.72*v.opacity})`;ctx.fillRect(0,0,cv.width,cv.height);
  ctx.translate(v.x,v.y);ctx.scale(v.scale,v.scale);ctx.globalAlpha*=v.opacity;ctx.drawImage(inventoryLayer,0,0,cv.width,cv.height);ctx.restore();
}
function inventoryPrepareExit(){inventoryRenderLayer();UIMotion.to('inventory',0,160);UIMotion.releaseAll();}
function inventoryDrawExit(){inventoryComposite();}
function inventoryDraw(){
  inventoryHold();uiHover=inventoryHit();inventoryRenderLayer();inventoryComposite();
  if(player.cursor){const s=inventoryLayout().grid?.cell||44;inventoryItem(player.cursor,{x:mouse.x-player.cursor.w*s/2,y:mouse.y-player.cursor.h*s/2,w:player.cursor.w*s,h:player.cursor.h*s});}
  uiFlash=Math.max(0,uiFlash-.03);
}
