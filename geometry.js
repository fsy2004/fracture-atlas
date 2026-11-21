import * as T from './vendor/three.module.js';

const vec = a => new T.Vector3(...a);
const vertexKey = v => [v.x,v.y,v.z].map(n=>Math.round(n*1e7)).join(',');
export function section(geometry, normal, anchor, fold=0, spiralHeight=0, spiralAxis=[0,1,0]) {
  const n=vec(spiralHeight?spiralAxis:normal).normalize(), origin=vec(anchor);
  const axis=new T.Vector3(Math.abs(n.x)<.8?1:0,Math.abs(n.x)<.8?0:1,0).cross(n).normalize();
  const up=n.clone().cross(axis);
  const axial=p=>n.dot(p.clone().sub(origin));
  function rise(x,y){
    const angle=(Math.atan2(y,x)+Math.PI)/(2*Math.PI);
    const ramp=angle<.84?angle/.84:(1-angle)/.16;
    // A continuous core avoids a singular height at the axis inside the bone.
    return spiralHeight*(ramp-.5)*T.MathUtils.smoothstep(Math.hypot(x,y),0,spiralHeight*.16);
  }
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
    return n.dot(relative)-rise(relative.dot(axis),relative.dot(up));
  }
  function clip(tri){
    for(const v of tri)v.d=signed(v.p);
    const sides=[[],[]], cross=[];
    tri.forEach((a,k)=>{
      const b=tri[(k+1)%3]; sides[Number(a.d>=0)].push(a);
      if((a.d>=0)!==(b.d>=0)){
        let t=a.d/(a.d-b.d);
        if(spiralHeight){
          // Compute the nonlinear edge intersection in a canonical order for both incident triangles.
          const first=a.d<0?a:b,second=a.d<0?b:a;
          let l=0,r=1;
          const probe=new T.Vector3();
          for(let j=0;j<22;j++){
            const m=(l+r)*.5;
            if(signed(probe.copy(first.p).lerp(second.p,m))<0)l=m;else r=m;
          }
          t=first===a?(l+r)*.5:1-(l+r)*.5;
        }
        const v={p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()};
        sides[0].push(v); sides[1].push(v); cross.push(v.p);
      }
    });
    sides.forEach((poly,s)=>emit(s,poly));
    if(cross.length===2 && cross[0].distanceToSquared(cross[1])>1e-16) edges.push(cross);
  }
  function refine(tri,depth){
    const farAbove=tri.every(v=>axial(v.p)>spiralHeight*.51);
    const farBelow=tri.every(v=>axial(v.p)<-spiralHeight*.51);
    if(!depth||farAbove||farBelow){clip(tri);return;}
    const mids=tri.map((v,j)=>({p:v.p.clone().lerp(tri[(j+1)%3].p,.5),n:v.n.clone().lerp(tri[(j+1)%3].n,.5).normalize()}));
    tri.forEach((v,j)=>refine([v,mids[j],mids[(j+2)%3]],depth-1));
    refine(mids,depth-1);
  }
  function splitCrease(tri,emitTriangle){
    const halves=[[],[]];
    for(let j=0;j<3;j++){
      const a=tri[j],b=tri[(j+1)%3],da=a.p.x-origin.x,db=b.p.x-origin.x;
      if(da<=0)halves[0].push(a);
      if(da>=0)halves[1].push(a);
      if(da*db<0){
        const t=da/(da-db);
        const v={p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()};
        halves[0].push(v);halves[1].push(v);
      }
    }
    for(const poly of halves)for(let k=1;k+1<poly.length;k++)emitTriangle([poly[0],poly[k],poly[k+1]]);
  }
  for(let i=0;i<index.length;i+=3){
    const tri=Array.from(index.slice(i,i+3),j=>({p:new T.Vector3().fromBufferAttribute(positions,j),n:new T.Vector3().fromBufferAttribute(norms,j)}));
    if(spiralHeight)refine(tri,3);
    else if(fold&&tri.some(a=>a.p.x>origin.x)&&tri.some(a=>a.p.x<origin.x))splitCrease(tri,clip);
    else clip(tri);
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
  const rings=[],cap=[];
  for(const start of graph.keys()){
    while(graph.get(start).size){
      const loop=[],visited=new Set();let k=start;
      while(!visited.has(k)&&graph.get(k)?.size){
        visited.add(k);loop.push(points.get(k));
        const next=graph.get(k).values().next().value;
        graph.get(k).delete(next);graph.get(next).delete(k);k=next;
      }
      if(k!==start||loop.length<3)continue;
      const flat=loop.map(p=>{const q=p.clone().sub(origin);return new T.Vector2(q.dot(axis),q.dot(up));});
      const area=Math.abs(T.ShapeUtils.area(flat));
      if(area>1e-14)rings.push({loop,flat,area,holes:[],depth:0});
    }
  }
  // A concentric contour bounds a cavity; an island inside a cavity is solid again.
  rings.sort((a,b)=>b.area-a.area);
  for(let i=0;i<rings.length;i++){
    const r=rings[i];
    for(let j=i-1;j>=0;j--){
      if(containsPoint(rings[j].flat,r.flat[0])){
        r.depth=rings[j].depth+1;
        if(r.depth%2)rings[j].holes.push(r);
        break;
      }
    }
  }
  for(const ring of rings){
    if(ring.depth%2)continue;
    const vertices=[ring,...ring.holes].flatMap(r=>r.loop);
    const faces=T.ShapeUtils.triangulateShape(ring.flat,ring.holes.map(r=>r.flat));
    const border=new Set();
    let base=0;
    for(const r of [ring,...ring.holes]){
      for(let i=0;i<r.loop.length;i++)border.add(pairKey(base+i,base+(i+1)%r.loop.length));
      base+=r.loop.length;
    }
    function surfaceMid(a,b){
      const p=a.clone().lerp(b,.5);
      const relative=p.clone().sub(origin);
      const height=spiralHeight?rise(relative.dot(axis),relative.dot(up)):-fold*Math.abs(relative.x);
      return p.addScaledVector(n,height-n.dot(relative));
    }
    // Split long interior diagonals on both adjacent triangles. Leave the cut rim exactly as clipped.
    let triangles=faces;
    if(spiralHeight){
      const size=spiralHeight/12;
      for(let depth=0;depth<7;depth++){
        const mids=new Map(),next=[];
        for(const [i,j,k] of triangles){
          for(const [a,b] of [[i,j],[j,k],[k,i]]){
            const key=pairKey(a,b);
            if(border.has(key)||mids.has(key)||vertices[a].distanceToSquared(vertices[b])<=size*size)continue;
            mids.set(key,vertices.length);vertices.push(surfaceMid(vertices[a],vertices[b]));
          }
        }
        if(!mids.size)break;
        for(const tri of triangles){
          const split=tri.map((a,j)=>mids.get(pairKey(a,tri[(j+1)%3])));
          const count=split.filter(x=>x!==undefined).length;
          if(!count){next.push(tri);continue;}
          if(count===3){
            const [a,b,c]=tri,[u,v,w]=split;next.push([a,u,w],[u,b,v],[w,v,c],[u,v,w]);continue;
          }
          const j=count===1?split.findIndex(x=>x!==undefined):(split.findIndex(x=>x===undefined)+1)%3;
          const a=tri[j],b=tri[(j+1)%3],c=tri[(j+2)%3],u=split[j],v=split[(j+1)%3];
          if(count===1)next.push([a,u,c],[u,b,c]);
          else next.push([a,u,c],[u,b,v],[u,v,c]);
        }
        triangles=next;
      }
    }
    for(const face of triangles){
      const tri=face.map(j=>vertices[j]);
      if(fold&&tri.some(p=>p.x>origin.x)&&tri.some(p=>p.x<origin.x)){
        // Keep the ridge shared by both planar arms of a Y-shaped break.
        splitCrease(tri.map(p=>({p,n})),row=>{
          for(const v of row){
            const p=v.p.clone();
            if(Math.abs(p.x-origin.x)<1e-9)p.addScaledVector(n,-axial(p));
            cap.push(...p.toArray());
          }
        });
      }else for(const p of tri)cap.push(...p.toArray());
    }
  }
  return groups.map((list,side)=>{
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(list,3));
    geo.setAttribute('normal',new T.Float32BufferAttribute(normals[side],3));
    const face=new T.BufferGeometry();
    const surface=new Float32Array(cap);
    if(side===1)for(let k=0;k<surface.length;k+=9)for(let j=0;j<3;j++){
      const temp=surface[k+3+j];surface[k+3+j]=surface[k+6+j];surface[k+6+j]=temp;
    }
    face.setAttribute('position',new T.BufferAttribute(surface,3));face.computeVertexNormals();
    const outline=new T.BufferGeometry().setFromPoints(edges.flat());
    return {geo,face,outline};
  });
}

