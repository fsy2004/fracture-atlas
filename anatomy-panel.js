import * as T from './vendor/three.module.js';
import {anatomyFor} from './anatomy-data.js';

// These are surface regions. A text entry can describe smaller features even
// when the scan has no registered coordinate for the feature itself.
const limbRegions={
 'hip bone':[['髂嵴区','0.48 0.97 0.50'],['坐骨结节区','0.48 0.03 0.32']],
 femur:[['大转子区','0.86 0.89 0.53'],['髁区','0.55 0.05 0.61']],
 tibia:[['平台区','0.52 0.98 0.55'],['胫骨粗隆区','0.48 0.83 0.91'],['内踝区','0.13 0.03 0.51']],
 fibula:[['腓骨头区','0.50 0.97 0.53'],['外踝区','0.65 0.035 0.55']],
 patella:[['髌底区','0.50 0.96 0.62'],['髌尖区','0.50 0.04 0.54']],
 clavicle:[['胸骨端','0.035 0.50 0.51'],['肩峰端','0.98 0.50 0.50']],
 scapula:[['肩胛下角区','0.24 0.025 0.50'],['肩峰区','0.80 0.90 0.54']],
 humerus:[['近端头区','0.19 0.96 0.52'],['远端髁区','0.50 0.04 0.51']],
 ulna:[['鹰嘴区','0.49 0.95 0.12'],['远端头区','0.50 0.04 0.46']],
 radius:[['桡骨头区','0.49 0.97 0.51'],['茎突区','0.72 0.035 0.52']],
 talus:[['滑车区','0.49 0.9 0.42'],['距骨头区','0.46 0.52 0.99']],
 calcaneus:[['跟骨结节区','0.49 0.35 0.02'],['跟骰关节区','0.53 0.55 0.97']],
 sacrum:[['骶底区','0.50 0.97 0.59'],['骶尖区','0.50 0.04 0.56']],
 atlas:[['前弓区','0.50 0.54 0.98'],['后弓区','0.50 0.54 0.03']],
 axis:[['齿突区','0.50 0.98 0.71'],['棘突区','0.50 0.56 0.05']],
 mandible:[['颏部区','0.50 0.20 0.97'],['左下颌支区','0.95 0.70 0.23'],['右下颌支区','0.05 0.70 0.23']],
 'frontal bone':[['额部区','0.50 0.68 0.96']],
 'occipital bone':[['枕部区','0.50 0.49 0.04']],
 'temporal bone':[['颞部外面','0.97 0.56 0.49']],
 'parietal bone':[['顶骨外面','0.83 0.74 0.54']],
 'zygomatic bone':[['颊隆部区','0.75 0.48 0.83']],
 'body of sternum':[['柄侧区','0.50 0.96 0.65'],['剑突侧区','0.50 0.04 0.65']],
 manubrium:[['胸骨柄上部','0.50 0.93 0.62'],['柄体交界区','0.50 0.05 0.62']],
 'xiphoid process':[['剑突尖区','0.50 0.04 0.55']],
 maxilla:[['下缘牙槽区','0.48 0.07 0.65']],
 'nasal bone':[['鼻背骨面','0.48 0.50 0.89']],
 'palatine bone':[['下部板区','0.42 0.13 0.49']],
 'sphenoid bone':[['体上方区','0.50 0.87 0.50'],['翼侧区','0.94 0.62 0.47']],
 ethmoid:[['筛骨上部','0.50 0.91 0.50']],
 vomer:[['上缘区','0.50 0.92 0.50'],['游离后缘区','0.50 0.53 0.04']],
 'hyoid bone':[['舌骨体区','0.50 0.60 0.95'],['大角后段','0.95 0.55 0.08']],
 'sesamoid bone of foot':[['背侧区','0.50 0.94 0.50'],['跖侧区','0.50 0.06 0.50']]
};
const wristBones=new Set(['scaphoid','lunate','triquetral','pisiform','trapezium','trapezoid','capitate','hamate']);
const footBones=new Set(['navicular bone of foot','cuboid bone','medial cuneiform bone','intermediate cuneiform bone','lateral cuneiform bone']);
function nearestVertex(geometry,seed){
 const attr=geometry.attributes.position,point=new T.Vector3();
 let best=Infinity,index=0;
 for(let i=0;i<attr.count;i++){
  const error=point.fromBufferAttribute(attr,i).distanceToSquared(seed);
  if(error<best){best=error;index=i;}
 }
 return new T.Vector3().fromBufferAttribute(attr,index);
}
function regionPoint(geometry,values,side){
 const {min,max}=geometry.boundingBox;
 const [lateral,superior,anterior]=values.split(' ').map(Number);
 return new T.Vector3(
  T.MathUtils.lerp(min.x,max.x,side==='right'?1-lateral:lateral),
  T.MathUtils.lerp(min.y,max.y,superior),T.MathUtils.lerp(min.z,max.z,anterior)
 );
}
export function guidesFor(name,geometry){
 if(!geometry?.boundingBox)return [];
 const side=/\bleft\b/i.test(name)?'left':/\bright\b/i.test(name)?'right':'mid';
 const key=name.toLowerCase().replace(/\b(?:left|right)\s+/g,'').replace(/ fj\d+$/,'');
 let records=limbRegions[key];
 if(!records&&key.endsWith(' vertebra'))
  records=[['椎体区','0.50 0.50 0.94'],['椎弓后部','0.50 0.51 0.045']];
 if(!records&&key.endsWith(' rib'))
  records=[['肋骨前段','0.35 0.48 0.91'],['肋骨后段','0.35 0.56 0.10']];
 if(!records&&(key.endsWith(' metatarsal bone')||footBones.has(key)))
  records=[['近侧区','0.50 0.55 0.045'],['远侧区','0.50 0.54 0.96']];
 if(!records&&(key.endsWith(' metacarpal bone')||wristBones.has(key))&&!geometry.userData.digit)
  records=[['近侧区','0.50 0.95 0.54'],['远侧区','0.50 0.05 0.54']];
 const marks=records?.map(([text,relative])=>({
  text,point:nearestVertex(geometry,regionPoint(geometry,relative,side))
 }))||[];
 // Digit endpoints are traceable to the two joint locations in the source
 // specimen. Snap the teaching marker to the nearest bone surface.
 const d=geometry.userData.digit;
 if(d?.proximal_m&&d.distal_m){
  const tip=key.startsWith('distal ')||d.distal_kind==='tip';
  marks.push({text:'基底端区',point:nearestVertex(geometry,new T.Vector3(...d.proximal_m))});
  marks.push({text:tip?'末端区':'头端区',point:nearestVertex(geometry,new T.Vector3(...d.distal_m))});
 }
 if(!marks.length&&key.includes(' phalanx ')){
  const foot=key.endsWith('toe'),proximal=foot?'0.50 0.50 0.05':'0.50 0.95 0.52';
  const distal=foot?'0.50 0.50 0.95':'0.50 0.05 0.52';
  for(const [text,region] of [['基底端区',proximal],['远端区',distal]])
   marks.push({text,point:nearestVertex(geometry,regionPoint(geometry,region,side))});
 }
 const centre=geometry.userData.headCentre;
 if(centre?.isVector3&&key==='femur'){
  const medial=side==='left'?-1:1;
  const surfaceSeed=centre.clone().addScaledVector(new T.Vector3(medial,.55,.08).normalize(),.023);
  marks.unshift({text:'股骨头区',point:nearestVertex(geometry,surfaceSeed)});
 }
 return marks;
}
export function updateAnatomyPanel(name,guides){
 const box=document.getElementById('anatomyPanel'),brief=document.getElementById('anatomySummary');
 const list=document.getElementById('anatomyMarks'),toggle=document.getElementById('anatomyGuideRow');
 const data=name&&anatomyFor(name);
 box.hidden=!data;toggle.hidden=!guides.length;
 if(!data){brief.textContent='';list.replaceChildren();return;}
 brief.textContent=data.summary;
 list.replaceChildren(...data.marks.map(({name,detail})=>{
  const row=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');
  term.textContent=name;description.textContent=detail;row.append(term,description);return row;
 }));
}
