import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {section,sliceMetrics} from '../geometry.js';

function cylinder(radius,height,count,reverse=false){
 const pos=[],idx=[];
 for(const z of [-height/2,height/2])for(let i=0;i<count;i++){
  const t=2*Math.PI*i/count;pos.push(radius*Math.cos(t),radius*Math.sin(t),z);
 }
 for(let i=0;i<count;i++){
  const j=(i+1)%count;idx.push(i,j,j+count,i,j+count,i+count);
 }
 if(reverse)idx.reverse();
 return {pos,idx};
}
function tube(){
 const outer=cylinder(.02,.15,64),inner=cylinder(.008,.15,64,true);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...outer.pos,...inner.pos],3));
 g.setIndex([...outer.idx,...inner.idx.map(i=>i+outer.pos.length/3)]);g.computeVertexNormals();g.computeBoundingBox();return g;
}
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function signedAreaXY(p){
 let area=0;
 for(let i=0;i<p.count;i+=3){
  const a=v().fromBufferAttribute(p,i),b=v().fromBufferAttribute(p,i+1),c=v().fromBufferAttribute(p,i+2);
  area+=b.sub(a).cross(c.sub(a)).z/2;
 }
 return area;
}
test('oriented contour integration preserves the centre, diameter and hole of a hollow section',()=>{
 const g=tube(),a=v(.003,-.002,.025);
 const m=sliceMetrics(g,a,v(0,0,1),v(1,0,0));
 const area=32*Math.sin(2*Math.PI/64)*(.02**2-.008**2);
 assert.ok(m.centre.distanceTo(v(0,0,.025))<1e-7);
 assert.ok(Math.abs(m.width-.04)<1e-7&&Math.abs(m.area-area)<1e-9);
 const [low,high]=section(g,[0,0,1],a.toArray());
 for(const [i,p] of [low,high].entries()){
  assert.ok(Math.abs(signedAreaXY(p.face.attributes.position)-(i?-1:1)*area)<1e-9);
 }
});
test('a spiral follows the supplied shaft axis and both fragment caps meet the same surface',()=>{
 const g=tube(),height=.05;
 const [minus,plus]=section(g,[.4,1,.2],[0,0,0],0,height,[0,0,1]);
 const a=minus.face.attributes.position,b=plus.face.attributes.position;
 assert.equal(a.count,b.count);
 const rise=(x,y)=>{
  // Tangent basis of the cutting surface for a +Z long axis: -Y, +X.
  const angle=(Math.atan2(x,-y)+Math.PI)/(2*Math.PI);
  const ramp=angle<.84?angle/.84:(1-angle)/.16;
  return height*(ramp-.5)*T.MathUtils.smoothstep(Math.hypot(x,y),0,height*.16);
 };
 for(let i=0;i<a.count;i++){
  assert.ok(Math.abs(a.getZ(i)-rise(a.getX(i),a.getY(i)))<1e-6);
  const j=i-i%3+[0,2,1][i%3];assert.ok(v().fromBufferAttribute(a,i).distanceTo(v().fromBufferAttribute(b,j))<1e-8);
 }
});


test('a folded fracture retains the sharp ridge of its two planar branches',()=>{
 const g=tube(),fold=.65;
 const [low]=section(g,[0,0,1],[0,0,0],fold);
 const pos=low.face.attributes.position;
 for(let i=0;i<pos.count;i+=3){
  const p=[0,1,2].map(j=>v().fromBufferAttribute(pos,i+j));
  const centre=p[0].add(p[1]).add(p[2]).divideScalar(3);
  assert.ok(Math.abs(centre.z+fold*Math.abs(centre.x))<1e-7);
 }
});
