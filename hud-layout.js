(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.HUDLayout=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const rect=(x,y,w,h,action)=>({x,y,w,h,action});
  const circle=(x,y,r,action)=>({x,y,r,action});
  function layout(width,height,mobile=false,safe={}){
    const inset={left:safe.left||0,right:safe.right||0,top:safe.top||0,bottom:safe.bottom||0};
    const availableW=width-inset.left-inset.right, availableH=height-inset.top-inset.bottom;
    const scale=Math.min(availableW/1672,availableH/941);
    // On phones keep combat buttons large enough to operate with a thumb.
    const s=mobile?Math.max(Math.min(.5,availableW/780),scale):scale;
    const w=availableW/s,h=availableH/s;
    const L={scale:s,w,h,inset,mobile,buttons:{},aux:[],hotbar:[],buffs:[]};
    const B=L.buttons;
    if(mobile){
      L.vitals=rect(20,20,444,140); L.portrait=rect(18,12,142,142);
      L.info=rect(24,164,320,78); L.map=rect(w-234,20,214,220,'map');
      const ur=Math.max(34,22/s),gap=Math.max(86,ur*2+8),start=L.map.x-30-ur-gap*2;
      B.bag=circle(start,72,ur,'bag'); B.quest=circle(start+gap,72,ur,'quest'); B.settings=circle(start+gap*2,72,ur,'settings');
      L.move=circle(210,h-280,145); L.aim=circle(w-216,h-202,94);
      L.map.h=Math.min(220,Math.max(140,h-460));
      B.attack=circle(w-190,h-212,82,'attack'); B.roll=circle(w-355,h-209,56,'roll');
      B.jump=circle(w-63,h-307,56,'jump'); B.skill=circle(w-199,h-367,58,'skill');
      B.spell=circle(w-346,h-324,56,'spell'); B.potion=circle(w-485,h-258,56,'potion');
      B.more=circle(w-497,h-398,Math.max(44,22/s),'more');
      B.interact=rect(w-364,h-16-Math.max(88,44/s),344,Math.max(88,44/s),'interact'); L.aim=B.attack;
      L.progress=rect(w/2-205,h-62,410,18);
      L.boss=rect(w/2-Math.min(338,(w-1020)/2),0,Math.min(676,w-1020),145);
    }else{
      L.info=rect(18,12,418,150,'quest'); L.floor=rect(18,12,78,150);
      L.map=rect(w-350,14,334,224,'map');
      L.vitals=rect(46,h-163,635,137); L.portrait=rect(46,h-212,218,208);
      L.boss=rect(w/2-Math.min(327,(w-820)/2),0,Math.min(654,w-820),137);
      L.hotbarFrame=rect(w-924,h-151,704,130);
      const defs=[['skill','Q'],['potion','E'],['spell','R'],['art0','1'],['art1','2'],['art2','3'],['jump','Space']];
      defs.forEach(([action,key],i)=>L.hotbar.push({...rect(w-906+i*97,h-121,83,91,action),key}));
      ['bow','roll','swap','bag'].forEach((action,i)=>L.aux.push({...rect(w-906+i*109,h-185,99,29,action),key:['右键','Shift','X','I'][i]}));
      L.progress=rect(296,h-38,352,5);
      B.settings=rect(w-186,h-65,164,42,'settings');
      for(let i=0;i<6;i++)L.buffs.push(rect(15,226+i*70,80,80));
      L.combo=rect(13,647,84,109);
    }
    // A portrait phone keeps top cards compact and places actions in two bottom rows.
    if(mobile && availableH>availableW){
      const ur=Math.max(44,22/s),gap=ur*2+8,right=w-ur-8;
      L.vitals=rect(14,12,Math.min(444,w-ur*6-64),140); L.portrait=rect(12,4,142,142);
      L.map=rect(w-204,172,188,172,'map'); L.info=rect(24,164,w-244,78);
      B.bag=circle(right-gap*2,64,ur,'bag'); B.quest=circle(right-gap,64,ur,'quest'); B.settings=circle(right,64,ur,'settings');
      L.move=circle(152,h-202,124);
      B.attack=circle(w-130,h-214,80,'attack'); B.roll=circle(w-292,h-214,56,'roll');
      B.jump=circle(w-66,h-408,56,'jump'); B.skill=circle(w-213,h-408,56,'skill');
      B.spell=circle(w-359,h-408,56,'spell'); B.potion=circle(w-504,h-408,56,'potion');
      B.more=circle(80,h-408,Math.max(44,22/s),'more'); L.aim=B.attack;
      B.interact=rect(w-364,h-16-Math.max(88,44/s),344,Math.max(88,44/s),'interact');
      L.progress=rect(w/2-165,h-490,330,12);
      L.boss=rect(20,346,w-40,Math.min(140,(w-40)*.21));
    }
    L.boss.w=Math.max(180,L.boss.w);
    L.modal=rect(w/2-310,h/2-205,620,410);
    L.close=rect(L.modal.x+L.modal.w-78,L.modal.y+20,55,42,'close');
    L.modalButtons=[0,1,2,3,4,5,6,7,8].map(i=>rect(L.modal.x+30+(i%3)*190,L.modal.y+112+Math.floor(i/3)*78,178,62));
    return L;
  }
  function contains(b,x,y,pad=0){
    return b.r!==undefined?Math.hypot(x-b.x,y-b.y)<=b.r+pad:x>=b.x-pad&&x<=b.x+b.w+pad&&y>=b.y-pad&&y<=b.y+b.h+pad;
  }
  function hit(L,x,y){
    for(const b of [...Object.values(L.buttons),...L.hotbar,...L.aux])if(!b.hidden&&contains(b,x,y))return b.action;
    if(contains(L.map,x,y))return 'map';
    if(!L.mobile && contains(L.info,x,y))return 'quest';
    return null;
  }
  function point(L,x,y){return {x:(x-L.inset.left)/L.scale,y:(y-L.inset.top)/L.scale};}
  return {layout,contains,hit,point};
});
