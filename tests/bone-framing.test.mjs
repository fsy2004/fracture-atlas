import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {frameBone} from '../bone-framing.js';

function check(meshes,dir,aspect){
 const {target,position}=frameBone(meshes,dir,38,aspect);
 const cam=new T.PerspectiveCamera(38,aspect,.001,30);cam.position.copy(position);cam.lookAt(target);cam.updateMatrixWorld();
 const bounds=new T.Box3(),v=new T.Vector3();
 for(const mesh of meshes){
  for(let i=0;i<mesh.geometry.attributes.position.count;i++)bounds.expandByPoint(mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld).project(cam));
 }
 const middle=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
 assert.ok(Math.max(Math.abs(middle.x),Math.abs(middle.y))<.0001,'centre of the visible outline');
 assert.ok(Math.abs(Math.max(size.x,size.y)/2-.77)<.0001,'complete surface fits with a stable margin');
}
test('centres a curved rotated bone on portrait and landscape canvases',()=>{
 const g=new T.TorusGeometry(.08,.008,10,32,Math.PI*1.21),mesh=new T.Mesh(g);
 mesh.position.set(-.22,1.44,-.03);mesh.rotation.set(.26,.7,.13);
 for(const aspect of [1.5,.48])check([mesh],new T.Vector3(-.36,.12,1).normalize(),aspect);
});
test('recentring follows the posed geometry of separate fragments',()=>{
 const g=new T.BoxGeometry(.012,.09,.016),first=new T.Mesh(g),second=new T.Mesh(g.clone());
 second.geometry.morphTargetsRelative=true;
 second.geometry.morphAttributes.position=[new T.BufferAttribute(Float32Array.from(second.geometry.attributes.position.array,(x,i)=>i%3===1&&x>0?.025:0),3)];
 second.updateMorphTargets();second.morphTargetInfluences[0]=.7;
 first.position.set(-.09,.86,0);second.position.set(-.066,.945,.007);second.rotation.z=.31;
 check([first,second],new T.Vector3(0,0,1),.62);
});
