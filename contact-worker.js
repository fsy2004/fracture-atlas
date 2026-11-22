// Input buffers are private copies, never detached from a visible mesh.
import {BufferGeometry,BufferAttribute} from './vendor/three.module.js';
import {MeshBVH,CENTER} from './vendor/mesh-bvh.js';

self.onmessage=({data})=>{
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(data.positions,3));
 if(data.index)g.setIndex(new BufferAttribute(data.index,1));
 const bvh=new MeshBVH(g,{strategy:CENTER,maxLeafTris:8});
 const packed=MeshBVH.serialize(bvh,{cloneBuffers:false});
 self.postMessage(packed,[...packed.roots,packed.index.buffer]);
};
