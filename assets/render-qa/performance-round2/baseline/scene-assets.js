// Shared scene geometry: 24 authored units per tile, X/Y horizontal, Z up.
// The Blockbench exporter maps [x,y,z] to [x,z,-y]; runtime meshes use it directly.
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SceneAssets=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const palette={grout:0x444d5b,stone:0x9ba3ae,stone2:0x919ba7,stone3:0xa3aab3,
    edge:0xb2bbc6,side:0x596575,wall:0x788391,wall2:0x828d9a,wall3:0x737e8d,
    trim:0x8d98a5,trimEdge:0xb0b8c1,dark:0x53606e,bronze:0x9b794a,
    earth:0x97866b,earth2:0x88765e,earth3:0xa18f72};
  const ids=['flagstone','split_flagstone','worn_flagstone','wall','pillar','rubble'];
  const palettes={
    '苔石地牢':palette,
    '幽深矿井':{...palette,grout:0x30353b,stone:0x697178,stone2:0x5d6873,stone3:0x788086,edge:0x909496,side:0x343e47,wall:0x57616b,wall2:0x606a72,wall3:0x505961,trim:0x697781,trimEdge:0x8b959e,dark:0x29343d,earth:0x79634c,earth2:0x61503f,earth3:0x897158,wood:0x644331,woodEdge:0x8b6244},
    '冰封洞窟':{...palette,grout:0x5e7687,stone:0xb4c8cf,stone2:0xa1b9c6,stone3:0xc2d3d8,edge:0xdbe8e9,side:0x627b8e,wall:0x819eaf,wall2:0x92adbb,wall3:0x7492a7,trim:0xa4c1ce,trimEdge:0xe0edef,dark:0x536f84,earth:0x92acb6,earth2:0x768f9e,earth3:0xa7c0c8,ice:0xadd8e8,iceEdge:0xdcf4f8},
    '下界要塞':{...palette,grout:0x262333,stone:0x55515f,stone2:0x454451,stone3:0x625661,edge:0x777181,side:0x302b3b,wall:0x4b3d50,wall2:0x58475c,wall3:0x413344,trim:0x60516a,trimEdge:0x82758c,dark:0x2b2031,earth:0x86503e,earth2:0x633b35,earth3:0xa36343,ember:0xed833b,emberEdge:0xffb15a},
    '沙海遗迹':{...palette,grout:0x766048,stone:0xc4ac83,stone2:0xb8a17b,stone3:0xcfb991,edge:0xe0cdab,side:0x907452,wall:0xb49b73,wall2:0xc0a783,wall3:0xa38b65,trim:0xc1ab88,trimEdge:0xe0cbaa,dark:0x82684c,bronze:0xb38746,earth:0xba9b66,earth2:0xa2875a,earth3:0xc9ab78},
  };
  const tint=(seed)=>['stone','stone2','stone3'][Math.abs(seed|0)%3];
  // A convex prism with a chamfered top. Every face winds outward.
  function slab(name,x,y,z,w,d,h,bevel,top='stone',side='side',edge='edge'){
    const b=Math.min(bevel,w/4,d/4,h/2),ring=(inset,zz)=>[
      [x+inset,y+inset,zz],[x+w-inset,y+inset,zz],
      [x+w-inset,y+d-inset,zz],[x+inset,y+d-inset,zz]];
    const vertices=[...ring(0,z),...ring(0,z+h-b),...ring(b,z+h)];
    const faces=[{v:[3,2,1,0],color:side}];
    for(let i=0;i<4;i++){const n=(i+1)%4;
      faces.push({v:[i,n,n+4,i+4],color:side});
      faces.push({v:[i+4,n+4,n+8,i+8],color:edge});
    }
    faces.push({v:[8,9,10,11],color:top});return {name,vertices,faces};
  }
  const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function triangles(poly){
    const left=poly.map((_,i)=>i),result=[];
    while(left.length>3){let found=false;
      for(let i=0;i<left.length;i++){
        const a=left[(i+left.length-1)%left.length],b=left[i],c=left[(i+1)%left.length];
        if(cross2(poly[a],poly[b],poly[c])<=1e-8)continue;
        if(left.some(k=>k!==a&&k!==b&&k!==c&&cross2(poly[a],poly[b],poly[k])>=-1e-8&&cross2(poly[b],poly[c],poly[k])>=-1e-8&&cross2(poly[c],poly[a],poly[k])>=-1e-8))continue;
        result.push([a,b,c]);left.splice(i,1);found=true;break;
      }
      if(!found)throw new Error('Invalid stone outline');
    }
    result.push(left.slice());return result;
  }
  function insetOutline(poly,b){
    return poly.map((v,i)=>{
      const previous=poly[(i+poly.length-1)%poly.length],next=poly[(i+1)%poly.length];
      const normal=(a,c)=>{const dx=c[0]-a[0],dy=c[1]-a[1],d=Math.hypot(dx,dy);return [-dy/d,dx/d];};
      const n=normal(previous,v),m=normal(v,next),a=n[0]*v[0]+n[1]*v[1]+b,c=m[0]*v[0]+m[1]*v[1]+b,det=n[0]*m[1]-n[1]*m[0];
      return Math.abs(det)<1e-8?[v[0]+n[0]*b,v[1]+n[1]*b]:[(a*m[1]-n[1]*c)/det,(n[0]*c-a*m[0])/det];
    });
  }
  // Ear-clipped caps preserve concave bite-outs; offset edges create real bevels.
  function stone(name,outline,z,h,bevel,top){
    const n=outline.length,inset=insetOutline(outline,bevel);
    const vertices=[...outline.map(v=>[...v,z]),...outline.map(v=>[...v,z+h-bevel]),...inset.map(v=>[...v,z+h])],faces=[];
    for(const [a,b,c] of triangles(outline))faces.push({v:[a,c,b],color:'side'});
    for(const t of triangles(inset))faces.push({v:t.map(i=>n*2+i),color:top});
    for(let i=0;i<n;i++){const j=(i+1)%n;
      faces.push({v:[i,j,j+n,i+n],color:'side'});
      faces.push({v:[i+n,j+n,j+n*2,i+n*2],color:'edge'});
    }return {name,vertices,faces,outline,inset,z,h,bevel};
  }
  function pieces(id,seed=7,height=28){
    if(!ids.includes(id))throw new Error('Unknown scene asset: '+id);
    const p=[],add=(...a)=>p.push(slab(...a)),c=tint(seed);
    if(id.endsWith('flagstone')){
      // Continuous bed under missing stone. Dropped fragments stay below feet.
      const broken=id!=='flagstone',bed=broken?(seed%2?'earth':'earth2'):'grout';
      add('grout',-12,-12,-2,24,24,.55,.12,bed,bed,bed);
      const shift=(Math.abs(seed)%3-1)*.45;
      if(id==='split_flagstone'){
        p.push(stone('eroded_edge',[[-11.65,-11.65],[11.65,-11.65],[11.65,-3.1],
          [9.9,-2.1+shift],[10.3,-.4],[7.5+shift,.3],[8.5,1.4],[10.8,1.8],
          [11.65,4.4],[11.65,11.65],[-11.65,11.65]],-1.45,1.45,.32,c));
        p.push(stone('dropped_chip',[[10.2,-.15],[11,-.3],[11.45,.5],[10.4,1.1]],-1.45,.92,.2,'stone2'));
      }else if(id==='worn_flagstone'){
        const scars=[
          [[11.65,-7.5],[8.8,-5.9],[6.6,-6.3],[6.9,-2.1],[3.3,-.7],[3.9,2.7],[-.8,5.1],[-1.4,8.6],[-6.6,11.65]],
          [[11.65,-2.8],[8.8,-1],[8.5,2],[5.2,4.3],[4.4,3.7],[1,8.7],[-3.5,11.65]],
          [[11.65,-6.1],[9.2,-4.4],[9.6,-2.5],[6.2,-1.3],[5.8,2.2],[1.8,3.4],[2.2,6.8],[-4.8,11.65]]
        ];
        p.push(stone('collapsed_corner',[[-11.65,-11.65],[11.65,-11.65],
          ...scars[Math.abs(seed)%3],[-11.65,11.65]],-1.45,1.45,.26,c));
        p.push(stone('large_fragment',[[3.4,9.9],[5,7.2],[7.8,8],[7.4,10.6],[5,11]],-1.45,1.25,.24,c));
        p.push(stone('small_fragment',[[8.8,3.3],[10.3,2.5],[11.3,4.4],[10.8,6],[9.2,5.5]],-1.45,.95,.2,'stone2'));
        p.push(stone('flat_chip',[[9,9],[10.7,8.1],[11.1,10.6],[9.2,11.2]],-1.45,.6,.16,'stone3'));
      }else{
        const outline=seed%3===2?[[-11.65,-11.05],[-11.05,-11.65],[11.65,-11.65],[11.65,11.65],[-11.65,11.65]]:
          [[-11.65,-11.65],[11.65,-11.65],[11.65,11.65],[-11.65,11.65]];
        p.push(stone('whole_slab',outline,-1.45,1.45,.42,c));
      }
    }else if(id==='wall'){
      // Broad blocks and narrow seams replace the dense voxel stippling.
      add('mortar_core',-11.1,-11.1,0,22.2,22.2,height+1,.2,'dark','dark','dark');
      const course=(height-5)/3;
      for(let row=0;row<3;row++)for(let col=0;col<2;col++)for(let back=0;back<2;back++){
        const tone=['wall','wall2','wall3'][(row+col+back+seed)%3];
        add('block_'+row+'_'+col+'_'+back,-11.4+col*11.5,-11.4+back*11.5,
          3+row*course,11.3,11.3,course-.22,.55,tone,tone,'trim');
      }
      add('foundation',-12,-12,0,24,24,3,.45,'trim','wall3','trimEdge');
      add('cap_mortar',-12,-12,height,24,24,.7,.15,'dark','dark','dark');
      for(let row=0;row<2;row++)for(let col=0;col<2;col++){
        add('cap_'+row+'_'+col,-12+col*12.08,-12+row*12.08,height+.55,
          11.92,11.92,1.45,.55,(row+col+seed)%2?'trim':'wall2','dark','trimEdge');
      }
      if(seed%3===1){
        add('pilaster_foot',-4.8,-12,3,9.6,3,2,.35,'trim','wall3','trimEdge');
        add('pilaster_shaft',-3.2,-12,5,6.4,2,height-8,.25,'wall2','wall2','trim');
        add('pilaster_crown',-4.8,-12,height-3,9.6,3,3,.4,'trim','wall3','trimEdge');
      }
    }else if(id==='pillar'){
      add('plinth_lower',-10,-10,0,20,20,2.4,.7,'trim','dark','trimEdge');
      add('plinth_upper',-8.7,-8.7,2.4,17.4,17.4,2.4,.55,'trim','side','edge');
      add('column_foot',-6.5,-6.5,4.8,13,13,2.6,.45,'trim','wall3','trimEdge');
      add('column_mortar',-5,-5,7.4,10,10,21.6,.2,'dark','dark','dark');
      for(let row=0;row<3;row++)add('column_'+row,-5.4,-5.4,7.4+row*7.2,10.8,10.8,7,.4,row===1?'wall3':'wall2','wall','trim');
      add('capital_lower',-6.5,-6.5,29,13,13,2,.45,'trim','wall3','edge');
      add('capital_upper',-8,-8,31,16,16,2.5,.65,'trim','side','trimEdge');
      // A restrained brass band gives landmarks a warm accent near torchlight.
      add('brass_band',-5.45,-5.45,14.35,10.9,10.9,.3,.07,'bronze','bronze','bronze');
    }else if(id==='rubble'){
      add('fallen_stone',-4.5,-3.2,0,5.5,5,2.5,.9,'wall3','side','trim');
      add('stone_chip',1.6,-1.4,0,3.2,3.5,1.4,.55,'stone2','side','edge');
      add('small_chip',-.8,3,0,2.2,2.2,.8,.35,'stone','side','edge');
      add('thin_chip',-3.6,2.3,0,2.1,1.4,.6,.25,'wall2','side','trim');
    }
    return p;
  }
  function bounds(parts){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const p of parts)for(const v of p.vertices)for(let a=0;a<3;a++){
      min[a]=Math.min(min[a],v[a]);max[a]=Math.max(max[a],v[a]);
    }return {min,max};
  }
  function build(T,id,seed=7,height=28,theme='苔石地牢'){
    const P=[],C=[],colors=new Map();
    const colorsForTheme=palettes[theme]||palette,authored=pieces(id,seed,height);
    // Small architectural accents keep each biome readable without dense masonry.
    if(id==='wall'){
      if(theme==='幽深矿井'&&seed%3===1){
        authored.push(slab('timber_header',-12,-12,height-7,24,1.2,2,.2,'woodEdge','wood','woodEdge'));
        for(const x of [-10,7])authored.push(slab('timber_brace',x,-12,0,2.6,1.2,height-7,.2,'woodEdge','wood','woodEdge'));
      }
      if(theme==='冰封洞窟'&&seed%2===0)for(let n=0;n<3;n++)authored.push(slab('frost_lip',-9+n*7,-12,height-5-n%2,1.1,1.2,5+n%2,.25,'iceEdge','ice','iceEdge'));
      if(theme==='下界要塞'&&seed%3!==0)for(let n=0;n<3;n++){
        const crack=slab('ember_seam',-6+n*1.1,-12,3+n*4,.5,.35,3.6,.08,'emberEdge','ember','ember');crack.kind='glow';authored.push(crack);
      }
      if(theme==='沙海遗迹'&&seed%3===1)for(const [x,z,w,h] of [[-3,8,6,.7],[-.35,6,.7,5],[-2,10,4,.7]])authored.push(slab('carved_sigil',x,-12,z,w,.35,h,.08,'bronze','dark','bronze'));
    }
    const glowP=[],glowC=[];
    for(const p of authored)for(const f of p.faces){
      let c=colors.get(f.color);if(!c){c=new T.Color(colorsForTheme[f.color]);colors.set(f.color,c);}
      const positions=p.kind==='glow'?glowP:P,vertexColors=p.kind==='glow'?glowC:C;
      for(let i=1;i<f.v.length-1;i++)for(const k of [f.v[0],f.v[i],f.v[i+1]]){
        positions.push(...p.vertices[k].map(v=>v/24));vertexColors.push(c.r,c.g,c.b);
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(P),3));
    geo.setAttribute('color',new T.BufferAttribute(new Float32Array(C),3));geo.computeVertexNormals();geo.computeBoundingBox();
    const b=geo.boundingBox;
    const parts=[{geo,kind:'stone'}];if(glowP.length){const glow=new T.BufferGeometry();glow.setAttribute('position',new T.BufferAttribute(new Float32Array(glowP),3));glow.setAttribute('color',new T.BufferAttribute(new Float32Array(glowC),3));glow.computeVertexNormals();parts.push({geo:glow,kind:'glow'});}
    return {parts,maxZ:Math.max(0,b.max.z),south:Math.max(0,-b.min.y)};
  }
  const hash=(x,y,s)=>{let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s|0,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  function field(x,y,s){
    const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,a=u*u*(3-2*u),b=v*v*(3-2*v);
    return (hash(i,j,s)*(1-a)+hash(i+1,j,s)*a)*(1-b)+(hash(i,j+1,s)*(1-a)+hash(i+1,j+1,s)*a)*b;
  }
  const directions=[[-1,0],[1,0],[0,-1],[0,1]];
  function floorTreatment(m,i,j){
    const seed=7+Math.floor(hash(i,j,112)*3),whole={id:'flagstone',seed,yaw:0,damaged:false};
    const tile=(x,y)=>x<0||y<0||x>=m.GW||y>=m.GH?0:m.G[y*m.GW+x];
    if(tile(i,j)!==1)return whole;
    const edge=directions.map(([x,y])=>tile(i+x,j+y)===0);
    // Protect narrow passages, gate approaches and the exit in every map.
    if((edge[0]&&edge[1])||(edge[2]&&edge[3]))return whole;
    if(m.exitPos&&Math.hypot(i+.5-m.exitPos.x,j+.5-m.exitPos.y)<1.8)return whole;
    for(let y=j-1;y<=j+1;y++)for(let x=i-1;x<=i+1;x++)if(tile(x,y)>1)return whole;
    const nearby=directions.map(([x,y],k)=>edge[k]||tile(i+x*2,j+y*2)===0),direct=edge.some(Boolean),near=nearby.some(Boolean);
    let prop=null;
    if(m.roomId)for(let y=j-1;y<=j+1;y++)for(let x=i-1;x<=i+1;x++)if(x>=0&&y>=0&&x<m.GW&&y<m.GH&&tile(x,y)===0&&m.roomId[y*m.GW+x]>=0)prop=[x-i,y-j];
    const cluster=field(i/3.4,j/3.4,173);
    let propChance=0;
    if(prop){const preferred=directions[Math.floor(hash(i+prop[0],j+prop[1],181)*4)],alignment=-prop[0]*preferred[0]-prop[1]*preferred[1];propChance=alignment>.4?.9:alignment<-.4?.12:.35;}
    const chance=prop?propChance:direct?(cluster>.42?.66:.07):near?(cluster>.42?.34:.025):.008;
    if(hash(i,j,174)>=chance)return whole;
    const worn=hash(i,j,175)<.64,id=worn?'worn_flagstone':'split_flagstone';
    const available=(direct?edge:nearby).map((yes,k)=>yes?k:-1).filter(k=>k>=0);
    const side=available.length?available[Math.floor(hash(i,j,176)*available.length)]:Math.floor(hash(i,j,176)*4);
    const [dx,dy]=prop||directions[side],angle=Math.atan2(-dy,dx);
    // The missing corner points toward the wall; its fragments share that yaw.
    const turn=(angle-Math.PI/4)/(Math.PI/2);
    let yaw=worn?Math.floor(turn)*Math.PI/2:Math.round(angle/(Math.PI/2))*Math.PI/2;
    if(worn&&Math.abs(turn-Math.round(turn))>.001&&hash(i,j,177)>.5)yaw+=Math.PI/2;
    return {id,seed,yaw,damaged:true};
  }
  return {palette,palettes,ids,pieces,bounds,build,floorTreatment};
});
