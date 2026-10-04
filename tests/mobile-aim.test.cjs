const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame,mobCode}=require('./game-harness.cjs');

function mobileGame(){
  const g=loadGame();
  g.run(fs.readFileSync(path.join(__dirname,'../scenefx.js'),'utf8'));
  g.run(`startGame();items=[];mobs=[];chests=[];torches=[];crates=[];G.fill(1);edge.fill(0);exitOpen=false;hudMode='mobile';player.x=5.5;player.y=5.5;player.ang=0;`);
  return g;
}
function drawWorld(g){g.run('touchAimScreen();withZoom(render);');}
function touchAt(g,action,id=8){
  const p=JSON.parse(g.run(`JSON.stringify({b:hudLayout().buttons.${action},s:hudLayout().scale})`));
  return {identifier:id,clientX:p.b.x*p.s,clientY:p.b.y*p.s};
}
function send(g,event,t){g.events[event][0]({preventDefault(){},changedTouches:[t]});}

for(const [w,h,z,cx,cy] of [[844,390,1,3,4],[844,390,2.2,7,6],[390,844,1.4,3,7],[1672,941,1.8,6,3]]){
  test(`手机瞄准随角色保持武器距离，镜头和缩放不改变判定 ${w}×${h} / ${z}`,()=>{
    const g=mobileGame();g.run(`innerWidth=${w};innerHeight=${h};resize();ZOOM=${z};cam.x=${cx};cam.y=${cy};mouse.x=123;mouse.y=234;`);
    drawWorld(g);
    assert.ok(g.run('Math.abs(mouse.wy-player.y)<1e-8'),'pointer drifted off attack direction');
    assert.ok(g.run('Math.abs(mouse.wx-player.x-weaponReach())<1e-8'),'pointer distance should use weapon reach');
    assert.equal(g.run('mouse.x===123&&mouse.y===234'),true,'HUD touch coordinates must stay intact');
  });
}
test('手机和 PC 未操作时没有方形准星，PC 攻击时显示缩小的落点',()=>{
  const g=mobileGame();drawWorld(g);
  g.run('let strokes=0;ctx.stroke=()=>strokes++;withZoom(drawReticle);');
  assert.equal(g.run('strokes'),0);
  g.run(`hudMode='pc';withZoom(drawReticle);`);
  assert.equal(g.run('strokes'),0);
  g.run('mouse.l=true;withZoom(drawReticle);');
  assert.equal(g.run('strokes'),2);
});
test('手机方向指示在墙前停止，隔墙敌人不会成为目标',()=>{
  const g=mobileGame();g.run(`G[idx(6,5)]=0;const enemy=${mobCode};enemy.x=7;enemy.y=5.5;mobs=[enemy];mouse.l=true;`);
  drawWorld(g);
  assert.equal(g.run('curTarget'),null);
  assert.equal(g.run('wallAt(mouse.wx,mouse.wy)'),false);
  assert.ok(g.run('mouse.wx>=player.x&&mouse.wx<6'),'pointer crossed the wall');
});
test('轻点攻击朝向前方射程内敌人，实际攻击角度与目标一致',()=>{
  const g=mobileGame();g.run(`const enemy=${mobCode};enemy.x=player.x+1;enemy.y=player.y+.75;mobs=[enemy];`);
  send(g,'touchstart',touchAt(g,'attack'));g.run('startAttack();');
  assert.ok(g.run('Math.abs(angDiff(player.atkAng,Math.atan2(.75,1)))<1e-8'));
  assert.equal(g.run('player.mobileAimExplicit'),false);
});
test('射程外、背后和死亡敌人不获得手机锁定标记',()=>{
  const g=mobileGame();g.run(`const far=${mobCode};far.x=player.x+weaponReach()+far.r+.5;far.y=player.y;const back={...far,x:player.x-1};const dead={...far,x:player.x+1,hp:0};mobs=[far,back,dead];`);
  drawWorld(g);assert.equal(g.run('curTarget'),null);
});
test('斜向拖动攻击按钮按俯视投影换算，出招沿手指指示方向',()=>{
  const g=mobileGame(),t=touchAt(g,'attack');send(g,'touchstart',t);
  send(g,'touchmove',{...t,clientX:t.clientX+30,clientY:t.clientY+30});
  g.run('startAttack();');
  assert.ok(g.run('Math.abs(Math.atan2(Math.sin(player.atkAng)*SY,Math.cos(player.atkAng)*SX)-Math.PI/4)<1e-8'));
  assert.equal(g.run('player.mobileAimExplicit'),true);
});
test('拖动瞄准保持手指方向，不吸向偏离方向的敌人',()=>{
  const g=mobileGame(),t=touchAt(g,'attack');send(g,'touchstart',t);
  send(g,'touchmove',{...t,clientX:t.clientX+40});
  g.run(`const enemy=${mobCode};enemy.x=player.x+1;enemy.y=player.y+.65;mobs=[enemy];startAttack();`);
  assert.equal(g.run('player.atkAng'),0);assert.equal(g.run('touch.attackTarget'),null);
});
test('轻微触摸抖动留在死区，松手后的旧瞄准不覆盖新移动方向',()=>{
  const g=mobileGame(),t=touchAt(g,'attack');send(g,'touchstart',t);
  send(g,'touchmove',{...t,clientX:t.clientX+40});send(g,'touchend',t);
  g.run('touch.moveId=7;touch.moveX=-1;touch.moveY=0;');
  send(g,'touchstart',t);send(g,'touchmove',{...t,clientX:t.clientX+7*g.run('hudLayout().scale')});
  g.run('startAttack();');
  assert.equal(g.run('player.mobileAimExplicit'),false);
  assert.ok(g.run('Math.abs(angDiff(player.atkAng,Math.PI))<1e-8'));
});
test('攻击已进入前摇时，目标标记跟随这次出招，不被移动摇杆改向',()=>{
  const g=mobileGame();g.run(`const front=${mobCode};front.x=player.x+1;front.y=player.y;const back={...front,x:player.x-1};mobs=[front,back];startAttack();touch.moveId=7;touch.moveX=-1;touch.moveY=0;`);
  drawWorld(g);
  assert.equal(g.run('curTarget===front'),true);
  assert.ok(g.run('mouse.wx>player.x'));
});
test('手机 TNT 使用自己的投掷距离，点击 HUD 坐标不成为落点',()=>{
  const g=mobileGame();g.run('mouse.wx=player.x+.2;mouse.wy=player.y;useArtifact(0);');
  assert.ok(g.run('bombs[0].tx-player.x>6.5&&bombs[0].tx-player.x<=7'));
  assert.equal(g.run('bombs[0].ty'),g.run('player.y'));
});
test('手机陨石选择射程内目标并避开墙体',()=>{
  const g=mobileGame();g.run(`player.cls='mage';player.lvl=20;mouse.wx=player.x+.2;mouse.wy=player.y;G[idx(8,5)]=0;useMageSkill(2);`);
  assert.equal(g.run('player.mSk'),'meteor');
  assert.ok(g.run('player.mTarget.x>7&&player.mTarget.x<8'));
  assert.equal(g.run('wallAt(player.mTarget.x,player.mTarget.y)'),false);
});
test('手机传送翻滚沿瞄准方向使用传送距离',()=>{
  const g=mobileGame();g.run('player.G.teleport=1;mouse.wx=player.x+.2;mouse.wy=player.y;const from=player.x;startRoll();');
  assert.ok(g.run('player.x-from>5&&player.x-from<=6'));
});
