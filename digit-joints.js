// Displacement of the moving phalangeal base in its native, right-template coordinates (mm and degrees).
// The healthy contact regions are derived from each same-subject adjacent bone pair.
const paths={
 "mcp-dislocation/0/1/R": {
  "end": [
   -3.599219,
   -3.761471,
   -14.067585
  ],
  "turn": [
   17.428895,
   -1.413484,
   -4.077634
  ],
  "waypoints": []
 },
 "pip-dislocation/0/1/R": {
  "end": [
   -1.631285,
   -7.43998,
   -2.446551
  ],
  "turn": [
   11.500024,
   -1.860722,
   -2.704434
  ],
  "waypoints": []
 },
 "pip-dislocation/1/1/R": {
  "end": [
   -10.579056,
   1.450865,
   2.641695
  ],
  "turn": [
   0,
   0,
   0
  ],
  "waypoints": []
 },
 "mtp-dislocation/0/1/R": {
  "end": [
   -6.146373,
   12.911709,
   6.042339
  ],
  "turn": [
   -11.106373,
   -3.738753,
   -2.984646
  ],
  "waypoints": []
 },
 "toe-ip-dislocation/0/1/R": {
  "end": [
   -5.425272,
   10.376661,
   4.887876
  ],
  "turn": [
   -9.368756,
   -1.978293,
   -7.405728
  ],
  "waypoints": []
 },
 "mcp-dislocation/0/1/L": {
  "end": [
   -5.033648,
   -10.723501,
   -7.46116
  ],
  "turn": [
   16.400966,
   -4.436998,
   -5.370837
  ],
  "waypoints": []
 },
 "pip-dislocation/0/1/L": {
  "end": [
   -2.257692,
   -6.590543,
   -0.683795
  ],
  "turn": [
   10.768406,
   -3.667776,
   -3.500784
  ],
  "waypoints": []
 },
 "pip-dislocation/1/1/L": {
  "end": [
   -9.061188,
   2.772559,
   3.194964
  ],
  "turn": [
   0,
   0,
   0
  ],
  "waypoints": []
 },
 "mtp-dislocation/0/1/L": {
  "end": [
   -1.960418,
   12.847752,
   -0.303364
  ],
  "turn": [
   -11.56842,
   -1.531167,
   -2.963387
  ],
  "waypoints": []
 },
 "toe-ip-dislocation/0/1/L": {
  "end": [
   -0.007465,
   11.148842,
   0.838615
  ],
  "turn": [
   -9.944415,
   -1.081034,
   -6.732104
  ],
  "waypoints": []
 }
};
export function digitJointPath(id,v,mirror){return paths[[id,v,1,mirror?'L':'R'].join('/')];}
