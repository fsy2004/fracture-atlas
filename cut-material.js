// Stable specimen-space shading on the modelled fracture bed only. The fracture
// silhouette, interlocking faces and contact tests all use the actual cut geometry.
// Renders a dense ivory outer cortical rim transitioning into porous reddish-ochre
// cancellous/trabecular bone inside the cross-section.
import * as T from './vendor/three.module.js';

export function cutMaterial(color, grain, rim) {
 const material = new T.MeshPhysicalMaterial({
  color,
  roughness: 0.92,
  metalness: 0.0,
  clearcoat: 0.05,
  clearcoatRoughness: 0.72,
  side: T.DoubleSide
 });
 const field = {
  cutAtlas: { value: rim?.texture || null },
  cutOrigin: { value: rim?.origin || new T.Vector3() },
  cutU: { value: rim?.u || new T.Vector3() },
  cutV: { value: rim?.v || new T.Vector3() },
  cutRange: { value: rim?.range || new T.Vector4() },
  cutHasAtlas: { value: Number(Boolean(rim)) }
 };
 material.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, field);
  shader.vertexShader = 'varying vec3 cutCoord;\n' + shader.vertexShader.replace(
   '#include <begin_vertex>',
   '#include <begin_vertex>\ncutCoord=position;'
  );
  shader.fragmentShader = `
   varying vec3 cutCoord;
   uniform sampler2D cutAtlas;
   uniform vec3 cutOrigin,cutU,cutV;
   uniform vec4 cutRange;
   uniform float cutHasAtlas;
   float cutHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
   float grains(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(cutHash(i),cutHash(i+vec3(1,0,0)),f.x),mix(cutHash(i+vec3(0,1,0)),cutHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(cutHash(i+vec3(0,0,1)),cutHash(i+vec3(1,0,1)),f.x),mix(cutHash(i+vec3(0,1,1)),cutHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  ` + shader.fragmentShader
   .replace('#include <color_fragment>', `#include <color_fragment>
    float fineMask=1.-smoothstep(.40,1.40,length(fwidth(cutCoord*1450.)));
    float medMask=1.-smoothstep(.45,1.50,length(fwidth(cutCoord*620.)));
    float broad=grains(cutCoord*540.);
    float trabeculae=grains(cutCoord*980.);
    float fine=grains(cutCoord*1550.);
    // Porous spongy-bone pits + crisp trabecular struts
    float pores=smoothstep(.44,.80,.58*broad+.42*trabeculae);
    float innerMask=0.55;
    if(cutHasAtlas>.5){
     vec3 local=cutCoord-cutOrigin;
     vec2 uv=(vec2(dot(local,cutU),dot(local,cutV))-cutRange.xy)*cutRange.zw;
     innerMask=smoothstep(.24,.92,texture2D(cutAtlas,uv).r);
    }
    float grain=(fine-.5)*fineMask*.85+(trabeculae-.5)*medMask*.55+(broad-.5)*.40-.44*pores*mix(.35,1.15,innerMask);
    diffuseColor.rgb*=1.+grain*${grain.toFixed(2)};
    if(cutHasAtlas>.5){
     // Outer rim: bright dense ivory cortex; inner bed: warm vascularized cancellous trabeculae
     vec3 cortexTint=vec3(1.10,1.08,1.04);
     vec3 marrowTint=vec3(.86,.69,.57);
     diffuseColor.rgb*=mix(cortexTint,marrowTint,innerMask);
    }else{
     diffuseColor.rgb*=mix(vec3(1.03,1.01,.98),vec3(.91,.79,.69),pores*.65);
    }
   `)
   .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
    // Dense outer cortex is slightly smoother than porous cancellous interior
    roughnessFactor=clamp(mix(.68,.95,innerMask)+pores*.06,0.58,0.98);
   `)
   .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    vec3 alongX=dFdx(vViewPosition),alongY=dFdy(vViewPosition);
    vec3 crossX=cross(alongY,normal),crossY=cross(normal,alongX);
    float plane=dot(alongX,crossX);
    float reliefAmp=mix(.00014,.00030,innerMask);
    float height=(broad*.55+trabeculae*medMask*.35+fine*fineMask*.25-pores*.35)*reliefAmp;
    vec3 slope=sign(plane)*(dFdx(height)*crossX+dFdy(height)*crossY);
    if(abs(plane)>1e-12)normal=normalize(abs(plane)*normal+slope);
   `);
 };
 material.customProgramCacheKey = () => 'fracture-bed-v2-' + grain;
 return material;
}
