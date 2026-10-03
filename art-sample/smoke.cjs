'use strict';const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const path=require('path');process.chdir(path.join(__dirname,'..'));
function run(file,renderer,baseline=false){
 const noop=()=>{};const gradient={addColorStop:noop};const c2d=new Proxy({measureText:t=>({width:t.length*8}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(t,k)=>k in t?t[k]:noop});
 const element=()=>({style:{},classList:{toggle:noop},append:noop,appendChild:noop,addEventListener:noop,setAttribute:noop,getContext:()=>c2d,innerHTML:'',parentNode:{insertBefore:noop}});const elements={};const storage=new Map();
 const c={console,performance,URLSearchParams,location:{search:baseline?'?baseline=1':'',reload:noop},navigator:{maxTouchPoints:0,userAgent:'test'},document:{getElementById:id=>elements[id]||(elements[id]=element()),createElement:element,head:element(),body:element(),addEventListener:noop},innerWidth:1440,innerHeight:900,devicePixelRatio:1,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},addEventListener:noop,requestAnimationFrame:noop,setTimeout:noop,setInterval:noop,matchMedia:()=>({matches:false,addEventListener:noop}),MOSS_BASELINE:baseline};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync('vendor/voxel-world.js','utf8'),c);
 let w=fs.readFileSync(renderer,'utf8');w=w.replace('window.World3D =','T=window.THREE;L=window.VOXLIB;ok=true;\nwindow.World3D =');vm.runInContext(w,c);
 for(const f of ['weapon-models.js','ui-kit.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
 const h=fs.readFileSync(file,'utf8');for(const m of h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())vm.runInContext(m[1],c);
 vm.runInContext(fs.readFileSync('art-sample/preview.js','utf8'),c);
 return {grid:c.MOSS_PREVIEW.grid(),snap:c.MOSS_PREVIEW.snapshot(),storage:[...storage.keys()]};
}
const before=run('block-dungeons.html','world3d.js',true),after=run('moss-outpost.html','art-sample/world3d-moss.js');
assert.equal(JSON.stringify(after.grid),JSON.stringify(before.grid));assert.equal(JSON.stringify(after.snap),JSON.stringify(before.snap));assert(after.snap.rooms>1);console.log('PASS: real startGame/genFloor with actual decoration produce identical seeded collision grid and game state');const {webgl,...state}=after.snap;console.log(state);console.log('WebGL was stubbed, not tested');console.log('Storage writes',after.storage);
