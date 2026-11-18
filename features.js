// Shape describes the fracture surface; displacement describes the relative pose.
export const shapeNames={transverse:'横断',shortOblique:'短斜形',oblique:'斜形',spiral:'螺旋形',comminuted:'粉碎'};
export const motionNames={shorten:'缩短（重叠）',rotate:'旋转',angle:'成角',side:'侧方',separate:'分离'};
const transverse=['transverse','shortOblique','comminuted'];
const torsional=['oblique','spiral'];
const allShaft=['transverse','oblique','spiral','comminuted'];
const shafts={
 tibia:[transverse,torsional],
 forearm:[['transverse','comminuted'],['oblique'],torsional],
 femur:[allShaft,allShaft,['shortOblique',...allShaft]],
 humerus:[['transverse','comminuted'],['transverse','comminuted'],torsional],
 'single-forearm':[allShaft,allShaft,allShaft]
};
export function initialShape(course,i){
 if(course.id==='clavicle')return 'shortOblique';
 if(course.id==='tibia')return i?'oblique':'transverse';
 if(course.id==='forearm')return i?'oblique':'transverse';
 if(course.id==='humerus')return i===2?'oblique':'transverse';
 if(course.id==='femur')return i===2?'shortOblique':'transverse';
 if(course.id==='metacarpal')return 'oblique';
 return 'transverse';
}
export function featuresFor(course,index){
 const shapes=shafts[course.id]?.[index];
 if(shapes)return {shapes,motions:Object.keys(motionNames)};
 if(course.id==='metacarpal'&&index===3)return {shapes:allShaft,motions:Object.keys(motionNames)};
 if(course.id==='radius'&&index<2)return {shapes:[],motions:['shorten']};
 if(course.id==='toes'&&index===2)return {shapes:[],motions:[]};
 if(course.id==='clavicle')return {shapes:['shortOblique','transverse','comminuted'],motions:[]};
 if(['finger','metatarsal','toes'].includes(course.id))return {shapes:[],motions:['side','angle','rotate','shorten','separate']};
 return {shapes:[],motions:[]};
}
export function withShape(spec,shape){
 if(!shape)return spec;
 const axis=spec.axis,normal=[0,0,0];normal[axis]=1;
 if(shape==='oblique'||shape==='shortOblique')normal[(axis+2)%3]=shape==='oblique'?1.35:.48;
 return {...spec,normal,second:shape==='comminuted'?(axis===0?[.2,1,.3]:[1,.2,.3]):undefined,spiral:shape==='spiral'};
}
// Motion is applied to the distal fragment about a common pivot for paired shafts.
// Shortening by overlap includes transverse clearance; separation excludes shortening.
export function customPose(spec,flags,width){
 if(!flags.length)return spec;
 const shift=[0,0,0],turn=[0,0,0],axis=spec.axis;
 const distalPositive=axis===2; // metatarsals and toes extend anteriorly
 const lateral=(axis+2)%3,sign=distalPositive?-1:1;
 if(flags.includes('shorten')){
  shift[axis]=sign*width*.57;
  shift[lateral]=width*1.03;
 }
 if(flags.includes('separate'))shift[axis]=-sign*width*.48;
 if(flags.includes('side'))shift[lateral]+=width*.42;
 if(flags.includes('angle'))turn[(axis+1)%3]=16;
 if(flags.includes('rotate'))turn[axis]=24;
 const moved={shift,turn},still={shift:[0,0,0],turn:[0,0,0]};
 return {...spec,minus:distalPositive?still:moved,plus:distalPositive?moved:still};
}