const pairKey=(a,b)=>a<b?a+','+b:b+','+a;
function containsPoint(poly,p){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}

// Integrate area moments over oriented triangle/plane intersection segments.
// This depends on the surface shape, not vertex density near the cut.
export function sliceMetrics(g,origin,normal,lateral){
  const n=normal.clone().normalize(),u=lateral.clone().addScaledVector(n,-lateral.dot(n)).normalize();
  const v=new T.Vector3().crossVectors(n,u),pos=g.attributes.position,index=g.index.array;
  const triangle=[new T.Vector3(),new T.Vector3(),new T.Vector3()],d=[0,0,0];
  const cuts=[new T.Vector3(),new T.Vector3()],ab=new T.Vector3(),ac=new T.Vector3(),tangent=new T.Vector3();
  let twiceArea=0,mx=0,my=0,perimeter=0,lx=0,ly=0,min=Infinity,max=-Infinity;
  for(let i=0;i<index.length;i+=3){
    for(let j=0;j<3;j++){triangle[j].fromBufferAttribute(pos,index[i+j]).sub(origin);d[j]=triangle[j].dot(n);}
    if((d[0]>=0)===(d[1]>=0)&&(d[1]>=0)===(d[2]>=0))continue;
    let k=0;
    for(let j=0;j<3;j++){
      const b=(j+1)%3;
      if((d[j]>=0)!==(d[b]>=0))cuts[k++].copy(triangle[j]).lerp(triangle[b],d[j]/(d[j]-d[b]));
    }
    const face=ab.subVectors(triangle[1],triangle[0]).cross(ac.subVectors(triangle[2],triangle[0]));
    tangent.crossVectors(n,face);
    const reverse=ab.subVectors(cuts[1],cuts[0]).dot(tangent)<0;
    const a=cuts[Number(reverse)],b=cuts[Number(!reverse)];
    const x=a.dot(u),y=a.dot(v),X=b.dot(u),Y=b.dot(v);
    const cross=x*Y-X*y,len=Math.hypot(X-x,Y-y);
    twiceArea+=cross;mx+=(x+X)*cross;my+=(y+Y)*cross;
    perimeter+=len;lx+=(x+X)*len*.5;ly+=(y+Y)*len*.5;
    min=Math.min(min,x,X);max=Math.max(max,x,X);
  }
  if(perimeter===0)return null;
  const cx=Math.abs(twiceArea)>1e-14?mx/(3*twiceArea):lx/perimeter;
  const cy=Math.abs(twiceArea)>1e-14?my/(3*twiceArea):ly/perimeter;
  return {centre:origin.clone().addScaledVector(u,cx).addScaledVector(v,cy),width:max-min,area:Math.abs(twiceArea)/2};
}
export function atLevel(g,axis,fraction){
  const box=g.boundingBox,origin=box.getCenter(new T.Vector3());
  const f=T.MathUtils.clamp(fraction,.0001,.9999);
  origin.setComponent(axis,T.MathUtils.lerp(box.min.getComponent(axis),box.max.getComponent(axis),f));
  const n=new T.Vector3().setComponent(axis,1),u=new T.Vector3().setComponent((axis+1)%3,1);
  return (sliceMetrics(g,origin,n,u)?.centre||origin).toArray();
}
