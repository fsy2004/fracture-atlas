import * as T from './vendor/three.module.js';
export const elbowStudy={"Right":{"rotation":[[-0.5296126121236885,0.6321346236950971,0.565611437831115],[-0.8361406380241732,-0.2768327544883124,-0.4735318991229023],[-0.1427561365547981,-0.7237191745202497,0.67516756579954]],"translation_m":[-0.963693804755459,1.2025981092535336,0.7135012374422403],"anchor_m":[-0.207,1.12,-0.036],"native_elbow_flexion_deg":106.09,"variants":[{"end":[-3.0,-8.4,-38.4],"via":[-12,-24,-6]},{"end":[-31,0,0],"via":[0,-6,0]},{"end":[0,0,31],"via":[-4.5,-9.0,4.95]}]},"Left":{"rotation":[[0.13753239891128743,-0.6480919333304441,-0.7490405097200775],[0.978484503841189,-0.028522337516113692,0.20433930607026893],[-0.15379504215795983,-0.7610278064661132,0.630225168327168]],"translation_m":[0.8259962799818367,0.9378461668450838,0.8147176775662656],"anchor_m":[0.207,1.12,-0.036],"native_elbow_flexion_deg":101.73,"variants":[{"end":[-3.0,-8.4,-38.4],"via":[-5.6,-28.0,0.0]},{"end":[-31,0,0],"via":[-9.6,-12.0,-3.0]},{"end":[0,0,31],"via":[-6.0,-12.0,6.6]}]}};

export const shoulderStudy={"Right":{"rotation":[[0.14593681685513515,-0.8422986798611384,0.5188789641047072],[-0.4515664737332054,-0.5233829068822412,-0.7226050460546574],[0.880221656906003,-0.12885366385042601,-0.45673468012181023]],"translation_m":[0.8057933992863828,1.5039995115723808,0.43029807046579477],"head_center_m":[-0.164,1.33,-0.02],"axial_in_template":[-0.12816547810002216,0.8628646840717978,-0.48891527610115565],"original_elbow_center_m":[-0.22013606492190063,1.045984975591306,-0.038708667692985727],"trunk_orientation":"source +X left, +Y posterior, +Z superior; displayed +X left, +Y superior, +Z anterior","native_humerus_vector":[-0.12816547810002216,0.8628646840717978,-0.48891527610115565],"variants":[{"end":[5,-13,34],"pose":[0,0,-34],"axial":18,"via":null},{"end":[-34,-2,-35],"via":[-14,-4,0],"pose":[-20,0,6],"axial":14}]},"Left":{"rotation":[[-0.0007016284386703361,0.7865982667635615,-0.6174647151393307],[0.9649182382813378,-0.16158266563662932,-0.2069392074929263],[-0.2625496165481359,-0.5959481595661841,-0.7588896428072429]],"translation_m":[-0.6359715197768653,1.0179017606185528,0.7459525933442087],"head_center_m":[0.164,1.33,-0.02],"axial_in_template":[0.1587793356974639,0.9038076554204579,-0.3973925572514502],"original_elbow_center_m":[0.21910542693691126,1.0451649362980737,-0.038781564513678105],"trunk_orientation":"source +X left, +Y posterior, +Z superior; displayed +X left, +Y superior, +Z anterior","native_humerus_vector":[-0.1587793356974639,0.9038076554204579,-0.3973925572514502],"variants":[{"end":[5,-13,34],"pose":[0,0,-34],"axial":18,"via":null},{"end":[-20,1,-35],"via":[-14,-2,0],"pose":[-20,0,6],"axial":14}]}};
export function elbowDisplayGeometry(source,side,shoulder=false){
 const {rotation:r,translation_m:t}=(shoulder?shoulderStudy:elbowStudy)[side],matrix=new T.Matrix4().set(...r[0],t[0],...r[1],t[1],...r[2],t[2],0,0,0,1);
 const g=source.clone();g.applyMatrix4(matrix);if(shoulder&&source.userData.headCentre)g.userData.headCentre=new T.Vector3(...shoulderStudy[side].head_center_m);g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// Legacy fitted paths are keyed independently of authoring order.
export function legacyJointPath(study,id){
 const index={v01:0,v02:1,v03:2}[id];
 return study?.variants[index];
}

// Compound trajectories checked in the native elbow teaching frame.
// Columns are radial head, distal ulna, and (when present) the olecranon fragment.
const compoundElbowFrames={
 v05:{
  Right:[[[0,-6,0],[0,-6,0]],[[-31,0,0],[-31,0,0]],[[-34,-22,42],[40,-52,-32]]],
  Left:[[[0,-6,0],[0,-6,0]],[[-16,-25,-10],[-16,-25,-10]],[[-33,-38,32],[41,-53,-35]]]
 },
 v06:{
  Right:[[[-3,3,4],[-5,-5,-2],[0,2,-3]],[[-6,-35,37],[-7,-37,38],[-2,2,-2]]],
  Left:[[[-8,3,-3],[5,-4,2],[0,0,0]],[[-36,-38,29],[-37,-39,31],[-1,0,-2]]]
 }
};
export function compoundElbowPaths(id,side){
 const frames=compoundElbowFrames[id]?.[side];
 if(!frames)return null;
 const knots=id==='v05'?[0,.22,.51,1]:[0,.25,1];
 return frames.at(-1).map((shift,i)=>({shift,knots,waypoints:frames.slice(0,-1).map(frame=>frame[i])}));
}
