// Medical studio environment lighting and cortical bone physical shader.
// Adds procedural PMREM studio reflections, object-space osseous micro-grain,
// and screen-space curvature/cavity shading so anatomical ridges, grooves,
// and foramina remain crisp at every zoom level with zero extra texture downloads.
import * as T from './vendor/three.module.js';

export function createStudioEnvironment(renderer) {
 const pmrem = new T.PMREMGenerator(renderer);
 pmrem.compileEquirectangularShader();
 const envScene = new T.Scene();
 envScene.background = new T.Color(0x282b2e);

 const panel = (color, intensity, w, h, pos, target = [0, 0, 0]) => {
  const mat = new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(intensity), side: T.DoubleSide });
  const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  mesh.position.set(...pos);
  mesh.lookAt(...target);
  envScene.add(mesh);
 };

 // Overhead warm medical softbox (main key reflection)
 panel(0xfff6e8, 2.3, 6.5, 4.5, [2.8, 5.2, 3.8]);
 // Cool sky-white fill softbox on opposite side (separates bone silhouette)
 panel(0xd8e8f8, 1.35, 5.5, 5.0, [-4.8, 2.2, 2.6]);
 // Crisp warm rear rim strip (highlights diaphyseal contours & epiphyses)
 panel(0xfff1d6, 1.9, 6.0, 2.4, [-1.4, 3.0, -5.2]);
 // Subtle right-rear kicker for posterior anatomical landmarks
 panel(0xeaf2fa, 1.0, 4.0, 3.0, [4.6, 1.4, -3.5]);
 // Soft warm ground bounce so inferior surfaces & condyles keep detail
 panel(0x9a9184, 0.55, 10.0, 10.0, [0, -5.0, 0]);

 const rt = pmrem.fromScene(envScene, 0.045);
 envScene.traverse(obj => {
  if (obj.isMesh) {
   obj.geometry.dispose();
   obj.material.dispose();
  }
 });
 pmrem.dispose();
 return rt;
}

export function createCorticalBoneMaterial({
 color = 0xe9ddc4,
 roughness = 0.58,
 clearcoat = 0.16,
 clearcoatRoughness = 0.52,
 sheen = 0.14,
 sheenColor = 0xfff4e0,
 sheenRoughness = 0.72,
 grainStrength = 0.085,
 cavityStrength = 0.24,
 bumpStrength = 0.11,
 cacheKey = 'cortical-bone-v1'
} = {}) {
 const material = new T.MeshPhysicalMaterial({
  color,
  roughness,
  metalness: 0.0,
  clearcoat,
  clearcoatRoughness,
  sheen,
  sheenColor,
  sheenRoughness,
  side: T.DoubleSide
 });

 material.onBeforeCompile = shader => {
  shader.vertexShader = 'varying vec3 vBoneLocal;\n' + shader.vertexShader.replace(
   '#include <begin_vertex>',
   '#include <begin_vertex>\nvBoneLocal = position;'
  );

  shader.fragmentShader = `
   varying vec3 vBoneLocal;
   float boneHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
   }
   float boneNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
     mix(
      mix(boneHash(i), boneHash(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(boneHash(i + vec3(0.0, 1.0, 0.0)), boneHash(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
     ),
     mix(
      mix(boneHash(i + vec3(0.0, 0.0, 1.0)), boneHash(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(boneHash(i + vec3(0.0, 1.0, 1.0)), boneHash(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
     ),
     f.z
    );
   }
  ` + shader.fragmentShader
   .replace('#include <color_fragment>', `#include <color_fragment>
    // Anisotropic longitudinal cortical striation + osseous micro-pores (anti-aliased via fwidth)
    vec3 grainCoord = vBoneLocal * vec3(165.0, 58.0, 165.0);
    float broadFilter = 1.0 - smoothstep(0.45, 1.65, length(fwidth(grainCoord)));
    float fineCoordLen = length(fwidth(vBoneLocal * 420.0));
    float fineFilter = 1.0 - smoothstep(0.40, 1.45, fineCoordLen);

    float nMacro = boneNoise(vBoneLocal * 26.0);
    float nFiber = boneNoise(grainCoord);
    float nPore = boneNoise(vBoneLocal * 420.0);

    // Warm organic ivory/trabecular-subsurface variation across epiphyses & diaphysis
    float toneShift = (nMacro - 0.5) * 0.065 + (nFiber - 0.5) * 0.045 * broadFilter;
    float poreDip = smoothstep(0.68, 0.90, nPore) * 0.055 * fineFilter;
    diffuseColor.rgb *= (1.0 + toneShift * ${(grainStrength * 14.0).toFixed(3)} - poreDip);
    // Subtle warm ochre warmth in macro variation (real dry/fresh cortical bone is never monochromatic)
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.03, 0.99, 0.92), clamp(nMacro, 0.0, 1.0) * 0.38);

    // Screen-space geometric curvature / cavity shading (brings out grooves, foramina & ridges)
    vec3 boneViewPos = -vViewPosition;
    vec3 bDxP = dFdx(boneViewPos);
    vec3 bDyP = dFdy(boneViewPos);
    vec3 bDxN = dFdx(vNormal);
    vec3 bDyN = dFdy(vNormal);
    float pixelScale = max(length(bDxP) + length(bDyP), 1e-5);
    float curvRaw = (dot(bDxP, bDxN) + dot(bDyP, bDyN)) / (pixelScale * pixelScale + 1e-5);
    // Clamp softly so CT triangles never look faceted while real anatomical grooves darken nicely
    float curv = clamp(curvRaw * 0.0055, -1.0, 1.0);
    float cavity = smoothstep(0.05, 0.85, -curv);
    float ridge = smoothstep(0.10, 0.85, curv);
    float curvStrength = ${cavityStrength.toFixed(3)};
    // Concave fossae/grooves pick up subtle warm amber-taupe ambient occlusion
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.79, 0.75, 0.69), cavity * curvStrength);
    // Convex anatomical crests & articular rims brighten very slightly
    diffuseColor.rgb *= (1.0 + ridge * curvStrength * 0.22);
   `)
   .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
    // Concave grooves are slightly more matte; smooth ridges/articular prominences hold soft periosteal sheen
    roughnessFactor = clamp(roughnessFactor + (nFiber - 0.5) * 0.09 * broadFilter + cavity * 0.14 - ridge * 0.07, 0.34, 0.92);
   `)
   .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    vec3 bAlongX = dFdx(vViewPosition);
    vec3 bAlongY = dFdy(vViewPosition);
    vec3 bCrossX = cross(bAlongY, normal);
    vec3 bCrossY = cross(normal, bAlongX);
    float bPlane = dot(bAlongX, bCrossX);
    float bHeight = (nFiber * broadFilter * 0.65 + nPore * fineFilter * 0.35) * ${(bumpStrength * 0.00055).toFixed(7)};
    vec3 bSlope = sign(bPlane) * (dFdx(bHeight) * bCrossX + dFdy(bHeight) * bCrossY);
    if (abs(bPlane) > 1e-12) normal = normalize(abs(bPlane) * normal + bSlope);
   `);
 };

 material.customProgramCacheKey = () => cacheKey;
 return material;
}
