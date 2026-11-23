const primaryOrigin='https://fsy2004.github.io';
const mirrorURL='https://fastly.jsdelivr.net/gh/fsy2004/fracture-atlas@68a5578f85009bc35e7494805e6837f5dfcbc005/models/bones.bin';
const expected='db557f347b6ae3a1c22d6aa303b700bcef34ca810c167e0344eb9e57f352f7d8';

async function verifiedMirror(){
 const response=await fetch(mirrorURL,{mode:'cors',credentials:'omit',signal:AbortSignal.timeout?.(20000)});
 if(!response.ok)throw Error('备用骨面载入失败');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==2938092)throw Error('备用骨面长度不匹配');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 if(hash!==expected)throw Error('备用骨面校验失败');
 return bytes;
}

export async function loadOverviewBytes(read){
 const primary=read('models/bones.bin');
 if(location.origin!==primaryOrigin||!location.pathname.startsWith('/fracture-atlas/')||!crypto.subtle||!Promise.any)
  return primary;
 let openFallback,timer;
 const threshold=new Promise(resolve=>{openFallback=resolve;timer=setTimeout(resolve,9000);});
 primary.catch(()=>openFallback());
 try{return await Promise.any([primary,threshold.then(verifiedMirror)]);}
 finally{clearTimeout(timer);}
}
