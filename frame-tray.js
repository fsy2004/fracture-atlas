// Frames are captured synchronously from the last rendered camera, before the drawing buffer clears.
export function createFrameTray({pause,render,describe}){
 const el=id=>document.getElementById(id);
 const frames=[],dialog=el('frameDialog');let current=null;
 function open(frame){
  current=frame;el('frameSheet').hidden=true;el('framePreview').hidden=false;el('removeFrame').hidden=false;el('saveFrame').hidden=false;el('framePreview').src=frame.url;el('frameCaption').textContent=frame.title;
  el('saveFrame').href=frame.url;el('saveFrame').download=frame.filename;
  if(!dialog.open)dialog.showModal();
 }
 function count(){
  el('captureFrame').textContent=frames.length?'截取当前帧（'+frames.length+'）':'截取当前帧';
  el('compareFrames').disabled=frames.length<2;el('savedFrames').hidden=!frames.length;
 }
 el('compareFrames').onclick=()=>{
  el('framePreview').hidden=true;el('saveFrame').hidden=true;el('removeFrame').hidden=true;
  const sheet=el('frameSheet');sheet.replaceChildren();sheet.hidden=false;
  for(const frame of frames){
   const b=document.createElement('button'),img=document.createElement('img');img.src=frame.url;img.alt=frame.title;
   b.append(img);b.onclick=()=>open(frame);sheet.append(b);
  }
  el('frameCaption').textContent='按截取顺序排列，点击可放大。';dialog.showModal();
 };
 el('removeFrame').onclick=()=>{
  dialog.close();frames.splice(frames.indexOf(current),1);current.button.remove();
  URL.revokeObjectURL(current.url);current=null;count();
 };
 el('captureFrame').onclick=()=>{
  pause();const labels=describe(),title=labels.filter(Boolean).join(' · ');
  const source=render(),canvas=document.createElement('canvas');
  canvas.width=source.width;const size=Math.max(15,Math.round(canvas.width/65)),pad=size;
  const ctx=canvas.getContext('2d');
  const lines=[labels.slice(0,3).join(' · '),labels[3]];
  ctx.font=size+'px sans-serif';
  let line='';for(const word of labels[4].split(/\s+/)){
   if(ctx.measureText(line+' '+word).width>canvas.width-2*pad&&line){lines.push(line);line=word;}
   else line=(line+' '+word).trim();
  }
  if(line)lines.push(line);
  canvas.height=source.height+pad+lines.length*size*1.5;
  ctx.fillStyle='#f5f3e8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0);
  const rect=source.getBoundingClientRect(),factor=source.width/rect.width;
  for(const label of document.querySelectorAll('#markLayer:not([hidden]) .pin:not([hidden])')){
   const box=label.getBoundingClientRect(),x=(box.x-rect.x)*factor,y=(box.y-rect.y)*factor;
   ctx.font='bold '+Math.round(12*factor)+'px sans-serif';const w=ctx.measureText(label.textContent).width+8*factor;
   ctx.fillStyle='#f4f2e6';ctx.fillRect(x,y,w,18*factor);ctx.fillStyle='#25443b';
   ctx.fillText(label.textContent,x+4*factor,y+13*factor);
  }
  ctx.font=size+'px sans-serif';ctx.fillStyle='#213d36';lines.forEach((s,i)=>ctx.fillText(s,pad,source.height+(i+1)*size*1.5));
  canvas.toBlob(blob=>{
   if(!blob)return;
   const frame={url:URL.createObjectURL(blob),title,filename:labels.slice(0,3).join('-')+'.png',button:document.createElement('button')};
   const image=document.createElement('img');image.src=frame.url;image.alt=title;
   const caption=document.createElement('span');caption.textContent=labels[1]+' · '+labels[2];
   frame.button.append(image,caption);frame.button.onclick=()=>open(frame);
   frames.push(frame);el('frameStrip').append(frame.button);el('savedFrames').hidden=false;
   count();
  },'image/png');
 };
}
