// Check the geometry that a glTF consumer actually renders, after all parent
// transforms. Bounding boxes alone miss rotated roofs and can falsely flag
// structures that wrap around a road, so intersect actual projected triangles.
import { readFileSync } from 'node:fs';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.mjs';
import { Vector3, Matrix4, Quaternion } from '../../vendor/three.module.js';

export async function loadScene(path) {
  const b = readFileSync(path);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '');
  gltf.scene.updateMatrixWorld(true);
  return gltf;
}

function signedArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return a / 2;
}
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

export function intersectionPolygon(p, clip) {
  if (signedArea(clip) < 0) clip = clip.slice().reverse();
  for (let i = 0; i < clip.length && p.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], out = [];
    for (let j = 0; j < p.length; j++) {
      const c = p[j], d = p[(j + 1) % p.length];
      const u = cross(a, b, c), v = cross(a, b, d);
      if (u >= 0) out.push(c);
      if ((u >= 0) !== (v >= 0)) {
        const t = u / (u - v);
        out.push([c[0] + t * (d[0] - c[0]), c[1] + t * (d[1] - c[1])]);
      }
    }
    p = out;
  }
  return p;
}
export function intersectionArea(p,clip) { return Math.abs(signedArea(intersectionPolygon(p,clip))); }

function cells(p, size = 40) {
  return [Math.floor(Math.min(...p.map(p => p[0])) / size),
    Math.floor(Math.min(...p.map(p => p[1])) / size),
    Math.floor(Math.max(...p.map(p => p[0])) / size),
    Math.floor(Math.max(...p.map(p => p[1])) / size)];
}

export function auditScene(gltf) {
  const road = [], architecture = [], groups = new Set(), errors = [];
  let meshes = 0;
  const v = new Vector3();
  for (const node of gltf.parser.json.nodes) {
    if (node.matrix) {
      const m = new Matrix4().fromArray(node.matrix), p = new Vector3(), q = new Quaternion(), s = new Vector3();
      m.decompose(p, q, s);
      const rebuilt = new Matrix4().compose(p, q, s);
      if (node.matrix.some((v, i) => !Number.isFinite(v) || Math.abs(v - rebuilt.elements[i]) > 1e-7)) errors.push(`Non-TRS matrix: ${node.name}`);
    }
    if (node.rotation && Math.abs(Math.hypot(...node.rotation) - 1) > 1e-5) errors.push(`Non-unit quaternion: ${node.name}`);
  }
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    let owner = o, nodeIndex;
    while (owner && nodeIndex === undefined) { nodeIndex = gltf.parser.associations.get(owner)?.nodes; owner = owner.parent; }
    const original = gltf.parser.json.nodes[nodeIndex]?.name || o.name;
    const isRoad = /^(road|bridge-deck)\/|^pitlane\/asphalt/.test(original);
    if (!isRoad && !/^(pit-|hero-|stand-|building-map-|urban-map-tile-|scenery-detail-canopy\/|signature-|champions-wall\/|interlagos-wall\/)/.test(original)) return;
    const p = o.geometry.attributes.position, idx = o.geometry.index, pts = [];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (![v.x, v.y, v.z].every(Number.isFinite)) throw new Error(`Nonfinite vertex: ${original}`);
      pts.push([v.x, v.z, v.y]);
    }
    const name = original.split('/')[0];
    if (!isRoad) groups.add(name);
    const target = isRoad ? road : architecture;
    for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
      const tri = [0, 1, 2].map(j => pts[idx ? idx.getX(i + j) : i + j]);
      if (Math.abs(signedArea(tri)) > 1e-6) target.push({ p: tri.map(p=>p.slice(0,2)), name, minY:Math.min(...tri.map(p=>p[2])), maxY:Math.max(...tri.map(p=>p[2])) });
    }
  });
  if (!road.length) errors.push('No driving surface found');
  if (!groups.size) errors.push('No architecture found');
  const grid = new Map();
  for (const tri of road) {
    const [x, z, X, Z] = cells(tri.p);
    for (let i = x; i <= X; i++) for (let j = z; j <= Z; j++) {
      const key = `${i},${j}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(tri);
    }
  }
  const hits = {};
  for (const t of architecture) {
    const [x, z, X, Z] = cells(t.p), candidates = new Set();
    for (let i = x; i <= X; i++) for (let j = z; j <= Z; j++) {
      for (const r of grid.get(`${i},${j}`) || []) candidates.add(r);
    }
    for (const r of candidates) {
      if (['champions-wall','interlagos-wall'].includes(t.name) && r.name !== 'pitlane') continue;
      const a = intersectionArea(t.p, r.p);
      if (a > 1e-5 && !(['signature-yas-link','signature-historic-banking'].includes(t.name) && t.minY-r.maxY>=7)) hits[t.name] = (hits[t.name] || 0) + a;
    }
  }
  // This sum can count overlapping faces of the same building. It is a
  // collision diagnostic, not the union area of blocked asphalt.
  const overlaps = Object.fromEntries(Object.entries(hits).filter(([, a]) => a > 0.01)
    .map(([name, a]) => [name, Math.round(a * 1000) / 1000]));
  for (const name of Object.keys(overlaps)) errors.push(`Architecture overlaps driving surface: ${name}`);
  return { meshes, architectureGroups: groups.size, roadTriangles: road.length, overlaps, errors, passed: errors.length === 0 };
}

export function disposeScene(gltf) {
  gltf.scene.traverse(o => {
    o.geometry?.dispose();
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
}
