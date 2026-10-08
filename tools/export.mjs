// Export the Apex Edition's circuits as a standalone, georeferenced dataset.
//
// The game stores circuits in its own normalised box — convenient for a
// renderer, useless to anyone else. This puts them back on the planet.
//
// SOURCE: apex-edition/www/tracks. Those carry `rulesRevision: circuits/3`,
// the authored braking decisions and corner names, which is the thing worth
// publishing. The main tree's www/tracks is an earlier revision of the same
// geometry.
//
// PIKES PEAK IS DELIBERATELY NOT HERE. It is a hillclimb, not a circuit; it
// lives at apex-edition/www/pikes-peak with its own model, its own frozen
// Overpass extracts and its own ODbL notice. Nothing in this directory should
// quietly acquire it, so the exclusion is asserted rather than assumed.
//
// THE INVERSE IS SOLVED, THEN VERIFIED. Game space is
//
//     gx = (x - xMin) / metresPerUnit + PAD
//     gy = (yMax - y) / metresPerUnit + PAD
//
// over a tangent plane about `meta.at`. `metresPerUnit` and `at` ship in the
// track file; `xMin` and `yMax` do not. Because the mapping is a pure
// translation once scaled, the two unknowns are recovered by matching the
// centreline's centroid to the source ring's — arc-length weighted, because
// the source rings run 21-70 m between vertices and a plain vertex mean is
// dragged toward the corners where the tracer clicked most.
//
// `meta.startAt` is NOT used as the anchor. It is wrong for Monaco and
// Silverstone, whose laps the asset pack rotates onto their real start/finish
// lines without moving startAt; anchoring there put them 525 m and 1111 m off.
// That is exactly the failure the verification below exists to catch.
//
// Every circuit is checked against the ORIGINAL GeoJSON ring it was built
// from: each exported centreline point must land within VERIFY_M of the source
// outline, and the lap length must match the published figure. A circuit that
// fails is not written. An unverified coordinate is worse than no coordinate —
// it is a map that points confidently at the wrong field.
//
// Usage: node tools/export.mjs [--out <dir>]

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, renameSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const SRC = join(REPO, 'apex-edition', 'www', 'tracks')
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : join(HERE, '..', 'circuits')

const EXCLUDE = new Set(['PikesPeak', 'Pikes Peak', 'pikes-peak'])

// Every circuit file is downloadable on its own, so the notices have to be
// inside it. A file that leaves the repository without them strips the
// attribution ODbL requires and silently makes its next user non-compliant.
const NOTICE = {
  licence: 'ODbL-1.0',
  licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution: 'Circuit geometry © OpenStreetMap contributors '
    + '(https://www.openstreetmap.org/copyright), ODbL 1.0, via bacinger/f1-circuits '
    + '(MIT, https://github.com/bacinger/f1-circuits). Elevation from NASA SRTM, '
    + 'public domain. Racing lines, corner detection and braking points derived '
    + 'by Raceline.',
  shareAlike: 'If you publish a modified or extended version of this database it '
    + 'must stay under ODbL 1.0 and carry this attribution. Work built on top of '
    + 'the data is yours. Retain the upstream MIT notice with any redistribution.',
  provenance: 'The upstream source chain is not fully established — see '
    + 'PROVENANCE.md before relying on this commercially.',
  notAffiliated: 'Not associated with Formula 1, the FIA or any circuit operator.',
}

const PAD = 60                // build-track-geo.js, GAME_SIZE/PAD
const VERIFY_M = 25           // how far an exported point may sit from the source ring
const LENGTH_TOLERANCE = 0.04 // against the published lap length

const R_LAT = 111320

function projector(lat0, lon0) {
  const mPerLon = R_LAT * Math.cos((lat0 * Math.PI) / 180)
  return {
    fwd: ([lon, lat]) => [(lon - lon0) * mPerLon, (lat - lat0) * R_LAT],
    inv: ([x, y]) => [lon0 + x / mPerLon, lat0 + y / R_LAT],
  }
}

