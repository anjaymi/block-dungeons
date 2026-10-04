const test=require('node:test');
const assert=require('node:assert/strict');
const HUD=require('../hud-layout.js');
const {loadGame}=require('./game-harness.cjs');
const setups=[[1672,941,false],[1280,720,false],[1920,1080,false],[844,390,true],[800,450,true],[390,844,true]];
for(const [w,h,mobile]of setups)test(`${w}×${h} ${mobile?'手机':'PC'}：可操作区域留在屏幕内且命中对应动作`,()=>{
  const L=HUD.layout(w,h,mobile);
  const boxes=[L.vitals,L.portrait,L.map,L.info,...Object.values(L.buttons),...L.hotbar,...L.aux];
  if(mobile)boxes.push(L.move);
  for(const b of boxes){
    const x=b.r===undefined?b.x:b.x-b.r,y=b.r===undefined?b.y:b.y-b.r;
    const bw=b.r===undefined?b.w:b.r*2,bh=b.r===undefined?b.h:b.r*2;
    assert.ok(x>=0&&y>=0&&x+bw<=L.w+.1&&y+bh<=L.h+.1,JSON.stringify(b));
    if(b.action){const cx=b.r===undefined?b.x+b.w/2:b.x,cy=b.r===undefined?b.y+b.h/2:b.y;
      assert.equal(HUD.hit(L,cx,cy),b.action);}
  }
  if(mobile&&w>h)for(const b of Object.values(L.buttons))assert.ok(b.r*2*L.scale>=44-.01,`${b.action} target too small`);
});
test('刘海安全区参与绘制坐标与点击换算',()=>{
  const L=HUD.layout(844,390,true,{left:30,right:15,top:6,bottom:12});
  const B=L.buttons.attack,p=HUD.point(L,B.x*L.scale+30,B.y*L.scale+6);
  assert.equal(HUD.hit(L,p.x,p.y),'attack');
  assert.ok(L.map.x*L.scale+L.map.w*L.scale+30<=844-15);
});
test('PC 点击地图、背包和菜单不会发起攻击',()=>{
  const g=loadGame();g.run('mouse.l=false; player.buf=null');
  const button=g.run(`JSON.stringify(hudLayout().map)`);const L=g.run(`JSON.stringify(hudLayout())`);const b=JSON.parse(button),s=JSON.parse(L).scale;
  g.events.mousedown[0]({button:0,clientX:(b.x+b.w/2)*s,clientY:(b.y+b.h/2)*s});
  assert.equal(g.run('state'),'map');assert.equal(g.run('mouse.l'),false);assert.equal(g.run('player.buf'),null);
});
test('手机新增法术按钮缓冲真正的法术，弓箭保留独立操作',()=>{
  const g=loadGame();g.run(`hudMode='mobile';hudAction('spell');`);assert.equal(g.run('player.buf.type'),'cast');
  g.run(`hudAction('bow')`);assert.equal(g.run('player.buf.type'),'bow');assert.equal(g.run('mouse.r'),true);
  g.run(`hudAction('bow',false)`);assert.equal(g.run('mouse.r'),false);
});
test('任务和设置暂停时不会推进战斗，关闭不会重置楼层与武器',()=>{
  const g=loadGame({lab:true,weapon:'hammer'});g.run(`floorN=3;const keepWeapon=player.weapon;const keepHP=player.hp;const keepTime=stats.time;openHUDModal('quest');simStep(.5);`);
  assert.equal(g.run('state'),'pause');assert.equal(g.run('stats.time===keepTime'),true);
  g.run('closeHUDModal()');assert.equal(g.run('state'),'play');assert.equal(g.run('floorN'),3);assert.equal(g.run('player.weapon===keepWeapon&&player.hp===keepHP'),true);
});
test('移动摇杆与攻击按钮支持两指独立输入，松手后均清理',()=>{
  const g=loadGame();g.run(`hudMode='mobile';const layout=hudLayout();const s=layout.scale;`);
  const points=JSON.parse(g.run(`JSON.stringify({move:layout.move,attack:layout.buttons.attack,s})`));
  const touches=[{identifier:7,clientX:(points.move.x+32)*points.s,clientY:points.move.y*points.s},{identifier:8,clientX:points.attack.x*points.s,clientY:points.attack.y*points.s}];
  g.events.touchstart[0]({preventDefault(){},changedTouches:touches});
  assert.equal(g.run('touch.moveId'),7);assert.equal(g.run('touch.attackId'),8);assert.equal(g.run('mouse.l'),true);assert.equal(g.run('player.buf.type'),'atk');
  g.events.touchend[0]({preventDefault(){},changedTouches:touches});
  assert.equal(g.run('touch.moveX'),0);assert.equal(g.run('touch.attackId'),null);assert.equal(g.run('mouse.l'),false);
});
test('按住翻滚可接奔跑，触摸取消清除奔跑状态',()=>{
  const g=loadGame();g.run(`hudMode='mobile';const B=hudLayout().buttons.roll;const s=hudLayout().scale;`);
  const p=JSON.parse(g.run(`JSON.stringify({x:B.x*s,y:B.y*s})`));const t={identifier:5,clientX:p.x,clientY:p.y};
  g.events.touchstart[0]({preventDefault(){},changedTouches:[t]});assert.equal(g.run('touch.run'),true);
  g.events.touchcancel[0]({preventDefault(){},changedTouches:[t]});assert.equal(g.run('touch.run'),false);
});
