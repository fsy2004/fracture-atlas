import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three.module.js';
import {courses} from '../courses.js';
import {joints} from '../joints.js';
import {canonicalCourse,variantIndex} from '../variant-registry.js';
import {examPoints} from '../exam-points.js';
import {specimenLibrary} from '../specimen.js';
import {contactBody,makeContactSet} from '../contact.js';
import {acetabularPlan,displaceAcetabularWall,extractFragment,fractureAnchor,greenstickGeometry,physisFragments,virtualPhysis} from '../textbook-geometry.js';
import {breathingDisplacement,directedRotation} from '../kinematics.js';

const atlas=new Map([...courses,...joints].map(input=>{
 const course=canonicalCourse(input);
 return [course.id,course];
}));
const variant=(course,id)=>atlas.get(course).variants.find(v=>v.id===id);
const library=specimenLibrary(file=>Promise.resolve(new Response(readFileSync(new URL('../'+file,import.meta.url)))));
await library.init();

test('textbook names, additions and stable numeric deep links',()=>{
 assert.equal(atlas.get('knee-dislocation').name,'膝关节脱位');
 assert.equal(atlas.get('lunate-dislocation').name,'月骨脱位');
 assert.equal(atlas.get('forearm').name,'尺桡骨干双骨折');
 assert.equal(atlas.get('galeazzi').name,'桡骨下1/3骨折合并尺桡远侧关节脱位');
 assert.equal(atlas.get('neck').source.includes('PDF 386 页'),true);
 assert.equal(atlas.get('metatarsal').source.includes('PDF 435 页'),true);
 assert.match(examPoints(atlas.get('neck'),0).points[1],/45° 左右.*70°/);
 const historic=[
  ['#knee-dislocation/0/1','v01','前脱位'],
  ['#hip-dislocation/v02/1','v02','前脱位'],
  ['#lunate-dislocation/v02/1','v02','月骨周围背侧脱位'],
  ['#lunate-dislocation/1/1','v02','月骨周围背侧脱位'],
  ['#elbow-dislocation/2/1','v03','前脱位']
 ];
 for(const [hash,id,label] of historic){
  const [key,selector,level]=hash.slice(1).split('/');
  const c=atlas.get(key),v=c.variants[variantIndex(c,selector)];
  assert.deepEqual([v.id,v.name,level],[id,label,'1'],hash);
 }
 assert.match(variant('lunate-dislocation','v02').source,/^AO/);
 assert.deepEqual(atlas.get('hip-dislocation').variants.slice(2).map(v=>v.name),[
  '中心性脱位','前脱位（耻骨部）','前脱位（闭孔）'
 ]);
 assert.equal(courses.flatMap(c=>c.variants).filter(v=>v.textbook).length,73);
 assert.equal(joints.flatMap(c=>c.variants).filter(v=>v.textbook).length,29);
});

for(const side of ['Right','Left'])test(side+' acetabular wall is cut open before the femoral head advances medially',async()=>{
 const c=atlas.get('hip-dislocation'),injury=variant(c.id,'v03'),mirror=side==='Left';
 const keys=library.required(side+' femur',c,injury);
 assert.equal(keys.length,2);
 await library.load(keys);library.trim(keys,c,injury);
 const femur=library.get('Right femur',mirror),hip=library.get('Right hip bone',mirror);
 const plan=acetabularPlan(femur,hip),[retained,fragment]=extractFragment(hip,plan.planes);
 assert.ok(plan.socket.x>plan.head.x&&plan.travel>0);
 assert.ok(plan.opening>plan.radius);
 for(const p of [retained,fragment]){
  assert.ok(p.geo.attributes.position.count>100&&p.face.attributes.position.count>40);
  assert.ok(p.geo.attributes.position.array.every(Number.isFinite));
 }
 assert.ok(retained.geo.boundingBox.getSize(new T.Vector3()).y>.13);
 assert.ok(fragment.geo.boundingBox.getSize(new T.Vector3()).y<.075);
 const immobile=new T.Group(),wall=new T.Group(),leg=new T.Group();
 const fixedMesh=new T.Mesh(retained.geo),plugMesh=new T.Mesh(fragment.geo),femurMesh=new T.Mesh(femur);
 immobile.add(fixedMesh);wall.add(plugMesh);leg.add(femurMesh);
 for(const g of [immobile,wall,leg])g.updateMatrixWorld(true);
 const bodies=[contactBody(fixedMesh,retained.face,'髋臼余部'),
  contactBody(plugMesh,fragment.face,'臼底骨片'),contactBody(femurMesh,null,'股骨')];
 bodies.forEach(b=>b.active=true);
 const contact=makeContactSet(bodies);
 for(let i=0;i<=12;i++){
  leg.position.x=plan.travel*i/12;
  wall.position.x=displaceAcetabularWall(leg.position.x,plan.clearance);
  wall.updateMatrixWorld(true);leg.updateMatrixWorld(true);
  assert.notEqual(contact.check()?.kind,'bone',side+' sample '+i);
 }
 assert.ok(plan.head.x+leg.position.x>plan.socket.x);
 assert.ok(wall.position.x>.03);
});

