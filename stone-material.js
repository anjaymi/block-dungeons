// Dry stone surface for shared dungeon geometry. No UVs, animation or extra lights.
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StoneMaterial=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const pars=`
    varying vec3 vStoneWp;
    varying vec3 vStoneView;
    varying vec3 vStoneNormal;
    float stoneHash(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }
    float stoneNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(stoneHash(i), stoneHash(i + vec2(1.0, 0.0)), u.x),
        mix(stoneHash(i + vec2(0.0, 1.0)), stoneHash(i + vec2(1.0)), u.x), u.y);
    }
    // Fade unresolved grain before it can shimmer as the camera moves.
    float stoneFilteredNoise(vec2 p, float footprint) {
      return mix(stoneNoise(p), 0.5, smoothstep(0.55, 1.4, footprint));
    }
  `;
  function create(T){
    const material=new T.MeshLambertMaterial({vertexColors:true});
    material.name='dry-dungeon-stone';
    material.onBeforeCompile=shader=>{
      const hooks=['#include <project_vertex>','#include <color_fragment>','#include <normal_fragment_maps>'];
      if(!shader.vertexShader.includes(hooks[0])||!hooks.slice(1).every(h=>shader.fragmentShader.includes(h)))throw Error('Unsupported stone shader chunks');
      shader.vertexShader='varying vec3 vStoneWp;\nvarying vec3 vStoneView;\nvarying vec3 vStoneNormal;\n'+shader.vertexShader.replace(hooks[0],`${hooks[0]}
        vec4 stonePosition = vec4(transformed, 1.0);
        vec3 stoneNormal = objectNormal;
        #ifdef USE_INSTANCING
          stonePosition = instanceMatrix * stonePosition;
          stoneNormal = mat3(instanceMatrix) * stoneNormal;
        #endif
        vStoneWp = (modelMatrix * stonePosition).xyz;
        vStoneView = -mvPosition.xyz;
        vStoneNormal = normalize(mat3(modelMatrix) * stoneNormal);`);
      shader.fragmentShader=pars+shader.fragmentShader.replace(hooks[1],`${hooks[1]}
        vec3 stoneN = normalize(vStoneNormal);
        // Skew world coordinates give continuous grain on top and vertical faces.
        vec2 stoneUV = vStoneWp.xy + vStoneWp.z * vec2(0.63, 0.81);
        float stonePixel = max(length(dFdx(stoneUV)), length(dFdy(stoneUV)));
        float stoneCloud = stoneNoise(stoneUV * 3.1);
        float stoneMottle = stoneFilteredNoise(stoneUV * 10.7 + vec2(17.4, 9.2), stonePixel * 10.7);
        float stoneGrain = stoneFilteredNoise(stoneUV * 68.0, stonePixel * 68.0);
        float stonePores = smoothstep(0.66, 0.86, stoneMottle) * (1.0 - smoothstep(0.7, 1.4, stonePixel * 10.7));
        float stoneBevel = smoothstep(0.03, 0.15, abs(stoneN.z)) * (1.0 - smoothstep(0.88, 0.99, abs(stoneN.z)));
        float stoneShade = 0.76 + stoneCloud * 0.22 + stoneMottle * 0.13 + (stoneGrain - 0.5) * 0.11;
        stoneShade *= 1.0 - stonePores * 0.13 - stoneBevel * 0.12;
        diffuseColor.rgb *= stoneShade;
        // Restrained warm/cool mineral stains, rather than saturated brown spots.
        diffuseColor.rgb *= mix(vec3(0.98, 1.0, 1.025), vec3(1.025, 0.985, 0.95), smoothstep(0.38, 0.73, stoneCloud) * 0.65);
        float stoneHeight = stoneCloud * 0.002 + stoneMottle * 0.0015 + stoneGrain * 0.00065;
      `).replace(hooks[2],`${hooks[2]}
        // Surface gradient in view space; Lambert has no general vViewPosition.
        vec3 stoneDx = dFdx(-vStoneView), stoneDy = dFdy(-vStoneView);
        vec3 stoneR1 = cross(stoneDy, normal), stoneR2 = cross(normal, stoneDx);
        float stoneDet = dot(stoneDx, stoneR1);
        vec3 stoneGradient = sign(stoneDet) * (dFdx(stoneHeight) * stoneR1 + dFdy(stoneHeight) * stoneR2);
        if (abs(stoneDet) > 0.0000000001) normal = normalize(abs(stoneDet) * normal - stoneGradient);
      `);
    };
    material.customProgramCacheKey=()=> 'dry-stone-v1';
    return material;
  }
  return {create};
});
