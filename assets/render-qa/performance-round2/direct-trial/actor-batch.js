// Shared instanced body renderer. Animation and combat continue to own their rigs.
(function(root){
'use strict';
const LIMIT=32768,META_ROWS=1024;
const vertex=`
attribute vec3 aSize; attribute vec3 aBase; attribute vec4 aData;
attribute vec4 aAppearance; attribute vec4 aWarm; attribute vec3 aWarmColor;
attribute vec3 aCoolColor; attribute vec4 aStatus;
uniform sampler2D skinRects;
varying vec2 vSkin; varying vec2 vFaceUV; varying vec3 vBase;
varying vec3 vTone; varying vec4 vShade; varying vec4 vMaterial;
float flag(float n,float bit){return mod(floor(n/bit),2.0);}
void main(){
  float axis=abs(normal.x)>.5?0.0:abs(normal.y)>.5?1.0:2.0;
  float signN=axis<.5?normal.x:axis<1.5?normal.y:normal.z;
  float face=axis*2.0+(signN>0.0?0.0:1.0);
  vec3 raw=mat3(instanceMatrix)*(normal/aSize);raw.y=-raw.y;
  float shown=flag(aData.y,pow(2.0,face));
  if(raw.y+raw.z*.842105263<=.00001)shown=0.0;
  vec2 uvFace;
  if(axis<.5)uvFace=vec2(signN>0.0?position.y+.5:.5-position.y,.5-position.z);
  else if(axis<1.5)uvFace=vec2(signN>0.0?.5-position.x:position.x+.5,.5-position.z);
  else uvFace=vec2(position.y+.5,signN>0.0?position.x+.5:.5-position.x);
  vec4 rect=texture2D(skinRects,vec2((face+.5)/6.0,(aData.x+.5)/1024.0));
  vSkin=rect.xy+uvFace*rect.zw;
  vFaceUV=axis<.5?vec2(position.y+.5,position.z+.5):axis<1.5?vec2(position.x+.5,position.z+.5):vec2(position.x+.5,position.y+.5);
  float emissive=flag(aAppearance.x,4.0),tiny=flag(aAppearance.x,1.0),soft=flag(aAppearance.x,2.0),fixedColor=flag(aAppearance.x,8.0);
  float f=emissive>.5?.97+.06*raw.z:flag(aAppearance.x,32.0)>.5?clamp(.84+aAppearance.w+.20*raw.z+.06*(raw.y-raw.x),.6,1.18):clamp(.7+aAppearance.w+.36*raw.z+.12*(raw.y-raw.x),.35,1.18);
  float diffuse=clamp(dot(raw,aWarm.xyz),0.0,1.0),warm=clamp(diffuse+.20*aWarm.w,0.0,1.0);
  float facing=clamp(-raw.x*.34-raw.y*.45+raw.z*.82,0.0,1.0);
  float gain=.90+.09*facing+.30*warm+flag(aAppearance.x,16.0)*.18*pow(facing,12.0);
  vec3 tone=warm>.15?aWarmColor:aCoolColor;
  float amount=warm>.15?min(.30,warm*.34):.09*(1.0-facing*.55);
  if(aAppearance.z<.5||emissive>.5||fixedColor>.5){gain=1.0;amount=0.0;}
  if(aStatus.w>0.0){tone=aStatus.xyz;amount=aStatus.w;}
  f=clamp(f*gain,.35,1.22);
  if(fixedColor>.5){amount=0.0;if(aData.x>.5)f=1.0;}
  vBase=mix(aBase,tone,floor(amount*10.0+.5)/10.0);vTone=tone;
  vShade=vec4(f,amount,soft*(1.0-tiny),shown);
  vMaterial=vec4(aData.x,aData.z,aData.w,aAppearance.y);
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
}`;
const fragment=`
precision highp float;
uniform sampler2D skins; uniform sampler2D grain;
varying vec2 vSkin; varying vec2 vFaceUV; varying vec3 vBase;
varying vec3 vTone; varying vec4 vShade; varying vec4 vMaterial;
vec3 shade(vec3 c,float f){return f>1.0?c+(1.0-c)*(f-1.0):c*f;}
void main(){
  if(vShade.w<.5)discard;
  vec3 rgb;float alpha=vMaterial.w,f=vShade.x;
  if(vMaterial.x>.5){
    vec4 tex=texture2D(skins,vSkin);if(tex.a<.05)discard;
    rgb=mix(tex.rgb,vTone,floor(vShade.y*20.0+.5)/20.0);
    f=floor(clamp(f,.4,1.2)*10.0+.5)/10.0;
    rgb=f<1.0?rgb*f:rgb+(1.0-rgb)*(f-1.0)*.7;alpha*=tex.a;
  }else if(vMaterial.y>0.0){
    vec2 cell=floor(clamp(vFaceUV,0.0,.9999)*6.0);
    float bump=texture2D(grain,vec2((cell.x+.5)/6.0,(cell.y+vMaterial.z*6.0+.5)/48.0)).r*2.0-1.0;
    rgb=shade(vBase,clamp(floor(f*20.0+.5)/20.0+bump*vMaterial.y*.36,.3,1.22));
  }else{
    float u=(vFaceUV.x+vFaceUV.y)*.5;
    float soft=vShade.z>.5?mix(1.12,.78,u):1.0;
    rgb=shade(vBase,clamp(f*soft,.3,1.22));
  }
  gl_FragColor=vec4(clamp(rgb,0.0,1.0),alpha);
}`;
const rgbCache=new Map();
function rgb(hex){let c=rgbCache.get(hex);if(c)return c;const n=parseInt((hex||'#ffffff').slice(1),16);c=[(n>>16)/255,(n>>8&255)/255,(n&255)/255];rgbCache.set(hex,c);if(rgbCache.size>4096)rgbCache.delete(rgbCache.keys().next().value);return c;}
class ActorBatch{
  constructor(T,scene){
    this.T=T;this.scene=scene;this.failed=false;this.ready=false;this.count=0;this.actors=0;this.metaRows=new WeakMap();this.metaCount=1;
    const geometry=new T.BoxGeometry(1,1,1),attrs={aSize:3,aBase:3,aData:4,aAppearance:4,aWarm:4,aWarmColor:3,aCoolColor:3,aStatus:4};
    this.attributes={};
    for(const [name,size] of Object.entries(attrs)){const a=new T.InstancedBufferAttribute(new Float32Array(LIMIT*size),size);a.setUsage(T.DynamicDrawUsage);geometry.setAttribute(name,a);this.attributes[name]=a;}
    this.rectData=new Float32Array(6*META_ROWS*4);this.rectTexture=new T.DataTexture(this.rectData,6,META_ROWS,T.RGBAFormat,T.FloatType);this.rectTexture.needsUpdate=true;
    const grains=new Uint8Array(6*48*4);
    for(let variant=0;variant<8;variant++)for(let y=0;y<6;y++)for(let x=0;x<6;x++){
      const seed=variant*137,px=((Math.floor(((x+.5)/6+seed*.013)*32)%32)+32)%32,py=((Math.floor(((y+.5)/6+seed*.017)*32)%32)+32)%32;
      const h=(a,b)=>.52+.22*Math.sin(a*.43+b*.19)+.12*Math.sin(a*1.17-b*.83)+.06*Math.sin(a*2.73+b*2.11);
      const dx=(h(px-1,py)-h(px+1,py))*1.7,dy=(h(px,py-1)-h(px,py+1))*1.7,inv=1/Math.hypot(dx,dy,1),p=((variant*6+y)*6+x)*4;
      const v=Math.round((Math.round(dx*inv*127)/127*.65+Math.round(dy*inv*127)/127*.35+1)*127.5);grains[p]=grains[p+1]=grains[p+2]=v;grains[p+3]=255;
    }
    const grain=new T.DataTexture(grains,6,48);grain.needsUpdate=true;
    this.material=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{skins:{value:null},skinRects:{value:this.rectTexture},grain:{value:grain}},side:T.DoubleSide,transparent:true,depthWrite:true,toneMapped:false});
    this.material.forceSinglePass=true;
    this.mesh=new T.InstancedMesh(geometry,this.material,LIMIT);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.count=0;this.mesh.castShadow=true;this.mesh.renderOrder=-2;scene.add(this.mesh);
  }
  setImages(images){
    if(this.ready)return true;
    const entries=Object.entries(images);if(!entries.length||entries.some(([,im])=>!im.width||im.complete===false))return false;
    const cols=4,size=Math.max(...entries.map(([,im])=>Math.max(im.width,im.height))),canvas=document.createElement('canvas');canvas.width=cols*size;canvas.height=Math.ceil(entries.length/cols)*size;
    const ctx=canvas.getContext('2d');this.skins=new Map();
    entries.forEach(([key,im],n)=>{const x=n%cols*size,y=Math.floor(n/cols)*size;ctx.drawImage(im,x,y);this.skins.set(key,{x,y,width:canvas.width,height:canvas.height});});
    const texture=new this.T.CanvasTexture(canvas);texture.flipY=false;texture.magFilter=this.T.NearestFilter;texture.minFilter=this.T.NearestFilter;texture.generateMipmaps=false;
    this.material.uniforms.skins.value=texture;this.ready=true;return true;
  }
  rectRow(tx,blink){
    if(!tx)return 0;
    let rows=this.metaRows.get(tx);if(!rows){rows=[];this.metaRows.set(tx,rows);}
    const version=blink&&tx.blink?1:0;if(rows[version])return rows[version];
    if(this.metaCount>=META_ROWS)throw Error('Actor skin metadata capacity exceeded');
    const row=this.metaCount++,skin=this.skins.get(tx.k);if(!skin)throw Error('Actor skin not loaded: '+tx.k);
    const names=['front','back','left','right','top','bottom'];
    names.forEach((face,n)=>{const r=version&&face==='front'?tx.blink:tx.r[face],p=(row*6+n)*4;this.rectData[p]=(skin.x+r[0])/skin.width;this.rectData[p+1]=(skin.y+r[1])/skin.height;this.rectData[p+2]=r[2]/skin.width;this.rectData[p+3]=r[3]/skin.height;});
    this.rectTexture.needsUpdate=true;rows[version]=row;return row;
  }
  begin(){this.count=0;this.actors=0;this.mesh.count=0;this.mesh.visible=false;}
  add(e,boxes,k,z0,ground,alpha=1){
    if(this.count+boxes.length>LIMIT)throw Error('Actor instance capacity exceeded');
    const arr=this.mesh.instanceMatrix.array,A=this.attributes,light=e.renderLight,baseZ=z0+ground(e.x,e.y);
    const sizes=A.aSize.array,bases=A.aBase.array,data=A.aData.array,appearance=A.aAppearance.array,warms=A.aWarm.array,warmColors=A.aWarmColor.array,coolColors=A.aCoolColor.array,statuses=A.aStatus.array;
    const status=e.tint>0?['#ff3a1a',Math.min(1,e.tint)*.65]:e.frozen>0?['#8fd8ff',.4]:null;
    const statusColor=status?rgb(status[0]):[0,0,0],warm=light?light.warm:[0,0,0],warmColor=rgb(light?light.colors.warm:'#ffc17d'),coolColor=rgb(light?light.colors.cool:'#9bb8df');
    const flash=e.flash>0,flashColor=flash?rgb(e.flash>.06?'#fff4d2':'#ffae52'):null,opacity=alpha*(e.alpha===undefined?1:e.alpha),hasLight=light?1:0,lift=e.actorPlayer&&e.softShader?(light?.10:.14):0;
    for(const b of boxes){
      const i=this.count++,M=b.M,c=b.c,s=b.s,offset=i*16,sx=s[0]*k,sy=s[1]*k,sz=s[2]*k,p3=i*3,p4=i*4;
      arr[offset]=M[0]*sx;arr[offset+1]=-M[3]*sx;arr[offset+2]=M[6]*sx;arr[offset+3]=0;
      arr[offset+4]=M[1]*sy;arr[offset+5]=-M[4]*sy;arr[offset+6]=M[7]*sy;arr[offset+7]=0;
      arr[offset+8]=M[2]*sz;arr[offset+9]=-M[5]*sz;arr[offset+10]=M[8]*sz;arr[offset+11]=0;
      arr[offset+12]=e.x+(M[0]*c[0]+M[1]*c[1]+M[2]*c[2]+M[9])*k;
      arr[offset+13]=-e.y-(M[3]*c[0]+M[4]*c[1]+M[5]*c[2]+M[10])*k;
      arr[offset+14]=baseZ+(M[6]*c[0]+M[7]*c[1]+M[8]*c[2]+M[11])*k;arr[offset+15]=1;
      const emissive=flash||!!b.emissive,base=flashColor||rgb(b.col);
      const tiny=b.sm||Math.max(s[0],s[1],s[2])*k*44<4,flags=(tiny?1:0)+(e.softShader?2:0)+(emissive?4:0)+(b.nf?8:0)+(b.metal?16:0)+(b.sm?32:0);
      sizes[p3]=sx;sizes[p3+1]=sy;sizes[p3+2]=sz;bases[p3]=base[0];bases[p3+1]=base[1];bases[p3+2]=base[2];
      data[p4]=b.tx&&!emissive?this.rectRow(b.tx,e.an&&e.an.blinkT>0):0;data[p4+1]=b.faces===undefined?63:b.faces;data[p4+2]=!tiny?b.nm||0:0;data[p4+3]=(b.nms||0)&7;
      appearance[p4]=flags;appearance[p4+1]=opacity;appearance[p4+2]=hasLight;appearance[p4+3]=lift;
      warms[p4]=warm[0];warms[p4+1]=warm[1];warms[p4+2]=warm[2];warms[p4+3]=light?light.energy:0;
      warmColors[p3]=warmColor[0];warmColors[p3+1]=warmColor[1];warmColors[p3+2]=warmColor[2];coolColors[p3]=coolColor[0];coolColors[p3+1]=coolColor[1];coolColors[p3+2]=coolColor[2];
      statuses[p4]=statusColor[0];statuses[p4+1]=statusColor[1];statuses[p4+2]=statusColor[2];statuses[p4+3]=!b.nf&&!flash&&status?status[1]:0;
    }
    this.actors++;
  }
  upload(){
    this.mesh.count=this.count;this.mesh.visible=this.count>0;
    for(const a of [this.mesh.instanceMatrix,...Object.values(this.attributes)]){a.clearUpdateRanges();a.addUpdateRange(0,this.count*a.itemSize);a.needsUpdate=true;}
  }
  wallPass(){this.material.transparent=false;this.material.colorWrite=false;this.mesh.layers.set(1);this.mesh.layers.enable(2);}
  bodyPass(){this.material.transparent=true;this.material.colorWrite=true;this.mesh.layers.set(0);this.mesh.layers.enable(2);}
  disable(error){this.failed=true;this.mesh.visible=false;this.mesh.count=0;this.error=String(error);}
}
ActorBatch.LIMIT=LIMIT;ActorBatch.vertex=vertex;ActorBatch.fragment=fragment;
if(typeof module==='object'&&module.exports)module.exports=ActorBatch;else root.ActorBatch=ActorBatch;
})(typeof globalThis==='object'?globalThis:this);
