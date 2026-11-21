import * as T from './vendor/three.module.js';

// Retain a face and its barycentric weights, including for a morphing vertebral body.
export function surfacePoint(hit){
 const mesh=hit.object,{a,b,c}=hit.face;
 const p=mesh.worldToLocal(hit.point.clone());
 const vertices=[a,b,c].map(i=>mesh.getVertexPosition(i,new T.Vector3()));
 const weights=T.Triangle.getBarycoord(p,...vertices,new T.Vector3());
 if(!weights||weights.x<-.001||weights.y<-.001||weights.z<-.001)return null;
 return ()=>mesh.localToWorld(new T.Vector3()
  .addScaledVector(mesh.getVertexPosition(a,vertices[0]),weights.x)
  .addScaledVector(mesh.getVertexPosition(b,vertices[1]),weights.y)
  .addScaledVector(mesh.getVertexPosition(c,vertices[2]),weights.z));
}
export function makeRuler(world,output,button){
 const obj=new T.Group(),lineGeo=new T.BufferGeometry(),attr=new T.Float32BufferAttribute(new Float32Array(6),3);
 lineGeo.setAttribute('position',attr);
 const line=new T.Line(lineGeo,new T.LineBasicMaterial({color:0x5742a0,depthTest:false}));
 line.renderOrder=11;line.frustumCulled=false;obj.add(line);
 const dots=[0x863db1,0x3f5899].map(color=>new T.Mesh(new T.SphereGeometry(1,14,10),new T.MeshBasicMaterial({color,depthTest:false})));
 dots.forEach(dot=>{dot.renderOrder=12;obj.add(dot);});
 world.add(obj);
 let active=false,points=[],baseline=0;
 function reset(){active=false;points=[];obj.visible=false;output.hidden=true;button.setAttribute('aria-pressed','false');button.textContent='两点测距';}
 function update(){
  if(!active)return;
  obj.visible=true;dots.forEach((d,i)=>{d.visible=i<points.length;if(d.visible)d.position.copy(points[i]());});
  line.visible=points.length===2;
  if(!line.visible){output.textContent=points.length?'已选第一点。可转动模型，再点第二处骨面。':'在模型表面点击第一点，可拖动旋转。';return;}
  dots.forEach((d,i)=>attr.setXYZ(i,d.position.x,d.position.y,d.position.z));attr.needsUpdate=true;
  const mm=dots[0].position.distanceTo(dots[1].position)*1000,diff=mm-baseline;
  output.textContent='两点距离 '+mm.toFixed(1)+' mm　较伤前 '+(diff>=0?'+':'')+diff.toFixed(1)+' mm';
 }
 reset();
 return {get active(){return active;},get picking(){return active&&points.length<2;},reset,update,
  toggle(span){if(active){reset();return;}active=true;dots.forEach(d=>d.scale.setScalar(T.MathUtils.clamp(span*.006,.0004,.0025)));output.hidden=false;button.textContent='清除测距';button.setAttribute('aria-pressed','true');update();},
  add(hit,rest,current){
   const point=surfacePoint(hit);if(!point)return;points.push(point);
   if(points.length===2){
    rest();world.updateMatrixWorld(true);baseline=points[0]().distanceTo(points[1]())*1000;
    current();world.updateMatrixWorld(true);
   }update();
  }
 };
}
