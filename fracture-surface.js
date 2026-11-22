// Piecewise-linear macrorelief about a clinically selected fracture envelope.
// Each cortical and cap triangle is split on the same facet boundaries.
function knot(i,seed){
 let h=Math.imul(i+seed,374761393)^Math.imul(seed,668265263);
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/2147483648-1;
}
function irregular(t,seed){
 // Knot intervals vary while staying strictly ordered.
 let i=Math.floor(t),a=i+.24*knot(i,seed),b=i+1+.24*knot(i+1,seed);
 if(t<a){i--;b=a;a=i+.24*knot(i,seed);}
 else if(t>b){i++;a=b;b=i+1+.24*knot(i+1,seed);}
 return i+(t-a)/(b-a);
}
export function facetCoordinate(x,y,p,axis){
 return axis?irregular((y-.31*x)/p.spacing+.29,p.seed+7):irregular((x+.43*y)/p.spacing+.17,p.seed);
}
function heightAt(i,j,seed){return knot(i+Math.imul(j,17189),seed+j*19);}
export function fractureRelief(x,y,p){
 const X=facetCoordinate(x,y,p,0),Y=facetCoordinate(x,y,p,1),i=Math.floor(X),j=Math.floor(Y),u=X-i,v=Y-j;
 const a=heightAt(i,j,p.seed),b=heightAt(i+1,j,p.seed),c=heightAt(i,j+1,p.seed),d=heightAt(i+1,j+1,p.seed);
 const z=(i+j)%2===0?(u+v<=1?a+(b-a)*u+(c-a)*v:d+(b-d)*(1-v)+(c-d)*(1-u)):
  (v<=u?a+(b-a)*u+(d-b)*v:a+(d-c)*u+(c-a)*v);
 return p.amplitude*z;
}
export function fractureProfile(width,seed){
 return {amplitude:Math.min(.0019,Math.max(.0003,width*.050)),spacing:Math.min(.0045,Math.max(.0015,width*.10)),seed};
}
function clipCells(cells,signed,interpolate){
 const next=[];
 for(const poly of cells){
  const d=poly.map(signed);
  if(Math.min(...d)>=-1e-8||Math.max(...d)<=1e-8){next.push(poly);continue;}
  const below=[],above=[];
  for(let i=0;i<poly.length;i++){
   const j=(i+1)%poly.length;
   if(d[i]<=0)below.push(poly[i]);if(d[i]>=0)above.push(poly[i]);
   if(d[i]*d[j]<0){const v=interpolate(poly[i],poly[j],d[i]/(d[i]-d[j]));below.push(v);above.push(v);}
  }
  if(below.length>=3)next.push(below);if(above.length>=3)next.push(above);
 }
 return next;
}
export function facetPolygons(triangle,coordinate,interpolate,profile){
 let cells=[triangle];
 for(const axis of [0,1]){
  const raw=triangle.map(v=>coordinate(v,axis)),coords=raw.map(v=>irregular(v,profile.seed+(axis?7:0)));
  for(let cut=Math.floor(Math.min(...coords))+1;cut<Math.ceil(Math.max(...coords));cut++){
   const edge=cut+.24*knot(cut,profile.seed+(axis?7:0));
   cells=clipCells(cells,v=>coordinate(v,axis)-edge,interpolate);
  }
 }
 const faces=[];
 for(const poly of cells){
  const xy=[0,1].map(k=>poly.reduce((sum,v)=>sum+coordinate(v,k),0)/poly.length);
  const i=Math.floor(irregular(xy[0],profile.seed)),j=Math.floor(irregular(xy[1],profile.seed+7));
  const slash=(i+j)%2===0;
  faces.push(...clipCells([poly],v=>{
   const x=irregular(coordinate(v,0),profile.seed)-i,y=irregular(coordinate(v,1),profile.seed+7)-j;
   return slash?x+y-1:x-y;
  },interpolate));
 }
 return faces;
}
export const gridCoordinate=(x,y,p,k)=>k?(y-.31*x)/p.spacing+.29:(x+.43*y)/p.spacing+.17;
