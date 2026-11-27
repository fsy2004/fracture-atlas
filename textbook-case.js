// Chapter additions carry their own source locator, teaching points and tissue profile key.
export const rest = {shift:[0,0,0],turn:[0,0,0]};

export function motion(shift=rest.shift,turn=rest.turn){
 return {shift,turn};
}

export function cut(bone,level,normal=[0,1,0],minus=rest,plus=rest,extra={}){
 return {bone,level,normal,minus,plus,axis:1,...extra};
}

export function teachingCase(name,cuts,points,clinical,options={}){
 return {
  name,cuts,cause:points[0],observe:points[1],...options,
  textbook:{points,clinical}
 };
}

export function addCases(courses,id,source,variants){
 const course=courses.find(item=>item.id===id);
 course.variants.push(...variants.map(v=>({...v,source:v.source||source})));
}

export const right = {
 humerus:'Right humerus',radius:'Right radius',ulna:'Right ulna',femur:'Right femur',
 tibia:'Right tibia',fibula:'Right fibula',hip:'Right hip bone',patella:'Right patella',
 talus:'Right talus',calcaneus:'Right calcaneus'
};

const rays=['first','second','third','fourth','fifth'];
export const metatarsals=rays.map(n=>'Right '+n+' metatarsal bone');
export const toeColumns=['big','second','third','fourth','little'].map((n,i)=>
 (i?['Proximal','Middle','Distal']:['Proximal','Distal']).map(p=>p+' phalanx of right '+n+' toe'));
toeColumns[0].push('Sesamoid bone of right foot','Sesamoid bone of right foot FJ3376');
export const midfoot=['Navicular bone of right foot','Right cuboid bone',
 ...['medial','intermediate','lateral'].map(n=>'Right '+n+' cuneiform bone')];
export const foot=[right.talus,right.calcaneus,...midfoot,...metatarsals,...toeColumns.flat()];
