// Check the published data against what SCHEMA.md promises.
//
// A dataset's documentation drifts from its data silently — nothing breaks,
// consumers just quietly get it wrong. Every claim in SCHEMA.md that can be
// checked mechanically is checked here.
//
// Usage: node tools/validate.mjs

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Takes a directory so it can be pointed at a staging copy, or at deliberately
// corrupted data to check that it still fails. A validator nobody has seen
// fail is not evidence of anything.
const DIR = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'circuits')
const fail = []
const note = (id, msg) => fail.push(`${id}: ${msg}`)

const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'))
const files = readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'index.json')

if (index.count !== files.length) {
  note('index.json', `count is ${index.count}, ${files.length} circuit files present`)
}
if (index.circuits.some(c => /pike/i.test(c.id))) note('index.json', 'Pikes Peak is present')

const SPACING_TOLERANCE = 0.45   // claimed ~5 m and ~2.5 m; allow real variation

function spacing(lon, lat) {
  let total = 0
  const mPerLon = 111320 * Math.cos((lat[0] * Math.PI) / 180)
  for (let i = 1; i < lon.length; i++) {
    total += Math.hypot((lon[i] - lon[i - 1]) * mPerLon, (lat[i] - lat[i - 1]) * 111320)
  }
  return total / (lon.length - 1)
}

