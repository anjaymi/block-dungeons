(function(root){
  // Frame-driven feedback: retarget from the current value; never delay an action.
  const tracks=new Map(),buttons=new Map(),owners=new Map();
  const preference=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
  const now=()=>performance.now(),reduced=()=>!!preference?.matches;
  const curve=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
  function ease(t){
    if(t<=0)return 0;if(t>=1)return 1;
    let lo=0,hi=1;for(let i=0;i<14;i++){const m=(lo+hi)/2;if(curve(m,.23,.32)<t)lo=m;else hi=m;}
    return curve((lo+hi)/2,1,1);
  }
  function tween(from,to,start,duration,t=now()){return duration<=0?to:from+(to-from)*ease((t-start)/duration);}
  function value(key,t=now()){const q=tracks.get(key);return q?tween(q.from,q.to,q.start,q.duration,t):0;}
  function to(key,target,duration){
    const q=tracks.get(key);if(q?.to===target)return;
    const from=value(key);tracks.set(key,{from,to:target,start:now(),duration:(reduced()?Math.min(120,duration):duration)*Math.abs(target-from)});
  }
  function view(width,height){
    const opacity=value('inventory'),scale=reduced()?1:.96+.04*opacity,dy=reduced()?0:8*(1-opacity);
    return {opacity,scale,x:width*(1-scale)/2,y:height*(1-scale)/2+dy};
  }
  function point(x,y,width,height){const v=view(width,height);return {x:(x-v.x)/v.scale,y:(y-v.y)/v.scale};}
  function amount(key,t=now()){
    const b=buttons.get(key);if(!b)return 0;
    const down=tween(b.from,1,b.start,80,t);
    if(b.up===null||t<b.up)return down;
    const pressed=tween(b.from,1,b.start,80,b.up),v=tween(pressed,0,b.up,reduced()?100:160,t);
    if(v<=0){buttons.delete(key);return 0;}return v;
  }
  function down(key,owner){
    if(!key||owners.get(owner)===key)return;
    up(owner,true);const from=amount(key);let b=buttons.get(key);
    if(!b||b.up!==null){b={from,start:now(),up:null,owners:new Set()};buttons.set(key,b);}
    b.owners.add(owner);owners.set(owner,key);
  }
  function up(owner,cancel=false){
    const key=owners.get(owner);if(!key)return;owners.delete(owner);const b=buttons.get(key);if(!b)return;
    b.owners.delete(owner);if(!b.owners.size)b.up=cancel?now():Math.max(now(),b.start+80);
  }
  function pulse(key){const owner='pulse:'+key;down(key,owner);up(owner);}
  function sync(key,pressed){const owner='live:'+key;if(pressed)down(key,owner);else up(owner);}
  function releaseAll(){for(const owner of [...owners.keys()])up(owner,true);}
  const inventoryKey=b=>b?.kind&&!['grid','slot','cube','drawerBody'].includes(b.kind)?'bag:'+b.kind+':'+(b.drawer??b.pane??b.set??b.slot??b.i??b.delta??''):null;
  root.UIMotion={value,to,view,point,amount,down,up,pulse,sync,releaseAll,inventoryKey,reduced};
})(typeof globalThis!=='undefined'?globalThis:this);
