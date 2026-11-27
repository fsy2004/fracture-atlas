// Use the same vendored Draco decoder as the viewer.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {runInThisContext} from 'node:vm';
import {Box3, Matrix4, Quaternion, Vector3} from '../vendor/three.module.js';

export function readGLB(raw) {
 if (raw.toString('ascii', 0, 4) !== 'glTF' || raw.readUInt32LE(4) !== 2 || raw.readUInt32LE(8) !== raw.length)
  throw Error('Invalid GLB');
 const length = raw.readUInt32LE(12);
 return {doc: JSON.parse(raw.toString('utf8', 20, 20 + length)), binary: raw.subarray(28 + length)};
}

export function dracoBlock(glb, node) {
 const primitive = glb.doc.meshes[node.mesh].primitives[0];
 const extension = primitive.extensions.KHR_draco_mesh_compression;
 const view = glb.doc.bufferViews[extension.bufferView], offset = view.byteOffset || 0;
 return {bytes: glb.binary.subarray(offset, offset + view.byteLength), positionId: extension.attributes.POSITION};
}

export function nodeMatrix(node) {
 return node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
  new Vector3(...(node.translation || [0, 0, 0])), new Quaternion(...(node.rotation || [0, 0, 0, 1])),
  new Vector3(...(node.scale || [1, 1, 1]))
 );
}

export async function dracoReader() {
 const wrapper = readFileSync(new URL('../vendor/draco/draco_wasm_wrapper.js', import.meta.url), 'utf8');
 const factory = runInThisContext('(function(require,__dirname){\n' + wrapper + '\nreturn DracoDecoderModule;\n})');
 const DracoDecoderModule = factory(createRequire(import.meta.url), fileURLToPath(new URL('../vendor/draco/', import.meta.url)));
 const wasmBinary = readFileSync(new URL('../vendor/draco/draco_decoder.wasm', import.meta.url));
 const module = await DracoDecoderModule({wasmBinary});
 const decoder = new module.Decoder();
 return {
  decode({bytes, positionId}, withFaces = false) {
   const mesh = new module.Mesh();
   const input = new module.DecoderBuffer();
   const coordinates = new module.DracoFloat32Array();
   const triangle = withFaces ? new module.DracoInt32Array() : null;
   try {
    input.Init(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), bytes.length);
    const status = decoder.DecodeBufferToMesh(input, mesh);
    if (!status.ok()) throw Error(status.error_msg());
    const attribute = decoder.GetAttributeByUniqueId(mesh, positionId);
    decoder.GetAttributeFloatForAllPoints(mesh, attribute, coordinates);
    const positions = Float32Array.from({length: coordinates.size()}, (_, i) => coordinates.GetValue(i));
    const faces = withFaces ? new Uint32Array(mesh.num_faces() * 3) : null;
    if (faces) for (let i = 0; i < mesh.num_faces(); i++) {
     decoder.GetFaceFromMesh(mesh, i, triangle);
     for (let corner = 0; corner < 3; corner++) faces[3 * i + corner] = triangle.GetValue(corner);
    }
    return {positions, faces};
   } finally {
    for (const value of [coordinates, triangle, input, mesh]) if (value) module.destroy(value);
   }
  },
  dispose() { module.destroy(decoder); }
 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const source = readGLB(readFileSync(process.argv[2]));
 const reader = await dracoReader(), point = new Vector3();
 const centres = {};
 try {
  for (const [index, node] of source.doc.nodes.entries()) {
   if (!/\.[oe]\d*[lr]$/.test(node.name.trim())) continue;
   const {positions} = reader.decode(dracoBlock(source, node));
   const matrix = nodeMatrix(node), bounds = new Box3();
   for (let i = 0; i < positions.length; i += 3) bounds.expandByPoint(point.fromArray(positions, i).applyMatrix4(matrix));
   centres[index] = bounds.getCenter(point).toArray().map(n => Number(n.toFixed(8)));
  }
 } finally { reader.dispose(); }
 console.log(JSON.stringify(centres));
}
