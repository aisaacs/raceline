// Standalone, offline validation of the shipped models; no game checkout needed.
// Usage: node tools/validate-scenes.mjs [--dir scenes] [--report report.json] [circuit ...]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditScene, loadScene, disposeScene } from './lib/scene-audit.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
let dir = resolve(root, 'scenes'), reportPath = null;
const ids = [];
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--dir' || arg === '--report') {
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    if (arg === '--dir') dir = resolve(value); else reportPath = resolve(value);
  } else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
  else ids.push(arg);
}
const index = JSON.parse(readFileSync(resolve(root, 'circuits/index.json')));
const all = index.circuits.map(c => c.id).sort();
for (const id of ids) if (!all.includes(id)) throw new Error(`Unknown circuit: ${id}`);
const files = readdirSync(dir).filter(f => f.endsWith('.glb'));
if (!ids.length && files.some(f => !all.includes(f.slice(0, -4)))) throw new Error('Scene directory contains circuits outside the library index');
const results = [];
for (const id of ids.length ? ids : all) {
  let gltf;
  try {
    gltf = await loadScene(resolve(dir, `${id}.glb`));
    const result = { id, ...auditScene(gltf) };
    results.push(result);
    console.log(`${id}: ${result.passed ? 'PASS' : result.errors.join('; ')}`);
  } catch (error) {
    results.push({ id, passed: false, errors: [error.message] });
    console.error(`${id}: ${error.message}`);
  } finally { if (gltf) disposeScene(gltf); }
}
const passed = results.every(r => r.passed);
const report = { schema: 'raceline.scene-validation/1', passed, sceneCount: results.length,
  checks: ['Decomposable node transforms', 'Unit rotation quaternions', 'Finite road and structure vertices',
    'Actual transformed structure triangles do not overlap the driving surface in XZ (0.01 m² accumulated tolerance per group)'],
  limitations: 'Does not establish surveyed accuracy, terrain contact, or clearance between buildings. Intended bridges and tunnels outside the architecture groups are not tested.',
  scenes: results };
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`${results.filter(r => r.passed).length}/${results.length} scenes pass.`);
if (!passed) process.exitCode = 1;
