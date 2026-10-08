// Repair already-compressed public scenes without requantizing the meshes.
// Usage: node tools/repair-scenes.mjs [circuit ...]
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readGLB, writeGLB } from './lib/glb.mjs';
import { restoreBase } from './lib/scene-additions.mjs';
import { repairPlacements } from './lib/placement-transforms.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('scene-transforms.json', import.meta.url)));
const only = process.argv.slice(2);
const index = JSON.parse(readFileSync(new URL('circuits/index.json', root)));
for (const id of only) {
  // The library index is the authority even for scenes that need no repair.
  if (!index.circuits.some(c => c.id === id)) throw new Error(`Unknown circuit: ${id}`);
}
let count = 0, total = 0;
for (const [id, source] of Object.entries(manifest.circuits)) {
  if (only.length && !only.includes(id)) continue;
  const path = fileURLToPath(new URL(`scenes/${id}.glb`, root));
  const baseline = readGLB(path); restoreBase(baseline);
  const hash = createHash('sha256');
  for (const c of baseline.chunks) { const h = Buffer.alloc(8); h.writeUInt32LE(c.data.length, 0); h.writeUInt32LE(c.type, 4); hash.update(h).update(c.data); }
  const fingerprint = hash.digest('hex');
  if (fingerprint !== source.compressedChunksSha256) throw new Error(`${id}: mesh data changed; rebuild from source instead of applying an old placement manifest`);
  const glb = readGLB(path);
  const repaired = repairPlacements(glb.json, source.nodes);
  if (repaired) { writeGLB(path, glb); count++; total += repaired; }
  console.log(`${id}: ${repaired ? `${repaired} placement(s) repaired` : 'already repaired'}`);
}
console.log(`${total} placements repaired in ${count} scenes.`);
