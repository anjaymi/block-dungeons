/* Visual poses only. Attack timing, movement and hit bones stay in the game. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CombatMotion=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const records=new WeakMap(),supported=new Set(['greatsword','sickles','hammer']);
  const fields=['legR','legL','bob','lean','twist','wpR','wpL','headYaw','headPitch','headRoll','roll','rootZ','spin','cape'];
  const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const mix=(a,b,t)=>a+(b-a)*t;
  const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
  function copy(p){return {...p,armR:p.armR.slice(),armL:p.armL.slice()};}
  function blend(a,b,t){
    const p=copy(b);
    for(const k of fields){
      if(a[k]===undefined&&b[k]===undefined)continue;
      const x=a[k]||0,y=b[k]||0;
      p[k]=k==='spin'?x+angle(y-x)*t:mix(x,y,t);
    }
    for(const k of ['armR','armL'])p[k]=b[k].map((v,i)=>mix(a[k][i]||0,v,t));
    return p;
  }
  function authored(e,input,rest){
    const p=copy(input),d=e.atkDef,T=e.T;
    if(e.st!=='atk'||!d||!T)return p;
    const phase=e.ph,span=phase==='wind'?T.w:phase==='act'?T.act:T.rec;
    const t=clamp(e.pt/Math.max(.001,span));
    const u=phase==='wind'||phase==='act'?1-(1-t)*(1-t):smooth(t);
    const load=phase==='wind'?u:phase==='act'?1:1-u;
    const drive=phase==='wind'?0:phase==='act'?u:1-u;
    const hand=d.h===-1?-1:1,side=(d.s||1)*hand,heavy=e.weapon!=='sickles';
    let backR,backL,frontR,frontL;
    if(d.a==='slam'){
      backR=-.18;backL=.24;frontR=-.55;frontL=.36;
      p.bob-=.85*load;
      p.headPitch-=.12*load;
    }else if(d.a==='spin'){
      backR=-.2;backL=.2;frontR=.28;frontL=-.28;
      // Small alternating support steps follow the rotation without lifting the root.
      const step=phase==='act'?Math.sin(t*Math.PI*2)*.18:0;
      p.legR=mix(backR,frontR,drive)*load+step;
      p.legL=mix(backL,frontL,drive)*load-step;
    }else{
      backR=-side*(heavy ? .18 : .23);backL=side*(heavy ? .25 : .23);
      frontR=side*(heavy ? .44 : .38);frontL=-side*(heavy ? .32 : .3);
      p.bob-=(heavy ? .65 : .38)*load;
      // The head follows the target while the shoulders lead the cut.
      p.headYaw-=p.twist*.32;
      p.headPitch-=.06*load;
    }
    if(d.a!=='spin'){
      p.legR=mix(backR,frontR,drive)*load;
      p.legL=mix(backL,frontL,drive)*load;
    }
    if(e.weapon==='sickles'&&d.a==='slash'){
      const free=hand===1?'armL':'armR',wrist=hand===1?'wpL':'wpR';
      const guard=[-hand*.38,-1.08,-hand*.2,-.8];
      p[free]=p[free].map((v,i)=>mix(v,guard[i],load));
      p[wrist]=mix(p[wrist],-.5,load);
      p.lean-=.035*load;
    }else if(heavy){
      // The supporting hand follows the shaft rather than returning to the hip.
      const a=p.armR;
      p.armL=[a[0]-.38*load,a[1]+.12*load,-.12*load,a[3]||0];
      p.lean+=(d.a==='slam' ? -.06 : -.1)*load+(d.a==='slam' ? .1 : .17)*drive;
    }
    if(d.a==='cross'){
      p.headPitch-=.06*load;
      // Legacy thrust starts its active phase 0.07 rad below the wind-up endpoint.
      if(phase==='wind'){p.armR[1]-=.07*u;p.armL[1]-=.07*u;}
    }
    // Match the actual modeled idle/run pose before the recovery ends, including wrists.
    if(phase==='rec')return blend(p,rest,smooth((t-.35)/.65));
    return p;
  }
  function sample(e,input,rest){
    if(!supported.has(e.weapon)||typeof e.visualTime!=='number'){records.delete(e);return input;}
    const now=e.visualTime||0,active=e.st==='atk';
    const key=active?'atk:'+e.attackId+':'+(e.atkDef?.a||'')+':'+(e.atkDef?.h||1):e.st;
    let r=records.get(e);
    if(r&&(r.weapon!==e.weapon||now<r.time)){records.delete(e);r=null;}
    if(r&&r.time===now&&r.key===key)return copy(r.pose);
    let p=authored(e,input,rest),transition=r?.transition||null;
    if(!r||r.key!==key){
      const entering=active&&e.ph==='wind',leaving=r?.active&&e.st==='move';
      const wind=e.T?.w||.1;
      const duration=entering ? Math.min(.055,wind*.55,Math.max(0,wind-(e.pt||0))) : leaving ? .065 : 0;
      transition=duration?{from:copy(r?.pose||rest),at:now,duration,
        attack:entering,turn:entering?angle((r?.facing??e.ang)-e.ang):0}:null;
    }
    let offset=0;
    if(transition){
      const t=transition.attack&&e.ph!=='wind' ? 1 : smooth((now-transition.at)/transition.duration);
      p=blend(transition.from,p,t);offset=t>=1?0:transition.turn*(1-t);
      if(t>=1)transition=null;
    }
    p.facingOffset=offset;
    records.set(e,{key,weapon:e.weapon,active,time:now,pose:copy(p),transition,facing:e.ang+offset});
    return p;
  }
  return Object.freeze({sample});
});
