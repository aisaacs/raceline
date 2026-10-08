import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Vector3, Quaternion } from '../../vendor/three.module.js';
import { splitPlacementMatrix, repairPlacements, nonTRSPlacements } from '../lib/placement-transforms.mjs';
import { intersectionArea } from '../lib/scene-audit.mjs';
const manifest = JSON.parse(readFileSync(new URL('../scene-transforms.json', import.meta.url)));
const placements = Object.values(manifest.circuits).flatMap(c => c.nodes);
function imported(matrix) {
  const p = new Vector3(), q = new Quaternion(), s = new Vector3();
  new Matrix4().fromArray(matrix).decompose(p, q, s);
  return new Matrix4().compose(p, q, s);
}
test('every original placement survives glTF TRS decomposition as two nodes', () => {
  for (const { matrix, name } of placements) {
    const [outer, inner] = splitPlacementMatrix(matrix);
    const loaded = imported(outer).multiply(imported(inner));
    // Distant vertices expose the world-space drift seen in the pit buildings.
    for (const point of [[0, 0, 0], [900, 25, -650], [-310, 100, 220]]) {
      const expected = new Vector3(...point).applyMatrix4(new Matrix4().fromArray(matrix));
      const actual = new Vector3(...point).applyMatrix4(loaded);
      assert.ok(actual.distanceTo(expected) < 1e-8, name);
    }
  }
});
test('single-node decomposition reproduces the Yas Marina placement regression', () => {
  const { matrix } = manifest.circuits.YasMarina.nodes[0];
  const point = new Vector3(-184.879, 18.611, 79.768);
  const intended = point.clone().applyMatrix4(new Matrix4().fromArray(matrix));
  assert.ok(point.applyMatrix4(imported(matrix)).distanceTo(intended) > 30);
});
test('repair is idempotent and preserves animation descendants and mesh references', () => {
  const matrix = manifest.circuits.YasMarina.nodes[0].matrix;
  const json = { nodes: [{ name: 'mapped', matrix, children: [1] }, { name: 'wheel', mesh: 7 }],
    scenes: [{ nodes: [0] }], animations: [{ channels: [{ target: { node: 1, path: 'rotation' } }] }] };
  const nodes = nonTRSPlacements(json);
  assert.equal(nodes.length, 1);
  assert.equal(repairPlacements(json, nodes), 1);
  const saved = JSON.stringify(json);
  assert.equal(repairPlacements(json, nodes), 0);
  assert.equal(JSON.stringify(json), saved);
  assert.equal(json.nodes[1].mesh, 7);
  assert.equal(json.animations[0].channels[0].target.node, 1);
  assert.deepEqual(nonTRSPlacements(json), []);
});
test('stale manifests and animated placement groups fail instead of corrupting the scene', () => {
  const p = { name: 'mapped', matrix: placements[0].matrix, children: ['building'] };
  assert.throws(() => repairPlacements({ nodes: [{ name: 'mapped', children: [] }] }, [p]), /children changed/);
  assert.throws(() => repairPlacements({ nodes: [{ name: 'mapped' }],
    animations: [{ channels: [{ target: { node: 0 } }] }] }, [p]), /Animated placement/);
  assert.throws(() => splitPlacementMatrix(Array(16).fill(0)), /affine/);
});
test('triangle audit catches crossings with no contained vertices, and ignores touching edges', () => {
  const roof = [[-2, -0.2], [2, -0.2], [0, 0.2]];
  const road = [[-0.2, -2], [0.2, -2], [0, 2]];
  assert.ok(intersectionArea(roof, road) > 0.01);
  assert.equal(intersectionArea([[0, 0], [1, 0], [0, 1]], [[0, 0], [0, -1], [1, 0]]), 0);
  assert.equal(intersectionArea(roof, road), intersectionArea(roof, road.slice().reverse()));
});
