const test=require('node:test'),assert=require('node:assert/strict');
const createDisplay=require('../game-display.js');
const {loadGame}=require('./game-harness.cjs');
function environment(){
  const listeners={},calls=[],root={};
  const doc={documentElement:root,fullscreenEnabled:true,fullscreenElement:null,addEventListener:(name,handler)=>listeners[name]=handler,getElementById:()=>null};
  const env={document:doc,innerWidth:844,innerHeight:390,navigator:{},matchMedia:()=>({matches:false}),screen:{orientation:{lock:()=>{calls.push('lock');return Promise.resolve();},unlock:()=>calls.push('unlock')}}};
  root.requestFullscreen=options=>{calls.push({target:root,options});doc.fullscreenElement=root;listeners.fullscreenchange();return Promise.resolve();};
  doc.exitFullscreen=()=>{calls.push('exit');doc.fullscreenElement=null;listeners.fullscreenchange();return Promise.resolve();};
  return {env,doc,root,listeners,calls,display:createDisplay(env)};
}
test('全屏包含地形、角色和 HUD 的文档根，点击时立即请求隐藏导航栏',async()=>{
  const g=environment(),pending=g.display.toggle();
  assert.equal(g.calls[0].target,g.root);assert.equal(g.calls[0].options.navigationUI,'hide');
  assert.equal(await pending,true);assert.equal(g.display.status().label,'退出全屏');
  await g.display.toggle();assert.equal(g.display.status().label,'全屏游戏');
});
test('全屏请求未完成时连续点击只发送一次请求',async()=>{
  const g=environment();let finish;
  g.root.requestFullscreen=()=>{g.calls.push('request');return new Promise(resolve=>finish=resolve);};
  const first=g.display.toggle();assert.equal(await g.display.toggle(),false);assert.equal(g.calls.length,1);
  finish();await first;assert.equal(g.display.status().busy,false);
});
test('请求被拒绝后解除忙碌状态，允许用户重试',async()=>{
  const g=environment();g.root.requestFullscreen=()=>Promise.reject(Error('denied'));
  assert.equal(await g.display.toggle(),false);assert.equal(g.display.status().active,false);assert.equal(g.display.status().busy,false);
  g.root.requestFullscreen=()=>{g.doc.fullscreenElement=g.root;return Promise.resolve();};
  assert.equal(await g.display.toggle(),true);
});
test('同步抛错与不支持全屏都安全返回，不假装已全屏',async()=>{
  const g=environment();g.root.requestFullscreen=()=>{throw Error('unavailable');};
  assert.equal(await g.display.toggle(),false);assert.equal(g.display.status().busy,false);
  delete g.root.requestFullscreen;assert.equal(await g.display.toggle(),false);assert.equal(g.display.status().active,false);
});
test('主屏幕启动已经是全屏，不再次调用浏览器请求',async()=>{
  const g=environment();g.env.navigator.standalone=true;
  assert.equal(await g.display.toggle(),true);assert.equal(g.display.status().label,'全屏已开启');assert.equal(g.calls.length,0);
  g.env.navigator.standalone=false;g.env.matchMedia=query=>({matches:query==='(display-mode: fullscreen)'});
  assert.equal(g.display.status().standalone,true);
});
test('旧版 WebKit 的进入、退出与状态变化使用完整页面',async()=>{
  const g=environment();delete g.root.requestFullscreen;delete g.doc.exitFullscreen;
  g.doc.fullscreenEnabled=false;g.doc.webkitFullscreenEnabled=true;
  g.root.webkitRequestFullscreen=function(){assert.equal(this,g.root);g.doc.webkitFullscreenElement=g.root;g.listeners.webkitfullscreenchange();};
  g.doc.webkitExitFullscreen=function(){assert.equal(this,g.doc);g.doc.webkitFullscreenElement=null;g.listeners.webkitfullscreenchange();};
  assert.equal(await g.display.toggle(),true);assert.equal(g.display.status().active,true);
  assert.equal(await g.display.toggle(),true);assert.equal(g.display.status().active,false);
});
test('手机全屏尝试横屏，外部退出会归还方向锁',async()=>{
  const g=environment();await g.display.toggle({landscape:true});await Promise.resolve();
  assert.equal(g.calls.filter(c=>c==='lock').length,1);
  g.doc.fullscreenElement=null;g.listeners.fullscreenchange();assert.ok(g.calls.includes('unlock'));
});
test('方向锁延迟完成时已退出全屏，也会及时解锁',async()=>{
  const g=environment();let finish;
  g.env.screen.orientation.lock=()=>new Promise(resolve=>finish=resolve);
  await g.display.toggle({landscape:true});await g.display.toggle();finish();await Promise.resolve();
  assert.ok(g.calls.includes('unlock'));
});
test('设备拒绝方向锁时全屏仍成功，退出不会解锁别人的锁',async()=>{
  const g=environment();g.env.screen.orientation.lock=()=>Promise.reject(Error('unsupported'));
  assert.equal(await g.display.toggle({landscape:true}),true);await g.display.toggle();assert.ok(!g.calls.includes('unlock'));
});
test('手机地址栏与旋转后的实际可视尺寸用于主画布',()=>{
  const g=loadGame({width:844,height:390});
  g.context.visualViewport={width:844,height:342};g.run('resize()');
  assert.equal(g.run('cv.width'),844);assert.equal(g.run('cv.height'),342);
  g.context.visualViewport={width:390,height:760};g.run('resize()');
  assert.equal(g.run('cv.width'),390);assert.equal(g.run('cv.height'),760);
});
test('设置的全屏动作保持当前冒险和菜单状态，并清掉按住输入',async()=>{
  const g=loadGame();let requested;
  g.context.document.documentElement={requestFullscreen:()=>{requested=true;return Promise.resolve();}};
  g.run(`openHUDModal('settings');mouse.l=true;const keepFloor=floorN,keepHP=player.hp;const layout=hudLayout(),button=layout.modalButtons[0];hudModalClick((button.x+button.w/2)*layout.scale,(button.y+button.h/2)*layout.scale);`);
  await Promise.resolve();assert.equal(requested,true);assert.equal(g.run('state'),'pause');
  assert.equal(g.run('mouse.l'),false);assert.equal(g.run('floorN===keepFloor&&player.hp===keepHP'),true);
});
