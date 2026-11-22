// Teaching clock: retain the same ordered 3-D poses while separating initial failure
// from subsequent displacement. Units on the player are replay seconds.
const clocks={
 joint:[[0,0],[.28,.19],[.43,.67],[.81,.96],[1,1]],
 fracture:[[0,0],[.14,0],[.23,.50],[.40,.57],[.86,.97],[1,1]]
};
export function sweepTimes(start,end,kind){
 const cuts=(clocks[kind]||[]).map(k=>k[0]).filter(t=>t>start&&t<end);
 const times=[];
 for(const next of [...cuts,end]){
  const distance=Math.max(next-start,injuryTime(next,kind)-injuryTime(start,kind));
  const n=Math.max(1,Math.ceil(distance*128));
  for(let k=1;k<=n;k++)times.push(k===n?next:start+(next-start)*k/n);
  start=next;
 }
 return times;
}
export function injuryTime(t,kind){
 if(!kind)return t;
 const keys=clocks[kind];
 for(let i=1;i<keys.length;i++){
  const [end,b]=keys[i];if(t>end)continue;
  const [start,a]=keys[i-1];return a+(b-a)*(t-start)/(end-start);
 }
 return 1;
}

// Reveal nearby edges together along the actual cut boundary. The starting site is an
// observation cue. It does not identify a patient's microscopic crack initiation point.
export function orderRim(line){
 const g=line.geometry,p=g.attributes.position;if(!p?.count)return;
 const segments=[],vertices=new Map();
 const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e6)).join('/');
 function node(i){
  const k=key(i);if(!vertices.has(k))vertices.set(k,{i,z:p.getZ(i),dist:Infinity,edges:[]});return vertices.get(k);
 }
 for(let i=0;i<p.count;i+=2){
  const a=node(i),b=node(i+1),d=Math.hypot(p.getX(i)-p.getX(i+1),p.getY(i)-p.getY(i+1),p.getZ(i)-p.getZ(i+1));
  a.edges.push([b,d]);b.edges.push([a,d]);segments.push({a,b,i});
 }
 let end=0;
 for(const start of [...vertices.values()].sort((a,b)=>b.z-a.z)){
  if(Number.isFinite(start.dist))continue;
  start.dist=end;const queue=[start];for(let k=0;k<queue.length;k++){
   const v=queue[k];for(const [other,d] of v.edges)if(other.dist>v.dist+d+1e-9){
    other.dist=v.dist+d;queue.push(other);
   }
  }
  for(const v of queue)end=Math.max(end,v.dist);
 }
 segments.sort((a,b)=>Math.min(a.a.dist,a.b.dist)-Math.min(b.a.dist,b.b.dist));
 const old=p.array.slice();segments.forEach(({i},k)=>p.array.set(old.subarray(i*3,i*3+6),k*6));
 p.needsUpdate=true;line.userData.progressive=true;
}