function metresBetween(a, b) {
  const mPerLon = R_LAT * Math.cos((a[1] * Math.PI) / 180)
  return Math.hypot((a[0] - b[0]) * mPerLon, (a[1] - b[1]) * R_LAT)
}

function ringOf(feature) {
  const g = feature.geometry
  const c = g.type === 'LineString' ? g.coordinates : g.coordinates[0]
  return c.map(p => [p[0], p[1]])
}

// Nearest distance from a point to a polyline, measured to SEGMENTS rather
// than vertices: the source rings run up to 70 m between points, so a
// vertex-only measure reports tens of metres of error on a perfect match.
function distanceToRing(p, ring, mPerLon) {
  let best = Infinity
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - p[0]) * mPerLon, ay = (ring[i][1] - p[1]) * R_LAT
    const bx = (ring[i + 1][0] - p[0]) * mPerLon, by = (ring[i + 1][1] - p[1]) * R_LAT
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
    best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t))
  }
  return best
}

// Centroid weighted by arc length, so an unevenly traced ring and an evenly
// resampled centreline give comparable answers.
function arcCentroid(pts) {
  let sx = 0, sy = 0, total = 0
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length], next = pts[(i + 1) % pts.length]
    const w = (Math.hypot(pts[i][0] - prev[0], pts[i][1] - prev[1])
      + Math.hypot(next[0] - pts[i][0], next[1] - pts[i][1])) / 2
    sx += pts[i][0] * w; sy += pts[i][1] * w; total += w
  }
  return [sx / total, sy / total]
}

// 'Nürburgring' and 'Nuerburgring', 'Portimão' and 'Portimao', 'SaoPaulo' and
// 'Sao Paulo' are the same circuit under three different spellings.
function key(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ue/g, 'u').replace(/oe/g, 'o').replace(/ae/g, 'a')
    .replace(/[^a-z0-9]/gi, '').toLowerCase()
}

// ---------------------------------------------------------------------------

// How each circuit's elevation was actually produced. Three circuits carry a
// hand-authored profile and never saw SRTM; seven more scale the sampled
// profile by an artistic factor as low as 0.15. Calling all of it "sampled
// from SRTM" was wrong, so the real answer travels with each circuit.
const AUTHORING = join(REPO, 'asset-pack', 'authoring', 'circuits')
function elevationSource(id) {
  try {
    const art = JSON.parse(readFileSync(join(AUTHORING, `${id}.json`), 'utf8')).art || {}
    if (art.elevationProfile) {
      return { method: 'authored', note: 'Hand-authored profile. Not derived from SRTM.' }
    }
    const scale = art.elevationScale
    const smooth = art.elevationSmoothingSamples
    const parts = ['Sampled from NASA SRTM at each point\'s real position']
    if (smooth) parts.push(`smoothed over ${smooth} samples`)
    if (scale && scale !== 1) parts.push(`scaled to ${scale} of measured relief for legibility`)
    return { method: scale && scale !== 1 ? 'srtm-scaled' : 'srtm', note: parts.join(', ') + '.' }
  } catch {
    return { method: 'srtm', note: 'Sampled from NASA SRTM at each point\'s real position.' }
  }
}

const geo = JSON.parse(readFileSync(join(REPO, 'tracks-geo', 'f1-circuits.geojson'), 'utf8'))
const ringByKey = new Map()
for (const f of geo.features) {
  for (const n of [f.properties.Location, f.properties.Name]) {
    if (n) ringByKey.set(key(n), ringOf(f))
  }
}

function findRing(meta) {
  for (const n of [meta.name, meta.fullName]) {
    const hit = ringByKey.get(key(n))
    if (hit) return hit
  }
  return null
}

