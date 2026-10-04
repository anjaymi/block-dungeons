const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const kinds=['greatsword','sickles','hammer'];
function setup(kind){
  const g=loadGame();
  g.run(`player.eq.weapon=newBase('weapon',0,'${kind}');recalc();player.attackId=0;player.visualTime=0;player.ang=.9;player.walk=0;player.speedFrac=0;player.flash=player.inv=0;
    let seenPose;const originalRig=rigModel;rigModel=(...args)=>{if(args[0]===player)seenPose=args[1];return originalRig(...args);};playerRig(player);`);
  return g;
}
const read=(g,code)=>JSON.parse(g.run('JSON.stringify('+code+')'));
function distance(a,b){
  let m=0;
  for(const k of ['legR','legL','bob','lean','twist','wpR','wpL','headYaw','headPitch','headRoll','rootZ'])m=Math.max(m,Math.abs((a[k]||0)-(b[k]||0)));
  for(const k of ['armR','armL'])a[k].forEach((v,i)=>m=Math.max(m,Math.abs(v-b[k][i])));
  m=Math.max(m,Math.abs(Math.atan2(Math.sin((a.spin||0)-(b.spin||0)),Math.cos((a.spin||0)-(b.spin||0)))));
  return m;
}
for(const kind of kinds)test(kind+'：所有普通动作与变招的骨骼连续、数值有限，皮肤保持原归属',()=>{
  const g=setup(kind),n=g.run('WEAPONS[player.weapon].combo.length');
  for(let i=0;i<=n;i++){
    g.run(`player.st='atk';player.attackId++;player.atkDef=${i===n?'WeaponGameplay.BRANCHES[player.weapon]':`WEAPONS[player.weapon].combo[${i}]`};
      player.T={w:player.atkDef.w,act:player.atkDef.act,rec:player.atkDef.rec};`);
    for(const phase of ['wind','act','rec']){
      for(let j=0;j<=24;j++){
        g.run(`player.ph='${phase}';player.pt=player.T.${phase==='wind'?'w':phase}*${j/24};player.visualTime+=.012;player.rig=playerRig(player);`);
        assert.equal(g.run('player.rig.every(b=>b.M.every(Number.isFinite))'),true);
        assert.equal(g.run("player.rig.filter(b=>b.tx).every(b=>b.tx.k===player.char)"),true);
      }
      if(phase!=='rec'){
        const before=read(g,'seenPose'),next=phase==='wind'?'act':'rec';
        g.run(`player.ph='${next}';player.pt=0;player.visualTime+=1e-6;playerRig(player);`);
        assert.ok(distance(before,read(g,'seenPose'))<.004,`${kind} 动作 ${i} ${phase} 阶段切换不能跳姿态`);
      }
    }
    const before=read(g,'seenPose');
    g.run("player.st='move';player.visualTime+=.001;playerRig(player);");
    assert.ok(distance(before,read(g,'seenPose'))<.004,'收势结束须衔接真实待机腕角');
  }
});
test('三种武器的视觉支撑脚随出手变化，刀身判定与攻击数据保持原值',()=>{
  for(const kind of kinds){
    const g=setup(kind);
    g.run("player.st='atk';player.attackId=1;player.atkDef=WEAPONS[player.weapon].combo[0];player.T={w:.2,act:.15,rec:.3};player.ph='act';player.pt=.025;player.visualTime=.3;");
    const before=read(g,'bladeSegs(player,hitRig(player))'),source=read(g,'player.atkDef');
    g.run('playerRig(player);');const legs=read(g,'[seenPose.legR,seenPose.legL]');
    g.run('player.pt=.1;player.visualTime=.375;playerRig(player);');
    assert.notDeepEqual(legs,read(g,'[seenPose.legR,seenPose.legL]'));
    g.run('player.pt=.025;');
    assert.deepEqual(read(g,'bladeSegs(player,hitRig(player))'),before);
    assert.deepEqual(read(g,'player.atkDef'),source);
  }
});
test('连招从上一击当前收势接入，新朝向在有效出手前完成，跨 π 不绕远路',()=>{
  const g=setup('sickles');
  g.run("player.st='atk';player.attackId=1;player.atkDef=WEAPONS.sickles.combo[0];player.T={w:.05,act:.08,rec:.09};player.ph='rec';player.pt=.02;player.ang=3;player.visualTime=.3;playerRig(player);");
  const previous=read(g,'seenPose');
  g.run("player.attackId=2;player.atkDef=WEAPONS.sickles.combo[1];player.ph='wind';player.pt=0;player.ang=-3;player.visualTime=.301;playerRig(player);");
  assert.ok(distance(previous,read(g,'seenPose'))<1e-9);
  assert.ok(Math.abs(g.run('seenPose.facingOffset'))<.3);
  g.run("player.pt=.045;player.visualTime=.346;playerRig(player);");
  assert.equal(g.run('seenPose.facingOffset'),0);assert.equal(g.run('player.ang'),-3);
});
test('暂停和命中停顿保留战斗姿态与附属摆动，同一模拟帧重复建模不推进动作',()=>{
  const g=setup('hammer');
  g.run("player.st='atk';player.attackId=1;player.atkDef=WEAPONS.hammer.combo[0];player.T={w:.2,act:.12,rec:.3};player.ph='act';player.pt=.04;player.visualTime=.3;player.rig=playerRig(player);");
  const before=read(g,'player.rig.map(b=>b.M)');
  g.context.performance.now=()=>20000;
  g.run("state='pause';simStep(.5);player.rig=playerRig(player);");
  assert.equal(g.run('player.visualTime'),.3);
  assert.deepEqual(read(g,'player.rig.map(b=>b.M)'),before);
  g.run('player.rig=playerRig(player);');assert.deepEqual(read(g,'player.rig.map(b=>b.M)'),before);
});
test('独立背包角色和换武器不继承世界中的收势，翻滚中断即时生效',()=>{
  const g=setup('greatsword');
  g.run("player.st='atk';player.attackId=1;player.atkDef=WEAPONS.greatsword.combo[0];player.T={w:.2,act:.12,rec:.3};player.ph='act';player.pt=.1;player.visualTime=.3;playerRig(player);const preview={...player,st:'move',walk:0,speedFrac:0};let previewPose;rigModel=(e,p,...rest)=>{if(e===preview)previewPose=p;if(e===player)seenPose=p;return originalRig(e,p,...rest);};playerRig(preview);");
  assert.equal(Math.abs(g.run('previewPose.legR')),0);assert.equal(Math.abs(g.run('previewPose.legL')),0);
  g.run("player.st='roll';player.rollT=.1;player.visualTime+=.001;playerRig(player);");
  assert.equal(g.run('seenPose.flip'),g.run('playerPose(player).flip'));
  g.run("player.weapon='hammer';player.st='move';player.visualTime+=.001;playerRig(player);");
  assert.equal(Math.abs(g.run('seenPose.legR')),0);
});
test('附属动画响应实际行走速度和旋风转动，去掉原有无效角速度分支',()=>{
  const g=loadGame();
  g.run(`const md={sec:['s_cape']},pose={lean:0,roll:0};
    const still={ang:0,st:'move',visualTime:0},moving={...still,mvx:4},spinning={...still};
    stepAnim(still,pose,md);stepAnim(moving,pose,md);stepAnim(spinning,pose,md);
    still.visualTime=moving.visualTime=spinning.visualTime=.03;
    stepAnim(still,pose,md);stepAnim(moving,pose,md);stepAnim(spinning,{...pose,spin:.6},md);`);
  assert.ok(g.run('moving.an.sec.s_cape.p')>g.run('still.an.sec.s_cape.p'));
  assert.ok(g.run('spinning.an.sec.s_cape.r')>g.run('still.an.sec.s_cape.r'));
});
test('高攻速连续输入保留相同的命中、血量、位移与接招时机',()=>{
  for(const kind of kinds){
    const runs=[];
    for(const enhanced of [true,false]){
      const g=setup(kind);if(!enhanced)g.context.CombatMotion=null;
      g.run(`player.G.effIas=120;player.attackAt=0;player.combo=-1;mouse.l=true;computeAim=()=>({ang:0,target:null,explicit:false});
        mobs=[{type:'zombie',x:6.2,y:5,r:.3,scale:1,hp:1000,maxhp:1000,mass:1,poise:99,ang:Math.PI,st:'idle',t:0,vx:0,vy:0,z:0,flash:0,frozen:0,walk:0,spd:1,dmg:1,awake:true}];
        const outcomes=[];for(let i=0;i<240;i++){stepPlayer(1/120);outcomes.push([player.st,player.ph,player.pt,player.attackId,player.x,player.y,mobs[0].hp]);}`);
      runs.push(read(g,'outcomes'));
    }
    assert.deepEqual(runs[0],runs[1],kind+' 的动画不能改变战斗结算');
    assert.ok(runs[0].some(row=>row[6]<1000),kind+' 必须覆盖真实命中');
  }
});
test('快速出手的衔接在判定前完成，长帧采样有界，换入法杖清掉旧姿态',()=>{
  const g=setup('greatsword');
  g.run("player.st='atk';player.attackId=1;player.atkDef=WEAPONS.greatsword.combo[0];player.T={w:.016,act:.03,rec:.18};player.ph='wind';player.pt=.0083;player.ang=-2;player.visualTime=.01;playerRig(player);");
  g.run("player.ph='act';player.pt=.0006;player.visualTime=.01833;playerRig(player);");
  assert.equal(g.run('seenPose.facingOffset'),0);
  g.run("player.ph='rec';player.pt=.15;player.visualTime+=.15;playerRig(player);");
  assert.equal(g.run('playerRig(player).every(b=>b.M.every(Number.isFinite))'),true);
  g.run("player.weapon='staff';player.st='move';player.visualTime+=.01;playerRig(player);player.weapon='greatsword';player.visualTime+=.01;playerRig(player);");
  assert.equal(Math.abs(g.run('seenPose.legR')),0);
});
test('选角和背包预览没有世界模拟时钟，仍能正常呼吸而非缓存首帧',()=>{
  const g=setup('greatsword');
  g.run('delete player.visualTime;playerRig(player);');const before=read(g,'seenPose');
  g.context.performance.now=()=>1400;g.run('playerRig(player);');
  assert.notDeepEqual(read(g,'seenPose.armR'),before.armR);
});