for (const file of files.sort()) {
  const id = file.replace(/\.json$/, '')
  const c = JSON.parse(readFileSync(join(DIR, file), 'utf8'))

  if (c.id !== id) note(id, `id field is "${c.id}"`)

  // Required fields, before anything tries to use them.
  for (const f of ['id', 'name', 'lengthMetres', 'publishedLengthMetres', 'elevationRangeMetres',
                   'centreline', 'racingLine', 'corners', 'notice', 'elevation']) {
    if (c[f] === undefined || c[f] === null) note(id, `missing ${f}`)
  }
  if (!c.notice || c.notice.licence !== 'ODbL-1.0' || !c.notice.attribution) {
    note(id, 'licence notice missing or wrong — a downloaded file must carry it')
  }
  if (!c.elevation || !['srtm', 'srtm-scaled', 'authored'].includes(c.elevation.method)) {
    note(id, `elevation.method is ${c.elevation && c.elevation.method}`)
  }

  // Parallel arrays really are parallel.
  const cl = c.centreline, rl = c.racingLine
  const clLen = cl.lon.length
  for (const [k, v] of Object.entries(cl)) {
    if (v.length !== clLen) note(id, `centreline.${k} has ${v.length}, expected ${clLen}`)
  }
  const rlLen = rl.lon.length
  for (const [k, v] of Object.entries(rl)) {
    if (v.length !== rlLen) note(id, `racingLine.${k} has ${v.length}, expected ${rlLen}`)
  }

  // Closed, not repeated: the last point must not duplicate the first.
  const dup = (a, b, i, j) => a[i] === a[j] && b[i] === b[j]
  if (dup(cl.lon, cl.lat, 0, clLen - 1)) note(id, 'centreline repeats its first point')
  if (dup(rl.lon, rl.lat, 0, rlLen - 1)) note(id, 'racingLine repeats its first point')

  // Corridor widths: finite, positive, and plausible for a racing circuit.
  for (const side of ['corridorLeftMetres', 'corridorRightMetres']) {
    const v = cl[side]
    if (!v) { note(id, `missing centreline.${side}`); continue }
    if (!v.every(x => Number.isFinite(x) && x > 0 && x < 60)) note(id, `${side} out of range`)
  }
  // Curvature: finite, and a radius no tighter than a hairpin.
  if (!rl.curvature.every(x => Number.isFinite(x) && Math.abs(x) < 0.5)) {
    note(id, 'curvature has non-finite or impossible values')
  }
  // Cumulative distance: present, monotonic, and ending near the lap length.
  const d = rl.distanceMetres
  if (!d) note(id, 'missing racingLine.distanceMetres')
  else {
    if (d[0] !== 0) note(id, `distanceMetres starts at ${d[0]}`)
    for (let i = 1; i < d.length; i++) {
      if (!(d[i] > d[i - 1])) { note(id, `distanceMetres not increasing at ${i}`); break }
    }
    if (Math.abs(d[d.length - 1] - c.racingLineLengthMetres) > 5) {
      note(id, `distanceMetres ends at ${d[d.length - 1]}, racingLineLengthMetres ${c.racingLineLengthMetres}`)
    }
  }

  // Claimed spacing.
  const cs = spacing(cl.lon, cl.lat), rs = spacing(rl.lon, rl.lat)
  if (Math.abs(cs - 5) / 5 > SPACING_TOLERANCE) note(id, `centreline spacing ${cs.toFixed(2)} m, claimed ~5`)
  if (Math.abs(rs - 2.5) / 2.5 > SPACING_TOLERANCE) note(id, `racingLine spacing ${rs.toFixed(2)} m, claimed ~2.5`)

  // Coordinates on the planet, and all finite.
  for (const [name, o] of [['centreline', cl], ['racingLine', rl]]) {
    if (!o.lon.every(v => Number.isFinite(v) && v >= -180 && v <= 180)) note(id, `${name}.lon out of range`)
    if (!o.lat.every(v => Number.isFinite(v) && v >= -90 && v <= 90)) note(id, `${name}.lat out of range`)
  }
  if (!rl.elevationMetres.every(Number.isFinite)) note(id, 'elevation has non-finite values')
  if (Math.min(...rl.elevationMetres) < -0.01) note(id, 'elevation goes below its own zero')

  // Re-measure the lap from the published coordinates rather than trusting
  // the field: a wrong length is exactly what a stale or corrupt export looks
  // like, and the field cannot catch itself.
  let measured = 0
  const mPerLon = 111320 * Math.cos((cl.lat[0] * Math.PI) / 180)
  for (let i = 1; i < clLen; i++) {
    measured += Math.hypot((cl.lon[i] - cl.lon[i - 1]) * mPerLon, (cl.lat[i] - cl.lat[i - 1]) * 111320)
  }
  measured += Math.hypot((cl.lon[0] - cl.lon[clLen - 1]) * mPerLon, (cl.lat[0] - cl.lat[clLen - 1]) * 111320)
  if (Math.abs(measured - c.lengthMetres) > 5) {
    note(id, `lengthMetres ${c.lengthMetres}, coordinates measure ${measured.toFixed(0)}`)
  }

  // The profile is zeroed on its own lowest point, exactly.
  if (Math.min(...rl.elevationMetres) !== 0) {
    note(id, `elevation minimum is ${Math.min(...rl.elevationMetres)}, expected exactly 0`)
  }

  // elevationRangeMetres agrees with the profile it summarises.
  const span = Math.max(...rl.elevationMetres) - Math.min(...rl.elevationMetres)
  if (Math.abs(span - c.elevationRangeMetres) > Math.max(2, span * 0.1)) {
    note(id, `elevationRangeMetres ${c.elevationRangeMetres}, profile spans ${span.toFixed(1)}`)
  }

  // Corner indices address racingLine, in lap order, and resolve after wrap.
  let prev = -1
  c.corners.forEach((k, n) => {
    for (const [f, v] of Object.entries({
      apexIndex: k.apexIndex, entryIndex: k.entryIndex, exitIndex: k.exitIndex,
      brakingPointIndex: k.brakingPointIndex,
    })) {
      if (!Number.isInteger(v)) note(id, `corner ${n} ${f} is not an integer`)
      if (((v % rlLen) + rlLen) % rlLen >= rlLen) note(id, `corner ${n} ${f} does not resolve`)
    }
    if (k.apexIndex <= prev) note(id, `corner ${n} (${k.name}) is out of lap order`)
    prev = k.apexIndex
    if (!Array.isArray(k.brakingWindow) || k.brakingWindow.length !== 2
        || !k.brakingWindow.every(Number.isInteger)) {
      note(id, `corner ${n} braking window is malformed`)
    } else if (k.brakingWindow[0] > k.brakingWindow[1]) {
      note(id, `corner ${n} braking window is inverted`)
    }
    if (k.intensity !== null && !['heavy', 'medium', 'light'].includes(k.intensity)) {
      note(id, `corner ${n} intensity is "${k.intensity}"`)
    }
    if (!k.name) note(id, `corner ${n} has no name`)
    // The window must contain the point it is a window for, or it cannot be hit.
    if (k.brakingPointIndex < k.brakingWindow[0] || k.brakingPointIndex > k.brakingWindow[1]) {
      note(id, `corner ${n} braking point sits outside its own window`)
    }
    if (!(k.severity > 0 && k.severity <= 1)) note(id, `corner ${n} severity ${k.severity}`)
  })

  // Measured length should be near the published one.
  const err = Math.abs(c.lengthMetres - c.publishedLengthMetres) / c.publishedLengthMetres
  if (err > 0.04) note(id, `length ${c.lengthMetres} vs published ${c.publishedLengthMetres}`)

  // The index agrees with the file.
  const row = index.circuits.find(r => r.id === id)
  if (!row) note(id, 'missing from index.json')
  else if (row.corners !== c.corners.length) note(id, `index says ${row.corners} corners, file has ${c.corners.length}`)
}

if (fail.length) {
  console.error(`${fail.length} problem(s):`)
  for (const f of fail) console.error('  ' + f)
  process.exit(1)
}
// Deliberately narrow. This establishes that the files are internally
// consistent and match the documented structure, ranges and invariants. It
// says nothing about whether the geometry is in the right place on Earth —
// that is the exporter's source-ring check — and nothing about provenance.
console.log(`ok — ${files.length} circuits, `
  + `${index.circuits.reduce((a, c) => a + c.corners, 0)} corners: structure, ranges, `
  + `licence notices, distances, elevation baselines and corner indices all consistent`)
