// Shared scene geometry: 24 authored units per tile, X/Y horizontal, Z up.
// The Blockbench exporter maps [x,y,z] to [x,z,-y]; runtime meshes use it directly.
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SceneAssets=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const palette={grout:0x444d5b,stone:0x9ba3ae,stone2:0x919ba7,stone3:0xa3aab3,
    edge:0xb2bbc6,side:0x596575,wall:0x788391,wall2:0x828d9a,wall3:0x737e8d,
    trim:0x8d98a5,trimEdge:0xb0b8c1,dark:0x53606e,bronze:0x9b794a};
  const ids=['flagstone','split_flagstone','worn_flagstone','wall','pillar','rubble'];
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
  // Convex chipped outline; the inset top is a real bevel, not a dark decal.
  function stone(name,outline,z,h,bevel,top){
    const n=outline.length,c=outline.reduce((a,v)=>[a[0]+v[0]/n,a[1]+v[1]/n],[0,0]);
    const inset=outline.map(v=>{const d=Math.hypot(v[0]-c[0],v[1]-c[1]);return v.map((x,a)=>x+(c[a]-x)*bevel/d);});
    const vertices=[...outline.map(v=>[...v,z]),...outline.map(v=>[...v,z+h-bevel]),...inset.map(v=>[...v,z+h])],faces=[];
    for(let i=1;i<n-1;i++){
      faces.push({v:[0,i+1,i],color:'side'});
      faces.push({v:[n*2,n*2+i,n*2+i+1],color:top});
    }
    for(let i=0;i<n;i++){const j=(i+1)%n;
      faces.push({v:[i,j,j+n,i+n],color:'side'});
      faces.push({v:[i+n,j+n,j+n*2,i+n*2],color:'edge'});
    }return {name,vertices,faces};
  }
  function pieces(id,seed=7,height=28){
    if(!ids.includes(id))throw new Error('Unknown scene asset: '+id);
    const p=[],add=(...a)=>p.push(slab(...a)),c=tint(seed);
    if(id.endsWith('flagstone')){
      // Complete grout backing keeps cracks closed; top stays at the player plane.
      add('grout',-12,-12,-2,24,24,.55,.12,'grout','grout','grout');
      if(id==='split_flagstone'){
        p.push(stone('stone_west',[[-11.7,-11.7],[-3,-11.7],[1,11.7],[-11.7,11.7]],-1.45,1.45,.6,c));
        p.push(stone('stone_east',[[-2.3,-11.7],[11.7,-11.7],[11.7,11.7],[1.7,11.7]],-1.45,1.3,.6,c));
      }else if(id==='worn_flagstone'){
        p.push(stone('stone_main',[[-11.7,-11.7],[10,-11.7],[11.7,-10],[11.7,5],[5,11.7],[-11.7,11.7]],-1.45,1.45,.6,c));
        p.push(stone('broken_corner',[[11.7,6.8],[11.7,11.7],[7,11.7]],-1.45,1.05,.3,'stone2'));
      }else{
        const cut=1.3+Math.abs(seed%3)*.55;
        p.push(stone('stone_main',[[-11.7,-11.7+cut],[-11.7+cut,-11.7],[11.7,-11.7],
          [11.7,11.7-cut],[11.7-cut,11.7],[-11.7,11.7]],-1.45,1.45,.65,c));
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
  function build(T,id,seed=7,height=28){
    const P=[],C=[],colors=new Map();
    for(const p of pieces(id,seed,height))for(const f of p.faces){
      let c=colors.get(f.color);if(!c){c=new T.Color(palette[f.color]);colors.set(f.color,c);}
      for(let i=1;i<f.v.length-1;i++)for(const k of [f.v[0],f.v[i],f.v[i+1]]){
        P.push(...p.vertices[k].map(v=>v/24));C.push(c.r,c.g,c.b);
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(P),3));
    geo.setAttribute('color',new T.BufferAttribute(new Float32Array(C),3));geo.computeVertexNormals();geo.computeBoundingBox();
    const b=geo.boundingBox;
    return {parts:[{geo,kind:'solid'}],maxZ:Math.max(0,b.max.z),south:Math.max(0,-b.min.y)};
  }
  return {palette,ids,pieces,bounds,build};
});
