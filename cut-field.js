import * as T from './vendor/three.module.js';

// Sample distance to the actual clipped cortical rim in section coordinates.
// This is a display layer and keeps the collision solids unmodified.
export function cutField(outline,anchor,normal){
 const positions=outline.attributes.position;if(positions.count<6)return null;
 const n=normal.clone().normalize();
 const u=new T.Vector3(Math.abs(n.x)<.8?1:0,Math.abs(n.x)<.8?0:1,0).cross(n).normalize();
 const v=n.clone().cross(u),p=new T.Vector3(),vertices=[];
 let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
 const stride=Math.max(2,2*Math.ceil(positions.count/2400));
 for(let i=0;i<positions.count;i+=stride){
  const start=p.fromBufferAttribute(positions,i).sub(anchor);
  const x=start.dot(u),y=start.dot(v);
  const end=p.fromBufferAttribute(positions,i+1).sub(anchor);
  const a=end.dot(u),b=end.dot(v);
  minU=Math.min(minU,x,a);maxU=Math.max(maxU,x,a);
  minV=Math.min(minV,y,b);maxV=Math.max(maxV,y,b);
  const dx=a-x,dy=b-y,length=dx*dx+dy*dy;
  if(length>1e-16)vertices.push([x,y,dx,dy,1/length]);
 }
 const width=maxU-minU,height=maxV-minV;
 if(!vertices.length||Math.min(width,height)<.0005)return null;
 const size=48,data=new Uint8Array(size*size*4);
 const scale=T.MathUtils.clamp(Math.min(width,height)*.095,.00035,.0022);
 for(let j=0;j<size;j++){
  const y=minV+(j+.5)*height/size;
  for(let i=0;i<size;i++){
   const x=minU+(i+.5)*width/size;
   let nearest=Infinity;
   for(const [a,b,dx,dy,invLength] of vertices){
    const px=x-a,py=y-b,t=Math.max(0,Math.min(1,(px*dx+py*dy)*invLength));
    nearest=Math.min(nearest,(px-t*dx)**2+(py-t*dy)**2);
   }
   const value=Math.round(255*Math.min(1,Math.sqrt(nearest)/scale));
   data.fill(value,(j*size+i)*4,(j*size+i)*4+3);
   data[(j*size+i)*4+3]=255;
  }
 }
 const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
 return {texture,origin:anchor.clone(),u,v,range:new T.Vector4(minU,minV,1/width,1/height)};
}
