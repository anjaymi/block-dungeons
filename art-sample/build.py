from pathlib import Path
root=Path(__file__).resolve().parent.parent
s=(root/'block-dungeons.html').read_text()
# Only an independent entry is generated. Shared combat, inventory and loot source is verbatim.
s=s.replace('world3d.js?v=5','art-sample/world3d-moss.js?v=1').replace('scenefx.js?v=5','art-sample/scenefx-moss.js?v=1')
s=s.replace("'bd_", "'bd_moss_sample_")
s=s.replace('<title>', '<title>苔石哨所 · ')
s=s.replace('<script src="world3d', '<script src="world3d')
s=s.replace('<script src="art-sample/world3d', '<script>window.MOSS_BASELINE = new URLSearchParams(location.search).has("baseline");</script>\n<script src="art-sample/world3d')
s=s.replace("lctx.fillStyle = theme.dark;", "lctx.fillStyle = window.MOSS_BASELINE ? theme.dark : 'rgba(3,13,23,.57)';")
s=s.replace("ctx.drawImage(SceneFX.radial('torchglow-strong'", "ctx.globalAlpha = window.MOSS_BASELINE ? 1 : .30; ctx.drawImage(SceneFX.radial('torchglow-strong'")
s=s.replace("  if(exitOpen){ const s=P(exitPos.x,exitPos.y,.35);", "  ctx.globalAlpha = 1;\n  if(exitOpen){ const s=P(exitPos.x,exitPos.y,.35);")
s=s.replace('</body>', '<script src="art-sample/preview.js"></script>\n</body>')
(root/'moss-outpost.html').write_text(s)
w=(root/'world3d.js').read_text()
w=w.replace("const FALLBACK_THEME = '苔石地牢';", """const FALLBACK_THEME = '苔石地牢';
const MOSS = !window.MOSS_BASELINE;
let sampleRoom = null;
if(MOSS) THEME3D['苔石地牢'].light = {sky:0x91b8d3, ground:0x182b27, hemi:.78, sun:1.3, torch:0xffb450, exposure:1.04};
function inSample(i,j,margin=0){return sampleRoom && i>=sampleRoom.x-margin && i<sampleRoom.x+sampleRoom.w+margin && j>=sampleRoom.y-margin && j<sampleRoom.y+sampleRoom.h+margin;}
function mossFloorParts(type,seed){
  const key='sample-floor/'+type+'/'+seed;
  if(partCache.has(key))return partCache.get(key);
  const v=new L.DungeonModel(100+seed);
  const palette=type==='path'?[0x68766e,0x738075,0x5d7069]:type==='edge'?[0x2f523e,0x3f6046,0x35543e]:[0x455f59,0x526961,0x49615b];
  v.box(-12,-12,-5,24,24,4,0x243b38);
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const n=(x+y*2+seed)%3;
    v.box(-12+x*8,-12+y*8,-1,8,8,1,palette[n]);
    if((x*3+y+seed)%4===0)v.box(-11+x*8,-10+y*8,0,4,3,1,palette[(n+1)%3]);
  }
  if(type==='edge') for(let n=0;n<9;n++){
    const x=-11+(n*7+seed*3)%21,y=-10+(n*11+seed)%20;
    v.box(x,y,0,2,2,1+n%3,[0x4d7247,0x5d7c49,0x34563b][n%3]);
  }
  const p=extractParts(v.build(key));partCache.set(key,p);return p;
}
""")
w=w.replace('cornerProps = new Map();\n  if(!init())', "cornerProps = new Map();\n  sampleRoom = o.rooms[0];\n  if(!init())")
w=w.replace("(WALL_BUILDERS[kind] || WALL_BUILDERS.dungeon)(v, L, h, k);", """if(MOSS && kind==='moss'){
      // Visual-only masonry: dark vertical faces, lighter coping and moss. No grid writes.
      v.box(-12,-12,0,24,24,h,0x243c43);
      for(let z=0;z<h;z+=6)for(let x=-12;x<12;x+=8){
        const shade=[0x354d54,0x3d5358,0x30454c][((x+12)/8+(z/6|0)+k)%3];
        v.box(x,-12,z,8,24,Math.min(5,h-z),shade);
      }
      v.box(-12,-12,h,24,24,2,0x516454);
      v.box(-12,-13,h-2,24,1,2,0x6b7b62);
      for(let n=0;n<7;n++){
        const xx=-11+(n*7+k*3)%21, yy=-10+(n*9+k)%20;
        v.box(xx,yy,h+2,3+n%3,4,1, [0x3f643f,0x557549,0x365a3d][n%3]);
        if(n<3) v.box(xx,-13,h-5-n*2,2,1,5+n*2,0x426846);
      }
    }else (WALL_BUILDERS[kind] || WALL_BUILDERS.dungeon)(v, L, h, k);""")
w=w.replace("put('f/'+f[0]+'/'+f[1]+'/'+sd, assetParts(f[0],f[1],sd), false, cx, cy, 0, ((h32(i,j,13)*4)|0)*Math.PI/2);", """if(MOSS && inSample(i,j,3)){
        const edge=solid(i-1,j)||solid(i+1,j)||solid(i,j-1)||solid(i,j+1);
        const main=Math.abs(j-sampleRoom.cy)<=1 || Math.abs(i-sampleRoom.cx)<=1;
        const kind=edge?'edge':main?'path':(fbm(i,j,11)>.52?'edge':'stone');
        put('sample/'+kind+'/'+sd,mossFloorParts(kind,sd),false,cx,cy,0,0);
      }else put('f/'+f[0]+'/'+f[1]+'/'+sd, assetParts(f[0],f[1],sd), false, cx, cy, 0, ((h32(i,j,13)*4)|0)*Math.PI/2);""")
w=w.replace('wallParts(cfg.wall, wk);', "wallParts(MOSS && inSample(i,j,2) ? 'moss' : cfg.wall, wk);")
w=w.replace('playerLight.intensity = 2.0 *', 'playerLight.intensity = (MOSS ? .65 : 2.0) *')
w=w.replace('l.intensity = 4.25*fl;', 'l.intensity = (MOSS ? 2.0 : 4.25)*fl; l.distance = MOSS ? 4.3 : 6.5;')
(root/'art-sample/world3d-moss.js').write_text(w)
f=(root/'scenefx.js').read_text()
f=f.replace("const FALLBACK = '苔石地牢';", """const FALLBACK = '苔石地牢';
if(!window.MOSS_BASELINE){CFG['苔石地牢'].fogA=.035;CFG['苔石地牢'].parts[0].n=24;CFG['苔石地牢'].shafts=null;}
""")
(root/'art-sample/scenefx-moss.js').write_text(f)
# Audio preference keys are isolated as well; no audio behavior changes.
a=(root/'sfx.js').read_text().replace("'bd_", "'bd_moss_sample_").replace('"bd_', '"bd_moss_sample_')
(root/'art-sample/sfx-moss.js').write_text(a)
p=root/'moss-outpost.html';p.write_text(p.read_text().replace('sfx.js?v=2','art-sample/sfx-moss.js?v=1'))
