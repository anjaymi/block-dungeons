// Map topology, constrained elevations and continuous ground sampling share one owner.
// Coordinates use game X/Y; entity z remains height above this ground.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DungeonMap=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const DIR=[[1,0],[-1,0],[0,1],[0,-1]], LEVEL_HEIGHT=1.15, MAX_STEP=.36;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), mix=(a,b,t)=>a+(b-a)*t;
  function random(seed){let s=seed>>>0;return ()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^(s>>>15),s|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
  // Improved gradient noise, quintic interpolation; no independent random tile colors.
  function perlin(seed){
    const rng=random(seed),p=Array.from({length:256},(_,i)=>i);
    for(let i=255;i>0;i--){const j=Math.floor(rng()*(i+1));[p[i],p[j]]=[p[j],p[i]];}
    const table=Uint16Array.from([...p,...p]),fade=t=>t*t*t*(t*(t*6-15)+10),gradients=[[1,0],[-1,0],[0,1],[0,-1],[.7071,.7071],[-.7071,.7071],[.7071,-.7071],[-.7071,-.7071]];
    const grad=(h,x,y)=>{const g=gradients[h&7];return g[0]*x+g[1]*y;};
    return (x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,a=ix&255,b=iy&255;
      return mix(mix(grad(table[table[a]+b],u,v),grad(table[table[a+1]+b],u-1,v),fade(u)),mix(grad(table[table[a]+b+1],u,v-1),grad(table[table[a+1]+b+1],u-1,v-1),fade(u)),fade(v));};
  }
  // Weighted Shannon-entropy WFC on the room graph. Each decision propagates
  // compatible height domains to neighbours; contradictions backtrack, with a cap.
  function collapse({neighbours,domains,weights,seed=1,limit=256}){
    const rng=random(seed),stats={decisions:0,propagations:0,backtracks:0};let budget=limit;
    function propagate(d){
      const queue=d.map((_,i)=>i);let head=0;
      while(head<queue.length){const i=queue[head++];if(!d[i].length)return false;
        for(const j of neighbours[i]){const next=d[j].filter(b=>d[i].some(a=>Math.abs(a-b)<=1));stats.propagations++;
          if(!next.length)return false;if(next.length!==d[j].length){d[j]=next;queue.push(j);}}
      }return true;
    }
    function solve(d){
      if(!propagate(d))return null;let chosen=-1,min=Infinity;
      for(let i=0;i<d.length;i++)if(d[i].length>1){let sum=0,log=0;for(const v of d[i]){const w=weights[i][v];sum+=w;log+=w*Math.log(w);}
        const entropy=Math.log(sum)-log/sum+rng()*1e-7;if(entropy<min){min=entropy;chosen=i;}}
      if(chosen<0)return d.map(a=>a[0]);if(--budget<0)return null;stats.decisions++;
      const options=d[chosen].slice();
      while(options.length){let draw=rng()*options.reduce((s,v)=>s+weights[chosen][v],0),index=0;
        for(;index<options.length-1;index++){draw-=weights[chosen][options[index]];if(draw<0)break;}
        const [value]=options.splice(index,1),next=d.map(a=>a.slice());next[chosen]=[value];
        const answer=solve(next);if(answer)return answer;stats.backtracks++;if(budget<0)break;
      }return null;
    }
    return {values:solve(domains.map(a=>a.slice())),stats};
  }
  function layout(nMain,nSide,cols,rows,rng,noise,limit,shrine){
    for(let attempt=0;attempt<limit;attempt++){
      const used=new Set(),rooms=[],key=(x,y)=>y*cols+x;
      const add=(gx,gy,type,parent)=>{const r={id:rooms.length,gx,gy,type,conn:[],cleared:false,visited:false,seen:false};rooms.push(r);used.add(key(gx,gy));if(parent){r.conn.push(parent.id);parent.conn.push(r.id);}return r;};
      let last=add(Math.floor(rng()*cols),Math.floor(rng()*rows),'start'),valid=true;
      for(let k=1;k<nMain;k++){
        const choices=DIR.map(([dx,dy])=>[last.gx+dx,last.gy+dy]).filter(([x,y])=>x>=0&&y>=0&&x<cols&&y<rows&&!used.has(key(x,y)));
        if(!choices.length){valid=false;break;}
        // Broad noise steers the main route, without replacing graph connectivity.
        choices.sort((a,b)=>noise(b[0]*.43,b[1]*.43)-noise(a[0]*.43,a[1]*.43));
        const [x,y]=choices[Math.floor(Math.pow(rng(),1.4)*choices.length)];last=add(x,y,k===nMain-1?'exit':'combat',last);
      }
      if(!valid)continue;
      const kinds=['treasure','shop','timed'];for(let i=2;i>0;i--){const j=Math.floor(rng()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
      for(let k=0;k<nSide;k++){
        const choices=[];for(const r of rooms)if(r.type!=='exit')for(const [dx,dy] of DIR){const x=r.gx+dx,y=r.gy+dy;if(x>=0&&y>=0&&x<cols&&y<rows&&!used.has(key(x,y)))choices.push([r,x,y]);}
        if(!choices.length){valid=false;break;}const [parent,x,y]=choices[Math.floor(rng()*choices.length)];add(x,y,shrine&&k===nSide-1?'shrine':kinds[k%3],parent);
      }
      if(valid)return {rooms,attempts:attempt+1};
    }
    // Deterministic snake fallback keeps a valid route even if the bounded random
    // search is exhausted. Supported campaign counts always leave branch space.
    const rooms=[],used=new Set();
    const add=(x,y,type,parent)=>{const r={id:rooms.length,gx:x,gy:y,type,conn:[],cleared:false,visited:false,seen:false};rooms.push(r);used.add(y*cols+x);if(parent){r.conn.push(parent.id);parent.conn.push(r.id);}return r;};
    for(let i=0;i<nMain;i++){const y=Math.floor(i/cols),x=y%2?cols-1-i%cols:i%cols;add(x,y,i===0?'start':i===nMain-1?'exit':'combat',rooms[i-1]);}
    for(let i=0;i<nSide;i++){let cell=null;for(const r of rooms){if(r.type==='exit')continue;for(const [dx,dy] of DIR){const x=r.gx+dx,y=r.gy+dy;if(x>=0&&y>=0&&x<cols&&y<rows&&!used.has(y*cols+x)){cell=[x,y,r];break;}}if(cell)break;}
      if(!cell)throw new Error('Room count leaves no valid branch position');add(cell[0],cell[1],shrine&&i===nSide-1?'shrine':['treasure','shop','timed'][i%3],cell[2]);}
    return {rooms,attempts:limit,fallback:true};
  }
  function generate({width=110,height=85,cellWidth=22,cellHeight=17,cols=5,rows=5,nMain=4,nSide=2,seed=1,boss=false,elite=false,layoutLimit=128,shrine=false}={}){
    if(nMain<3||nMain+nSide>cols*rows||width<cols*cellWidth||height<rows*cellHeight)throw new RangeError('Invalid map dimensions or room count');
    const rng=random(seed),noise=perlin(seed),result=layout(nMain,nSide,cols,rows,rng,noise,clamp(Math.floor(layoutLimit),0,128),shrine),rooms=result.rooms;
    if(boss)rooms.find(r=>r.type==='exit').type='boss';
    if(elite&&!boss){const candidates=rooms.filter(r=>r.type==='combat');candidates[Math.floor(rng()*candidates.length)].type='elite';}
    const domains=rooms.map(r=>['start','exit','boss','shop'].includes(r.type)?[0]:[0,1,2]);
    const elevated=rooms.filter(r=>r.type==='combat'||r.type==='elite').sort((a,b)=>noise(b.gx*.6+11,b.gy*.6)-noise(a.gx*.6+11,a.gy*.6))[0];
    if(elevated)domains[elevated.id]=[1];
    const weights=rooms.map(r=>{const target=clamp(1+noise(r.gx*.5+11,r.gy*.5)*2.8,0,2);return [0,1,2].map(v=>.08+Math.exp(-((v-target)**2)*2.8));});
    const wfc=collapse({neighbours:rooms.map(r=>r.conn),domains,weights,seed:seed^0x5c173});
    if(!wfc.values)throw new Error('Elevation constraints have no solution');
    const G=new Uint8Array(width*height),roomId=new Int16Array(G.length).fill(-1),protectedTiles=new Uint8Array(G.length),id=(x,y)=>y*width+x;
    const ri=(a,b)=>a+Math.floor(rng()*(b-a+1));
    for(const r of rooms){
      r.level=wfc.values[r.id];r.height=r.level*LEVEL_HEIGHT;
      const big=r.type==='boss',small=['start','treasure','shop','timed','shrine'].includes(r.type);
      r.w=big?cellWidth-2:small?ri(9,11):ri(12,cellWidth-5);r.h=big?cellHeight-2:small?ri(8,9):ri(10,cellHeight-4);
      const cx=r.gx*cellWidth+cellWidth/2+(big?0:rng()*2-1),cy=r.gy*cellHeight+cellHeight/2+(big?0:rng()*2-1);
      r.x=Math.round(cx-r.w/2);r.y=Math.round(cy-r.h/2);r.cx=Math.floor(cx);r.cy=Math.floor(cy);r.tiles=[];
      for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
        const dx=(x+.5-cx)/(r.w/2),dy=(y+.5-cy)/(r.h/2),shape=Math.abs(dx)**3.2+Math.abs(dy)**3.2;
        const field=noise(x*.19+19,y*.19+7)*.44+noise(x*.065,y*.065)*.18;
        if(shape<.93+field||(Math.abs(dx)<.45&&Math.abs(dy)<.45)){G[id(x,y)]=1;roomId[id(x,y)]=r.id;r.tiles.push([x,y]);}
      }
    }
    const carve=(x,y)=>{if(x>0&&y>0&&x<width-1&&y<height-1){G[id(x,y)]=1;protectedTiles[id(x,y)]=1;}};
    for(const a of rooms)for(const bId of a.conn){if(bId<a.id)continue;const b=rooms[bId];
      if(a.gy===b.gy){const [l,r]=a.gx<b.gx?[a,b]:[b,a],middle=r.gx*cellWidth;
        for(let x=l.cx;x<=middle;x++)for(let d=-1;d<=1;d++)carve(x,l.cy+d);
        for(let y=Math.min(l.cy,r.cy)-1;y<=Math.max(l.cy,r.cy)+1;y++)for(let d=-1;d<=1;d++)carve(middle+d,y);
        for(let x=middle;x<=r.cx;x++)for(let d=-1;d<=1;d++)carve(x,r.cy+d);
      }else{const [t,bottom]=a.gy<b.gy?[a,b]:[b,a],middle=bottom.gy*cellHeight;
        for(let y=t.cy;y<=middle;y++)for(let d=-1;d<=1;d++)carve(t.cx+d,y);
        for(let x=Math.min(t.cx,bottom.cx)-1;x<=Math.max(t.cx,bottom.cx)+1;x++)for(let d=-1;d<=1;d++)carve(x,middle+d);
        for(let y=middle;y<=bottom.cy;y++)for(let d=-1;d<=1;d++)carve(bottom.cx+d,y);
      }
    }
    for(const r of rooms){r.gates=[];
      for(let y=r.y-2;y<r.y+r.h+2;y++)for(let x=r.x-2;x<r.x+r.w+2;x++){
        if(x<1||y<1||x>=width-1||y>=height-1||!G[id(x,y)]||roomId[id(x,y)]!==-1)continue;
        if([-1,0,1].some(dy=>[-1,0,1].some(dx=>roomId[id(x+dx,y+dy)]===r.id)))r.gates.push([x,y]);
      }
    }
    const obstacleRng=random(seed^0x32bd417),pick=a=>a[Math.floor(obstacleRng()*a.length)];
    for(const r of rooms)if(['combat','elite','exit','boss'].includes(r.type)){
      const count=r.type==='boss'?4:1+Math.floor(obstacleRng()*3);
      for(let k=0;k<count;k++){const [x,y]=pick(r.tiles);if(Math.abs(x-r.cx)<3||Math.abs(y-r.cy)<3)continue;
        const cells=pick([[[0,0]],[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[1,0],[0,1],[1,1]]]).map(([dx,dy])=>[x+dx,y+dy]);
        if(cells.some(([a,b])=>roomId[id(a,b)]!==r.id||!G[id(a,b)]||protectedTiles[id(a,b)]||r.gates.some(g=>Math.abs(g[0]-a)+Math.abs(g[1]-b)<4)))continue;
        for(const [a,b] of cells)G[id(a,b)]=0;
      }
    }
    const map={G,GW:width,GH:height,roomId,rooms,protectedTiles,seed,diagnostics:{layoutAttempts:result.attempts,layoutFallback:!!result.fallback,wfc:wfc.stats}};
    finalize(map);return map;
  }
  // Decorations can remove cells. Restore protected connectors, then trim isolated
  // fringe cells rather than leave inaccessible loot/spawn locations in room.tiles.
  function finalize(m){
    const {G,GW,GH,rooms,roomId}=m;
    if(m.protectedTiles)for(let i=0;i<G.length;i++)if(m.protectedTiles[i])G[i]=1;
    const seen=new Uint8Array(G.length),q=[rooms[0].cy*GW+rooms[0].cx];seen[q[0]]=1;let head=0;
    while(head<q.length){const k=q[head++],x=k%GW,y=Math.floor(k/GW);for(const [dx,dy] of DIR){const a=x+dx,b=y+dy,n=b*GW+a;if(a>=0&&b>=0&&a<GW&&b<GH&&G[n]&&!seen[n]){seen[n]=1;q.push(n);}}}
    let removed=0;for(let i=0;i<G.length;i++)if(G[i]&&!seen[i]){G[i]=0;roomId[i]=-1;removed++;}
    for(const r of rooms){if(!seen[r.cy*GW+r.cx])throw new Error('Protected route disconnected a room');r.tiles=r.tiles.filter(([x,y])=>G[y*GW+x]===1);r.gates=r.gates.filter(([x,y])=>G[y*GW+x]);}
    const fixtureRng=random(m.seed^0x74e90b);m.torches=[];
    for(let y=1;y<GH-1;y++)for(let x=1;x<GW-1;x++)if(!G[y*GW+x]&&G[(y+1)*GW+x]&&!G[(y-1)*GW+x]&&fixtureRng()<.08)m.torches.push({i:x,j:y,side:'y',x:x+.5,y:y+1.2,ph:fixtureRng()*9});
    if(m.diagnostics){m.diagnostics.reachable=q.length;m.diagnostics.trimmed=removed;}return m;
  }
  function buildTerrain(m){
    const {G,GW,GH,rooms,roomId}=m,H=new Float32Array(G.length),known=new Uint8Array(G.length),queue=[],corridor=[];
    // Door landings extend two cells into each room. Even a short corridor into
    // a large boss chamber has enough run to climb one level without a cliff.
    const rampDistance=new Int16Array(G.length).fill(-1),rampQueue=[];
    for(let i=0;i<G.length;i++)if(G[i]&&roomId[i]<0){rampDistance[i]=0;rampQueue.push(i);}
    for(let head=0;head<rampQueue.length;head++){const i=rampQueue[head];if(rampDistance[i]>=2)continue;const x=i%GW,y=Math.floor(i/GW);
      for(const [dx,dy] of DIR){const a=x+dx,b=y+dy,n=b*GW+a;if(a>=0&&b>=0&&a<GW&&b<GH&&G[n]&&rampDistance[n]<0){rampDistance[n]=rampDistance[i]+1;rampQueue.push(n);}}}
    for(let i=0;i<G.length;i++)if(G[i]&&roomId[i]>=0&&rampDistance[i]<0){H[i]=rooms[roomId[i]].height||0;known[i]=1;queue.push(i);}
    // Flood only through floor for initialization; then relax corridor cells with
    // fixed room boundaries, solving a smooth ramp rather than assigning steps.
    let head=0;while(head<queue.length){const i=queue[head++],x=i%GW,y=Math.floor(i/GW);for(const [dx,dy] of DIR){const a=x+dx,b=y+dy,n=b*GW+a;if(a>=0&&b>=0&&a<GW&&b<GH&&G[n]&&!known[n]){known[n]=1;H[n]=H[i];queue.push(n);}}}
    for(let i=0;i<G.length;i++)if(G[i]&&rampDistance[i]>=0)corridor.push(i);
    for(let iteration=0;iteration<160;iteration++){let delta=0;
      for(const i of corridor){const x=i%GW,y=Math.floor(i/GW);let sum=0,n=0;for(const [dx,dy] of DIR){const a=x+dx,b=y+dy;if(a>=0&&b>=0&&a<GW&&b<GH&&G[b*GW+a]){sum+=H[b*GW+a];n++;}}
        const v=n?sum/n:0;delta=Math.max(delta,Math.abs(H[i]-v));H[i]=v;}
      if(delta<.00002)break;
    }
    // Nearest floor extends support heights under walls and solid props. No void
    // geometry is created: this field only anchors the existing scene objects.
    head=0;while(head<queue.length){const i=queue[head++],x=i%GW,y=Math.floor(i/GW);for(const [dx,dy] of DIR){const a=x+dx,b=y+dy,n=b*GW+a;if(a>=0&&b>=0&&a<GW&&b<GH&&!known[n]){known[n]=1;H[n]=H[i];queue.push(n);}}}
    const corners=new Float32Array((GW+1)*(GH+1));
    for(let y=0;y<=GH;y++)for(let x=0;x<=GW;x++){let sum=0,n=0;for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){const a=x+dx,b=y+dy;if(a>=0&&b>=0&&a<GW&&b<GH){sum+=H[b*GW+a];n++;}}corners[y*(GW+1)+x]=n?sum/n:0;}
    return {G,GW,GH,H,corners,rampDistance,maxStep:MAX_STEP,positions:new WeakMap()};
  }
  function surfaceAt(t,x,y){
    if(!t)return {height:0,dx:0,dy:0};x=clamp(x,0,t.GW-.000001);y=clamp(y,0,t.GH-.000001);
    const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,k=j*(t.GW+1)+i,c=t.corners;
    const a=c[k],b=c[k+1],d=c[k+t.GW+1],e=c[k+t.GW+2];
    return {height:mix(mix(a,b,u),mix(d,e,u),v),dx:mix(b-a,e-d,v),dy:mix(d-a,e-b,u)};
  }
  const heightAt=(t,x,y)=>surfaceAt(t,x,y).height;
  function canStep(t,x,y,a,b){
    if(!t)return true;if(a<0||b<0||a>=t.GW||b>=t.GH)return false;
    const i=y*t.GW+x,j=b*t.GW+a;return t.G[j]===1&&t.G[i]===1&&Math.abs(t.H[j]-t.H[i])<=t.maxStep;
  }
  function constrain(t,e){
    if(!t)return;const previous=t.positions.get(e),now={x:e.x,y:e.y};
    // Large teleports are validated by their callers. Normal movement/dashes are
    // traced across cell edges so a high ledge cannot be crossed in one update.
    if(previous&&Math.hypot(now.x-previous.x,now.y-previous.y)<3){
      const steps=Math.max(1,Math.ceil(Math.hypot(now.x-previous.x,now.y-previous.y)/.08));let x=previous.x,y=previous.y;
      for(let k=1;k<=steps;k++){const a=mix(previous.x,now.x,k/steps),b=mix(previous.y,now.y,k/steps),i=Math.floor(x),j=Math.floor(y),ni=Math.floor(a),nj=Math.floor(b);
        const from=j*t.GW+i,to=nj*t.GW+ni;
        // Solid-wall sliding still belongs to the circle collision solver.
        if((i!==ni||j!==nj)&&t.G[from]===1&&t.G[to]===1&&Math.abs(t.H[to]-t.H[from])>t.maxStep){e.x=x;e.y=y;break;}x=a;y=b;
      }
    }t.positions.set(e,{x:e.x,y:e.y});
  }
  function remember(t,e){if(t)t.positions.set(e,{x:e.x,y:e.y});}
  function sight(t,a,b,eye=.65){
    if(!t)return true;const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.2),za=heightAt(t,a.x,a.y)+(a.z||0)+eye,zb=heightAt(t,b.x,b.y)+(b.z||0)+eye;
    for(let k=1;k<n;k++){const u=k/n,x=mix(a.x,b.x,u),y=mix(a.y,b.y,u);if(heightAt(t,x,y)>mix(za,zb,u))return false;}return true;
  }
  function unproject(t,sx,sy,ox,oy,SX=44,SY=32,SZ=38){const x=(sx-ox)/SX;let y=(sy-oy)/SY;for(let n=0;n<8;n++)y=(sy-oy+heightAt(t,x,y)*SZ)/SY;return {x,y};}
  return {generate,finalize,buildTerrain,heightAt,surfaceAt,canStep,constrain,remember,sight,unproject,perlin,collapse,LEVEL_HEIGHT,MAX_STEP};
});
