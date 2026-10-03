'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../weapon-gameplay.js');
const source = fs.readFileSync(path.join(__dirname,'../weapon-gameplay.js'),'utf8');
const sample = overrides => ({identity:1,weapon:'greatsword',play:true,grounded:true,special:false,st:'atk',ph:'rec',combo:1,held:false,...overrides});

test('holding normal attack never arms a branch',()=>{const g=new C.BranchGate();for(let i=0;i<120;i++)g.observe(sample({held:true}),1/120);assert.equal(g.ready,false);g.press();assert.equal(g.consume(),false);});
test('release must last 140ms and then needs a new press',()=>{const g=new C.BranchGate();g.observe(sample(),0.13);assert.equal(g.ready,false);g.observe(sample(),0.02);assert.equal(g.ready,true);assert.equal(g.consume(),false);g.observe(sample(),0.15);g.press();assert.equal(g.consume(),true);assert.equal(g.consume(),false);});
test('rapid clicks do not accumulate released time',()=>{const g=new C.BranchGate();for(let i=0;i<4;i++){g.observe(sample(),0.08);g.observe(sample({held:true}),0.01);}assert.equal(g.ready,false);});
test('held rising edge after a real pause requests branch',()=>{const g=new C.BranchGate();g.observe(sample(),0.16);g.observe(sample({held:true}),0.008);assert.equal(g.consume(),true);});
test('window expires without rearming on the same node',()=>{const g=new C.BranchGate();g.observe(sample(),0.86);g.observe(sample(),0.2);g.press();assert.equal(g.consume(),false);});
for(const [name,delta] of Object.entries({switch:{identity:2},roll:{st:'roll'},air:{grounded:false},pause:{play:false},special:{special:true},weapon:{weapon:'staff'},newAttack:{ph:'wind'}})) {
  test('clears prepared branch on '+name,()=>{const g=new C.BranchGate();g.observe(sample(),0.15);g.observe(sample(delta),0.001);assert.equal(g.ready,false);});
}
test('zero time cannot arm; invalid dt resets',()=>{const g=new C.BranchGate();g.observe(sample(),0);assert.equal(g.ready,false);g.observe(sample(),0.15);g.observe(sample(),NaN);assert.equal(g.ready,false);});
const mob=(x,y,extra={})=>({x,y,r:0.3,hp:100,type:'zombie',mass:1,scale:1,z:0,...extra});
test('corridor selects the first enemy, including an immovable blocker',()=>{const heavy=mob(2,0,{boss:true}),other=mob(3,0);assert.equal(C.corridorTarget({x:0,y:0},0,4,0.2,[other,heavy],()=>true),heavy);});
test('corridor excludes dead, nonfinite, behind and occluded enemies',()=>{const a=mob(2,0),others=[mob(-1,0),mob(1,0,{hp:NaN}),mob(1,0,{hp:0}),mob(1,2),mob(1,0,{hidden:true}),a];assert.equal(C.corridorTarget({x:0,y:0},0,4,0.2,others,(_,m)=>!m.hidden),a);});
test('swept circle cannot tunnel through a tile wall',()=>{const m=mob(0.5,0.5),wall=(x,y)=>x>=2&&x<3;const r=C.sweep(m,5,0,wall,[]);assert.equal(r.reason,'wall');assert(m.x<=1.7+1e-8);assert(m.x>1.6);});
test('circle collision handles a diagonal tile corner',()=>{assert.equal(C.circleBlocked(0.8,0.8,0.3,(x,y)=>x>=1&&y>=1),true);assert.equal(C.circleBlocked(0.7,0.7,0.3,(x,y)=>x>=1&&y>=1),false);});
test('sweep collides with first body and does not move the other body',()=>{const m=mob(0,0),o=mob(1,0);const r=C.sweep(m,2,0,()=>false,[o]);assert.equal(r.other,o);assert(m.x<=0.42);assert.equal(o.x,1);});
test('sweep separates a preexisting overlap without deepening it',()=>{const m=mob(0.2,0),o=mob(0,0);assert.equal(C.sweep(m,1,0,()=>false,[o]).reason,null);const n=mob(0.2,0);assert.equal(C.sweep(n,-0.1,0,()=>false,[o]).reason,'body');});
test('sweep rejects nonfinite or unbounded displacements',()=>{assert.equal(C.sweep(mob(0,0),NaN,0,()=>false,[]).reason,'invalid');assert.equal(C.sweep(mob(0,0),100,0,()=>false,[]).reason,'invalid');});
for(const [name,extra] of Object.entries({boss:{boss:true},heavy:{mass:4},golem:{type:'golem'},treant:{type:'treant'},teleporter:{type:'enderman'},ghost:{type:'wraith'},air:{z:1}}))test('cannot pull or launch '+name,()=>assert.equal(C.movable(mob(0,0,extra)),false));
test('ordinary ground enemy can be displaced',()=>assert.equal(C.movable(mob(0,0)),true));

