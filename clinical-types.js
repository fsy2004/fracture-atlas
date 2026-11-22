export function typeView(c,i){
 if(['plateau','calcaneus','patella-dislocation','lisfranc-dislocation'].includes(c?.id))return 'top';
 if(c?.id==='elbow-dislocation'&&i===1||c?.id==='knee-dislocation'&&i>1)return 'front';
 if(['radius','lunate-dislocation','elbow-dislocation','hip-dislocation','shoulder-dislocation','elbow','knee-dislocation'].includes(c?.id))return 'side';
 if(c?.id==='intercondylar'||c?.id==='ankle')return 'front';
 return null;
}
