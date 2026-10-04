(function(){
  const images={},errors=[];
  const files={title:'assets/inventory/title-frame.png',plinth:'assets/inventory/character-plinth.png',slot:'assets/inventory/slot-frame.png',panel:'assets/hud/panel-frame.png',gold:'assets/inventory/gold-button.png'};
  const icons=['helm','amulet','armor','gloves','belt','ring','close','salvage','sort','emerald','cube','appearance','stats','blocked','weapon','hp','mana','str','dex'];
  let pending=0;
  function load(key,url){const im=new Image();pending++;im.onload=()=>{images[key]=im;pending--;};im.onerror=()=>{pending--;errors.push(url);console.error('Inventory asset failed:',url);};im.src=url;}
  Object.entries(files).forEach(([k,url])=>load(k,url));
  icons.forEach(k=>load(k,'assets/inventory/icons/'+k+'.png'));
  for(const [k,n]of Object.entries({scroll:'quest',vit:'shield',ene:'skill',boot:'boot',eye:'interact'}))load(k,'assets/hud/icons/'+n+'.png');
  function image(key,b,alpha=1,crop){const im=images[key];if(!im)return;ctx.save();ctx.globalAlpha*=alpha;ctx.imageSmoothingEnabled=true;if(crop)ctx.drawImage(im,...crop,b.x,b.y,b.w,b.h);else ctx.drawImage(im,b.x,b.y,b.w,b.h);ctx.restore();}
  function slice(key,b,edge=10){
    const im=images[key];if(!im)return;
    const crop=key==='slot'?[80,96,1094,1063]:key==='gold'?[25,82,1998,602]:key==='panel'?[10,29,1564,934]:[0,0,im.naturalWidth||im.width,im.naturalHeight||im.height];
    const [cx,cy,sw,sh]=crop,sx=sw*(key==='panel'?.075:key==='gold'?.05:.07),sy=sh*(key==='panel'?.14:key==='gold'?.16:.07),d=Math.min(edge,b.w/3,b.h/3);
    const xs=[cx,cx+sx,cx+sw-sx,cx+sw],ys=[cy,cy+sy,cy+sh-sy,cy+sh],dx=[b.x,b.x+d,b.x+b.w-d,b.x+b.w],dy=[b.y,b.y+d,b.y+b.h-d,b.y+b.h];
    for(let r=0;r<3;r++)for(let c=0;c<3;c++)ctx.drawImage(im,xs[c],ys[r],xs[c+1]-xs[c],ys[r+1]-ys[r],dx[c],dy[r],dx[c+1]-dx[c],dy[r+1]-dy[r]);
  }
  function text(s,x,y,size=16,col='#eee9e4',align='left',maxWidth){
    ctx.save();ctx.font=`700 ${size}px "Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif`;ctx.fillStyle=col;ctx.textAlign=align;ctx.textBaseline='middle';
    if(maxWidth)ctx.fillText(String(s),x,y,maxWidth);else ctx.fillText(String(s),x,y);ctx.restore();
  }
  function icon(key,x,y,size=26,alpha=1){image(key,{x:x-size/2,y:y-size/2,w:size,h:size},alpha);}
  function button(b,label,key,active=false,disabled=false){ctx.save();const press=disabled?0:UIMotion.amount(UIMotion.inventoryKey(b)),scale=UIMotion.reduced()?1:1-.03*press;
    ctx.translate(b.x+b.w/2,b.y+b.h/2+(UIMotion.reduced()?0:1.5*press));ctx.scale(scale,scale);ctx.translate(-b.x-b.w/2,-b.y-b.h/2);
    ctx.globalAlpha*=disabled?.42:1;slice(active?'gold':'panel',b,9);const sz=b.h<48?15:18;
    if(press>0){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha*=press*.18;slice('gold',b,9);ctx.restore();}
    if(key){icon(key,b.x+22,b.y+b.h/2,25);text(label,b.x+42,b.y+b.h/2,sz,active?'#251908':'#f1ebe6','left',b.w-48);}
    else text(label,b.x+b.w/2,b.y+b.h/2,sz,active?'#251908':'#f1ebe6','center',b.w-12);ctx.restore();}
  window.InventoryAssets={image,slice,text,icon,button,ready:()=>pending===0&&errors.length===0,errors};
})();
