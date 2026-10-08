import { Matrix4, Vector3, Quaternion } from '../../vendor/three.module.js';

export function nonTRSPlacements(json) {
  return json.nodes.filter(node => {
    if (!node.matrix) return false;
    const m = new Matrix4().fromArray(node.matrix), p = new Vector3(), q = new Quaternion(), s = new Vector3();
    m.decompose(p, q, s);
    const rebuilt = new Matrix4().compose(p, q, s);
    return node.matrix.some((v, i) => Math.abs(v - rebuilt.elements[i]) > 1e-10);
  }).map(node => ({ name: node.name, matrix: node.matrix, children: (node.children || []).map(i => json.nodes[i].name) }));
}

// Mapped buildings were fitted with rotate → nonuniform scale → rotate.
// That is an affine transform with shear in world axes. A single glTF node
// cannot express it as TRS: decomposing it moves the building off its pad.
// Factor the XZ matrix into two orthogonal-column matrices (a 2D SVD).
// Their product preserves the original mapping, and each is valid glTF TRS.
export function splitPlacementMatrix(m) {
  if (m.length !== 16 || !m.every(Number.isFinite) ||
      [1, 3, 4, 6, 7, 9, 11].some(i => Math.abs(m[i]) > 1e-10) ||
      Math.abs(m[15] - 1) > 1e-10) throw new Error('Expected an affine XZ placement matrix');
  const a = m[0], b = m[8], c = m[2], d = m[10];
  if (Math.abs(a * d - b * c) < 1e-12 || Math.abs(m[5]) < 1e-12) throw new Error('Singular placement matrix');
  const theta = Math.atan2(2 * (a * b + c * d), a * a + c * c - b * b - d * d) / 2;
  const co = Math.cos(theta), si = Math.sin(theta);
  const outer = [a * co + b * si, 0, c * co + d * si, 0,
    0, m[5], 0, 0, -a * si + b * co, 0, -c * si + d * co, 0,
    m[12], m[13], m[14], 1];
  const inner = [co, 0, -si, 0, 0, 1, 0, 0, si, 0, co, 0, 0, 0, 0, 1];
  // Guard against accidentally reintroducing lossy decomposition.
  for (const matrix of [outer, inner]) {
    const exact = new Matrix4().fromArray(matrix);
    const p = new Vector3(), q = new Quaternion(), s = new Vector3();
    exact.decompose(p, q, s);
    const rebuilt = new Matrix4().compose(p, q, s);
    if (matrix.some((v, i) => Math.abs(v - rebuilt.elements[i]) > 1e-9)) throw new Error('Placement factor is not valid TRS');
  }
  return [outer, inner];
}

export function repairPlacements(json, placements) {
  let repaired = 0;
  for (const placement of placements) {
    const matches = json.nodes.filter(n => n.name === placement.name);
    if (matches.length !== 1) throw new Error(`Expected one ${placement.name}, got ${matches.length}`);
    const node = matches[0];
    const basisName = `${placement.name}-basis`;
    let basis = json.nodes.find(n => n.name === basisName);
    if (node.mesh !== undefined || node.skin !== undefined) throw new Error(`Placement must be a group: ${node.name}`);
    const groupIndex = json.nodes.indexOf(node);
    if ((json.animations || []).some(a => a.channels.some(c => c.target.node === groupIndex))) throw new Error(`Animated placement needs a separate bake: ${node.name}`);
    if (basis && (node.children?.length !== 1 || node.children[0] !== json.nodes.indexOf(basis))) throw new Error(`Unexpected basis hierarchy: ${basisName}`);
    const children = (basis || node).children || [];
    const actual = children.map(i => json.nodes[i].name).sort();
    const expected = [...placement.children].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Placement children changed: ${node.name}`);
    const [outer, inner] = splitPlacementMatrix(placement.matrix);
    if (basis && JSON.stringify(node.matrix) === JSON.stringify(outer) && JSON.stringify(basis.matrix) === JSON.stringify(inner)) continue;
    if (!basis) {
      basis = { name: basisName, children };
      node.children = [json.nodes.length];
      json.nodes.push(basis);
    }
    for (const n of [node, basis]) for (const k of ['translation', 'rotation', 'scale']) delete n[k];
    node.matrix = outer;
    basis.matrix = inner;
    repaired++;
  }
  return repaired;
}