// Staged, then swapped. Writing straight into OUT meant a circuit that failed
// verification kept its PREVIOUS file on disk while vanishing from the index —
// a directory that is neither the old export nor the new one, and no error to
// say so.
const STAGE = OUT + '.staging'
rmSync(STAGE, { recursive: true, force: true })
mkdirSync(STAGE, { recursive: true })

const files = readdirSync(SRC).filter(f => f.endsWith('.json')).sort()
const index = []
const skipped = []

for (const file of files) {
  const id = file.replace(/\.json$/, '')
  if (EXCLUDE.has(id)) { skipped.push(`${id}: excluded by request`); continue }

  const t = JSON.parse(readFileSync(join(SRC, file), 'utf8'))
  const m = t.meta
  const mpu = m.metresPerUnit
  const [lat0, lon0] = m.at
  const proj = projector(lat0, lon0)

  const ring = findRing(m)
  if (!ring) { skipped.push(`${id}: no source ring to verify against`); continue }

  // Scale into metres; the remaining unknown is a pure translation.
  const rel = (gx, gy) => [(gx - PAD) * mpu, -(gy - PAD) * mpu]
  const relCentre = t.centerline.x.map((gx, i) => rel(gx, t.centerline.y[i]))
  const [ux, uy] = arcCentroid(relCentre)
  const [sx, sy] = arcCentroid(ring.map(p => proj.fwd(p)))
  const offX = sx - ux, offY = sy - uy

  const toWorld = (gx, gy) => {
    const [u, v] = rel(gx, gy)
    return proj.inv([u + offX, v + offY])
  }
  const centre = t.centerline.x.map((gx, i) => toWorld(gx, t.centerline.y[i]))
  const race = t.raceline.x.map((gx, i) => toWorld(gx, t.raceline.y[i]))

  // --- verify, or do not ship it ------------------------------------------
  const mPerLon = R_LAT * Math.cos((lat0 * Math.PI) / 180)
  const closed = [...ring, ring[0]]
  // Every point, on the coordinates actually published. Sampling every third
  // point was a claim this file made and did not keep, and checking the
  // full-precision values would not test what ships.
  const pub = centre.map(p => [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7])
  let worst = 0
  for (let i = 0; i < pub.length; i++) {
    worst = Math.max(worst, distanceToRing(pub[i], closed, mPerLon))
  }

  let lapM = 0
  for (let i = 1; i < centre.length; i++) lapM += metresBetween(centre[i - 1], centre[i])
  lapM += metresBetween(centre[centre.length - 1], centre[0])
  const lengthErr = Math.abs(lapM - m.publishedKm * 1000) / (m.publishedKm * 1000)

  if (worst > VERIFY_M || lengthErr > LENGTH_TOLERANCE) {
    skipped.push(`${id}: ${worst.toFixed(1)} m from the source ring, `
      + `length off by ${(lengthErr * 100).toFixed(1)}%`)
    continue
  }

  const r = (v, n) => Math.round(v * 10 ** n) / 10 ** n

  // Distance along the RACING LINE, cumulative. Without this the obvious way
  // to turn a corner index into a distance is to scale by the lap length —
  // but the lap length is measured along the centreline, and the two differ
  // by 95 m at Sepang. Shipping the real thing removes the trap.
  const raceDist = [0]
  for (let i = 1; i < race.length; i++) {
    raceDist.push(raceDist[i - 1] + metresBetween(race[i - 1], race[i]))
  }
  const raceLapM = raceDist[raceDist.length - 1] + metresBetween(race[race.length - 1], race[0])

  // Re-zero the profile on its own lowest point. The asset pack adjusts
  // elevation for the authored road, which leaves a few circuits a little
  // below the zero they were sampled against — IMS at -0.33 m and Jeddah at
  // -0.54 m. Sub-metre, but "metres above the circuit's lowest point" should
  // be exactly true rather than nearly true, or every consumer has to guess
  // how near.
  const elevRaw = t.elevation.map(v => v * mpu)
  const elevLow = Math.min(...elevRaw)
  const elev = elevRaw.map(v => r(v - elevLow, 2))
  const elevSpan = Math.round(Math.max(...elev))
  const out = {
    id,
    notice: NOTICE,
    name: m.fullName || m.name,
    shortName: m.name,
    lengthMetres: Math.round(lapM),
    publishedLengthMetres: Math.round(m.publishedKm * 1000),
    trackWidthMetres: m.trackWidthM,
    corridorExaggeration: 1.8,
    racingLineLengthMetres: Math.round(raceLapM),
    elevationRangeMetres: elevSpan,
    elevation: elevationSource(id),
    rulesRevision: m.rulesRevision || null,
    units: {
      coordinates: 'WGS84 decimal degrees',
      elevation: 'metres above this circuit low point',
      curvature: 'radians per metre',
      distance: 'metres',
    },
    centreline: {
      lon: centre.map(p => r(p[0], 7)),
      lat: centre.map(p => r(p[1], 7)),
      // NOT the real track width. These are the game's drivable corridor,
      // deliberately widened (1.8x nominal) so a circuit reads on a phone,
      // and constant along the lap on every circuit in this release. Named
      // for what they are: the arrays stay per-point so a future build can
      // carry real variation without a format change.
      corridorLeftMetres: t.centerline.widthLeft.map(v => r(v * mpu, 2)),
      corridorRightMetres: t.centerline.widthRight.map(v => r(v * mpu, 2)),
    },
    racingLine: {
      lon: race.map(p => r(p[0], 7)),
      lat: race.map(p => r(p[1], 7)),
      curvature: t.raceline.kappa.map(v => r(v, 6)),
      elevationMetres: elev,
      distanceMetres: raceDist.map(v => r(v, 1)),
    },
    // Indices address racingLine[]. Braking decisions are original authoring,
    // not telemetry — see PROVENANCE.md.
    corners: t.corners.map(c => ({
      name: c.name,
      apexIndex: c.apex,
      entryIndex: c.cornerStart,
      exitIndex: c.cornerEnd,
      brakingPointIndex: c.optimalBrake,
      brakingWindow: [c.brakeStart, c.brakeEnd],
      peakCurvature: c.peakKappa,
      severity: c.severity,
      intensity: c.intensity || null,
    })),
  }

  writeFileSync(join(STAGE, `${id}.json`), JSON.stringify(out))
  index.push({
    id,
    name: out.name,
    lengthMetres: out.lengthMetres,
    corners: out.corners.length,
    elevationRangeMetres: out.elevationRangeMetres,
    centre: { lat: r(lat0, 5), lon: r(lon0, 5) },
    verifiedWithinMetres: r(worst, 1),
  })
  console.log(`${id.padEnd(16)} ${String(out.lengthMetres).padStart(5)} m  `
    + `${String(out.corners.length).padStart(2)} corners  within ${worst.toFixed(1)} m of source`)
}

if ([...EXCLUDE].some(x => files.includes(`${x}.json`))) {
  throw new Error('an excluded circuit reached the export loop')
}

index.sort((a, b) => a.name.localeCompare(b.name))
writeFileSync(join(STAGE, 'index.json'), JSON.stringify({
  count: index.length,
  generated: new Date().toISOString().slice(0, 10),
  circuits: index,
}, null, 1))

// A circuit that fails verification is a failure of the export, not a quiet
// omission: a 39-circuit library that claims to be 40 is the thing this whole
// file exists to prevent.
const rejected = skipped.filter(s => !s.includes('excluded by request'))
if (rejected.length) {
  console.error(`\n${rejected.length} circuit(s) failed verification — nothing written:`)
  for (const s of rejected) console.error('  ' + s)
  rmSync(STAGE, { recursive: true, force: true })
  process.exit(1)
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })
renameSync(STAGE, OUT)

console.log(`\n${index.length} circuits written to ${OUT}`)
for (const s of skipped) console.log('  ' + s)
