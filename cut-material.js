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
    float fineMask=1.-smoothstep(.40,1.35,length(fwidth(cutCoord*1450.)));
    float broad=grains(cutCoord*560.);
    float fine=grains(cutCoord*1450.);
    float pits=smoothstep(.40,.78,.72*broad+.28*fine);
    float grain=(fine-.5)*fineMask+(broad-.5)*.45-.30*pits;
    diffuseColor.rgb*=1.+grain*${grain.toFixed(2)};
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 alongX=dFdx(vViewPosition),alongY=dFdy(vViewPosition);
    vec3 crossX=cross(alongY,normal),crossY=cross(normal,alongX);
    float plane=dot(alongX,crossX);
    float height=(broad+fine*fineMask*.28)*.00019;
    vec3 slope=sign(plane)*(dFdx(height)*crossX+dFdy(height)*crossY);
    if(abs(plane)>1e-12)normal=normalize(abs(plane)*normal+slope);
  `);
 };
 material.customProgramCacheKey=()=>'fracture-bed-'+grain;
 return material;
}
