import {shapeNames,motionNames,featuresFor,initialShape} from './features.js';
import {levels} from './courses.js';

const namedMorphology=[
 [/T 形|T形/,'T 形骨折线'],[/Y 形|Y形/,'Y 形骨折线'],[/粉碎|多块/,'多骨块断面'],
 [/裂缝|裂线/,'局部裂线'],[/嵌插/,'断端嵌插'],[/撕脱/,'附着区撕脱'],
 [/横断|横形/,'横形骨折线'],[/短斜/,'短斜形骨折线'],[/斜形|斜断/,'斜形骨折线'],[/纵裂/,'纵向裂线'],[/螺旋/,'螺旋形骨折线']
];
const articular={
 'radius/v03':'背侧关节缘劈裂，断线进入桡腕关节面',
 'radius/v04':'掌侧关节缘劈裂，断线进入桡腕关节面',
 'plateau/v01':'内侧平台劈裂，断线进入负重关节面',
 'plateau/v02':'外侧平台劈裂，断线进入负重关节面',
 'plateau/v03':'两侧平台劈裂，断线进入双髁关节面',
 'calcaneus/v02':'距下关节面受累',
 'calcaneus/v01':'关节外骨折线',
 'elbow/v03':'髁上横行线连至髁间纵裂',
 'intercondylar/v01':'T 形髁间骨折线',
 'intercondylar/v02':'Y 形髁间骨折线',
};
function lineOf(course,index){
 const v=course.variants[index];
 if(v.depression)return v.cuts.length===1&&v.cuts[0].pit?'关节面局部压陷':'关节面劈裂伴压陷';
 if(v.cuts.some(c=>c.wedge==='anterior'))return '椎体前缘楔变';
 if(v.cuts.some(c=>c.wedge==='lateral'))return '椎体偏侧楔变';
 const special=articular[course.id+'/'+(v.id||'v'+String(index+1).padStart(2,'0'))];
 if(special)return special;
 const fromName=namedMorphology.find(([pattern])=>pattern.test(v.name))?.[1];
 if(fromName)return fromName;
 if(v.fissure||v.cuts.every(c=>c.surface==='trace'))return '局部裂线';
 if(v.cuts.some(c=>c.surface==='dent'))return '骨面局部凹陷';
 if(featuresFor(course,index).shapes.length)return shapeNames[initialShape(course,index)]+'骨折线';
 if(v.cuts.some(c=>c.second))return '相交断线与骨片';
 if(v.cuts.length>1)return '多处骨折线';
 const cut=v.cuts[0];
 const direction=cut.normal||[0,1,0],axis=cut.axis??1;
 const angle=Math.acos(Math.min(1,Math.abs(direction[axis])/Math.max(Math.hypot(...direction),.001)))*180/Math.PI;
 if(angle<16)return '横向断面的教学例';
 if(angle>72)return '近纵向断面的教学例';
 return '斜向断面的教学例';
}

export function injuryDescription(course,index,level=1,{shape='',movements=[]}={}){
 const v=course.variants[index],joint=course.kind==='joint';
 const site=course.levels?course.name+' '+levels[level][0]:course.name;
 const form=joint?'':shape?shapeNames[shape]:lineOf(course,index);
 const motion=movements.length?movements.map(id=>motionNames[id]).join('、'):
  shape&&shape!=='wedgeFragment'?'沿该断面演示断端分离。':v.observe||v.cause;
 return {site,form,motion};
}
