importScripts('./offline-files.js');
const cacheName='fracture-atlas-offline';
const root=new URL('./',self.location.href);
const inside=url=>url.origin===root.origin&&url.pathname.startsWith(root.pathname);
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('message',event=>{
 if(event.data?.type!=='save-atlas'||!event.ports[0])return;
 const reply=event.ports[0];
 const assetPaths=Array.isArray(event.data.assets)?event.data.assets:[];
 event.waitUntil((async()=>{
  try{
   const urls=[...new Set([...self.ATLAS_OFFLINE_FILES,...assetPaths].map(path=>new URL(path,root).href))];
   if(urls.some(url=>!inside(new URL(url))))throw Error('Invalid atlas URL');
   const cache=await caches.open(cacheName);
   await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})));
   reply.postMessage({saved:true});
  }catch{reply.postMessage({saved:false});}
 })());
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||!inside(new URL(request.url)))return;
 event.respondWith((async()=>{
  try{return await fetch(request);}
  catch{
   const cache=await caches.open(cacheName),response=await cache.match(request);
   if(response)return response;
   return new Response('Atlas asset not saved',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','X-Atlas-Offline-Miss':'1'}});
  }
 })());
});