// Contract harness, NOT a full game/renderer test. The adapter is run unchanged
// in a classic-script realm; baseline hooks are narrow, explicit test doubles.
function game(kind='greatsword') {
  const events={},docEvents={},damage=[];
  const W={};for(const [k,n] of [['greatsword',4],['sickles',5],['hammer',3],['sword',3]])W[k]={kind:k,combo:Array.from({length:n},()=>({w:0.1,act:0.1,rec:0.3,m:1,kb:2})),ranged:false};
  const p={x:1.5,y:1.5,r:0.3,hp:100,z:0,st:'atk',ph:'rec',pt:0.16,combo:1,weapon:kind,eq:{weapon:{uid:1}},atkDef:W[kind].combo[1],T:{w:0.1,act:0.1,rec:0.3},atkAng:0,ang:0,hitSet:new Set(),rageT:0,mvx:0,mvy:0};
  const s={console,WEAPONS:W,player:p,mouse:{l:false},state:'play',floorN:1,mobs:[],crates:[],chests:[],rings:[],streaks:[],shake:0,hitStop:0,
    wallAt:()=>false,los:()=>true,grounded:()=>p.z===0,atkSpeed:()=>1,rollWDmg:()=>10,L:()=>0,weaponReach:()=>2,computeAim:()=>({ang:0}),addText:()=>{},
    damageMob:(m,d,a,k,poise,crit,heavy)=>{damage.push({m,d});m.hp-=d;if(poise>0){m.st='stun';m.vx=3;}},
    meleeHit:m=>{s.damageMob(m,10*p.atkDef.m,0,0,5,false,false);},
    breakCrate:c=>{c.dead=true;},openChest:c=>{c.open=true;},
    startAttack(){p.st='atk';p.ph='wind';p.pt=0;p.combo=(p.combo+1)%W[p.weapon].combo.length;p.atkDef=W[p.weapon].combo[p.combo];p.T={w:0.1,act:0.1,rec:0.3};p.hitSet=new Set();},
    canAttack:()=>p.st==='move'||(p.st==='atk'&&p.ph==='rec'),stepPlayer:()=>{},bladeHits(){s.normalHits=(s.normalHits||0)+1;},onActEnd(){s.normalEnds=(s.normalEnds||0)+1;},
    stepMob(m,dt){m.t=(m.t||0)+dt;s.mobTicks=(s.mobTicks||0)+1;},playerPose:()=>({}),swapWeapons(){s.swaps=(s.swaps||0)+1;},touchAction(){s.touchCalls=(s.touchCalls||0)+1;},
    addEventListener:(k,f)=>{(events[k]??=[]).push(f);},document:{hidden:false,addEventListener:(k,f)=>{docEvents[k]=f;}}
  };
  s.window=s;vm.createContext(s);vm.runInContext(source,s,{filename:'weapon-gameplay.js'});
  s.events=events;s.damage=damage;
  s.arm=()=>{p.st='atk';p.ph='rec';p.combo=1;p.atkDef=W[p.weapon].combo[1];p.pt=0.16;s.mouse.l=false;s.stepPlayer(0.15);assert.equal(s.WeaponGameplay.status().ready,true);events.mousedown.forEach(f=>f({button:0}));s.startAttack();};
  s.strike=()=>{p.ph='act';p.pt=p.T.act*0.8;s.bladeHits([],[]);};
  return s;
}
test('adapter installs once and keeps normal attacks on baseline',()=>{const s=game('sword');s.startAttack();s.bladeHits([],[]);s.onActEnd();vm.runInContext(source,s);assert.equal(s.normalHits,1);assert.equal(s.normalEnds,1);assert.equal(s.events.mousedown.length,1);});
test('normal recovery is not cancelled immediately',()=>{const s=game();s.player.pt=0.01;assert.equal(s.canAttack(),false);s.player.pt=0.11;assert.equal(s.canAttack(),true);});
test('greatsword branch is directional, does not also trigger normal shock',()=>{const s=game();const front=mob(3,1.5),side=mob(2,2.8);s.mobs.push(front,side);s.arm();assert.equal(s.player.atkDef.wgKind,'greatsword');s.strike();s.strike();s.onActEnd();assert(front.hp<100);assert.equal(side.hp,100);assert.equal(s.damage.length,1);assert.equal(s.normalEnds,undefined);});
test('branch has a minimum recovery even at extreme attack speed',()=>{const s=game();s.atkSpeed=()=>0.1;s.arm();assert.equal(s.player.T.rec,0.18);s.player.ph='rec';s.player.pt=0.1;assert.equal(s.canAttack(),false);});
test('sickles pull nearest enemy then strike at the later active time',()=>{const s=game('sickles'),m=mob(4.2,1.5);s.mobs.push(m);s.arm();s.player.ph='act';s.player.pt=0;s.bladeHits([],[]);assert.equal(s.damage.length,0);s.stepMob(m,0.16);assert(m.x<4.2);assert(m.x>=s.player.x+s.player.r+m.r+0.20);s.strike();assert(m.hp<100);assert.equal(s.WeaponGameplay.status().counts.pulls,1);});
test('sickles cannot select a target through a wall',()=>{const s=game('sickles'),m=mob(4,1.5);s.mobs.push(m);s.los=()=>false;s.arm();s.strike();assert.equal(s.WeaponGameplay.status().activeMotions,0);assert.equal(m.hp,100);});
test('pull stops before intervening crate without teleporting through it',()=>{const s=game('sickles'),m=mob(4.4,1.5);s.mobs.push(m);s.crates.push({x:3.4,y:1.5,r:0.3,dead:false});s.arm();s.player.ph='act';s.player.pt=0;s.bladeHits([],[]);s.stepMob(m,0.2);assert(m.x>=3.98);assert.equal(s.WeaponGameplay.status().activeMotions,0);});
test('heavy target blocks hooking a smaller enemy behind it',()=>{const s=game('sickles'),heavy=mob(3.9,1.5,{mass:4}),small=mob(4.5,1.5);s.mobs.push(heavy,small);s.arm();s.player.ph='act';s.player.pt=0;s.bladeHits([],[]);assert.equal(s.WeaponGameplay.status().counts.pulls,0);});
test('hammer causes exactly one wall collision, with source damage frozen',()=>{const s=game('hammer'),m=mob(3.1,1.5);s.mobs.push(m);s.wallAt=x=>x>=4;s.arm();s.strike();s.rollWDmg=()=>1000;s.stepMob(m,0.4);s.stepMob(m,0.4);assert.equal(s.WeaponGameplay.status().counts.wallImpacts,1);assert.equal(s.damage.length,2);assert.equal(s.damage[1].d,5.5);assert(m.x<=3.7+1e-6);});
test('hammer victim hits one other enemy; no recursive launch',()=>{const s=game('hammer'),m=mob(3,1.5),other=mob(4.3,1.5),third=mob(5.6,1.5);s.mobs.push(m,other,third);s.arm();s.strike();s.stepMob(m,0.4);assert.equal(s.WeaponGameplay.status().counts.bodyImpacts,1);assert(other.hp<100);assert.equal(third.hp,100);assert.equal(s.WeaponGameplay.status().activeMotions,0);});
test('Boss can take branch damage but cannot be launched or interrupted',()=>{const s=game('hammer'),m=mob(3,1.5,{boss:true,st:'skill',t:0.4,stunT:0,vx:0,vy:0,mvx:0,mvy:0});s.mobs.push(m);s.arm();s.strike();assert(m.hp<100);assert.equal(m.st,'skill');assert.equal(m.t,0.4);assert.equal(m.vx,0);assert.equal(s.WeaponGameplay.status().activeMotions,0);});
test('lethal hammer direct hit never launches corpse',()=>{const s=game('hammer'),m=mob(3,1.5,{hp:1});s.mobs.push(m);s.arm();s.strike();assert.equal(s.WeaponGameplay.status().activeMotions,0);});
test('flight advances baseline mob timers and survives zero dt',()=>{const s=game('hammer'),m=mob(3,1.5);s.mobs.push(m);s.arm();s.strike();s.stepMob(m,0);assert.equal(s.WeaponGameplay.status().activeMotions,1);s.stepMob(m,0.01);assert.equal(s.mobTicks,1);});
test('floor change clears old motions and armed input',()=>{const s=game('hammer'),m=mob(3,1.5);s.mobs.push(m);s.arm();s.strike();s.floorN++;s.stepPlayer(0.01);assert.equal(s.WeaponGameplay.status().activeMotions,0);assert.equal(s.WeaponGameplay.status().ready,false);});
test('rolling cancels a pending pull',()=>{const s=game('sickles'),m=mob(4,1.5);s.mobs.push(m);s.arm();s.player.ph='act';s.player.pt=0;s.bladeHits([],[]);s.player.st='roll';s.stepPlayer(0.01);assert.equal(s.WeaponGameplay.status().activeMotions,0);});
test('swap input queues until permitted recovery, without duplicate swap',()=>{const s=game();s.arm();s.swapWeapons();assert.equal(s.swaps,undefined);s.player.ph='rec';s.player.pt=0.2;s.stepPlayer(0.01);s.stepPlayer(0.01);assert.equal(s.swaps,1);});
test('blur clears armed input; touch attack can request branch',()=>{const s=game();s.stepPlayer(0.15);assert.equal(s.WeaponGameplay.status().ready,true);s.events.blur.forEach(f=>f());assert.equal(s.WeaponGameplay.status().ready,false);s.stepPlayer(0.15);s.touchAction('attack',true);s.startAttack();assert.equal(s.player.atkDef.wgKind,'greatsword');assert.equal(s.touchCalls,1);});
