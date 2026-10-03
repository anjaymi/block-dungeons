'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const path=require('path');process.chdir(path.join(__dirname,'..'));
const vendor=fs.readFileSync('vendor/voxel-world.js','utf8');
const base=fs.readFileSync('block-dungeons.html','utf8'),sample=fs.readFileSync('moss-outpost.html','utf8');
for(const file of ['moss-outpost.html'])for(const m of fs.readFileSync(file,'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('PASS: generated inline JS parses');
const coreNames=['startGame','genFloor','spawnWave','setGates','moveInput','startAttack','startRoll','startCast','startBow','recalc'];
function body(s,n){const start=s.indexOf('function '+n+'(');assert(start>=0,n);const next=s.indexOf('\nfunction ',start+1);return s.slice(start,next<0?undefined:next);}
for(const n of coreNames)assert.equal(body(sample,n),body(base,n),n);
console.log('PASS: '+coreNames.length+' core gameplay sections identical');
assert(!/(?<!moss_sample_)bd_(?:zoom|lastpick|weapon_style|rawskin|hidevis)'/.test(sample));
const original=fs.readFileSync('world3d.js','utf8'),changed=fs.readFileSync('art-sample/world3d-moss.js','utf8');
assert.equal(body(changed,'decorate').replace('  sampleRoom = o.rooms[0];\n',''),body(original,'decorate'));
console.log('PASS: decoration grid mutation identical');
const context={console,performance,window:{},setTimeout:()=>0};context.window=context;vm.createContext(context);vm.runInContext(vendor,context);
const exposed=changed.replace('window.World3D =', 'window.__sampleTest={initCPU(){T=window.THREE;L=window.VOXLIB;},floor:mossFloorParts,wall:wallParts};\nwindow.World3D =');
vm.runInContext(exposed,context);context.__sampleTest.initCPU();let geometries=0,vertices=0;
for(const type of ['path','edge','stone'])for(const seed of [7,8,9]){
 const p=context.__sampleTest.floor(type,seed);assert(p.parts.length>0);for(const {geo} of p.parts){for(const a of ['position','normal','color']){assert(geo.attributes[a]);assert([...geo.attributes[a].array].every(Number.isFinite));}vertices+=geo.attributes.position.count;geometries++;}assert(p.maxZ<=.2);}
for(let k=0;k<6;k++){const p=context.__sampleTest.wall('moss',k);assert(p.parts.length>0);assert(p.maxZ>1);assert(p.maxZ<2);for(const {geo} of p.parts)assert([...geo.attributes.position.array].every(Number.isFinite));}
console.log(`PASS: 9 floor variants / 6 wall variants, ${geometries} floor meshes, ${vertices} vertices are finite and bounded`);
