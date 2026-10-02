// Block Dungeons · shared voxel weapon models. Cosmetic only: no combat state or RNG.
(function (global) {
  'use strict';
  const VERSION = '4.0.1';
  const STYLE_IDS = Object.freeze(['steel','ember','frost','void','holy','thunder','dragon','blood','nature','abyss']);
  const STYLES=Object.freeze({
    steel:Object.freeze({id:'steel',name:'锻钢',shape:'王庭圣翼',subtitle:'ROYAL WING',accent:'#dec58c',blade:'#bdcbd7',edge:'#edf7ff',core:'#69788d',metal:'#697c8b',guard:'#c6a562',grip:'#40342f',gem:'#fff0b9',glow:false,description:'尖锐菱形刃 · 圣翼护手 · 宝石柄头',silhouette:'金色上扬翼形护手、菱形剑尖、中央金线与宝石柄头；斧、镰、矛和弓也有独立的王庭翼饰。'}),
    ember:Object.freeze({id:'ember',name:'熔火',shape:'炼狱魔角',subtitle:'DEMON HORN',accent:'#ff9851',blade:'#62414b',edge:'#ffae65',core:'#241b25',metal:'#43303a',guard:'#ae653f',grip:'#302328',gem:'#ffe2a4',glow:true,description:'弯角恶魔护手 · 锯齿重刃 · 熔岩裂缝',silhouette:'长弯角与恶魔面甲护手、偏置斩首重刃、外张锯齿和熔岩裂缝；柄尾分成双爪，不再沿用普通剑柄。'}),
    frost:Object.freeze({id:'frost',name:'霜晶',shape:'哀霜符文',subtitle:'FROSTMOURNE INSPIRED',accent:'#7ee8f2',blade:'#455467',edge:'#b6d4e5',core:'#141c29',metal:'#62768a',guard:'#96a9b9',grip:'#242b37',gem:'#8ff5ff',glow:true,description:'骷髅护手 · 倒钩波刃 · 冰蓝符文',silhouette:'参考霜之哀伤：骷髅护手、上弯尖角、连续的暗色波刃与冰蓝符文。不是三叉冰枝；斧、镰、矛、弓延续亡霜骨骸造型。'}),
    void:Object.freeze({id:'void',name:'虚空',shape:'蚀月星环',subtitle:'ECLIPSE HALO',accent:'#bd92ff',blade:'#645777',edge:'#d4b8ff',core:'#211e32',metal:'#443950',guard:'#8874a5',grip:'#282334',gem:'#ecc2ff',glow:true,description:'镂空星环 · 尖锐悬浮刃片 · 蚀月弧线',silhouette:'镂空、断开的星环护手，尖锐而非方块状的悬浮刃片，独立双叉柄尾；斧、镰、矛和弓以弧形月刃或破碎星环构成。'}),
    holy:Object.freeze({"id":"holy","name":"圣光","shape":"灰烬圣裁","subtitle":"ASHEN SUN","accent":"#ffe5a0","blade":"#ece1c7","edge":"#fff7df","core":"#786d52","metal":"#997d44","guard":"#d8af55","grip":"#53433a","gem":"#fff2b4","glow":true,"description":"日轮光环 · 圣翼刃肩 · 灰烬金线","silhouette":"完整圣刃与独立日轮护手，刃肩伸展为圣翼；金线贯穿实体刃，不采用普通十字护手。","lore":"失落圣堂将余烬封进白金剑脊。日轮不是装饰贴图，而是环绕持握处的实体光环；斧、镰和长弓同样保留圣翼轮廓。"}),
    thunder:Object.freeze({"id":"thunder","name":"雷霆","shape":"风暴缚刃","subtitle":"STORM BINDER","accent":"#9acbff","blade":"#577397","edge":"#d2efff","core":"#273f58","metal":"#455469","guard":"#bdb06c","grip":"#25333f","gem":"#bcfaff","glow":true,"description":"折线雷刃 · 闪电护手 · 高频光芯","silhouette":"刃体在几段明确折线之间转向，护手也是实体闪电形；不是给直剑添加电蓝颜色。","lore":"风暴工匠不试图驯服雷电，而让刃体沿电流折返。每一处拐角都是锻造节点；雷霆战锤的双头负责将风暴压入地面。"}),
    dragon:Object.freeze({"id":"dragon","name":"龙骨","shape":"龙骸斩首","subtitle":"DRAGON RELIC","accent":"#e6c898","blade":"#c9b493","edge":"#fff0cc","core":"#655448","metal":"#776554","guard":"#a58c69","grip":"#45382e","gem":"#ffb76c","glow":true,"description":"龙颅护手 · 骨齿刃缘 · 巨型獠牙","silhouette":"以龙颅、下颌和长獠牙构成护手，厚实骨刃外侧长出独立骨齿；强调遗骸而非金属直刃。","lore":"巨龙陨落后，最坚硬的不是鳞甲，而是被吐息淬炼的颅骨。龙颅与獠牙直接参与武器结构，古老琥珀留在眼窝中。"}),
    blood:Object.freeze({"id":"blood","name":"血月","shape":"赤月渴锋","subtitle":"CRIMSON VOW","accent":"#ff7790","blade":"#744355","edge":"#efb0b4","core":"#351b2c","metal":"#4e2d3f","guard":"#a95c6a","grip":"#2d2029","gem":"#ff627d","glow":true,"description":"偏心月刃 · 环抱弯角 · 赤红裂纹","silhouette":"连续弯曲的偏心刀身、向刃体环抱的护手与红色裂纹，形成仪式性的月牙剪影。","lore":"守望者在赤月之夜立下誓约，将一面小盾和一柄短刃锻成同一件兵器。血月系列的月牙护手象征收束与反击。"}),
    nature:Object.freeze({"id":"nature","name":"荆棘","shape":"翠枝王刃","subtitle":"VERDANT CROWN","accent":"#a4ed96","blade":"#71a97e","edge":"#ccecb4","core":"#355a42","metal":"#647455","guard":"#8cb765","grip":"#635042","gem":"#bbffb4","glow":true,"description":"三叶分刃 · 木质枝桠 · 翡翠芽核","silhouette":"三叶刃、独立枝桠与木质护手构成明显植物轮廓，侧叶和中心叶保持真实的分叉空间。","lore":"林地没有铸造炉，却有会记住形状的树木。枝桠沿握柄攀升，最后展开成三片利叶；翡翠芽核让枯木再次发光。"}),
    abyss:Object.freeze({"id":"abyss","name":"深渊","shape":"凝视空刃","subtitle":"ABYSSAL EYE","accent":"#d6a6ff","blade":"#41384f","edge":"#bfa6d8","core":"#1a1629","metal":"#6c5482","guard":"#8c68a3","grip":"#242031","gem":"#f4b0ff","glow":true,"description":"空心刃框 · 悬浮瞳核 · 断环结构","silhouette":"刃身不是实心板，而是围绕瞳核的空心长框；法杖和战锤也有可看穿的负空间。","lore":"深渊之眼从不藏在刀面后：实体刃框围绕它生长。武器看似空缺，却正因为空缺而产生自己的轮廓。"})
  });
  const DESIGN_NAMES=Object.freeze({
    sword:['王庭圣剑','魔角焚刃','哀霜符文剑','虚界星锋'],
    greatsword:['誓光巨剑','地狱断头刃','霜之哀伤式巨剑','碎星月巨刃'],
    claymore:['圣翼阔剑','焚狱巨刃','哀霜阔剑','裂隙月刃'],
    dagger:['双持圣裁','双持魔牙','双持亡语匕','双持裂星匕'],
    axe:['王庭翼斧','恶魔斩首斧','亡霜骷髅斧','虚空裂月斧'],
    sickle:['双持月钩','双持魔爪镰','双持哀霜镰','双持蚀月镰'],
    spear:['圣旗翼矛','炎魔叉枪','寒魂符文戟','虚界星环戟'],
    bow:['圣翼长弓','炼狱角弓','亡霜骷髅弓','虚空星环弓'],
    hammer:['圣翼重锤','炼狱震地锤','亡霜骨锤','虚界空锤'],
    staff:['王庭法杖','魔角法杖','寒魂法杖','虚界法杖'],
    shieldblade:['王庭盾刃','魔角盾刃','亡霜盾刃','虚界盾刃']
  });
  const newPrefixes=['灰烬','风暴','龙骸','赤月','翠枝','凝视'];
  const suffixes={sword:'长锋',greatsword:'巨刃',claymore:'阔刃',dagger:'双匕',axe:'战斧',sickle:'双镰',spear:'长戟',bow:'长弓',hammer:'战锤',staff:'法杖',shieldblade:'盾刃'};
  Object.keys(DESIGN_NAMES).forEach(kind=>DESIGN_NAMES[kind].push(...newPrefixes.map(v=>v+suffixes[kind])));
  Object.values(DESIGN_NAMES).forEach(Object.freeze);
  function designName(kind,style){const k=alias(kind);if(k==='fist')return '徒手';const names=DESIGN_NAMES[k]||DESIGN_NAMES.sword;return names[Math.max(0,STYLE_IDS.indexOf(style))];}
  const KINDS = Object.freeze({
    sword: Object.freeze({ id:'sword', name:'长剑', len:22, col:'#d8dce4', note:'均衡的单手轮廓', dual:false }),
    greatsword: Object.freeze({ id:'greatsword', name:'双手巨剑', len:46, col:'#b8c0d0', note:'厚实肩部与长柄', dual:false }),
    claymore: Object.freeze({ id:'claymore', name:'阔剑', len:38, col:'#c8ccd8', note:'宽刃与翼形护手', dual:false }),
    axe: Object.freeze({ id:'axe', name:'战斧', len:24, col:'#9aa0a8', note:'阶梯斧面与加厚刃口', dual:false }),
    dagger: Object.freeze({ id:'dagger', name:'双匕首', len:11, col:'#e8e8f0', note:'紧凑双持短刃', dual:true }),
    sickle: Object.freeze({ id:'sickle', name:'双镰', len:17, col:'#c8d0e0', note:'明确的弯钩剪影', dual:true }),
    spear: Object.freeze({ id:'spear', name:'长矛', len:44, col:'#c8ccd8', note:'长杆与分段矛尖', dual:false }),
    bow: Object.freeze({ id:'bow', name:'长弓', len:18, col:'#a78261', note:'右键射箭，蓄力与穿透', dual:false }),
    hammer:Object.freeze({id:'hammer',name:'战锤',len:29,col:'#9ca3b1',note:'三段重击，终段震地冲击',dual:false}),
    staff:Object.freeze({id:'staff',name:'法杖',len:34,col:'#93a5ca',note:'左键奥术弹，终段三连齐射',dual:false}),
    shieldblade:Object.freeze({id:'shieldblade',name:'盾刀',len:27,col:'#b9bdc7',note:'刀盾一体，自带格挡，终段回盾',dual:false})
  });
  const models = new Map(), icons = new Map();
  const MODEL_LIMIT = 128, ICON_LIMIT = 96, PART_LIMIT = 36;
  let hits = 0, misses = 0;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const finite = (n,fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const validColor = (value,fallback) => typeof value==='string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
  const alias = kind => kind==='daggers' ? 'dagger' : kind==='sickles' ? 'sickle' : kind;
  function colorMix(a,b,t) {
    const av=parseInt(a.slice(1),16), bv=parseInt(b.slice(1),16);
    let hex='#';
    for (const shift of [16,8,0]) hex += Math.round(((av>>shift)&255)*(1-t)+((bv>>shift)&255)*t).toString(16).padStart(2,'0');
    return hex;
  }
  function styleOf(item) {
    if (!item) return 'steel';
    if (STYLE_IDS.includes(item.weaponStyle)) return item.weaponStyle;
    // A revealed elemental affix may influence appearance, never its damage.
    if (item.ident!==false) {
      const st=item.st||{};
      if (st.coldDmg>0) return 'frost';
      if (st.fireDmg>0) return 'ember';
      if (st.lightDmg>0 || st.lm>0) return 'void';
    }
    if (!Number.isFinite(Number(item.uid))) return 'steel';
    const seed=(Math.imul(Number(item.uid),1664525)+1013904223)>>>0;
    return STYLE_IDS[(seed>>>16)%STYLE_IDS.length];
  }
  function forItem(def,item,len) {
    return { kind:def.kind, len:len===undefined?def.len:len, col:item&&item.eth?'#c8d8ff':def.col,
      guard:def.guard, style:styleOf(item), tier:item?item.tier||0:0, eth:!!(item&&item.eth), dual:!!def.dual };
  }
  function normalize(look) {
    look=look||{};
    let kind=alias(look.kind||'sword');
    if (kind!=='fist' && !KINDS[kind]) kind='sword';
    const def=KINDS[kind]||KINDS.sword;
    return { kind, len:Math.max(1,finite(look.len,def.len)), style:STYLE_IDS.includes(look.style)?look.style:'steel',
      tier:clamp(Math.floor(finite(look.tier,0)),0,2), col:validColor(look.col,def.col), guard:validColor(look.guard,''), eth:!!look.eth };
  }
  function keyOf(w) { return [w.kind,w.style,w.tier,w.len.toFixed(4),w.col,w.guard,w.eth?1:0].join('|'); }
  function touch(map,key,value,limit) {
    map.delete(key); map.set(key,value);
    if (map.size>limit) map.delete(map.keys().next().value);
    return value;
  }
  // V3: legendary silhouettes, pointed blades and sculpted signature hilts.
  const ZERO=Object.freeze([0,0,0]),IDENTITY=Object.freeze([1,0,0,0,1,0,0,0,1]);
  const DIAMOND=Object.freeze([1,0,0,0,Math.SQRT1_2,-Math.SQRT1_2,0,Math.SQRT1_2,Math.SQRT1_2]);
  function cornerPoints(center,size,axes=IDENTITY){
    const points=[];
    for(let i=0;i<8;i++){
      const x=(i&1?1:-1)*size[0]/2,y=(i&2?1:-1)*size[1]/2,z=(i&4?1:-1)*size[2]/2;
      points.push(Object.freeze([center[0]+axes[0]*x+axes[1]*y+axes[2]*z,center[1]+axes[3]*x+axes[4]*y+axes[5]*z,center[2]+axes[6]*x+axes[7]*y+axes[8]*z]));
    }
    return Object.freeze(points);
  }
  function makeModel(w){
    const p=Object.assign({},STYLES[w.style]),boxes=[];let currentRole='body';
    if(w.style==='steel'){p.blade=w.col;if(w.guard)p.guard=w.guard;}
    if(w.eth)for(const k of ['blade','edge','core','metal','guard','gem'])p[k]=colorMix(p[k],'#c8e3ff',.38);
    const role=(name,build)=>{const previous=currentRole;currentRole=name;build();currentRole=previous;};
    const A=(x,y,z,sx,sy,sz,col,light=false,axes=null)=>{
      const c=Object.freeze([x,y,z]),s=Object.freeze([sx,sy,sz]);
      const box={c,s,col,nf:light,emissive:light&&p.glow,role:currentRole,vertices:cornerPoints(c,s,axes||IDENTITY)};
      if(axes){box.axes=Object.freeze(Array.from(axes));box.local=Object.freeze([...axes,x,y,z]);}
      boxes.push(Object.freeze(box));
    };
    const beam=(a,b,thickness,width,col,light=false)=>{
      const delta=b.map((n,i)=>n-a[i]),length=Math.hypot(...delta);if(length<.001)return;
      const z=delta.map(n=>n/length),hint=Math.abs(z[0])<.93?[1,0,0]:[0,1,0],dot=hint.reduce((sum,n,i)=>sum+n*z[i],0);
      const raw=hint.map((n,i)=>n-dot*z[i]),q=Math.hypot(...raw),x=raw.map(n=>n/q),y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
      A((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,thickness,width,length,col,light,[x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]]);
    };
    const B=(y0,z0,y1,z1,depth,width,col,light=false)=>beam([0,y0,z0],[0,y1,z1],depth,width,col,light);
    const peak=(y,z,width,depth,col,light=false)=>role('point',()=>A(0,y,z+width/2,depth,width*Math.SQRT1_2,width*Math.SQRT1_2,col,light,DIAMOND));
    const jewel=(z,width=2.0)=>role('gem',()=>A(0,0,z,2.65,width*Math.SQRT1_2,width*Math.SQRT1_2,p.gem,p.glow,DIAMOND));
    const runes=(from,to,count=3,width=1,depth=1.78)=>role('runes',()=>{
      const h=Math.max(.35,Math.min(1.4,Math.abs(from-to)/(count+1)*.26));
      for(let i=0;i<count;i++){
        const z=from+(to-from)*(i+1)/(count+1),u=width*.34;
        if(i%3===0){B(-u,z+h,-u,z-h,depth,.24,p.gem,true);B(-u,z-h*.7,u,z-h*.12,depth,.24,p.gem,true);}
        else if(i%3===1){B(-u,z+h,u,z,depth,.24,p.gem,true);B(u,z,-u,z-h,depth,.24,p.gem,true);}
        else{B(-u,z+h,u,z-h,depth,.24,p.gem,true);B(u,z+h,-u,z-h,depth,.24,p.gem,true);}
      }
    });
    const L=w.len,T=w.tier,S=1+T*.10;
    const grip=h=>role('grip',()=>{
      const broad=w.style==='ember'?2.1:1.55;
      A(0,0,h/2+.15,broad,broad,h,p.grip);A(0,0,.55,broad+.35,broad+.45,.65,p.metal);A(0,0,h-.45,broad+.35,broad+.45,.65,p.metal);
      if(w.style==='steel'){
        A(0,0,h+1.1,2.5,2.4*Math.SQRT1_2,2.4*Math.SQRT1_2,p.guard,false,DIAMOND);A(0,0,h+1.1,2.75,.8,.8,p.gem);
      }else if(w.style==='ember'){
        for(const side of [-1,1])B(side*.45,h+.2,side*1.9,h+2.3,1.9,1.2,p.metal);
        A(0,0,h+1.0,2.2,1.1,1.0,p.gem,true);
      }else if(w.style==='frost'){
        A(0,0,h+1.0,2.2,2.7,1.9,p.metal);A(0,0,h+1.0,2.4,1.1*Math.SQRT1_2,1.1*Math.SQRT1_2,p.gem,true,DIAMOND);
      }else{
        B(-1.8,h+.2,-.3,h+2,1.35,.95,p.guard);B(.5,h+2.1,2.0,h+.3,1.35,.95,p.guard);
        A(0,0,h+1.1,2.0,1.2*Math.SQRT1_2,1.2*Math.SQRT1_2,p.gem,true,DIAMOND);
      }
    });
    const shaft=end=>role('shaft',()=>{
      end=Math.max(1,end);
      if(w.style==='void'){
        A(0,0,-end/2,.4,.4,end,p.gem,true);
        for(const [z,h,col] of [[.13,.23,p.grip],[.51,.25,p.core],[.87,.17,p.metal]])A(0,0,-end*z,1.5,1.5,end*h,col);
      }else{
        const width=w.style==='ember'?1.95:1.45;
        A(0,0,-end/2,width,width,end,w.style==='steel'?p.grip:p.metal);A(0,0,-end*.47,width+.35,width+.35,1.1,p.guard);
        if(w.style==='frost'||w.style==='ember')A(0,0,-end*.5,width+.18,.24,end*.26,p.gem,true);
      }
    });
    const ctx={w,p,A,B,beam,peak,jewel,runes,role,L,T,S,grip,shaft};
    ctx.sigil=(z,size=1)=>buildSignature(ctx,z,size);
    if(EXTRA_STYLES.includes(w.style)&&w.kind!=='fist')buildFamily(ctx);
    else if(['hammer','staff','shieldblade'].includes(w.kind)){grip(w.kind==='hammer'?5.8:4.3);buildExtraWeapon(ctx);}
    else if(w.kind==='bow')buildLegendBow(ctx);
    else if(w.kind!=='fist'){
      grip(w.kind==='dagger'?3.1:(w.kind==='greatsword'||w.kind==='claymore')?7:4.3);
      if(w.kind==='axe')buildLegendAxe(ctx);
      else if(w.kind==='sickle')buildLegendSickle(ctx);
      else if(w.kind==='spear')buildLegendSpear(ctx);
      else buildLegendBlade(ctx);
    }
    if(boxes.length>PART_LIMIT)throw new Error('Weapon component budget exceeded: '+w.kind+' '+w.style+' '+boxes.length);
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const b of boxes)for(const v of b.vertices)for(let i=0;i<3;i++){min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i]);}
    if(!boxes.length)min.fill(0),max.fill(0);
    return Object.freeze({key:keyOf(w),kind:w.kind,style:w.style,tier:w.tier,len:w.len,cubes:Object.freeze(boxes),bounds:Object.freeze({min:Object.freeze(min),max:Object.freeze(max)}),components:boxes.length,features:Object.freeze([...new Set(boxes.map(b=>b.role))])});
  }
  function buildSignature(c,z,q=1){
    const {w,p,A,B,role}=c;
    if(w.style==='steel'){
      role('holy-wings',()=>{
        A(0,0,z,2.7*q,3.0*q,1.6*q,p.metal);
        for(const side of [-1,1]){
          B(side*1.2*q,z,side*4.2*q,z-1.1*q,1.9*q,1.4*q,p.guard);
          B(side*4.2*q,z-1.1*q,side*6.1*q,z-3.8*q,1.45*q,1.0*q,p.guard);
          B(side*3.6*q,z-1.4*q,side*5.9*q,z-1.0*q,1.2*q,.85*q,p.edge);
        }
        A(0,0,z-.3*q,3.0*q,1.7*q*Math.SQRT1_2,1.7*q*Math.SQRT1_2,p.gem,false,DIAMOND);
      });
    }else if(w.style==='ember'){
      role('demon-mask',()=>{
        A(0,0,z,3.4*q,4.2*q,2.5*q,p.metal);A(0,0,z+1.3*q,2.7*q,2.4*q,1.0*q,p.guard);
        for(const side of [-1,1])A(0,side*.97*q,z-.3*q,3.6*q,.82*q,.5*q,p.gem,true);
        A(0,0,z+.9*q,3.55*q,.6*q,.6*q,p.core);
      });
      role('demon-horns',()=>{for(const side of [-1,1]){
        B(side*1.6*q,z-.6*q,side*5.3*q,z-1.3*q,2.4*q,1.9*q,p.guard);
        B(side*5.3*q,z-1.3*q,side*7.4*q,z-5.0*q,1.8*q,1.0*q,p.metal);
      }});
    }else if(w.style==='frost'){
      // A goat-like skull, hollow-looking nose, cyan eye sockets and swept quillons.
      role('skull',()=>{
        A(0,0,z,3.25*q,3.8*q*Math.SQRT1_2,3.8*q*Math.SQRT1_2,p.metal,false,DIAMOND);
        A(0,0,z+1.55*q,2.45*q,2.3*q,1.45*q,p.guard);A(0,0,z+.7*q,3.45*q,.6*q,.95*q,p.core);
        A(0,0,z+1.75*q,2.6*q,1.65*q,.28*q,p.core);
        for(const side of [-1,1])A(0,side*.86*q,z-.17*q,3.5*q,.68*q,.57*q,p.gem,true);
      });
      role('skull-horns',()=>{for(const side of [-1,1]){
        B(side*1.4*q,z-.7*q,side*4.4*q,z-2.0*q,2.2*q,1.8*q,p.guard);
        B(side*4.4*q,z-2.0*q,side*5.8*q,z-4.3*q,1.75*q,1.1*q,p.edge);
        B(side*5.8*q,z-4.3*q,side*6.6*q,z-6.6*q,.95*q,.42*q,p.edge);
        B(side*1.5*q,z+.4*q,side*3.3*q,z+2.5*q,1.9*q,1.35*q,p.metal);
      }});
    }else{
      role('star-halo',()=>{
        const pts=[[-4.4,-1.5],[-2.2,1.8],[2.2,1.8],[4.4,-1.5],[2.1,-4.3],[-2.1,-4.3]];
        for(let i=0;i<pts.length-1;i++){
          const a=pts[i],b=pts[i+1],dy=b[0]-a[0],dz=b[1]-a[1];B((a[0]+dy*.12)*q,z+(a[1]+dz*.12)*q,(b[0]-dy*.12)*q,z+(b[1]-dz*.12)*q,1.7*q,1.0*q,p.guard);
        }
        A(0,0,z-.7*q,2.8*q,2.1*q*Math.SQRT1_2,2.1*q*Math.SQRT1_2,p.gem,true,DIAMOND);
      });
    }
  }
  function buildLegendBlade(c){
    const {w,p,A,B,peak,runes,role,L,T,S,sigil}=c;
    const heavy=w.kind==='greatsword'||w.kind==='claymore',short=w.kind==='dagger',base=(short?2.0:heavy?4.4:3.0)*S,root=Math.min(3.2,L*.19);
    sigil(-.9,short?.56:heavy?1.05:.8);
    if(w.style==='steel'){
      const width=base*.86,tip=Math.min(width*.66,(L-root)*.5),span=L-root-tip*.5;
      role('blade',()=>{A(0,0,-root-span*.34,1.2,width,span*.68,p.blade);A(0,0,-root-span*.84,1.18,width*.66,span*.32,p.blade);});
      peak(0,-L,tip,1.16,p.edge);
      role('gold-fuller',()=>{A(0,0,-root-span*.35,1.4,width*.19,span*.64,p.guard);A(0,0,-root+1.1,1.55,width*.8,1.5,p.metal);});
      if(T>0)role('crest',()=>A(0,0,-root-span*.18,1.6,1.05*Math.SQRT1_2,1.05*Math.SQRT1_2,p.gem,false,DIAMOND));
      if(T===2)for(const side of [-1,1])B(side*width*.38,-L*.39,side*width*.18,-L*.48,1.4,.35,p.edge);
    }else if(w.style==='ember'){
      const width=base*2.1,tip=Math.min(width*.42,(L-root)*.5),span=L-root-tip*.5,shift=width*.14;let at=-root;
      role('cleaver-blade',()=>{[.27,.42,.31].forEach((f,i)=>{const h=span*f,bw=width*[.96,1,.68][i],y=shift+(i===2?-width*.13:0);A(0,y,at-h/2,2.25,bw,h,p.blade);A(0,y+bw/2-.28,at-h/2,2.4,.6,h,p.edge,true);at-=h;});});
      peak(shift-width*.13,-L,tip,2.23,p.edge,true);
      role('saw-teeth',()=>{for(let i=0;i<3;i++){const z=-root-span*(.12+i*.23);B(shift+width*.40,z,shift+width*.75,z-span*.09,1.9,1.35,p.metal);}});
      role('lava-fissure',()=>{B(-width*.12,-root-span*.31,width*.13,-root-span*.52,2.5,.4,p.gem,true);B(width*.13,-root-span*.52,0,-root-span*.62,2.5,.4,p.gem,true);});
      if(T===2)B(-width*.38,-root-span*.14,-width*.62,-root-span*.25,2.0,1.25,p.guard);
    }else if(w.style==='frost'){
      // Frostmourne-inspired: solid scalloped runeblade, pointed tip and skull crossguard.
      const width=base*1.42,tip=Math.min(width*.53,(L-root)*.5),span=L-root-tip*.5,curve=[-.05,.10,-.08,-.025];let at=-root;
      role('runeblade',()=>{[.35,.40,.25].forEach((f,i)=>{const h=span*f,overlap=Math.min(.35,h*.12);B(width*curve[i],at+overlap,width*curve[i+1],at-h-overlap,1.6,width*[.95,.80,.53][i],p.blade);at-=h;});});
      role('blade-edges',()=>{
        B(width*.40,-root,width*.51,-root-span*.35,1.65,.26,p.edge);
        B(-width*.43,-root-span*.35,-width*.42,-root-span*.73,1.65,.26,p.edge);
      });
      role('blade-shoulders',()=>{for(const side of [-1,1])B(side*width*.20,-root+1.5,side*width*.55,-root-1.9,1.65,Math.min(.85,width*.16),p.guard);});
      peak(-width*.025,-L,tip,1.59,p.edge);
      role('blade-barbs',()=>{
        B(-width*.44,-root-span*.28,-width*.78,-root-span*.34,1.55,Math.min(1.2,width*.19),p.edge);
        B(-width*.44,-root-span*.60,-width*.68,-root-span*.67,1.55,Math.min(.95,width*.15),p.edge);
      });
      runes(-root-span*.06,-root-span*.78,short?2:3,Math.min(1.25,width*.22));
      if(T===2)role('relic-seal',()=>A(0,0,-root*.6,1.9,1.45*Math.SQRT1_2,1.45*Math.SQRT1_2,p.gem,true,DIAMOND));
    }else{
      const span=L-root,n=short?3:4,ys=[.16,.82,.57,-.08];
      role('energy-tether',()=>A(0,0,-root-span/2,.28,.28,span,p.gem,true));
      for(let i=0;i<n;i++){
        const z=-root-span*(i+.65)/(n+.12),height=span/(n+.12)*.62,width=Math.min(base*.70,height*.70),y=base*ys[i],lean=(i%2?1:-1)*width*.18;
        role('floating-shards',()=>B(y-lean,z+height*.5,y+lean,z-height*.5,1.5,width,p.blade));
        peak(y+lean,z-height*.5-width*.5,width,1.48,p.edge);
        role('shard-runes',()=>A(0,y,z,1.72,width*.18,Math.max(.3,height*.33),p.gem,true));
      }
      if(T>0)B(base*.6,-L*.48,base*1.30,-L*.56,1.0,1.3,p.metal);
    }
  }
  function buildLegendAxe(c){
    const {w,p,A,B,peak,runes,role,L,T,S,shaft,sigil}=c;shaft(L-3);const z=-L+6.5;
    if(w.style!=='void')role('head-spine',()=>B(0,z+1,0,-L+.4,1.35,1.2,p.metal));
    sigil(z,w.style==='frost'?.7:.64);
    role('axe-head',()=>{
      if(w.style==='steel'){
        B(1,z+1,5.0*S,z-2.4,1.6,3.2,p.blade);B(5*S,z-2.4,8*S,z-.7,1.7,2.5,p.blade);B(8*S,z-.7,5.4*S,z+5.3,1.45,2.2,p.edge);
        B(-1.2,z,-3.7,z-1.9,1.3,1.0,p.metal);peak(0,-L+.1,1.8,1.5,p.metal);
      }else if(w.style==='ember'){
        for(const side of [-1,1]){
          B(side*2,z,side*6.4*S,z-2.6,2.65,4.0,p.blade);B(side*6.4*S,z-2.6,side*9.7*S,z+2.0,2.6,3.3,p.blade);
          B(side*9.7*S,z+2,side*5.4*S,z+6,2.2,2.1,p.edge,true);B(side*6.0*S,z+2.8,side*9.4*S,z+6.3,1.8,1.6,p.metal);
        }
        peak(0,-L-1.5,2.2,2.5,p.edge,true);
      }else if(w.style==='frost'){
        B(1.4,z-.6,7.5*S,z-2.5,1.75,3.8,p.blade);B(7.5*S,z-2.5,8.8*S,z+1.4,1.55,3.1,p.blade);B(8.8*S,z+1.4,4.8*S,z+6.8,1.5,1.6,p.edge);
        B(-1.6,z,-4.1*S,z-3.9,1.45,1.55,p.metal);peak(0,-L-.9,2.25,1.7,p.edge);
      }else{
        const pts=[[2.1,-3.0],[6.1,-4.1],[10.2,-.6],[10.8,4.2],[6.2,7.3]];
        for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dy=b[0]-a[0],dz=b[1]-a[1];B((a[0]+dy*.15)*S,z+a[1]+dz*.15,(b[0]-dy*.15)*S,z+b[1]-dz*.15,1.9,2.0,p.blade);}
        peak(6.2*S,z+6.4,1.6,1.6,p.edge);B(-2,z,-5.6,z+2.1,1.5,2.0,p.metal);
      }
    });
    if(w.style==='frost')runes(z-3,z+1,2,1.0,2.1);
    if(T===2&&w.style!=='frost')role('axe-spike',()=>B(-1,z-1,-3.5,z-4.0,1.4,1.0,p.guard));
  }
  function buildLegendSickle(c){
    const {w,p,A,B,peak,role,L,T,S,shaft,sigil}=c;shaft(L*.71);const z=-L*.73;
    sigil(z,w.style==='frost'?.56:.50);
    role('hook-blade',()=>{
      const heavy=w.style==='ember',width=heavy?3.2:w.style==='frost'?2.2:1.8,spread=(heavy?9.8:w.style==='void'?10.4:7.4)*S;
      if(w.style==='void'){
        const pts=[[0,z],[spread*.47,-L+.8],[spread,-L+2.7],[spread*1.12,-L+7.3],[spread*.70,-L+10.7],[spread*.29,-L+8.2]];
        for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dy=b[0]-a[0],dz=b[1]-a[1];B(a[0]+dy*.15,a[1]+dz*.15,b[0]-dy*.15,b[1]-dz*.15,1.55,1.9,p.blade);}
        peak(spread*.29,-L+7.9,1.1,1.6,p.edge);
      }else{
        B(.5,z-.5,spread*.52,-L+.65,heavy?2.45:1.5,width,p.blade);
        B(spread*.52,-L+.65,spread,-L+3.2,heavy?2.3:1.5,width*.95,p.blade);
        B(spread,-L+3.2,spread*.84,-L+8.3,heavy?2:1.3,width*.55,p.edge,heavy);
        peak(spread*.84,-L+7.6,width*.55,1.5,p.edge,heavy);
        if(heavy){for(let i=0;i<2;i++)B(spread*.8,-L+2.1+i*3,spread*1.2,-L+3.3+i*3,1.65,1.2,p.metal);}
        if(w.style==='frost')role('runes',()=>{B(2.1,-L+1.7,5.5,-L+3.1,1.65,.3,p.gem,true);B(spread*.88,-L+3.6,spread*.76,-L+6.4,1.5,.3,p.gem,true);});
      }
    });
    if(T===2&&w.style==='steel')B(2,z-1,5,z+1,1.5,.7,p.guard);
  }
  function buildLegendSpear(c){
    const {w,p,A,B,peak,runes,role,L,T,S,shaft,sigil}=c;shaft(L-7);const z=-L+6;
    sigil(z,w.style==='frost'?.57:.55);
    role('spear-head',()=>{
      if(w.style==='steel'){
        A(0,0,-L+.8,1.3,2.6*S,6.3,p.blade);peak(0,-L-3.0,2.35*S,1.28,p.edge);A(0,0,-L+1.5,1.48,.45,5,p.guard);
      }else if(w.style==='ember'){
        A(0,0,-L+.7,2.4,4.4*S,5.6,p.blade);peak(0,-L-3,3.8,2.38,p.edge,true);
        for(const side of [-1,1]){B(side*1.2,z-1,side*5.8*S,-L+.2,1.9,2.1,p.metal);peak(side*5.8*S,-L-1.4,1.6,1.9,p.edge,true);}
      }else if(w.style==='frost'){
        A(0,0,-L+.7,1.6,3.6*S,5.4,p.blade);peak(0,-L-3,3.0*S,1.58,p.edge);
        for(const side of [-1,1])B(side*1.3,-L+2.5,side*3.7*S,-L-.3,1.35,1.1,p.edge);
      }else{
        const pts=[[-4.9,z-2.4],[-3.2,z-6.2],[0,z-8.7],[4.0,z-6.5],[5.4,z-1.8],[3.0,z+2.2],[-2.8,z+2.2]];
        for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dy=b[0]-a[0],dz=b[1]-a[1];B((a[0]+dy*.17)*S,a[1]+dz*.17,(b[0]-dy*.17)*S,b[1]-dz*.17,1.6,1.5,p.blade);}
        B(0,z-1,0,-L-3,.3,.3,p.gem,true);peak(0,-L-3,1.4,1.75,p.edge,true);
      }
    });
    if(w.style==='frost')runes(-L+4,-L-1,2,.7);
    if(T===2&&w.style==='steel')for(const side of [-1,1])B(side*.6,z+.8,side*2.9,z+3.1,1.4,.7,p.guard);
  }
  function buildLegendBow(c){
    const {w,p,A,beam,role,T,sigil}=c;
    role('bow-grip',()=>A(0,0,0,w.style==='ember'?2.65:1.7,w.style==='ember'?2.8:1.85,3.25,p.grip));
    sigil(0,w.style==='frost'?.57:.48);
    role('bow-limbs',()=>{for(const side of [-1,1]){
      if(w.style==='steel'){
        beam([0,0,side*1.5],[.8,0,side*4.4],1.5,1.5,p.guard);beam([.8,0,side*4.4],[2.4,0,side*6.8],1.3,1.25,p.blade);beam([2.4,0,side*6.8],[3.2,0,side*8.4],1.15,1.05,p.metal);
        beam([1.1,0,side*4.9],[4.0,0,side*5.8],1.2,.85,p.guard);
      }else if(w.style==='ember'){
        beam([0,0,side*1.4],[5.2,0,side*3.9],2.3,2.45,p.blade);beam([5.2,0,side*3.9],[6.5,0,side*6.5],2.05,2.3,p.metal);beam([6.5,0,side*6.5],[3.2,0,side*8.4],1.6,1.7,p.guard);
        beam([5.9,0,side*6.2],[9.1,0,side*8.3],1.65,1.4,p.metal);A(6.3,0,side*4.5,2.7,1.3,1.5,p.gem,true);
      }else if(w.style==='frost'){
        beam([0,0,side*1.3],[2.6,0,side*4.1],1.8,2.1,p.metal);beam([2.6,0,side*4.1],[2.2,0,side*6.9],1.5,1.7,p.blade);beam([2.2,0,side*6.9],[3.2,0,side*8.4],1.15,1.35,p.edge);
        beam([2.5,0,side*7.0],[5.9,0,side*9.9],1.3,1.2,p.guard);role('runes',()=>beam([2.5,0,side*4.2],[2.2,0,side*6.6],1.7,.30,p.gem,true));
      }else{
        const pts=[[3.2,side*8.4],[6.0,side*6.1],[8.0,side*3.2],[7.8,side*.8]];
        for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1];beam([a[0]+dx*.17,0,a[1]+dz*.17],[b[0]-dx*.17,0,b[1]-dz*.17],1.55,1.6,p.blade);}
        beam([0,0,side*1.1],[3.2,0,side*8.4],.28,.28,p.gem,true);A(5.4,0,side*5.1,1.8,1.2*Math.SQRT1_2,1.2*Math.SQRT1_2,p.gem,true,DIAMOND);
      }
    }});
    if(T>0)role('bow-collar',()=>{A(0,0,-1.25,2.2,2.15,.5,p.metal);A(0,0,1.25,2.2,2.15,.5,p.metal);});
  }

  const EXTRA_STYLES=Object.freeze(['holy','thunder','dragon','blood','nature','abyss']);
  function familyGrip(c,h=4.8){
    const {p,A,role}=c;role('grip',()=>{A(0,0,h/2,1.6,1.6,h,p.grip);A(0,0,.5,2,2,.65,p.metal);A(0,0,h-.5,2,2,.65,p.metal);A(0,0,h+1.1,2.4,1.7,1.7,p.guard,false,DIAMOND);A(0,0,h+1.1,2.65,.7,.8,p.gem,true);});
  }
  function familySign(c,z=0,q=1){
    const {w,p,A,B,role}=c;
    if(!EXTRA_STYLES.includes(w.style)){c.sigil(z,q);return;}
    role('signature',()=>{
      if(w.style==='holy'){
        const r=4.5*q;for(let i=0;i<6;i++){const a=i*Math.PI/3,b=(i+1)*Math.PI/3;B(Math.cos(a)*r,z+Math.sin(a)*r,Math.cos(b)*r,z+Math.sin(b)*r,1.4*q,.9*q,p.guard);}
        A(0,0,z,2.4*q,1.7*q,1.7*q,p.gem,true,DIAMOND);for(const side of [-1,1])B(side*3*q,z,side*7.3*q,z-2.2*q,1.4*q,1.1*q,p.edge);
      }else if(w.style==='thunder'){
        B(-6*q,z+1,-1*q,z-2.3*q,2.0*q,1.5*q,p.guard);B(-1*q,z-2.3*q,2*q,z+.7*q,2.0*q,1.6*q,p.metal);B(2*q,z+.7*q,6*q,z-3*q,1.7*q,1.1*q,p.guard);A(0,0,z-.6,2.8*q,1.3*q,1.4*q,p.gem,true);
      }else if(w.style==='dragon'){
        A(0,0,z,3.0*q,3.3*q,2.4*q,p.guard);A(0,0,z+1.7*q,2.3*q,1.7*q,2.0*q,p.metal);
        for(const side of [-1,1]){A(0,side*.8*q,z-.2*q,3.2*q,.6*q,.55*q,p.gem,true);B(side*1.1*q,z-.5*q,side*5.4*q,z-4.3*q,1.8*q,1.0*q,p.edge);B(side*1.2*q,z+1.4*q,side*2.3*q,z+2.5*q,1.2*q,.6*q,p.edge);}
      }else if(w.style==='blood'){
        for(const side of [-1,1]){B(side*1.0*q,z+1.1*q,side*4.4*q,z-.8*q,1.7*q,1.4*q,p.guard);B(side*4.4*q,z-.8*q,side*3.2*q,z-4.0*q,1.5*q,.75*q,p.edge);}
        A(0,0,z,2.7*q,2.0*q,2.0*q,p.gem,true,DIAMOND);
      }else if(w.style==='nature'){
        for(const side of [-1,1]){B(side*.6*q,z+.8*q,side*3.4*q,z-1.3*q,1.6*q,1.1*q,p.grip);B(side*3.4*q,z-1.3*q,side*5.4*q,z-4*q,1.2*q,.75*q,p.guard);A(0,side*3.8*q,z-2.4*q,1.0*q,1.6*q,1.9*q,p.blade,false,DIAMOND);}
        A(0,0,z,2.4*q,1.4*q,1.4*q,p.gem,true);
      }else{
        const r=4.4*q;for(let i=0;i<6;i++){const a=i*Math.PI/3,b=(i+.82)*Math.PI/3;B(Math.cos(a)*r,z+Math.sin(a)*r*.66,Math.cos(b)*r,z+Math.sin(b)*r*.66,1.5*q,.8*q,p.metal);}
        A(0,0,z,2.6*q,1.7*q,1.4*q,p.gem,true);
      }
    });
  }
  function localProfile(c,z,angle,L,width){
    const co=Math.cos(angle),si=Math.sin(angle),R=[1,0,0,0,co,-si,0,si,co],map=v=>[v[0],v[1]*co-v[2]*si,z+v[1]*si+v[2]*co];
    const rotate=a=>{const out=[];for(let r=0;r<3;r++)for(let col=0;col<3;col++){let n=0;for(let k=0;k<3;k++)n+=R[r*3+k]*a[k*3+col];out.push(n);}return out;};
    const A=(x,y,zz,sx,sy,sz,col,nf=false,axes=null)=>{const v=map([x,y,zz]);c.A(...v,sx,sy,sz,col,nf,rotate(axes||IDENTITY));};
    const B=(y0,z0,y1,z1,dep,wide,col,nf=false)=>c.beam(map([0,y0,z0]),map([0,y1,z1]),dep,wide,col,nf);
    const peak=(y,zz,wide,dep,col,nf=false)=>c.role('point',()=>A(0,y,zz+wide/2,dep,wide*Math.SQRT1_2,wide*Math.SQRT1_2,col,nf,DIAMOND));
    return {...c,A,B,peak,L,forceWidth:width};
  }
  function profileBlade(c){
    const {w,p,A,B,peak,role,L,T}=c,b=c.forceWidth||(w.kind==='dagger'?2.4:w.kind==='sword'?3.8:5.4)*(1+T*.09),end=L;
    role('family-blade',()=>{
      if(w.style==='holy'){
        B(0,0,0,-end*.73,1.45,b,p.blade);B(0,-end*.65,0,-end+b*.3,1.4,b*.62,p.blade);peak(0,-end,b*.6,1.38,p.edge);
        A(0,0,-end*.42,1.7,b*.19,end*.73,p.gem,true);
        for(const side of [-1,1]){B(side*b*.38,-end*.24,side*b*.92,-end*.38,1.15,b*.36,p.guard);B(side*b*.5,-end*.57,side*b*.83,-end*.67,1.1,.6,p.edge);}
      }else if(w.style==='thunder'){
        const pts=[[0,0],[b*.66,-end*.26],[-b*.48,-end*.47],[b*.58,-end*.69],[0,-end+b*.25]];
        for(let i=0;i<pts.length-1;i++){const a=pts[i],bb=pts[i+1];B(a[0],a[1],bb[0],bb[1],1.65,b*.60,p.blade);B(a[0],a[1],bb[0],bb[1],1.9,.3,p.gem,true);}peak(0,-end,b*.5,1.6,p.edge);
      }else if(w.style==='dragon'){
        B(0,0,b*.32,-end*.55,2.1,b*1.05,p.blade);B(b*.32,-end*.51,b*.07,-end+b*.3,1.9,b*.67,p.blade);peak(b*.07,-end,b*.65,1.88,p.edge);
        for(let i=0;i<3;i++)B(-b*.4,-end*(.2+i*.19),-b*.85,-end*(.28+i*.19),1.5,.9,p.edge);
        A(0,0,-end*.35,2.25,.5,end*.35,p.gem,true);
      }else if(w.style==='blood'){
        const pts=[[0,0],[b*.76,-end*.30],[b*.92,-end*.56],[b*.5,-end*.78],[0,-end+b*.25]];
        for(let i=0;i<4;i++)B(...pts[i],...pts[i+1],1.6,b*[.72,.84,.70,.42][i],p.blade);peak(0,-end,b*.45,1.55,p.edge);
        B(b*.65,-end*.30,b*.84,-end*.65,1.85,.32,p.gem,true);B(-b*.2,-end*.08,-b*.55,-end*.23,1.3,1.0,p.guard);
      }else if(w.style==='nature'){
        for(const side of [-1,0,1]){const y=side*b*1.08,zz=-end*(side?.80:1);B(side*.35,0,y,zz+b*.35,1.25,b*(side?.46:.65),p.blade);peak(y,zz,b*(side?.4:.55),1.22,p.edge);}
        A(0,0,-end*.42,1.5,.4,end*.66,p.gem,true);B(-b*.4,-end*.38,-b,-end*.49,1.0,.6,p.grip);
      }else{
        const left=[[0,0],[-b*.93,-end*.33],[-b*.73,-end*.67],[0,-end]],right=[[0,0],[b*.93,-end*.33],[b*.73,-end*.67],[0,-end]];
        for(const pts of [left,right])for(let i=0;i<3;i++)B(...pts[i],...pts[i+1],1.5,b*.28,p.blade);
        A(0,0,-end*.47,2.2,b*.38,b*.58,p.gem,true,DIAMOND);A(0,0,-end*.5,.24,.24,end*.96,p.core);
      }
    });
  }
  function buildFamily(c){
    const {w,p,A,B,beam,role,L,T,peak,shaft}=c;
    if(w.kind==='bow'){
      familyGrip(c,2.1);familySign(c,0,.5);
      role('family-bow',()=>{for(const side of [-1,1]){
        const mid={holy:3.6,thunder:5.4,dragon:6.8,blood:7.0,nature:2.6,abyss:7.8}[w.style];
        beam([0,0,side*1.4],[mid,0,side*4.7],1.5,1.8,p.blade);beam([mid,0,side*4.7],[3.2,0,side*8.4],1.4,1.3,p.guard);
        if(w.style==='nature'||w.style==='dragon')beam([mid,0,side*4.7],[mid+3,side*1.4,side*7.3],1.1,1.0,p.edge);
        if(w.style==='thunder')beam([mid,0,side*4.7],[mid-1.3,0,side*6.3],1.7,.28,p.gem,true);
        if(w.style==='abyss')beam([0,0,side*1.2],[3.2,0,side*8.4],.25,.25,p.gem,true);
      }});return;
    }
    familyGrip(c,w.kind==='greatsword'||w.kind==='claymore'?7:w.kind==='dagger'?3.1:4.5);
    if(['hammer','staff','shieldblade'].includes(w.kind)){buildExtraWeapon(c);return;}
    if(['sword','greatsword','claymore','dagger'].includes(w.kind)){familySign(c,-.7,w.kind==='dagger'?.55:1);profileBlade(localProfile(c,-2.3,0,Math.max(1,L-2.3)));return;}
    if(w.kind==='spear'){shaft(Math.max(1,L-8));familySign(c,-L+7,.58);profileBlade(localProfile(c,-L+8,0,11,3.0));return;}
    if(w.kind==='axe'){shaft(Math.max(1,L-4));familySign(c,-L+6,.62);profileBlade(localProfile(c,-L+7,Math.PI/2,11,5.3));return;}
    shaft(L*.70);familySign(c,-L*.72,.52);
    role('family-hook',()=>{
      const spread={holy:7.5,thunder:10.1,dragon:8.8,blood:10.0,nature:7.8,abyss:10.8}[w.style],pts=[[0,-L*.73],[spread*.45,-L+.5],[spread,-L+2.7],[spread*.94,-L+7.1],[spread*.55,-L+10.4]];
      for(let i=0;i<4;i++){const a=pts[i],bb=pts[i+1],f=w.style==='abyss'?.14:0,dy=bb[0]-a[0],dz=bb[1]-a[1];B(a[0]+dy*f,a[1]+dz*f,bb[0]-dy*f,bb[1]-dz*f,w.style==='dragon'?1.9:1.4,w.style==='blood'?2.8:1.85,p.blade);}
      if(['dragon','thunder','nature'].includes(w.style))for(let i=0;i<2;i++)B(spread*.7,-L+3+i*2.4,spread*1.16,-L+3.8+i*2.4,1.2,.9,p.edge);
      A(0,spread*.57,-L+1.1,1.7,.5,1.4,p.gem,true);
    });
  }
  function buildExtraWeapon(c){
    const {w,p,A,B,peak,runes,role,L,T,shaft}=c,newStyle=EXTRA_STYLES.includes(w.style),sign=(z,q)=>familySign(c,z,q);
    if(w.kind==='hammer'){
      shaft(Math.max(1,L-5));const z=-L+4;sign(z+7.5,.59);
      role('hammer-head',()=>{
        if(w.style==='abyss'||w.style==='void'){
          for(const y of [-5.2,5.2])A(0,y,z,3.4,1.4,6.4,p.metal);for(const zz of [-2.8,2.8])A(0,0,z+zz,3.4,10.5,1.25,p.blade);A(0,0,z,3.8,2.1,2.1,p.gem,true);
        }else if(w.style==='holy'){
          A(0,0,z,3.2,6.6,6.6,p.metal);
          for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4;B(Math.cos(a)*5.5,z+Math.sin(a)*5.5,Math.cos(b)*5.5,z+Math.sin(b)*5.5,3.3,1.8,p.guard);}
          A(0,0,z,3.45,1.3,4.4,p.gem,true);
        }else if(w.style==='thunder'){
          A(0,0,z,3.6,5.8,5.0,p.metal);
          A(0,-4.4,z-1.7,4.0,3.6,6.2,p.blade);A(0,4.4,z+1.7,4.0,3.6,6.2,p.blade);
          B(-4,z-3.7,0,z-.8,4.2,.4,p.gem,true);B(0,z-.8,4,z+3.7,4.2,.4,p.gem,true);
          B(-1,z-2,-2.8,z-7,1.6,1.0,p.guard);
        }else if(w.style==='dragon'){
          B(-5.2,z-2.5,5.2,z-2.5,3.4,2.3,p.blade);B(-5.2,z+2.5,5.2,z+2.5,3.4,2.3,p.blade);
          for(const side of [-1,1]){A(0,side*5.6,z,3.8,2.0,7.7,p.metal);for(const s of [-1,1])B(side*3.4,z+s*2.4,side*2.6,z+s*5.8,2.1,.9,p.edge);}
          A(0,0,z,3.7,1.3,1.6,p.gem,true);
        }else if(w.style==='blood'){
          A(0,0,z,3.6,5.1,10.2,p.blade);A(0,0,z,3.9,.5,7.8,p.gem,true);
          for(const side of [-1,1])for(const s of [-1,1])B(side*2.0,z+s*2.9,side*5.8,z+s*4.6,2.0,1.2,p.guard);
        }else if(w.style==='nature'){
          B(-5,z-1.8,5,z-.6,4.0,4.0,p.grip);B(-4.6,z+1.5,4.8,z+2.6,3.3,2.6,p.metal);
          for(const side of [-1,1]){B(side*3.5,z-1,side*7.0,z-4.8,1.5,1.1,p.guard);A(0,side*6.5,z-4.4,1.4,2.0,3.0,p.blade,false,DIAMOND);}
          A(0,0,z,4.2,1.5,1.6,p.gem,true);
        }else{
          A(0,0,z,3.9,7.9,5.4,p.metal);for(const side of [-1,1]){A(0,side*4.6,z,4.2,2.1,6.4,p.blade);A(0,side*5.45,z,4.35,.35,4.4,p.edge);}
          A(0,0,z,4.1,.7,3.8,p.gem,true);
          if(w.style==='ember')for(const side of [-1,1])B(side*4,z-2.3,side*5.6,z-5.2,2.0,1.1,p.guard);
        }
      });if(w.style==='frost')runes(z-1.6,z+1.6,2,1.1,4.25);return;
    }
    if(w.kind==='staff'){
      shaft(Math.max(1,L-7));const z=-L+4;sign(z,.58);
      role('staff-focus',()=>{A(0,0,z-2.5,3.0,2.5,2.5,p.gem,true,DIAMOND);for(const side of [-1,1]){B(side*1.0,z+.5,side*4.2,z-2.3,1.3,1.0,p.guard);B(side*4.2,z-2.3,side*2.0,z-5.9,1.1,.65,p.edge);}A(0,0,z-2.3,.22,.22,7.8,p.gem,true);});
      if(w.style==='frost')runes(-L+10,-L+6,2,.8,1.8);return;
    }
    // A shieldblade is a blade mounted above a compact shield, not two damage rigs.
    sign(-2,.62);
    role('shield-plate',()=>{A(0,0,-6,1.5,7.2,9.6,p.metal);for(const side of [-1,1]){B(side*3.6,-10,side*5.0,-5.0,1.9,.8,p.guard);B(side*5,-5,side*1.4,-.8,1.9,.8,p.guard);}A(0,0,-6,2.0,1.8,2.0,p.gem,true,DIAMOND);});
    if(newStyle)profileBlade(localProfile(c,-10.0,0,Math.max(1,L-10),2.5));
    else{role('shield-blade',()=>{A(0,0,-10-(L-11)/2,1.2,2.6,Math.max(1,L-11),p.blade);peak(0,-L,1.6,1.17,p.edge);});if(w.style==='frost')runes(-13,-L+2,2,.7,1.4);}
  }

  function model(look) {
    const w=normalize(look), key=keyOf(w);
    if(models.has(key)) { hits++;return touch(models,key,models.get(key),MODEL_LIMIT); }
    misses++;return touch(models,key,makeModel(w),MODEL_LIMIT);
  }
  function append(matrix,look,out) {
    const phase=global.performance?global.performance.now()/1000:0;
    for(const b of model(look).cubes) out.push({M:b.local?multiply(matrix,b.local):matrix,c:b.local?ZERO:b.c,s:b.s,col:b.emissive?colorMix(b.col,'#ffffff',.08+.08*Math.sin(phase*2.4)):b.col,nf:b.nf,emissive:b.emissive});
    return out;
  }
  function multiply(a,b) {
    const r=new Array(12);
    for(let i=0;i<3;i++) {
      for(let j=0;j<3;j++) r[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[j+3]+a[i*3+2]*b[j+6];
      r[9+i]=a[i*3]*b[9]+a[i*3+1]*b[10]+a[i*3+2]*b[11]+a[9+i];
    }
    return r;
  }
  function appendBow(matrix,look,draw,out) {
    look=look||{};
    append(matrix,Object.assign({},look,{kind:'bow',len:18}),out);
    const d=clamp(finite(draw,0),0,1), pull=-1-d*4.5;
    for(const side of [-1,1]) {
      const dx=pull-3.2,dz=-side*8.4,h=Math.hypot(dx,dz),a=Math.atan2(dx,dz),c=Math.cos(a),s=Math.sin(a);
      const local=[c,0,s,0,1,0,-s,0,c,(3.2+pull)/2,0,side*4.2];
      out.push({M:multiply(matrix,local),c:[0,0,0],s:[.26,.26,h],col:'#e4e6e5',nf:true});
    }
    if(d>0) {
      const x=4-d*4.5;
      out.push({M:matrix,c:[x,0,0],s:[11,.6,.6],col:'#ad9673'});
      out.push({M:matrix,c:[x+5.9,0,0],s:[1.5,1.25,1.15],col:STYLES[look.style] ? STYLES[look.style].edge:'#dce8ef'});
      out.push({M:matrix,c:[x-4.8,0,0],s:[1.5,1.2,1.2],col:'#e5e1d3'});
    }
    return out;
  }
  const FACES=[
    {a:0,s:1,ids:[1,3,7,5]}, {a:0,s:-1,ids:[0,4,6,2]},
    {a:1,s:1,ids:[2,6,7,3]}, {a:1,s:-1,ids:[0,1,5,4]},
    {a:2,s:1,ids:[4,5,7,6]}, {a:2,s:-1,ids:[0,2,3,1]}
  ];
  function shade(col,f) { return colorMix('#000000',col,clamp(f,0,1)); }
  // Per-pixel depth, rather than average face sorting, keeps raised runes visible.
  const rasterBuffers=new WeakMap();
  function rasterBuffer(ctx,w,h){
    let b=rasterBuffers.get(ctx);
    if(!b||b.width<w||b.height<h){
      const width=Math.ceil(w/32)*32,height=Math.ceil(h/32)*32;
      const canvas=global.document?global.document.createElement('canvas'):global.OffscreenCanvas?new global.OffscreenCanvas(width,height):new ctx.canvas.constructor(width,height);
      canvas.width=width;canvas.height=height;const target=canvas.getContext('2d');
      b={canvas,target,width,height,image:target.createImageData(width,height),depth:new Float32Array(width*height)};rasterBuffers.set(ctx,b);
    }
    b.image.data.fill(0);b.depth.fill(-Infinity);return b;
  }
  function rasterColor(value,ctx){
    if(/^#[0-9a-f]{6}$/i.test(value))return [parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16),255];
    ctx.fillStyle=value;const normalized=ctx.fillStyle;
    if(/^#[0-9a-f]{6}$/i.test(normalized))return rasterColor(normalized,ctx);
    const nums=normalized.match(/[\d.]+/g)||[0,0,0];return [+nums[0],+nums[1],+nums[2],nums.length>3?Math.round(+nums[3]*255):255];
  }
  function rasterTriangle(b,vertices,color,edgeMask,w,h,outline){
    const [v0,v1,v2]=vertices,area=(v1[0]-v0[0])*(v2[1]-v0[1])-(v1[1]-v0[1])*(v2[0]-v0[0]);
    if(Math.abs(area)<1e-8||!color[3])return;
    const sign=area>0?1:-1,den=Math.abs(area);
    const A0=(v1[1]-v2[1])*sign,B0=(v2[0]-v1[0])*sign,C0=(v1[0]*v2[1]-v2[0]*v1[1])*sign;
    const A1=(v2[1]-v0[1])*sign,B1=(v0[0]-v2[0])*sign,C1=(v2[0]*v0[1]-v0[0]*v2[1])*sign;
    const A2=(v0[1]-v1[1])*sign,B2=(v1[0]-v0[0])*sign,C2=(v0[0]*v1[1]-v1[0]*v0[1])*sign;
    const zx=(A0*v0[2]+A1*v1[2]+A2*v2[2])/den,zy=(B0*v0[2]+B1*v1[2]+B2*v2[2])/den,zc=(C0*v0[2]+C1*v1[2]+C2*v2[2])/den;
    const left=Math.max(0,Math.ceil(Math.min(v0[0],v1[0],v2[0])-.5)),right=Math.min(w-1,Math.floor(Math.max(v0[0],v1[0],v2[0])-.5));
    const top=Math.max(0,Math.ceil(Math.min(v0[1],v1[1],v2[1])-.5)),bottom=Math.min(h-1,Math.floor(Math.max(v0[1],v1[1],v2[1])-.5));
    const e0=outline&&edgeMask[0]?Math.hypot(A0,B0)*.38:-Infinity,e1=outline&&edgeMask[1]?Math.hypot(A1,B1)*.38:-Infinity,e2=outline&&edgeMask[2]?Math.hypot(A2,B2)*.38:-Infinity;
    const data=b.image.data,depth=b.depth,stride=b.width;
    for(let y=top;y<=bottom;y++){
      const yy=y+.5,xx=left+.5;let f0=A0*xx+B0*yy+C0,f1=A1*xx+B1*yy+C1,f2=A2*xx+B2*yy+C2,z=zx*xx+zy*yy+zc,at=y*stride+left;
      for(let x=left;x<=right;x++,at++,f0+=A0,f1+=A1,f2+=A2,z+=zx){
        if(f0>=-1e-6&&f1>=-1e-6&&f2>=-1e-6&&z>=depth[at]-1e-5){
          depth[at]=z;const i=at*4,shade=f0<e0||f1<e1||f2<e2?.78:1;
          data[i]=Math.round(color[0]*shade);data[i+1]=Math.round(color[1]*shade);data[i+2]=Math.round(color[2]*shade);data[i+3]=color[3];
        }
      }
    }
  }
  function paint(ctx,look,x,y,w,h,options){
    options=options||{};const md=options.model||model(look);if(!md.cubes.length||w<=0||h<=0)return md;
    const yaw=finite(options.yaw,.65),tilt=finite(options.tilt,-.30),co=Math.cos(yaw),si=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
    const pair=options.pair===undefined?!!look.dual:!!options.pair,offsets=pair?[-1,1]:[0],spacing=(md.bounds.max[1]-md.bounds.min[1]+3)*.39;
    const polys=[];let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const offset of offsets)for(const box of md.cubes){
      const points=box.vertices.map(v=>{
        const px=v[0],py=v[1]+offset*spacing,pz=v[2]+offset*1.1,depth=px*co+py*si,u=py*co-px*si,vv=pz+depth*.36;
        const p=[u*ct-vv*st,u*st+vv*ct,depth-pz*.36];minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);return p;
      });
      const axes=box.axes||IDENTITY;
      for(const face of FACES){
        const nx=axes[face.a]*face.s,ny=axes[3+face.a]*face.s,nz=axes[6+face.a]*face.s;if(nx*co+ny*si-nz*.36<=.0001)continue;
        const light=box.emissive?1:clamp(.72+nx*.10+ny*.08-nz*.21,.4,1);
        polys.push({points:face.ids.map(i=>points[i]),col:options.silhouette?(typeof options.silhouette==='string'?options.silhouette:'#000000'):shade(box.col,light),outline:!options.silhouette&&!box.emissive&&options.outline!==false});
      }
    }
    const pad=finite(options.padding,Math.min(w,h)*.1),ref=options.referenceSpan,zoom=Math.min((w-pad*2)/Math.max(.1,ref?ref[0]:maxX-minX),(h-pad*2)/Math.max(.1,ref?ref[1]:maxY-minY));
    if(!Number.isFinite(zoom)||zoom<=0)return md;
    const cx=x+w/2,cy=y+h/2,bx=(minX+maxX)/2,by=(minY+maxY)/2;
    const rx=Math.floor(cx+(minX-bx)*zoom)-1,ry=Math.floor(cy+(minY-by)*zoom)-1;
    const rw=Math.max(1,Math.ceil(cx+(maxX-bx)*zoom)-rx+1),rh=Math.max(1,Math.ceil(cy+(maxY-by)*zoom)-ry+1),buffer=rasterBuffer(ctx,rw,rh);
    for(const poly of polys){
      const pp=poly.points.map(p=>[cx+(p[0]-bx)*zoom-rx,cy+(p[1]-by)*zoom-ry,p[2]]),color=rasterColor(poly.col,buffer.target);
      rasterTriangle(buffer,[pp[0],pp[1],pp[2]],color,[true,false,true],rw,rh,poly.outline);
      rasterTriangle(buffer,[pp[0],pp[2],pp[3]],color,[true,true,false],rw,rh,poly.outline);
    }
    buffer.target.putImageData(buffer.image,0,0,0,0,rw,rh);ctx.drawImage(buffer.canvas,0,0,rw,rh,rx,ry,rw,rh);return md;
  }

  function drawIcon(ctx,look,x,y,w,h) {
    const iw=clamp(Math.ceil(w*2),4,512),ih=clamp(Math.ceil(h*2),4,512);
    const key=model(look).key+'|'+iw+'x'+ih+'|'+(look.dual?1:0);
    let canvas=icons.get(key);
    if(!canvas && global.document) {
      canvas=global.document.createElement('canvas');canvas.width=iw;canvas.height=ih;
      paint(canvas.getContext('2d'),look,0,0,iw,ih,{yaw:.67,tilt:-.23,padding:Math.min(iw,ih)*.06});
      touch(icons,key,canvas,ICON_LIMIT);
    } else if(canvas) touch(icons,key,canvas,ICON_LIMIT);
    if(canvas) ctx.drawImage(canvas,x,y,w,h);
    else paint(ctx,look,x,y,w,h,{yaw:.67,tilt:-.23,padding:Math.min(w,h)*.06});
  }
  const LORE=Object.freeze({"steel":"王庭工匠以圣翼护手和金色剑脊表示守护誓言。外形克制、连续、完整，保持清晰的骑士轮廓。","ember":"恶魔面甲封住锻炉中的火焰。长弯角、偏心重刃与熔岩裂缝让每次重击看起来更沉重。","frost":"参考霜之哀伤的骷髅护手、倒钩和符文剑脊，并按方块地牢的体素语言重建。冰蓝来自符文与眼窝，而不是整块冰枝。","void":"星环维持刃片之间的联系。悬浮片有真正尖端与断口，虚空不是同一把剑的紫色涂装。","holy":"失落圣堂将余烬封进白金剑脊。日轮不是装饰贴图，而是环绕持握处的实体光环；斧、镰和长弓同样保留圣翼轮廓。","thunder":"风暴工匠不试图驯服雷电，而让刃体沿电流折返。每一处拐角都是锻造节点；雷霆战锤的双头负责将风暴压入地面。","dragon":"巨龙陨落后，最坚硬的不是鳞甲，而是被吐息淬炼的颅骨。龙颅与獠牙直接参与武器结构，古老琥珀留在眼窝中。","blood":"守望者在赤月之夜立下誓约，将一面小盾和一柄短刃锻成同一件兵器。血月系列的月牙护手象征收束与反击。","nature":"林地没有铸造炉，却有会记住形状的树木。枝桠沿握柄攀升，最后展开成三片利叶；翡翠芽核让枯木再次发光。","abyss":"深渊之眼从不藏在刀面后：实体刃框围绕它生长。武器看似空缺，却正因为空缺而产生自己的轮廓。"});
  function effects(style){const p=STYLES[style]||STYLES.steel;return {color:p.accent,core:p.gem,kind:style,pulse:p.glow};}
  function rgb(color){const v=parseInt(color.slice(1),16);return [(v>>16)&255,(v>>8)&255,v&255].join(',');}
  global.WeaponModels=Object.freeze({version:VERSION,STYLE_IDS,STYLES,KINDS,LORE,effects,rgb,designName,styleOf,forItem,model,append,appendBow,paint,drawIcon,
    cacheInfo:()=>({models:models.size,icons:icons.size,hits,misses,modelLimit:MODEL_LIMIT,iconLimit:ICON_LIMIT,partLimit:PART_LIMIT}),
    clearCache:()=>{models.clear();icons.clear();hits=0;misses=0;}});
})(typeof window!=='undefined'?window:globalThis);
