const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Stone=require('../stone-material.js'),Assets=require('../scene-assets.js');
const env={};env.window=env;vm.runInNewContext(fs.readFileSync(require.resolve('../vendor/voxel-world.js'),'utf8'),env);const T=env.THREE;
test('石材 shader 使用项目真实 r186 Lambert 输入，输出独立视图坐标且保留灯光和阴影',()=>{
  const material=Stone.create(T),shader={...T.ShaderLib.lambert,uniforms:{}};
  material.onBeforeCompile(shader);assert.equal(T.REVISION,'186');
  assert.ok(shader.vertexShader.includes('vStoneView = -mvPosition.xyz'));
  assert.ok(!shader.fragmentShader.replace(/\/\/[^\n]*/g,'').includes('vViewPosition'));
  for(const chunk of ['lights_fragment_begin','shadowmap_pars_fragment','fog_fragment','colorspace_fragment'])assert.ok(shader.fragmentShader.includes('#include <'+chunk+'>'));
  assert.ok(shader.fragmentShader.includes('dFdx(stoneHeight)'));assert.ok(shader.fragmentShader.includes('stoneFilteredNoise'));
  assert.ok(!shader.fragmentShader.includes('uTime'));assert.equal(material.vertexColors,true);assert.equal(material.transparent,false);
  assert.equal(material.customProgramCacheKey(),'dry-stone-v1');
});
test('石材 shader 接口不兼容时显式失败，让既有地形回退接管',()=>{
  assert.throws(()=>Stone.create(T).onBeforeCompile({vertexShader:'void main(){}',fragmentShader:'void main(){}'}),/Unsupported stone shader chunks/);
});
test('仅共享石材标记为石材材质，法线、顶点和颜色与着色前逐项一致',()=>{
  const old={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/render-qa/stone-shader/scene-assets-before.js'),'utf8'),old);
  for(const id of Assets.ids){
    const now=Assets.build(T,id),previous=old.module.exports.build(T,id);assert.equal(now.parts[0].kind,'stone');
    for(const key of ['position','normal','color'])assert.deepEqual(Array.from(now.parts[0].geo.attributes[key].array),Array.from(previous.parts[0].geo.attributes[key].array));
    assert.equal(now.maxZ,previous.maxZ);assert.equal(now.south,previous.south);
  }
});
