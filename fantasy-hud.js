(function(){
  'use strict';
  const FONT='"Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif';
  const files={panel:'panel-frame',action:'action-ring',portrait:'portrait-frame',joystick:'joystick-ring',thumb:'joystick-thumb',boss:'boss-frame'};
  const images={}, failures=[];
  const icons=['attack','roll','potion','potionGreen','skill','spell','bag','quest','settings','interact','coin','key','hp','mana','shield','boot','heal','pin','compass','fireball','frost','chain','art0','art1','art2','bow','jump','swap','more','star'];
  let pending=0;
  function load(key,url){
    const im=new Image(); pending++;
    im.onload=()=>{images[key]=im;pending--;};
    im.onerror=()=>{failures.push(url);pending--;console.error('HUD image failed:',url);};
    im.src=url;
  }
  Object.entries(files).forEach(([k,name])=>load(k,'assets/hud/'+name+'.png'));
  icons.forEach(k=>load('i_'+k,'assets/hud/icons/'+k+'.png'));
  function text(c,s,x,y,size=22,col='#f7f3ec',align='left',maxWidth){
    c.save();c.font='800 '+size+'px '+FONT;c.textAlign=align;c.textBaseline='middle';
    c.lineJoin='round';c.lineWidth=Math.max(2,size/6);c.strokeStyle='rgba(7,5,11,.96)';
    if(maxWidth){c.strokeText(String(s),x,y,maxWidth);c.fillStyle=col;c.fillText(String(s),x,y,maxWidth);}
    else{c.strokeText(String(s),x,y);c.fillStyle=col;c.fillText(String(s),x,y);}c.restore();
  }
  function image(c,key,x,y,w,h,alpha=1){
    const im=images[key];if(!im)return;c.save();c.globalAlpha*=alpha;c.imageSmoothingEnabled=true;
    c.drawImage(im,x,y,w,h);c.restore();
  }
  function icon(c,key,x,y,size,alpha=1){image(c,'i_'+key,x-size/2,y-size/2,size,size,alpha);}
  // Only the straight runs are stretched. Ornaments retain their shape at every size.
  function panel(c,b,alpha=1,edge=22){
    const im=images.panel;if(!im)return;
    const sw=im.naturalWidth,sh=im.naturalHeight,sx=sw*.13,sy=sh*.19;
    const d=Math.min(edge,b.w/3,b.h/3),xs=[0,sx,sw-sx,sw],ys=[0,sy,sh-sy,sh];
    const dx=[b.x,b.x+d,b.x+b.w-d,b.x+b.w],dy=[b.y,b.y+d,b.y+b.h-d,b.y+b.h];
    c.save();c.globalAlpha*=alpha;c.imageSmoothingEnabled=true;
    for(let r=0;r<3;r++)for(let k=0;k<3;k++)c.drawImage(im,xs[k],ys[r],xs[k+1]-xs[k],ys[r+1]-ys[r],dx[k],dy[r],dx[k+1]-dx[k],dy[r+1]-dy[r]);
    c.restore();
  }
  function fillBar(c,b,f,type,value){
    panel(c,b,1,Math.min(9,b.h/3));
    const colors=type==='hp'?['#ff4462','#ec0031','#85041b']:type==='mp'?['#29c4ff','#008ef6','#075298']:['#d596ff','#a42eff','#501a84'];
    const ww=(b.w-12)*Math.max(0,Math.min(1,f)),hh=b.h-10;
    if(ww>0){const g=c.createLinearGradient(0,b.y+5,0,b.y+b.h-5);g.addColorStop(0,colors[0]);g.addColorStop(.4,colors[1]);g.addColorStop(1,colors[2]);
      c.fillStyle=g;c.fillRect(b.x+6,b.y+5,ww,hh);c.fillStyle='#ffffff66';c.fillRect(b.x+7,b.y+6,Math.max(0,ww-2),2);}
    if(value)text(c,value,b.x+b.w/2,b.y+b.h/2,Math.min(22,b.h*.66),'#fff','center');
  }
  function portrait(c,L,S){
    const b=L.portrait,sz=Math.min(b.w,b.h),cx=b.x+b.w/2,cy=b.y+b.h/2;
    c.save();c.beginPath();c.moveTo(cx,cy-sz*.325);c.lineTo(cx+sz*.325,cy);c.lineTo(cx,cy+sz*.325);c.lineTo(cx-sz*.325,cy);c.closePath();c.clip();
    S.portrait(cx,cy+sz*.07,sz*.48,true);c.restore();image(c,'portrait',b.x,b.y,b.w,b.h);
    const badge={x:cx-34,y:b.y+b.h-42,w:68,h:35};panel(c,badge,1,12);text(c,L.mobile?S.p.lvl:'Lv.'+S.p.lvl,cx,badge.y+18,24,'#ffd570','center');
  }
  function vitals(c,L,S){
    const p=S.p,b=L.vitals;
    const x=L.mobile?b.x+172:b.x+262,y=L.mobile?b.y+29:b.y+36,w=L.mobile?b.w-194:b.w-292;
    panel(c,{x:L.mobile?b.x+119:b.x+155,y:L.mobile?b.y+15:b.y+11,w:L.mobile?b.w-119:b.w-155,h:L.mobile?90:111},.98,23);
    icon(c,'hp',x-24,y+16,39);fillBar(c,{x,y,w,h:33},p.hp/p.maxhp,'hp',Math.ceil(p.hp)+' / '+p.maxhp);
    icon(c,'mana',x-24,y+54,33);fillBar(c,{x,y:y+40,w,h:30},p.mana/p.maxMana,'mp',Math.round(p.mana)+' / '+p.maxMana);
    portrait(c,L,S);
    if(L.mobile)text(c,S.className+' Lv.'+p.lvl,b.x+129,b.y+124,20,S.classColor);
    else fillBar(c,L.progress,p.xp/S.xpNeed,'xp');
  }
  function map(c,L,S){
    const b=L.map;panel(c,b,.95,25);
    c.save();c.beginPath();c.rect(b.x+20,b.y+L.mobile*5+45,b.w-40,b.h-85);c.clip();
    S.map(b.x+b.w/2,b.y+b.h/2+4,(b.w-54)/S.mapCols,(b.h-92)/S.mapRows);c.restore();
    text(c,L.mobile?'地牢地图':S.theme+' · 第 '+S.floor+' 层',b.x+b.w/2,L.mobile?b.y+b.h-34:b.y+31,L.mobile?20:19,'#c8c2d1','center',b.w-62);
    icon(c,'compass',b.x+b.w-18,b.y+26,59);
    if(!L.mobile){panel(c,{x:b.x+b.w-59,y:b.y+b.h-58,w:39,h:36},1,8);text(c,'M',b.x+b.w-40,b.y+b.h-40,21,'#ffe6a4','center');}
  }
  function info(c,L,S){
    const b=L.info,p=S.p;
    if(L.mobile){
      c.fillStyle='rgba(9,8,16,.58)';c.fillRect(b.x,b.y,b.w,b.h*.45);c.fillRect(b.x,b.y+45,b.w,b.h*.43);
      icon(c,'pin',b.x+23,b.y+17,31);text(c,'第 '+S.floor+' 层: '+S.theme,b.x+50,b.y+17,23,'#ffd451', 'left',b.w-50);
      resource(c,'coin',p.emeralds,b.x+23,b.y+62);resource(c,'attack',S.kills,b.x+152,b.y+62);resource(c,'skill',Math.floor(p.souls),b.x+249,b.y+62);
    }else{
      panel(c,b,.97,25);panel(c,L.floor,1,22);text(c,S.floor,b.x+39,b.y+59,38,'#fff','center');
      text(c,'第 '+S.floor+' 层 · '+S.theme,b.x+95,b.y+35,26,'#ffe075','left',b.w-117);
      icon(c,'pin',b.x+105,b.y+79,27);text(c,S.objective,b.x+125,b.y+79,19,'#f0eaef','left',b.w-143);
      resource(c,'mana',p.emeralds,b.x+106,b.y+119,21);resource(c,'attack',S.kills,b.x+216,b.y+119,21);
      icon(c,'skill',b.x+291,b.y+119,29);text(c,S.className+' Lv.'+p.lvl,b.x+b.w-31,b.y+119,17,S.classColor,'right');
    }
  }
  function resource(c,key,value,x,y,size=23){icon(c,key,x,y,32);text(c,value,x+27,y,size);}
  function boss(c,L,S){
    if(!S.boss)return;const b=L.boss,im=images.boss;if(!im)return;
    c.drawImage(im,14,112,2146,455,b.x,b.y,b.w,b.h);
    const bx=b.x+b.w*.115,by=b.y+b.h*.635,bw=b.w*.77,bh=b.h*.132;
    const g=c.createLinearGradient(0,by,0,by+bh);g.addColorStop(0,'#ff4765');g.addColorStop(.4,'#f10032');g.addColorStop(1,'#9a0320');
    c.fillStyle=g;c.fillRect(bx,by,bw*Math.max(0,S.boss.hp/S.boss.maxhp),bh);
    text(c,S.boss.name,b.x+b.w/2,b.y+b.h*.447,22,S.boss.enraged?'#ffab87':'#fff','center',b.w*.39);
    text(c,Math.ceil(S.boss.hp)+' / '+S.boss.maxhp,b.x+b.w/2,by+bh/2,21,'#fff','center');
  }
  function pressTransform(c,x,y,feedback){const scale=UIMotion.reduced()?1:1-.03*feedback;c.translate(x,y+(UIMotion.reduced()?0:1.5*feedback));c.scale(scale,scale);c.translate(-x,-y);}
  function action(c,b,data,pressed=false,mobile=false,feedback=0,scale=1){
    const x=b.r===undefined?b.x+b.w/2:b.x,y=b.r===undefined?b.y+b.h/2:b.y;
    const size=b.r===undefined?Math.min(b.w,b.h):b.r*2;
    c.save();pressTransform(c,x,y,feedback);
    if(b.r===undefined)panel(c,b,1,15);else image(c,'action',b.x-b.r,b.y-b.r,size,size);
    if(feedback>0||pressed){c.save();c.globalCompositeOperation='screen';const alpha=.18*Math.max(feedback,pressed?.5:0);if(b.r===undefined)panel(c,b,alpha,15);else image(c,'action',b.x-b.r,b.y-b.r,size,size,alpha);c.restore();}
    icon(c,data.icon,x,y-(data.label?size*.025:0),size*(b.action==='attack'?.52:.48),data.disabled?.28:1);
    if(data.cd>0){c.save();c.fillStyle='rgba(5,3,12,.72)';c.beginPath();c.moveTo(x,y);c.arc(x,y,size*.32,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,data.cd/data.full));c.closePath();c.fill();c.restore();text(c,data.cd<3?data.cd.toFixed(1):Math.ceil(data.cd),x,y,23,'#fff','center');}
    else if(data.cost)text(c,data.cost,x+size*.31,y+size*.32,19,data.disabled?'#ad829c':'#fff','right');
    if(mobile&&data.label){const wb=Math.max(55,size*.78),lh=Math.max(28,16/scale);panel(c,{x:x-wb/2,y:y+size*.34,w:wb,h:lh},1,8);text(c,data.label,x,y+size*.34+lh/2,Math.max(22,12/scale),'#fff','center',wb-12);}
    if(b.key){const kw=Math.max(39,b.key.length*12+12);panel(c,{x:x-kw/2,y:b.y-26,w:kw,h:34},1,9);text(c,b.key,x,b.y-9,24,'#fff','center');}
    c.restore();
  }
  function desktop(c,L,S){
    info(c,L,S);map(c,L,S);boss(c,L,S);vitals(c,L,S);
    S.buffs.slice(0,6).forEach((data,i)=>{const b=L.buffs[i];c.save();c.translate(b.x+b.w/2,b.y+b.h/2);c.rotate(Math.PI/4);panel(c,{x:-b.w*.34,y:-b.h*.34,w:b.w*.68,h:b.h*.68},1,13);c.restore();icon(c,data.icon,b.x+b.w/2,b.y+b.h/2,43);if(data.level>1)text(c,data.level,b.x+b.w-17,b.y+b.h-18,15,'#fff','right');});
    if(S.combo>0){panel(c,L.combo,1,18);text(c,S.combo,L.combo.x+42,L.combo.y+40,40,'#ffc359','center');text(c,'连击',L.combo.x+42,L.combo.y+77,20,'#fff','center');}
    panel(c,L.hotbarFrame,1,25);L.hotbar.forEach(b=>action(c,b,S.actions[b.action],S.pressed(b.action),false,S.feedback(b.action)));
    L.aux.forEach(b=>{c.save();pressTransform(c,b.x+b.w/2,b.y+b.h/2,S.feedback(b.action));panel(c,b,.75,9);text(c,b.key+' '+S.actions[b.action].label,b.x+b.w/2,b.y+b.h/2,14,'#a69dab','center');c.restore();});
    resource(c,'coin',S.p.emeralds,L.w-167,L.h-132,21);resource(c,'skill',Math.floor(S.p.souls),L.w-167,L.h-93,21);
    panel(c,{x:L.w-182,y:L.h-61,w:60,h:32},1,9);text(c,'ESC',L.w-152,L.h-45,19,'#fff','center');text(c,'菜单',L.w-92,L.h-45,18);
  }
  function mobile(c,L,S){
    info(c,L,S);vitals(c,L,S);map(c,L,S);boss(c,L,S);
    for(const k of ['bag','quest','settings']){const b=L.buttons[k];c.save();pressTransform(c,b.x,b.y,S.feedback(k));panel(c,{x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2},1,16);icon(c,k,b.x,b.y,b.r*1.25);text(c,S.actions[k].label,b.x,b.y+b.r+19,20,'#fff','center');c.restore();}
    const j=L.move;image(c,'joystick',j.x-j.r,j.y-j.r,j.r*2,j.r*2);
    c.save();c.strokeStyle=S.p.running?'#ffe09a':'#b5aac9';c.globalAlpha=S.p.running?.9:.45;c.lineWidth=S.p.running?4:2;
    c.beginPath();c.arc(j.x,j.y,j.r*.72,0,Math.PI*2);c.stroke();c.restore();
    const tr=j.r*.34,power=Math.hypot(S.touch.moveX,S.touch.moveY),travel=power?j.r*.72*(.12+.88*power)/power:0;
    image(c,'thumb',j.x+S.touch.moveX*travel-tr,j.y+S.touch.moveY*travel-tr,tr*2,tr*2);
    text(c,S.p.running?'奔跑':S.p.exh?'恢复耐力':S.touch.moveId!==null?'走路':'外圈奔跑',j.x,j.y+j.r+22,Math.max(22,12/L.scale),S.p.running?'#ffe09a':'#f7f3ec','center');
    if(S.touch.moveId!==null)fillBar(c,{x:j.x-70,y:j.y+j.r+43,w:140,h:14},S.p.sta/100,'xp');
    for(const k of ['attack','potion','skill','roll','jump','spell','more'])action(c,L.buttons[k],S.actions[k],S.pressed(k),true,S.feedback(k),L.scale);
    const b=L.buttons.interact,data=S.actions.interact;
    if(!b.hidden){panel(c,b,1,15);icon(c,'interact',b.x+38,b.y+b.h/2,44,data.disabled?.45:1);
      text(c,data.label,b.x+72,b.y+28,Math.max(26,12/L.scale),data.disabled?'#bdb2c8':'#ffe09a','left',b.w-88);
      text(c,data.detail||'轻点交互',b.x+72,b.y+62,Math.max(22,11/L.scale),'#f7f3ec','left',b.w-88);}
    text(c,S.objective,L.w/2,L.progress.y-18,18,'#a398b3','center');fillBar(c,L.progress,S.p.xp/S.xpNeed,'xp');
    c.save();c.fillStyle='#17131ecc';for(let i=1;i<8;i++)c.fillRect(L.progress.x+L.progress.w*i/8,L.progress.y+4,3,L.progress.h-8);c.restore();
  }
  function modal(c,L,S){
    if(!S.modal)return;c.save();c.fillStyle='rgba(0,2,8,.78)';c.fillRect(0,0,L.w,L.h);panel(c,L.modal,1,28);
    text(c,S.modal.title,L.modal.x+32,L.modal.y+40,28,'#ffe09a');panel(c,L.close,1,11);text(c,'关闭',L.close.x+L.close.w/2,L.close.y+21,18,'#fff','center');
    if(S.modal.kind==='quest'){
      const lines=S.modal.lines,spacing=Math.min(40,(L.modal.h-102)/Math.max(1,lines.length)),size=Math.min(20,spacing*.78);
      lines.forEach((v,i)=>text(c,v,L.modal.x+30,L.modal.y+86+i*spacing,size,i===0?'#fff0b1':'#ddd6e9','left',L.modal.w-60));
    }else S.modal.items.forEach((data,i)=>{const b=L.modalButtons[i];panel(c,b,1,15);icon(c,data.icon,b.x+27,b.y+31,35);text(c,data.label,b.x+53,b.y+31,18,'#fff','left',b.w-64);});
    if(S.modal.kind==='settings')text(c,'图标: Lorc / Delapouite / sbed · game-icons.net · CC BY 3.0',L.modal.x+32,L.modal.y+L.modal.h-30,13,'#aca4ba');c.restore();
  }
  function draw(c,L,S){
    c.save();c.setTransform(L.scale,0,0,L.scale,L.inset.left,L.inset.top);
    if(pending){text(c,'界面素材加载中…',L.w/2,40,22,'#ddd','center');c.restore();return;}
    (L.mobile?mobile:desktop)(c,L,S);
    if(S.banner){c.save();c.globalAlpha=Math.min(1,S.banner.t);text(c,S.banner.txt,L.w/2,L.h*.23,32,'#ffe09a','center');c.restore();}
    if(S.locked)text(c,S.locked,L.w/2,L.boss.y+L.boss.h+19,18,'#ffc0a8','center');
    if(S.swapPending)text(c,'换组已排队 · 再按 X 取消',L.w/2,L.h-206,18,'#ffe09a','center');
    if(S.buffTip)text(c,S.buffTip,L.w/2,L.h-233,16,'#cda9fa','center');
    modal(c,L,S);c.restore();
  }
  window.FantasyHUD={draw,ready:()=>pending===0&&failures.length===0,failures,assets:images};
})();
