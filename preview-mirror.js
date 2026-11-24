import { fetchVerifiedModel } from './asset-mirror.js?v=mobile-ui1';

const OVERVIEW_BYTES = 2938092;
const OVERVIEW_SHA256 = 'db557f347b6ae3a1c22d6aa303b700bcef34ca810c167e0344eb9e57f352f7d8';

export async function loadOverviewBytes(read) {
 if (typeof location !== 'undefined' && location.protocol === 'file:') {
  return read('models/bones.bin');
 }
 try {
  return await fetchVerifiedModel('models/bones.bin', {
   originURL: 'models/bones.bin',
   bytes: OVERVIEW_BYTES,
   sha256: OVERVIEW_SHA256,
   initialParallel: 2,
   hedgeMs: 420
  });
 } catch {
  return read('models/bones.bin');
 }
}
