(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.InventoryLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const rect=(x,y,w,h,kind,extra={})=>({x,y,w,h,kind,...extra});
  const contains=(b,x,y)=>!!b&&x>=b.x&&y>=b.y&&x<b.x+b.w&&y<b.y+b.h;
  function layout(width,height,mobile=false,safe={},view={}){
    const sl=safe.left||0,sr=safe.right||0,st=safe.top||0,sb=safe.bottom||0;
    const aw=width-sl-sr,ah=height-st-sb,fw=Math.min(1280,aw-(mobile?16:36)),fh=Math.min(mobile?1120:1040,ah-(mobile?16:64));
    const F=rect(sl+(aw-fw)/2,st+(ah-fh)/2,fw,fh),compact=mobile&&aw<780;
    const header=mobile?44:ah>900?84:60,footer=compact?0:mobile?44:52,pad=mobile?8:26,gap=mobile?10:16;
    const L={width,height,mobile,compact,tight:mobile&&compact&&ah<480,frame:F,controls:[],slots:{},tabs:[],view:view.pane||'bag'};
    const add=(b)=>{L.controls.push(b);return b;};
    L.close=add(rect(F.x+F.w-52,F.y+4,44,44,'close'));
    L.title=rect(F.x+F.w/2-(mobile?142:250),F.y-(mobile?12:36),mobile?284:500,mobile?60:104);
    let by=F.y+header,bh=F.h-header-footer-pad;
    if(compact){
      const tw=(F.w-2*pad)/3;
      ['gear','bag','cube'].forEach((pane,i)=>L.tabs.push(add(rect(F.x+pad+i*tw,by,tw-4,44,'pane',{pane}))));
      by+=48;bh-=48;
    }
    const body=rect(F.x+pad,by,F.w-2*pad,bh);
    if(!compact){
      const rw=mobile?464:Math.floor(body.w*.485),lw=body.w-rw-gap;
      L.gear=rect(body.x,by,lw,bh);L.bag=rect(body.x+lw+gap,by,rw,mobile?bh:Math.min(bh,Math.max(352,bh*.48)));
      if(!mobile)L.craft=rect(L.bag.x,L.bag.y+L.bag.h+12,rw,Math.min(208,bh-L.bag.h-12));
      if(mobile)L.cubeToggle=add(rect(body.x,F.y+F.h-44,Math.max(170,body.w*.54),44,'drawer',{drawer:'cube'}));
      L.setToggle=add(rect(mobile?body.x+body.w*.55:body.x,F.y+F.h-(mobile?44:52),mobile?body.w*.45:body.w,44,'drawer',{drawer:'sets'}));
    }else{
      if(L.view==='gear')L.gear=body;
      if(L.view==='cube')L.craft=body;
      if(L.view==='bag')L.bag=body;
    }
    if(L.gear){
      const B=L.gear,top=B.y+(L.tight?12:mobile?39:90),foot=mobile?48:190;
      const gh=B.h-(top-B.y)-foot,s=mobile?44:Math.min(78,Math.max(48,(gh-18)/4)),g=mobile?4:8;
      const right=B.x+B.w-2*s-g-10,left=B.x+10;
      L.swap=[0,1].map((set,i)=>add(rect(left+i*(s+g),top,s,mobile?44:34,'swap',{set})));
      L.slots.weapon=add(rect(left,top+(mobile?48:40),s,s*2,'slot',{slot:'weapon'}));
      L.slots.offhand=add(rect(left,top+(mobile?140:48+s*2),s,s,'slot',{slot:'offhand'}));
      ['helm','amulet','armor','gloves','belt','boots','ring1','ring2'].forEach((slot,i)=>L.slots[slot]=add(rect(right+(i%2)*(s+g),top+Math.floor(i/2)*(s+g),s,s,'slot',{slot})));
      const hw=Math.max(48,B.w*(mobile?.82:.73)),hx=B.x+(B.w-hw)/2,hh=Math.max(90,gh-24);
      L.hero=rect(hx,top+10,hw,hh);
      const abw=Math.min(mobile?124:174,hw);
      L.appearance=add(rect(B.x+B.w/2-abw/2,top+gh-42,abw,44,'drawer',{drawer:'appearance'}));
      L.summary=rect(B.x+10,B.y+B.h-foot,B.w-20,foot);
      L.stats=add(rect(mobile?B.x+10:B.x+B.w-160,B.y+B.h-44,mobile?80:150,44,'drawer',{drawer:'stats'}));
    }
    if(L.bag){
      const B=L.bag,cols=mobile&&aw<480?5:10,colStart=cols===5?(view.bagPage||0)*5:0;
      const cell=mobile?44:Math.min(54,(B.w-28)/10);
      const gx=B.x+(B.w-cell*cols)/2,gy=B.y+(L.tight?8:cols===5?48:mobile?28:56);
      L.grid=rect(gx,gy,cell*cols,cell*4,'grid',{cell,cols,colStart});
      if(cols===5)L.page=add(rect(B.x+B.w-104,B.y+2,96,44,'page'));
      L.currency=rect(B.x+12,gy+cell*4+3,B.w-24,22);
      const buttonsY=Math.max(L.currency.y+24,B.y+B.h-(mobile?50:64)),bw=(B.w-24-12)/3;
      L.bagActions=['idall','junk','sort'].map((kind,i)=>add(rect(B.x+12+i*(bw+6),buttonsY,bw,mobile?44:52,kind)));
    }
    if(L.craft){
      const B=L.craft,stacked=mobile&&aw<480,cs=mobile?(stacked?Math.min(64,(B.w-42)/4):52):Math.min(96,(B.w-150)/4),cy=B.y+52;
      L.cube=Array.from({length:4},(_,i)=>add(rect(B.x+12+i*(cs+6),cy,cs,cs,'cube',{i})));
      L.transmute=add(stacked?rect(B.x+12,cy+cs+12,B.w-24,44,'transmute'):rect(B.x+B.w-112,cy,100,Math.max(44,cs),'transmute'));
      L.recipes=add(rect(B.x+B.w-110,B.y+4,98,44,'drawer',{drawer:'recipes'}));
    }
    return L;
  }
  function hit(L,x,y){
    for(let i=L.controls.length-1;i>=0;i--)if(contains(L.controls[i],x,y))return L.controls[i];
    if(contains(L.grid,x,y)){const b=L.grid;return {kind:'grid',cx:b.colStart+Math.floor((x-b.x)/b.cell),cy:Math.floor((y-b.y)/b.cell)};}
    return null;
  }
  return {layout,hit,contains,rect};
});
