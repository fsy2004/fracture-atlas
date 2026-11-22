// Stable specimen-space shading on the modelled fracture bed only. The fracture
// silhouette, interlocking faces and contact tests all use the actual cut geometry.
import * as T from './vendor/three.module.js';
export function cutMaterial(color,grain){
 const material=new T.MeshStandardMaterial({color,roughness:.96,side:T.DoubleSide});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 cutCoord;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncutCoord=position;');
  shader.fragmentShader=`
   varying vec3 cutCoord;
   float cutHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
   float grains(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(cutHash(i),cutHash(i+vec3(1,0,0)),f.x),mix(cutHash(i+vec3(0,1,0)),cutHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(cutHash(i+vec3(0,0,1)),cutHash(i+vec3(1,0,1)),f.x),mix(cutHash(i+vec3(0,1,1)),cutHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float textureWeight=1.-smoothstep(.35,1.2,length(fwidth(cutCoord*1550.)));
    float grain=(grains(cutCoord*1550.)-.5)*textureWeight+(grains(cutCoord*510.)-.5)*.55;
    diffuseColor.rgb*=1.+grain*${grain.toFixed(2)};
  `);
 };
 material.customProgramCacheKey=()=>'fracture-bed-'+grain;
 return material;
}
