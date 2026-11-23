export function setupOffline(getFiles){
 const area=document.getElementById('networkTools'),button=document.getElementById('saveOffline'),status=document.getElementById('offlineState');
 if(location.protocol==='file:'){area.hidden=true;return;}
 if(!('serviceWorker' in navigator)){button.hidden=true;return;}
 const reflect=()=>{
  button.disabled=!navigator.onLine;
  status.textContent=navigator.onLine?'':'离线中';
 };
 window.addEventListener('online',reflect);window.addEventListener('offline',reflect);reflect();
 button.onclick=async()=>{
  const assets=getFiles();
  button.disabled=true;status.textContent='正在保存…';
  try{
   await navigator.serviceWorker.register('./sw.js');
   const worker=(await navigator.serviceWorker.ready).active,channel=new MessageChannel();
   const response=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{channel.port1.close();reject(Error('Timeout'));},90000);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
    worker.postMessage({type:'save-atlas',assets},[channel.port2]);
   });
   status.textContent=response.saved?'已保存全身及当前精细骨面':'保存失败，可重试';
  }catch{status.textContent='保存失败，可重试';}
  button.disabled=!navigator.onLine;
 };
}
