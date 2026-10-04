const test=require('node:test'),assert=require('node:assert/strict');
const MapGen=require('../dungeon-map.js'),{loadGame}=require('./game-harness.cjs');
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
function reachable(m,terrain){
  const start=m.rooms[0].cy*m.GW+m.rooms[0].cx,seen=new Set([start]),q=[start];
  for(let head=0;head<q.length;head++){const i=q[head],x=i%m.GW,y=Math.floor(i/m.GW);
    for(const [dx,dy] of dirs){const a=x+dx,b=y+dy,n=b*m.GW+a;if(a<0||b<0||a>=m.GW||b>=m.GH||!m.G[n]||seen.has(n))continue;
      if(terrain&&!MapGen.canStep(terrain,x,y,a,b))continue;seen.add(n);q.push(n);}}
  return seen;
}
test('柏林梯度噪声可复现、连续，在整数格点为零，并随种子变化',()=>{
  const a=MapGen.perlin(31),b=MapGen.perlin(31),c=MapGen.perlin(19);
  for(let i=-10;i<10;i++){assert.ok(a(i,4)===0);assert.equal(a(i*.13,2.77),b(i*.13,2.77));assert.ok(Math.abs(a(i*.13,2.77)-a(i*.13+.00001,2.77))<.0001);}
  assert.notEqual(a(.37,2.81),c(.37,2.81));
});
test('WFC 传播高度约束，矛盾返回失败，搜索有明确上限',()=>{
  const chain={neighbours:[[1],[0,2],[1]],domains:[[0],[0,1,2],[2]],weights:[[1,1,1],[1,1,1],[1,1,1]]};
  const solved=MapGen.collapse(chain);assert.deepEqual(solved.values,[0,1,2]);assert.ok(solved.stats.propagations>0);
  assert.equal(MapGen.collapse({...chain,domains:[[0],[2],[2]]}).values,null);
  assert.equal(MapGen.collapse({...chain,domains:[[0,1,2],[0,1,2],[0,1,2]],limit:0}).values,null);
});
test('500 张不同种子与层数的地图：全部房间和地面可达，高低差坡道也可寻路',()=>{
  let upper=0;const started=performance.now();
  for(let seed=0;seed<500;seed++){
    const floor=seed%20+1,boss=floor%5===0,nMain=boss?3:4+Math.min(3,Math.floor(floor/2)),nSide=boss?1:floor===1?2:3;
    const m=MapGen.generate({seed,nMain,nSide,boss,elite:floor>=2}),t=MapGen.buildTerrain(m),seen=reachable(m,t);
    assert.equal(m.rooms.length,nMain+nSide);assert.equal(seen.size,m.G.reduce((s,v)=>s+!!v,0),'seed '+seed+' disconnected ramp');
    assert.equal(m.rooms[0].height,0);assert.equal(m.rooms.find(r=>r.type==='exit'||r.type==='boss').height,0);
    for(const r of m.rooms){assert.ok(seen.has(r.cy*m.GW+r.cx));assert.ok(r.tiles.length>0);assert.ok(r.gates.length>0);if(r.level===2)upper++;
      for(const next of r.conn)assert.ok(Math.abs(r.level-m.rooms[next].level)<=1);}
    assert.ok(m.rooms.some(r=>r.level>0));assert.ok(m.diagnostics.wfc.propagations>0);
  }
  assert.ok(upper>0);assert.ok(performance.now()-started<20000);
});
test('地图相同种子完全一致；装饰不堵连接；无入口的零散地面被清除',()=>{
  const a=MapGen.generate({seed:887}),b=MapGen.generate({seed:887});assert.deepEqual(a.G,b.G);assert.deepEqual(a.rooms,b.rooms);
  const protectedIndex=a.protectedTiles.findIndex(Boolean);a.G[protectedIndex]=0;
  a.G[1]=1;a.roomId[1]=-1;MapGen.finalize(a);assert.equal(a.G[protectedIndex],1);assert.equal(a.G[1],0);
});
test('随机房间搜索耗尽时，确定性回退仍提供完整主路、分支和可行走坡道',()=>{
  const m=MapGen.generate({seed:71,nMain:7,nSide:3,layoutLimit:0});assert.equal(m.diagnostics.layoutFallback,true);assert.equal(m.rooms.length,10);
  assert.equal(reachable(m,MapGen.buildTerrain(m)).size,m.G.reduce((s,v)=>s+!!v,0));
});
test('坡道共享顶点连续，投影可反解，高台不能靠一次移动或寻路跨越',()=>{
  const m=MapGen.generate({seed:981,nMain:7,nSide:3}),t=MapGen.buildTerrain(m);
  for(let y=1;y<m.GH-1;y++)for(let x=1;x<m.GW-1;x++)if(m.G[y*m.GW+x]){
    assert.ok(Number.isFinite(MapGen.heightAt(t,x+.5,y+.5)));
    assert.ok(Math.abs(MapGen.heightAt(t,x+1-.00001,y+.3)-MapGen.heightAt(t,x+1+.00001,y+.3))<.0001);
    const xx=x+.5,yy=y+.5,h=MapGen.heightAt(t,xx,yy),q=MapGen.unproject(t,77+xx*44,38+yy*32-h*38,77,38);
    assert.ok(Math.abs(q.x-xx)<.00001);assert.ok(Math.abs(q.y-yy)<.001,'aim offset '+x+','+y);
  }
  const cliff={G:new Uint8Array([1,1]),GW:2,GH:1,H:new Float32Array([0,1]),maxStep:.36,positions:new WeakMap()};
  assert.equal(MapGen.canStep(cliff,0,0,1,0),false);const e={x:.7,y:.5};MapGen.constrain(cliff,e);e.x=1.5;MapGen.constrain(cliff,e);assert.ok(e.x<1);
});
test('真实游戏在全部五个主题、首领层装饰后仍连通；关门和开门改变实际寻路',()=>{
  const game=loadGame();
  for(let floor=1;floor<=10;floor++){
    game.run(`floorN=${floor};genFloor();computeFlow(rooms[0].cx,rooms[0].cy,999);`);
    assert.equal(game.run('rooms.every(r=>flow[idx(r.cx,r.cy)]>=0)'),true);
    assert.equal(game.run('terrain.G===G && dungeonMap.G===G'),true);
    assert.equal(game.run('rooms.some(r=>r.height>0)'),true);
    game.run('setGates(rooms[1],true);computeFlow(rooms[0].cx,rooms[0].cy,999);');
    assert.equal(game.run('flow[idx(rooms[1].cx,rooms[1].cy)]'),-1);
    game.run('setGates(rooms[1],false);computeFlow(rooms[0].cx,rooms[0].cy,999);');
    assert.ok(game.run('flow[idx(rooms[1].cx,rooms[1].cy)]')>0);
  }
});
test('真实角色沿坡道抵达高台，身体整体抬升，背包预览不继承高度；平地撞墙保留滑动',()=>{
  const g=loadGame();g.run(`genFloor();
    const targetRoom=rooms.find(r=>r.height>0),start=idx(rooms[0].cx,rooms[0].cy),target=idx(targetRoom.cx,targetRoom.cy),q=[start],previous=new Int32Array(G.length).fill(-1);previous[start]=start;
    for(let h=0;h<q.length&&previous[target]<0;h++){const n=q[h],x=n%GW,y=Math.floor(n/GW);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,k=idx(a,b);if(a>=0&&b>=0&&a<GW&&b<GH&&previous[k]<0&&DungeonMap.canStep(terrain,x,y,a,b)){previous[k]=n;q.push(k);}}}
    const path=[];for(let n=target;n!==start;n=previous[n])path.unshift([n%GW+.5,Math.floor(n/GW)+.5]);
    for(const [x,y] of path){const sx=player.x,sy=player.y;for(let k=1;k<=10;k++){player.x=lerp(sx,x,k/10);player.y=lerp(sy,y,k/10);collideCircle(player);}}
  `);
  assert.equal(g.run('idx(Math.floor(player.x),Math.floor(player.y))===target'),true);
  assert.ok(g.run('groundHeight(player.x,player.y)>.9'));
  g.run(`const box=BX(mat(0,0,0),[0,0,3],[2,2,6],'#aaa');drawingTerrain=false;drawBox(player,box,.1,0);const previewPoints=boxPts.map(v=>v.slice());drawingTerrain=true;drawBox(player,box,.1,0);const worldPoints=boxPts.map(v=>v.slice());drawingTerrain=false;`);
  assert.equal(g.run('worldPoints.every((p,i)=>Math.abs((previewPoints[i][1]-p[1])-groundHeight(player.x,player.y)*SZ)<.00001 && p[0]===previewPoints[i][0])'),true);
  const slide=[];for(const useHeight of [false,true]){
    const f=loadGame();f.run(`G=new Uint8Array(GW*GH).fill(1);G[idx(5,4)]=0;terrain=${useHeight?'DungeonMap.buildTerrain({G,GW,GH,rooms:[{height:0}],roomId:new Int16Array(G.length)})':'null'};player.x=4.5;player.y=4.5;collideCircle(player);player.x=5.1;player.y=4.8;collideCircle(player);`);
    slide.push(f.run('JSON.stringify([player.x,player.y])'));
  }assert.equal(slide[0],slide[1]);
});
