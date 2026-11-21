import * as T from './vendor/three.module.js';

// The verified source is an adult male anatomical surface atlas. Quantisation is 1/30 mm.
export async function decodeSurfaces(manifest,bytes){
 const magic=new Uint8Array(bytes,0,2);
 const packed=magic[0]===31&&magic[1]===139
  ?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes;
 const surfaces=new Map();
 for(const m of manifest.entries){
  const coords=new Uint16Array(packed,m.offset,m.vertices*3);
  const positions=new Float32Array(coords.length);
  for(let k=0;k<coords.length;k++)positions[k]=(m.origin_mm[k%3]+coords[k]/manifest.position_units_per_mm)*.001;
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  geometry.setIndex(new T.BufferAttribute(new Uint16Array(packed,m.offset+coords.byteLength,m.indices),1));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  surfaces.set(m.mesh,geometry);
 }
 return surfaces;
}
