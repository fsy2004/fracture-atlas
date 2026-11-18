import * as T from './vendor/three.module.js';

const vec = a => new T.Vector3(...a);
const vertexKey = v => [v.x,v.y,v.z].map(n=>Math.round(n*1e7)).join(',');
export function section(geometry, normal, anchor, fold=0, spiralHeight=0) {
  const n=vec(normal).normalize(), origin=vec(anchor);
  const positions=geometry.attributes.position, norms=geometry.attributes.normal;
  const index=geometry.index.array, groups=[[],[]], normals=[[],[]], edges=[];
  function emit(side,poly) {
    for(let k=1;k+1<poly.length;k++) for(const v of [poly[0],poly[k],poly[k+1]]) {
      groups[side].push(...v.p.toArray()); normals[side].push(...v.n.toArray());
    }
  }
  function signed(p){
    const relative=p.clone().sub(origin);
    if(!spiralHeight)return n.dot(relative)+fold*Math.abs(relative.x);
    // One helical rise with a short longitudinal return across the cortex.
    const angle=(Math.atan2(relative.z,relative.x)+Math.PI)/(2*Math.PI);
    const ramp=angle<.84 ? angle/.84 : (1-angle)/.16;
    return relative.y-spiralHeight*(ramp-.5);
  }
  function clip(tri){
    for(const v of tri)v.d=signed(v.p);
    const sides=[[],[]], cross=[];
    tri.forEach((a,k)=>{
      const b=tri[(k+1)%3]; sides[Number(a.d>=0)].push(a);
      if((a.d>=0)!==(b.d>=0)){
        const t=a.d/(a.d-b.d);
        const v={p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()};
        sides[0].push(v); sides[1].push(v); cross.push(v.p);
      }
    });
    sides.forEach((poly,s)=>emit(s,poly));
    if(cross.length===2 && cross[0].distanceToSquared(cross[1])>1e-16) edges.push(cross);
  }
  function refine(tri,depth){
    const farAbove=tri.every(v=>v.p.y>origin.y+spiralHeight*.51);
    const farBelow=tri.every(v=>v.p.y<origin.y-spiralHeight*.51);
    if(!depth||farAbove||farBelow){clip(tri);return;}
    const mids=tri.map((v,j)=>({p:v.p.clone().lerp(tri[(j+1)%3].p,.5),n:v.n.clone().lerp(tri[(j+1)%3].n,.5).normalize()}));
    tri.forEach((v,j)=>refine([v,mids[j],mids[(j+2)%3]],depth-1));
    refine(mids,depth-1);
  }
  for(let i=0;i<index.length;i+=3){
    const tri=Array.from(index.slice(i,i+3),j=>({p:new T.Vector3().fromBufferAttribute(positions,j),n:new T.Vector3().fromBufferAttribute(norms,j)}));
    if(spiralHeight)refine(tri,3);else clip(tri);
  }
  const graph=new Map(), points=new Map();
  for(const [a,b] of edges){
    const i=vertexKey(a),j=vertexKey(b);
    if(i===j)continue;
    for(const [from,to,p] of [[i,j,a],[j,i,b]]){
      if(!graph.has(from))graph.set(from,new Set());
      graph.get(from).add(to);points.set(from,p);
    }
  }
  const axis=new T.Vector3(Math.abs(n.x)<.8?1:0,Math.abs(n.x)<.8?0:1,0).cross(n).normalize();
  const up=n.clone().cross(axis), cap=[];
  for(const start of graph.keys()){
    while(graph.get(start).size){
      const loop=[],visited=new Set();let k=start;
      while(!visited.has(k)&&graph.get(k)?.size){
        visited.add(k);loop.push(points.get(k));
        const next=graph.get(k).values().next().value;
        graph.get(k).delete(next);graph.get(next).delete(k);k=next;
      }
      if(k!==start||loop.length<3)continue;
      const flat=loop.map(p=>new T.Vector2(p.dot(axis),p.dot(up)));
      for(const face of T.ShapeUtils.triangulateShape(flat,[]))for(const j of face)cap.push(...loop[j].toArray());
    }
  }
  return groups.map((list,side)=>{
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(list,3));
    geo.setAttribute('normal',new T.Float32BufferAttribute(normals[side],3));
    const face=new T.BufferGeometry();
    face.setAttribute('position',new T.Float32BufferAttribute(cap,3));face.computeVertexNormals();
    const outline=new T.BufferGeometry().setFromPoints(edges.flat());
    return {geo,face,outline};
  });
}

// Use the local centreline at the selected level, including curved shafts.
export function atLevel(g,axis,fraction){
  const p=g.attributes.position;
  const lo=g.boundingBox.min.getComponent(axis),hi=g.boundingBox.max.getComponent(axis);
  const v=lo+(hi-lo)*fraction;
  const samples=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i));
  samples.sort((a,b)=>Math.abs(a.getComponent(axis)-v)-Math.abs(b.getComponent(axis)-v));
  const count=Math.max(6,Math.floor(samples.length*.04));
  return samples.slice(0,count).reduce((s,a)=>s.add(a),new T.Vector3()).divideScalar(count).setComponent(axis,v).toArray();
}
