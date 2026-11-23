import * as T from './vendor/three.module.js';

import {nativeGeometry,sourceVersion,cutKey,cachedCut} from './section-cache.js';
import {endostealLoop} from './endosteum.js';
import {fractureRelief,gridCoordinate,facetPolygons} from './fracture-surface.js';

const vec = a => new T.Vector3(...a);

export function section(geometry, normal, anchor, fold=0, spiralHeight=0, spiralAxis=[0,1,0], exteriorEnd=Infinity,posteriorSpiral=false,relief=null,retry=0) {
  if(retry===0&&exteriorEnd===Infinity&&nativeGeometry(geometry)){
   const key=cutKey(geometry,normal,anchor,fold,spiralHeight,spiralAxis,posteriorSpiral,relief);
   return cachedCut(geometry,key,()=>computeSection(geometry,normal,anchor,fold,spiralHeight,spiralAxis,exteriorEnd,posteriorSpiral,relief,0));
  }
  return computeSection(geometry,normal,anchor,fold,spiralHeight,spiralAxis,exteriorEnd,posteriorSpiral,relief,retry);
}

// A paged float stream avoids growing multi-million-element JavaScript number arrays
// when most faces of the input mesh simply pass unchanged into a fragment.
class FloatTriples {
 constructor(capacity){this.capacity=capacity;this.pages=[];this.length=0;this.pos=capacity;}
 push(x,y,z){
  if(this.pos===this.capacity){this.page=new Float32Array(this.capacity);this.pages.push(this.page);this.pos=0;}
  const p=this.pos;this.page[p]=x;this.page[p+1]=y;this.page[p+2]=z;this.pos+=3;this.length+=3;
 }
 triangle(array,indices,offset){
  if(this.pos===this.capacity){this.page=new Float32Array(this.capacity);this.pages.push(this.page);this.pos=0;}
  let dest=this.pos;
  for(let j=offset;j<offset+3;j++){
   const src=indices[j]*3;
   this.page[dest++]=array[src];this.page[dest++]=array[src+1];this.page[dest++]=array[src+2];
  }
  this.pos=dest;this.length+=9;
 }
 finish(){
  if(this.pages.length===1&&this.length===this.capacity)return this.page;
  const out=new Float32Array(this.length);
  for(let i=0;i<this.pages.length;i++)out.set(this.pages[i].subarray(0,Math.min(this.capacity,this.length-i*this.capacity)),i*this.capacity);
  return out;
 }
}
function computeSection(geometry,normal,anchor,fold,spiralHeight,spiralAxis,exteriorEnd,posteriorSpiral,relief,retry){
  const n=vec(spiralHeight?spiralAxis:normal).normalize(), origin=vec(anchor);
  const axis=new T.Vector3(Math.abs(n.x)<.8?1:0,Math.abs(n.x)<.8?0:1,0).cross(n).normalize();
  if(posteriorSpiral)axis.set(0,0,1).addScaledVector(n,-n.z).normalize();
  const up=n.clone().cross(axis);
  const axial=p=>n.dot(p.clone().sub(origin));
  function helix(x,y){
    if(posteriorSpiral){
      // Anterior-reference azimuth; the near-longitudinal connecting limb lies posteriorly.
      const seam=.075,u=(Math.atan2(-y,x)/(2*Math.PI)+1.5+seam/2)%1;
      const h=u<seam?.5-u/seam:(u-seam)/(1-seam)-.5;
      return spiralHeight*h*T.MathUtils.smoothstep(Math.hypot(x,y),0,spiralHeight*.10);
    }
    const angle=(Math.atan2(y,x)+Math.PI)/(2*Math.PI);
    const ramp=angle<.84?angle/.84:(1-angle)/.16;
    // A continuous core avoids a singular height at the axis inside the bone.
    return spiralHeight*(ramp-.5)*T.MathUtils.smoothstep(Math.hypot(x,y),0,spiralHeight*.16);
  }
  const curved=Boolean(spiralHeight||relief);
  const band=spiralHeight*.51+(relief?.amplitude||0)+2e-8;
  const rise=(x,y)=>(spiralHeight?helix(x,y):0)+(relief?fractureRelief(x,y,relief):0);
  const positions=geometry.attributes.position, norms=geometry.attributes.normal;
  const index=geometry.index.array,capacity=Math.min(65520,Math.max(198,index.length*3));
  const packed=positions.array instanceof Float32Array&&norms.array instanceof Float32Array&&
    positions.itemSize===3&&norms.itemSize===3&&!positions.normalized&&!norms.normalized&&
    !positions.isInterleavedBufferAttribute&&!norms.isInterleavedBufferAttribute;
  const groups=[new FloatTriples(capacity),new FloatTriples(capacity)];
  const normals=[new FloatTriples(capacity),new FloatTriples(capacity)],edges=[];
  const inherited=[[],[]];let isExterior=true;
  function emit(side,poly) {
    for(let k=1;k+1<poly.length;k++) for(const v of [poly[0],poly[k],poly[k+1]]) {
      if(isExterior){groups[side].push(...v.p.toArray());normals[side].push(...v.n.toArray());}
      else inherited[side].push(...v.p.toArray());
    }
  }
  const coord=(p,k)=>gridCoordinate(p.dot(axis)-origin.dot(axis),p.dot(up)-origin.dot(up),relief,k);
  function splitFaceted(tri){
    const cells=facetPolygons(tri,(v,k)=>coord(v.p,k),(a,b,t)=>({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()}),relief);
    for(const poly of cells)for(let j=1;j+1<poly.length;j++)clip([poly[0],poly[j],poly[j+1]]);
  }
  function signed(p){
    const relative=p.clone().sub(origin);
    if(!curved)return n.dot(relative)+fold*Math.abs(relative.x);
    return n.dot(relative)-rise(relative.dot(axis),relative.dot(up));
  }
  function clip(tri){
    // A previous cut is stored as float32. Classify a shared crease consistently on recut.
    for(const v of tri){v.d=signed(v.p);if(Math.abs(v.d)<2e-8)v.d=0;}
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
    const farAbove=tri.every(v=>axial(v.p)>band);
    const farBelow=tri.every(v=>axial(v.p)<-band);
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
  // Most of a high-resolution shaft is entirely outside the cut band.
  // Preserve those triangles verbatim without allocating clipping vertices.
  const axialFromPlane=new Float64Array(positions.count),offset=n.dot(origin);
  for(let j=0;j<positions.count;j++)axialFromPlane[j]=n.x*positions.getX(j)+n.y*positions.getY(j)+n.z*positions.getZ(j)-offset;
  for(let i=0;i<index.length;i+=3){
    isExterior=i<exteriorEnd;
    const a=index[i],b=index[i+1],c=index[i+2],da=axialFromPlane[a],db=axialFromPlane[b],dc=axialFromPlane[c];
    let low=Math.min(da,db,dc),high=Math.max(da,db,dc);
    if(fold){
     const x=positions.getX(a)-origin.x,y=positions.getX(b)-origin.x,z=positions.getX(c)-origin.x;
     if(Math.min(x,y,z)<0&&Math.max(x,y,z)>0){low=-Infinity;high=Infinity;}
     else{
      const h1=da+fold*Math.abs(x),h2=db+fold*Math.abs(y),h3=dc+fold*Math.abs(z);
      low=Math.min(h1,h2,h3);high=Math.max(h1,h2,h3);
     }
    }
    if(low>band||high<-band){
     const side=Number(low>band),out=isExterior?groups[side]:inherited[side],ns=normals[side];
     if(isExterior&&packed){out.triangle(positions.array,index,i);ns.triangle(norms.array,index,i);}
     else for(let j=i;j<i+3;j++){
      const k=index[j];out.push(positions.getX(k),positions.getY(k),positions.getZ(k));
      if(isExterior)ns.push(norms.getX(k),norms.getY(k),norms.getZ(k));
     }
     continue;
    }
    const tri=Array.from(index.slice(i,i+3),j=>({p:new T.Vector3().fromBufferAttribute(positions,j),n:new T.Vector3().fromBufferAttribute(norms,j)}));
    if(spiralHeight)refine(tri,index.length>250000?1:3);
    else if(relief)splitFaceted(tri);
    else if(fold&&tri.some(a=>a.p.x>origin.x)&&tri.some(a=>a.p.x<origin.x))splitCrease(tri,clip);
    else clip(tri);
  }
  const graph=new Map(),points=new Map(),buckets=new Map(),weld=.0000004;
  function rimKey(p){
   const x=Math.floor(p.x/weld),y=Math.floor(p.y/weld),z=Math.floor(p.z/weld);
   for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++)for(let k=z-1;k<=z+1;k++){
    const ids=buckets.get(i+','+j+','+k);if(!ids)continue;
    for(const id of ids)if(points.get(id).distanceToSquared(p)<weld*weld)return id;
   }
   const key=x+','+y+','+z,id=points.size;points.set(id,p);
   if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);return id;
  }
  for(const [a,b] of edges){
    const i=rimKey(a),j=rimKey(b);
    if(i===j)continue;
    for(const [from,to,p] of [[i,j,a],[j,i,b]]){
      if(!graph.has(from))graph.set(from,new Set());
      graph.get(from).add(to);
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
  // A plane passing exactly through source vertices can yield an open boundary graph
  // at float32 precision. Recut the entire pair together, never fill only one side.
  if(!rings.length&&edges.length>5&&groups.every(side=>side.length)&&retry<3){
   const delta=[.000005,-.000011,.000018][retry],nearby=origin.clone().addScaledVector(n,delta);
   return section(geometry,normal,nearby.toArray(),fold,spiralHeight,spiralAxis,exteriorEnd,posteriorSpiral,relief,retry+1);
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
  const canals=[];
  for(const ring of rings){
    if(ring.depth%2)continue;
    if(relief?.canal&&ring===rings[0]&&!ring.holes.length&&!spiralHeight){
     // The atlas supplies the external cortex only. Use a labelled internal teaching model.
     const flat=ring.flat,centre=new T.Vector2();let sum=0;
     for(let i=0;i<flat.length;i++){
      const a=flat[i],b=flat[(i+1)%flat.length],w=a.x*b.y-a.y*b.x;
      sum+=w;centre.x+=(a.x+b.x)*w;centre.y+=(a.y+b.y)*w;
     }
     if(Math.abs(sum)>1e-15){
      centre.divideScalar(3*sum);
      const toWorld=q=>origin.clone().addScaledVector(axis,q.x).addScaledVector(up,q.y).addScaledVector(n,rise(q.x,q.y));
      const toFlat=q=>{const v=q.clone().sub(origin);return new T.Vector2(v.dot(axis),v.dot(up));};
      const measured=relief.ct?endostealLoop(flat,centre,toWorld,toFlat,relief.ct):null;
      if(measured||!relief.requireMeasured){
       if(measured)centre.copy(measured.centre);
       const inner=measured?.inner||flat.map(p=>p.clone().sub(centre).multiplyScalar(relief.canal).add(centre));
       if(T.ShapeUtils.area(inner)<0)inner.reverse();
       const lift=v=>origin.clone().addScaledVector(axis,v.x).addScaledVector(up,v.y).addScaledVector(n,rise(v.x,v.y));
       const loop=inner.map(lift);
       ring.holes.push({flat:inner,loop});
       canals.push({loop,measured:Boolean(measured),centre:lift(centre),depth:Math.min(.0045,Math.sqrt(ring.area)*.13)});
      }
     }
    }
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
      const height=curved?rise(relative.dot(axis),relative.dot(up)):-fold*Math.abs(relative.x);
      return p.addScaledVector(n,height-n.dot(relative));
    }
    // Split long interior diagonals on both adjacent triangles. Leave the cut rim exactly as clipped.
    let triangles=faces;
    if(spiralHeight){
      const size=relief?Math.max(.0008,relief.spacing*.35):spiralHeight/12;
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
      if(relief&&!spiralHeight){
        const cells=facetPolygons(tri,coord,(a,b,t)=>a.clone().lerp(b,t),relief);
        for(const poly of cells)for(let j=1;j+1<poly.length;j++)for(const v of [poly[0],poly[j],poly[j+1]]){
          const r=v.clone().sub(origin),h=fractureRelief(r.dot(axis),r.dot(up),relief);
          cap.push(...v.clone().addScaledVector(n,h-r.dot(n)).toArray());
        }
      }else if(fold&&tri.some(p=>p.x>origin.x)&&tri.some(p=>p.x<origin.x)){
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
    geo.setAttribute('position',new T.BufferAttribute(list.finish(),3));
    geo.setAttribute('normal',new T.BufferAttribute(normals[side].finish(),3));
    const face=new T.BufferGeometry();
    const surface=new Float32Array(cap);
    if(side===1)for(let k=0;k<surface.length;k+=9)for(let j=0;j<3;j++){
      const temp=surface[k+3+j];surface[k+3+j]=surface[k+6+j];surface[k+6+j]=temp;
    }
    const wall=[],marrow=[];
    const tri=(out,a,b,c)=>{for(const v of (side?[a,c,b]:[a,b,c]))out.push(...v.toArray());};
    for(const canal of canals){
     const advance=side?canal.depth:-canal.depth;
     const heights=canal.loop.map(p=>p.dot(n));
     const baseHeight=(side?Math.max(...heights):Math.min(...heights))+advance;
     const floor=canal.loop.map(p=>p.clone().addScaledVector(n,baseHeight-p.dot(n)));
     const centre=canal.centre.clone().addScaledVector(n,baseHeight-canal.centre.dot(n));
     for(let i=0;i<floor.length;i++){
      const j=(i+1)%floor.length;
      tri(wall,canal.loop[i],canal.loop[j],floor[i]);tri(wall,canal.loop[j],floor[j],floor[i]);
      tri(marrow,centre,floor[i],floor[j]);
     }
    }
    const outerLength=surface.length+inherited[side].length;
    const combined=new Float32Array(outerLength+wall.length+marrow.length);
    combined.set(wall,outerLength);combined.set(marrow,outerLength+wall.length);
    if(wall.length){
     face.addGroup(0,outerLength/3,0);face.addGroup(outerLength/3,wall.length/3,1);
     face.addGroup((outerLength+wall.length)/3,marrow.length/3,2);face.userData.canal=true;face.userData.canalMeasured=canals.some(entry=>entry.measured);
    }
    combined.set(surface);combined.set(inherited[side],surface.length);
    face.setAttribute('position',new T.BufferAttribute(combined,3));face.computeVertexNormals();
    if(relief&&!spiralHeight){
     // Smooth lighting across very small facets while retaining their full relief and edges.
     const step=relief.spacing*.20,fn=face.attributes.normal,v=new T.Vector3();
     for(let k=0;k<surface.length/3;k++){
      v.fromArray(surface,k*3).sub(origin);const u=v.dot(axis),w=v.dot(up);
      const dx=(fractureRelief(u+step,w,relief)-fractureRelief(u-step,w,relief))/(2*step);
      const dy=(fractureRelief(u,w+step,relief)-fractureRelief(u,w-step,relief))/(2*step);
      v.copy(n).addScaledVector(axis,-dx).addScaledVector(up,-dy).normalize().multiplyScalar(side?-1:1);
      fn.setXYZ(k,v.x,v.y,v.z);
     }
    }
    const outline=new T.BufferGeometry().setFromPoints(edges.flat());
    return {geo,face,outline};
  });
}

// Preserve both the internal face material and the outline of the first cut when recutting.
export function branchSection(first,normal,anchor){
 const merged=new T.BufferGeometry();
 for(const key of ['position','normal']){
  const a=first.geo.attributes[key].array,b=first.face.attributes[key].array;
  const values=new Float32Array(a.length+b.length);values.set(a);values.set(b,a.length);
  merged.setAttribute(key,new T.BufferAttribute(values,3));
 }
 merged.setIndex(Array.from({length:merged.attributes.position.count},(_,i)=>i));
 const children=section(merged,normal,anchor,0,0,[0,1,0],first.geo.attributes.position.count);
 const rim=first.outline.attributes.position,n=vec(normal).normalize(),plane=n.dot(vec(anchor)),extra=[[],[]];
 for(let i=0;i<rim.count;i+=2){
  const a=new T.Vector3().fromBufferAttribute(rim,i),b=new T.Vector3().fromBufferAttribute(rim,i+1);
  const da=n.dot(a)-plane,db=n.dot(b)-plane;
  if((da>=0)===(db>=0))extra[Number(da>=0)].push(a,b);
  else {const mid=a.clone().lerp(b,da/(da-db));extra[Number(da>=0)].push(a,mid);extra[Number(db>=0)].push(mid,b);}
 }
 children.forEach((item,k)=>{
  const pos=item.outline.attributes.position.array,coords=new Float32Array(pos.length+3*extra[k].length);coords.set(pos);
  extra[k].forEach((p,i)=>p.toArray(coords,pos.length+3*i));
  item.outline.setAttribute('position',new T.BufferAttribute(coords,3));
 });
 merged.dispose();return children;
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
  if(!nativeGeometry(g))return computeSliceMetrics(g,origin,normal,lateral);
  if(!metricOwners.has(g)){
   metricOwners.add(g);
   function release(){sliceCache.delete(g);slabCache.delete(g);metricOwners.delete(g);g.removeEventListener('dispose',release);}
   g.addEventListener('dispose',release);
  }
  let cache=sliceCache.get(g);
  const version=sourceVersion(g);
  if(cache?.version!==version){cache={version,values:new Map()};sliceCache.set(g,cache);}
  const key=[origin.x,origin.y,origin.z,normal.x,normal.y,normal.z,lateral.x,lateral.y,lateral.z].join(',');
  if(!cache.values.has(key)){
   if(cache.values.size>=64)cache.values.delete(cache.values.keys().next().value);
   cache.values.set(key,computeSliceMetrics(g,origin,normal,lateral));
  }
  const result=cache.values.get(key);
  return result?{...result,centre:result.centre.clone()}:null;
}
const metricOwners=new WeakSet(),sliceCache=new WeakMap();
const slabCache=new WeakMap();
// Store at most one anatomical axis per source. Bin memberships keep the original
// triangle order so clipped area, centre and perimeter integrate identically.
function trianglesAt(g,axis,value){
 const p=g.attributes.position,idx=g.index.array,version=sourceVersion(g);
 let slabs=slabCache.get(g);
 if(!slabs||slabs.version!==version||slabs.axis!==axis){
  if(!g.boundingBox)g.computeBoundingBox();
  const min=g.boundingBox.min.getComponent(axis),span=g.boundingBox.max.getComponent(axis)-min;
  if(!(span>0))return null;
  const bin=x=>Math.max(0,Math.min(63,Math.floor((x-min)*64/span)));
  const counts=new Uint32Array(65),ranges=new Uint8Array(2*idx.length/3),coords=p.array;
  for(let j=0;j<idx.length;j+=3){
   const a=coords[idx[j]*3+axis],b=coords[idx[j+1]*3+axis],c=coords[idx[j+2]*3+axis];
   const lo=bin(Math.min(a,b,c)),hi=bin(Math.max(a,b,c));
   ranges[j/3*2]=lo;ranges[j/3*2+1]=hi;
   for(let k=lo;k<=hi;k++)counts[k+1]++;
  }
  for(let k=1;k<counts.length;k++)counts[k]+=counts[k-1];
  let offsets=null;
  if(counts[64]<=idx.length){
   offsets=new Uint32Array(counts[64]);const cursor=counts.slice();
   for(let j=0;j<idx.length;j+=3){
    for(let k=ranges[j/3*2];k<=ranges[j/3*2+1];k++)offsets[cursor[k]++]=j;
   }
  }
  slabs={axis,version,counts,offsets,bin};slabCache.set(g,slabs);
 }
 if(!slabs.offsets)return null;
 const k=slabs.bin(value);
 return slabs.offsets.subarray(slabs.counts[k],slabs.counts[k+1]);
}
function computeSliceMetrics(g,origin,normal,lateral){
  const n=normal.clone().normalize(),u=lateral.clone().addScaledVector(n,-lateral.dot(n)).normalize();
  const v=new T.Vector3().crossVectors(n,u),pos=g.attributes.position,index=g.index.array;
  const triangle=[new T.Vector3(),new T.Vector3(),new T.Vector3()],d=[0,0,0];
  const cuts=[new T.Vector3(),new T.Vector3()],ab=new T.Vector3(),ac=new T.Vector3(),tangent=new T.Vector3();
  let twiceArea=0,mx=0,my=0,perimeter=0,lx=0,ly=0,min=Infinity,max=-Infinity;
  // Measure a signed distance once per indexed vertex. Only intersected triangles
  // need full Vector3 coordinates for contour integration.
  const cardinal=n.x===1&&n.y===0&&n.z===0?0:n.y===1&&n.x===0&&n.z===0?1:n.z===1&&n.x===0&&n.y===0?2:-1;
  const packed=pos.array instanceof Float32Array&&pos.itemSize===3&&!pos.normalized&&!pos.isInterleavedBufferAttribute;
  const value=cardinal<0?0:origin.getComponent(cardinal);
  const candidates=cardinal>=0&&packed&&nativeGeometry(g)&&index.length>=60000?trianglesAt(g,cardinal,value):null;
  let distance;
  if(!candidates){
   distance=new Float64Array(pos.count);
   for(let j=0;j<pos.count;j++)distance[j]=n.x*(pos.getX(j)-origin.x)+n.y*(pos.getY(j)-origin.y)+n.z*(pos.getZ(j)-origin.z);
  }
  const count=candidates?candidates.length:index.length/3;
  for(let row=0;row<count;row++){
    const i=candidates?candidates[row]:3*row;
    if(candidates)for(let j=0;j<3;j++)d[j]=pos.array[index[i+j]*3+cardinal]-value;
    else {d[0]=distance[index[i]];d[1]=distance[index[i+1]];d[2]=distance[index[i+2]];}
    if((d[0]>=0)===(d[1]>=0)&&(d[1]>=0)===(d[2]>=0))continue;
    for(let j=0;j<3;j++)triangle[j].fromBufferAttribute(pos,index[i+j]).sub(origin);
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

// Orient named transverse and oblique cuts to the axis of this specimen's short tubular bone.
export function shortShaftCut(g,s,angle){
 const low=vec(atLevel(g,s.axis,.26)),high=vec(atLevel(g,s.axis,.74)),axis=high.sub(low).normalize();
 if(axis.dot(vec(s.normal))<0)axis.negate();
 const side=new T.Vector3(Math.abs(axis.x)<.88?1:0,Math.abs(axis.x)<.88?0:1,0);
 side.addScaledVector(axis,-axis.dot(side)).normalize();
 const rad=T.MathUtils.degToRad(angle),normal=axis.multiplyScalar(Math.cos(rad)).addScaledVector(side,Math.sin(rad)).normalize();
 return {...s,normal:normal.toArray(),second:s.second?side.toArray():undefined};
}
