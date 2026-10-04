// Shared scene art rules. Pure sampling keeps terrain, actors and QA in one space.
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=(x,y,s=0)=>{let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s|0,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
function noise(x,y,s){
  const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,a=u*u*(3-2*u),b=v*v*(3-2*v);
  return (hash(i,j,s)*(1-a)+hash(i+1,j,s)*a)*(1-b)+(hash(i,j+1,s)*(1-a)+hash(i+1,j+1,s)*a)*b;
}
const floor=(m,x,y)=>x>=0&&y>=0&&x<m.GW&&y<m.GH&&m.G[y*m.GW+x]===1;
const sides=[[-1,0],[1,0],[0,-1],[0,1]];
function edges(m,i,j){return sides.map(([x,y])=>!floor(m,i+x,j+y));}
function footprintClear(m,x,y,r){
  for(let j=Math.floor(y-r);j<=Math.floor(y+r);j++)for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++)if(!floor(m,i,j))return false;
  return true;
}
function mossPatches(m,i,j,seed=37,density=.85){
  if(!floor(m,i,j))return [];
  const edge=edges(m,i,j),result=[];
  // A one-tile corridor stays bare. Closed gates and the exit also stay clear.
  if((edge[0]&&edge[1])||(edge[2]&&edge[3]))return result;
  const cluster=noise(i/3.8,j/3.8,seed+4);
  for(let side=0;side<4;side++)if(edge[side])for(let n=0;n<2;n++){
    const key=side*2+n,r=.13+hash(i,j,seed+80+key)*.09;
    const along=.25+n*.5+(hash(i,j,seed+20+key)-.5)*.12;
    const inset=r+.035+hash(i,j,seed+40+key)*.045;
    const x=i+(side===0?inset:side===1?1-inset:along);
    const y=j+(side===2?inset:side===3?1-inset:along);
    const weight=clamp((cluster-.22)*1.8,0,.92);
    if(hash(i,j,seed+60+key)>=clamp(density,0,1)*weight||!footprintClear(m,x,y,r))continue;
    if(m.exitPos&&Math.hypot(x-m.exitPos.x,y-m.exitPos.y)<1.15+r)continue;
    result.push({id:`${i}:${j}:${side}:${n}`,x,y,r,yaw:hash(i,j,seed+100+key)*Math.PI*2,variant:Math.floor(hash(i,j,seed+120+key)*3)});
  }
  return result;
}
function floorSurface(m,i,j,seed=37){
  return {i,j,edge:edges(m,i,j),variation:.94+noise(i/4,j/4,seed+9)*.09};
}
function floorShade(surface,x,y){
  const dx=clamp(x-surface.i,0,1),dy=clamp(y-surface.j,0,1),dist=[dx,1-dx,dy,1-dy];
  let occlusion=0;
  for(let k=0;k<4;k++)if(surface.edge[k])occlusion+=Math.pow(1-clamp(dist[k]*2.7,0,1),2)*.20;
  const value=surface.variation*clamp(1-occlusion,.65,1);
  return [value*.97,value*.99,value*1.025];
}
const palettes={
  '苔石地牢':{cool:'#9bb8df',warm:'#ffc17d'},
  '幽深矿井':{cool:'#b0a7b9',warm:'#ffb976'},
  '冰封洞窟':{cool:'#a8ceff',warm:'#ffd3a0'},
  '下界要塞':{cool:'#cb9dac',warm:'#ff9261'},
  '沙海遗迹':{cool:'#c1c4ce',warm:'#ffd79e'}
};
function actorLights({theme,torches=[],glows=[],cam,time=0}){
  const colors=palettes[theme]||palettes['苔石地牢'];
  const lights=torches.filter(t=>Math.hypot(t.x-cam.x,t.y-cam.y)<20)
    .sort((a,b)=>Math.hypot(a.x-cam.x,a.y-cam.y)-Math.hypot(b.x-cam.x,b.y-cam.y)).slice(0,8)
    .map(t=>({x:t.x,y:t.y,z:1.15,power:.92+.08*Math.sin(time*3.1+(t.ph||0))}));
  const flashes=glows.map(g=>{
    const life=(g.gold||g.frost) ? .8 : g.red ? .45 : .22;
    return {x:g.x,y:g.y,z:.9,range:clamp(g.r*1.8,1.2,4),power:Math.pow(clamp(1-g.t/life,0,1),2)*.75,
      color:g.frost?'#a8dcff':g.heal?'#8dffc1':g.gold?'#ffe7a2':'#ffae78'};
  }).filter(g=>g.power>0&&Math.hypot(g.x-cam.x,g.y-cam.y)<16)
    .sort((a,b)=>Math.hypot(a.x-cam.x,a.y-cam.y)-Math.hypot(b.x-cam.x,b.y-cam.y)).slice(0,3);
  return {colors,lights,flashes};
}
function sampleActor(e,field,visible=()=>true){
  const warm=[0,0,0];let energy=0;
  for(const t of field.lights){
    const dx=t.x-e.x,dy=t.y-e.y,dz=t.z-(e.z||0)-.55,d=Math.hypot(dx,dy,dz);
    if(d>=5.5||!visible(e,t))continue;
    const strength=Math.pow(1-d/5.5,2)*t.power;
    warm[0]+=dx/(d||1)*strength;warm[1]+=dy/(d||1)*strength;warm[2]+=dz/(d||1)*strength;energy+=strength;
  }
  let strongest=0,color=field.colors.warm;
  for(const f of field.flashes||[]){
    const dx=f.x-e.x,dy=f.y-e.y,dz=f.z-(e.z||0)-.55,d=Math.hypot(dx,dy,dz);
    if(d>=f.range||!visible(e,f))continue;
    const strength=Math.pow(1-d/f.range,2)*f.power;
    warm[0]+=dx/(d||1)*strength;warm[1]+=dy/(d||1)*strength;warm[2]+=dz/(d||1)*strength;energy+=strength;
    if(strength>strongest&&strength>.10){strongest=strength;color=f.color;}
  }
  return {colors:color===field.colors.warm?field.colors:{...field.colors,warm:color},warm,energy:Math.min(1.2,energy)};
}
function faceLight(light,nx,ny,nz,metal=false){
  const diffuse=clamp(nx*light.warm[0]+ny*light.warm[1]+nz*light.warm[2],0,1);
  const warm=clamp(diffuse+.20*light.energy,0,1);
  const facing=clamp(-nx*.34-ny*.45+nz*.82,0,1);
  return {gain:.90+.09*facing+.30*warm+(metal?.18*Math.pow(facing,12):0),
    tone:warm>.15?light.colors.warm:light.colors.cool,amount:warm>.15?Math.min(.30,warm*.34):.09*(1-facing*.55)};
}
const api=Object.freeze({mossPatches,floorSurface,floorShade,actorLights,sampleActor,faceLight});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.SceneStyle=api;
})(typeof window==='object'?window:globalThis);
