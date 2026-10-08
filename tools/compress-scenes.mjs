// Compress baked scenes for publication, preserving affine building placement.
// Usage: node tools/compress-scenes.mjs [--source /path/to/pack] [--out scenes] [circuit ...]
// Node 20+, npx and @gltf-transform/cli are needed only to rebuild compression.
import { readdirSync, mkdirSync, statSync, existsSync, mkdtempSync, rmSync, renameSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { readGLB, writeGLB } from './lib/glb.mjs';
import { nonTRSPlacements, repairPlacements } from './lib/placement-transforms.mjs';
import { buildDetails } from './build-scene-details.mjs';
import { loadScene, auditScene, disposeScene } from './lib/scene-audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const candidates = [join(ROOT, '..', 'braking-point', 'apex-edition', 'www', 'pack'),
  join(ROOT, '..', 'apex-edition', 'www', 'pack')];
let src = candidates.find(existsSync);
let out = join(ROOT, 'scenes');
const only = [];
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--source' || arg === '--out') {
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing ${arg} directory`);
    if (arg === '--source') src = resolve(value); else out = resolve(value);
  } else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
  else only.push(arg);
}
if (!src || !existsSync(src)) throw new Error('Baked scenes not found; supply --source /path/to/apex-edition/www/pack');
const ids = JSON.parse(readFileSync(join(ROOT, 'circuits', 'index.json'))).circuits.map(c => c.id);
for (const id of only) if (!ids.includes(id)) throw new Error(`Unknown circuit: ${id}`);
const requested = only.length ? only : ids;
// A full build must never quietly publish an incomplete library.
const available = new Set(readdirSync(src));
for (const id of requested) if (!available.has(`${id}.glb`)) throw new Error(`Missing source scene: ${id}`);
mkdirSync(out, { recursive: true });
const mb = n => (n / 1e6).toFixed(1);
let before = 0, after = 0, failed = 0;
for (const id of [...requested].sort()) {
  const file = `${id}.glb`, input = join(src, file), destination = join(out, file);
  const temp = mkdtempSync(join(tmpdir(), 'raceline-compress-'));
  const staged = join(out, `.${id}.staged.glb`);
  process.stdout.write(`${id.padEnd(16)} ${mb(statSync(input).size).padStart(6)} MB → `);
  try {
    const glb = readGLB(input);
    // Normalize BEFORE any glTF importer decomposes matrices. Never flatten
    // animation descendants or roundtrip the entire mesh through a renderer.
    const fixed = repairPlacements(glb.json, nonTRSPlacements(glb.json));
    const normalized = join(temp, file);
    writeGLB(normalized, glb);
    execFileSync('npx', ['--yes', '@gltf-transform/cli@4.5.1', 'meshopt', normalized, staged],
      { stdio: ['ignore', 'ignore', 'pipe'], timeout: 20 * 60 * 1000 });
    await buildDetails(id, staged);
    const loaded = await loadScene(staged);
    let audit;
    try { audit = auditScene(loaded); } finally { disposeScene(loaded); }
    if (!audit.passed) throw new Error(audit.errors.join('; '));
    // Only replace a released file after validating its rendered geometry.
    renameSync(staged, destination);
    before += statSync(input).size; after += statSync(destination).size;
    console.log(`${mb(statSync(destination).size).padStart(6)} MB; ${fixed} placement(s) normalized; PASS`);
  } catch (e) {
    console.log(`FAILED: ${String(e.stderr || e.message).trim().split('\n').pop()}`);
    failed++;
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(staged, { force: true });
  }
}
console.log(`${requested.length - failed} scenes: ${mb(before)} MB → ${mb(after)} MB`);
if (failed) process.exitCode = 1;
