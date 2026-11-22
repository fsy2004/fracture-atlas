// Visible displaced examples within each lesson. These scale a checked anatomical
// trajectory in its native frame; each input remains expressed in actual mm/degrees.
const largerExamples={
 femur:[0,1,2],humerus:[0,1,2],neck:[0,1],radius:[0,1,2,3],tibia:[0,1],
 clavicle:[1],patella:[0],finger:[1],metacarpal:[1,2,3],intercondylar:[0,1]
};

export function teachingTargets(clinical,travel,spin){
 const {id,variant,selectedShape,wedge,legacyMotion}=clinical;
 if(legacyMotion||selectedShape||wedge||!largerExamples[id]?.includes(variant))return {travel,spin};
 if(id==='tibia'&&variant===1)return {travel:12,spin:12};
 return {travel:Math.round(travel*1.5*2)/2,spin:Math.round(spin*1.4)};
}