test('paediatric courses construct with virtual tissue and six distinguishable physeal patterns',async()=>{
 const pulled=atlas.get('pulled-elbow'),pv=pulled.variants[0];
 assert.equal(pulled.name,'小儿桡骨头半脱位');
 assert.match(pv.source,/成人骨性底图儿童解剖示意/);
 const keys=library.required('Right radius',pulled,pv);
 assert.equal(keys.length,3);
 await library.load(keys);library.trim(keys,pulled,pv);
 for(const {bone} of pv.cuts)assert.ok(library.get(bone)?.attributes.position.count);
 const physis=atlas.get('physis-injury');
 assert.equal(physis.variants.length,6);
 for(const [i,v] of physis.variants.entries()){
  const s=v.cuts[0],type=s.physis.type;
  assert.equal(type,i+1);
  assert.match(v.source,/儿童解剖示意/);
  const keys=library.required(s.bone,physis,v);
  assert.ok(keys.length>=2);
  await library.load(keys);library.trim(keys,physis,v);
  const g=library.get(s.bone),a=fractureAnchor(g,s);
  const {geometry,band}=virtualPhysis(g,a,type);
  assert.ok(geometry.attributes.position.count>0&&band.attributes.position.count>0);
  const bounds=new T.Box3().setFromBufferAttribute(band.attributes.position);
  if(type===6)assert.ok(bounds.max.x<.005);
  if(type<=4){
   const parts=physisFragments(g,a,type,s.physis.side);
   for(const part of parts)assert.ok(part.geo.attributes.position.count>0&&part.face.attributes.position.count>0);
  }
 }
});

test('greenstick deformation keeps the indexed cortex connected and exposes a partial trace',async()=>{
 const course=atlas.get('femur'),injury=variant(course.id,'v04'),s=injury.cuts[0];
 const keys=library.required(s.bone,course,injury);
 await library.load(keys);library.trim(keys,course,injury);
 const g=library.get(s.bone),a=fractureAnchor(g,s);
 const {geometry,outline}=greenstickGeometry(g,a,s);
 assert.deepEqual(geometry.index.array,g.index.array);
 assert.ok(outline.attributes.position.count>0);
 const delta=geometry.morphAttributes.position[0].array;
 assert.ok(delta.some(value=>Math.abs(value)>.003));
 assert.ok(delta.some(value=>value===0));
});

test('lunate rotates continuously past 180 degrees and detached ribs move against breathing phase',()=>{
 const injury=variant('lunate-dislocation','v04'),axis=new T.Vector3(...injury.directed.axis);
 const point=new T.Vector3(0,1,0),prior=point.clone();
 let accumulated=0;
 for(let i=1;i<=40;i++){
  const p=point.clone().applyQuaternion(directedRotation(axis,injury.directed.degrees,i/40));
  const turn=Math.atan2(new T.Vector3().crossVectors(prior,p).dot(axis),prior.dot(p));
  assert.ok(turn>0);
  accumulated+=turn;prior.copy(p);
 }
 assert.ok(accumulated>Math.PI);
 assert.ok(Math.abs(accumulated*180/Math.PI-injury.directed.degrees)<1e-9);
 assert.ok(breathingDisplacement(.56)>0&&breathingDisplacement(.78)<0);
 assert.ok(Math.abs(breathingDisplacement(1))<1e-9);
});
