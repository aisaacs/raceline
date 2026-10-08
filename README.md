# Raceline

Forty motor-racing circuits as georeferenced open data: centrelines, solved
racing lines, elevation profiles, and corner geometry with braking points and
real corner names.

**[Browse the circuits →](https://aisaacs.github.io/raceline/)**

Built for a racing game and split out because the data is useful on its own —
for simulators, visualisations, analysis, or any project that needs a real
circuit in real coordinates without building the pipeline first.

```
circuits/index.json      every circuit, with length, corner count and centre
circuits/<Id>.json       one circuit in full
scenes/<Id>.glb          the baked 3D model of that circuit
scenes/signatures.json  landmark cameras and pit-route provenance
authoring/              frozen map extracts and reproducible scene inputs
```

## What is in a circuit

```jsonc
{
  "id": "Spa",
  "name": "Circuit de Spa-Francorchamps",
  "lengthMetres": 6992,
  "elevationRangeMetres": 102,
  "trackWidthMetres": 12,

  "elevation": { "method": "srtm", "note": "..." },   // read this before trusting it

  "centreline": {
    "lon": [...], "lat": [...],           // WGS84, ~5 m apart
    "corridorLeftMetres": [...],          // the GAME's corridor, 1.8x real
    "corridorRightMetres": [...]
  },

  "racingLine": {
    "lon": [...], "lat": [...],           // ~2.5 m apart
    "curvature": [...],                   // radians per metre
    "elevationMetres": [...],             // above this circuit's low point
    "distanceMetres": [...]               // cumulative along the racing line
  },

  "corners": [{
    "name": "EAU ROUGE",
    "apexIndex": 268,                     // all indices address racingLine[]
    "entryIndex": 240, "exitIndex": 299,
    "brakingPointIndex": 196,
    "brakingWindow": [170, 222],
    "peakCurvature": 0.0338,              // 1/peakCurvature is the radius
    "severity": 0.35,
    "intensity": "heavy"
  }]
}
```

Full field reference: [SCHEMA.md](SCHEMA.md).

## Using it

No build step, no dependency. The viewer is plain HTML and one script; the
data is plain JSON.

```js
const spa = await (await fetch('circuits/Spa.json')).json()

// Every corner's radius, in metres
spa.corners.map(c => ({ name: c.name, radius: Math.round(1 / c.peakCurvature) }))

// Where the circuit climbs — but check how that profile was made first
spa.elevation.method              // 'srtm' | 'srtm-scaled' | 'authored'
const e = spa.racingLine.elevationMetres
Math.max(...e) - Math.min(...e)   // 102

// Distance along the racing line to a corner. Use the exported array; do not
// scale an index by lengthMetres, which is measured along the CENTRELINE.
spa.racingLine.distanceMetres[spa.corners[1].apexIndex]
```

To run the viewer locally:

```sh
python3 -m http.server 8000      # then open http://localhost:8000
```

## Licence — please read, it is split

| | |
| --- | --- |
| **Data** (`circuits/`, map inputs and routes in `authoring/`) | [ODbL 1.0](LICENSE-DATA.txt) — share-alike |
| **Scenes** (`scenes/`) | [CC BY-SA 4.0](licenses/CC-BY-SA-4.0.txt) for the modelled art, **plus** ODbL for the map-derived landscape baked into them. Both apply. |
| **Code** (viewer, `tools/`, `vendor/`) | [MIT](LICENSE-CODE.txt) |

Vendored Three.js and meshoptimizer retain their notices in
[`licenses/three-LICENSE.txt`](licenses/three-LICENSE.txt) and
[`licenses/meshoptimizer-LICENSE.txt`](licenses/meshoptimizer-LICENSE.txt).

The data is ODbL because the circuit outlines descend from map data that
carries share-alike obligations. If you publish a modified or extended version
of this database, it has to stay ODbL and carry the attribution below. You can
build whatever you like *on top* of it — a game, a visualisation, a paper —
and that work is yours; ODbL only binds the database itself.

**Required attribution**, which also ships inside every circuit file as
`notice`:

> Circuit geometry © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
> [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), via
> [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT).
> Elevation from NASA SRTM, public domain. Racing lines, corner detection and
> braking points derived by Raceline.

Retain the upstream MIT notice (`licenses/f1-circuits-MIT.txt`) with any
redistribution. The database licence and any separate copyright in individual
contents are distinct — see ODbL §2.4 and §4.2.

If you use the data behind a Produced Work rather than republishing it, ODbL
§4.3, §4.4(c) and §4.6 still require you to offer recipients the data or the
means to create it. Publishing a derived database is not the only trigger.

**Why ODbL, and the open question behind it.** The upstream repository labels
the geometry MIT and does not mention OpenStreetMap; our own asset records
attribute the traces to OSM. We could not establish which is right. ODbL is a
**precaution taken under uncertainty, not a settled finding** — and it is not
free, because share-alike genuinely restricts what others can do. The
unresolved rights affect non-commercial reuse and publication too, not only
commercial use. [PROVENANCE.md](PROVENANCE.md) sets out the whole chain.

## The 3D scenes

Each circuit also ships as a baked glTF model — road, kerbs, run-off,
barriers, grandstands, pit buildings, foliage and landmarks. 40
scenes, opening by default in the **3D scene** view. Landmark buttons move
the camera to each circuit’s signature features and pit lane.

```js
// They are ordinary glTF 2.0 with EXT_meshopt_compression.
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const spa = await loader.loadAsync('scenes/Spa.glb')
```

The original scene geometry was compressed from 1.39 GB to 241 MB with
meshopt. The current files also contain authored landmarks, pit surfaces and
small replacement index buffers for openings in existing scenery.
Node names survive compression; the game matches them on a **prefix** because
glTF import strips `/`, so `road/asphalt` arrives as `roadasphalt`.

**Explore.** Drag to orbit, right-drag to pan, and scroll to zoom. Select
**Fly**, then use WASD or arrow keys to move, Q/E to descend/climb, and Shift
to move faster. Drag to look around; F switches camera mode, R restores the
overview, and Escape releases keyboard focus. The viewer also has speed,
full-screen and touch movement controls.

**Signature features and pits.** The catalogue records retained and added
geometry for all 40 circuits. Additions include the Spielberg bull, Sepang
palm canopies, Shanghai main and lotus canopies, Imola and Nürburgring timing
towers, Baku’s Old City walls, Yas Marina’s lattice hotel and Monza’s historic
banking. Montreal’s Wall of Champions is retained and has its own camera.

All 40 scenes include a referenced pit route, garage inventory, working areas,
edge markings, and entry/exit camera buttons. The circuit-by-circuit reference
manifest is [`authoring/pit-facilities.json`](authoring/pit-facilities.json): it
records the relevant era, FIA/operator drawings, visual references, selected
map ways and model-specific adjustments.

New or corrected complexes include Melbourne's six roofed pavilions, Bahrain's
canopy garages, Jeddah's waterfront building, Monaco's curved garage row,
Indianapolis's F1 garages, Madrid's separated garage groups, and the historic
Jacarepaguá pits. Watkins Glen has detached paddock garages and open pit boxes.
Yas Marina's pit exit descends through an underpass with four metres of headroom.
Montreal enters before Turn 13 and exits through the Senna S.

The landmark review also corrects Spielberg's steel bull, the Singapore and
Suzuka observation wheels, and Baku's Flame Towers. Scene boundaries now extend
beneath outlying architecture in 35 models, including Marina Bay Sands across
the reservoir. Suzuka's floating G grandstand is grounded. Research sources and
modelling decisions are in [`authoring/landmark-references.json`](authoring/landmark-references.json).

The [landmark review page](tools/review-landmarks.html?ids=Spielberg,Singapore,Baku,Suzuka)
provides circuit overviews and close-ups; add `&overview` to compare complete
scenes. Final captures for all 40 circuits are in `validation/landmark-views/`.
Run `node tools/validate-landmarks.mjs` for terrain-support and landmark-bound
checks, alongside the driving and junction checks in `tools/validate-details.mjs`.
Terrain extensions are frozen in `authoring/landscape-extensions.json`; normal
builds require no GIS dependency. Regenerating those polygons uses
`tools/export-landscape-inputs.mjs` and `tools/prepare-landscape-extensions.py`
(the latter requires Shapely 2.1 or newer).

These remain **stylised game models with widened roads and approximate terrain**.
Reference review establishes the intended arrangement; it is not a survey.
Madrid retains the supplied concept track, and Jacarepaguá is a reconstruction
from historical photographs. Check the era and notes before using a layout as
real-world evidence.

`node tools/build-scene-details.mjs` regenerates additions offline from the
frozen inputs in `authoring/`, including lossless compression of the new buffers.
Repeated builds replace the previous additions and preserve the original
compressed vertex buffers. Ground, kerb, fence and barrier openings are cut to
fit the pit corridor. Paving shares the main track's exact edge height and
material; duplicated asphalt and wear overlays are removed at the joins.

The [pit review page](tools/review-pits.html?ids=Melbourne,Montreal,Monza,YasMarina)
provides overview and garage views. Add `&merges` for close entry/exit views
or `&junctions` for elevated views of the lane markings and road connections.
Reference checks, render captures and geometry reports are in `validation/`.

**Placement repair.** The mapped buildings used skewed transforms that cannot
be represented by one glTF rotation/scale node. Importing or compressing those
nodes displaced buildings from their foundations, sometimes over the road.
The scenes now preserve those transforms using two valid parent/child nodes.
46 placements in 37 scenes were repaired; their compressed mesh bytes were
left unchanged. An audit of actual transformed triangles found road overlaps
in 14 scenes before the repair and none in all 40 afterward.

Run `node tools/validate-scenes.mjs` to repeat the road-clearance and transform
checks from a clone, offline. Results are in
[`validation/scenes.json`](validation/scenes.json), with a
[before/after view of Yas Marina](validation/YasMarina-placement.jpg).
These checks do not establish surveyed accuracy, ground contact everywhere,
or clearance between buildings.

**What is real and what is authored.** The road corridor follows the same
geometry as `circuits/`. Water, coastlines and woodland outlines are mapped,
from OpenStreetMap extracts. Everything else — buildings, grandstand forms,
individual trees, barriers, landmark silhouettes — is **original stylised
art**, informed by published references but not reproducing any of them. No
photograph, sponsor logo, branded texture or official architectural model is
embedded in any scene. Landmark dimensions are stylised, not surveyed.

## What this is not

- **Not telemetry.** Racing lines are solved by optimisation, not measured.
  Braking points are game design informed by published references, not real
  braking markers.
- **Not survey data, and not one process.** Three circuits — Baku, Miami,
  Monaco — carry a hand-drawn elevation profile that never saw SRTM. Seven
  more scale SRTM by an artistic factor, as low as 0.15 at Mexico City. The
  rest are SRTM, smoothed. Every circuit states its own `elevation.method`.
- **Corridor widths are the game's, not the circuit's.** 1.8× nominal width,
  and constant along the lap on every circuit here.
- **Not official.** Not associated with, endorsed by, or connected to
  Formula 1, the FIA, or any circuit operator. Circuit names identify real
  places descriptively.

## Rebuilding

The validation and placement-repair tools run from a clone with Node.js 20+
and the vendored loader; no installation or network access is needed:

```sh
node tools/validate.mjs
node tools/validate-scenes.mjs
node tools/validate-details.mjs
node --test tools/tests/*.test.mjs
node tools/repair-scenes.mjs   # idempotent; shipped scenes are already repaired
```

**Re-exporting the data and rebuilding compression still need the game source.**
The data exporter reads the game's baked circuits and original GeoJSON,
neither of which is published here. It expects these paths as siblings of this
directory:

```
apex-edition/www/tracks/*.json          the baked circuits
apex-edition/www/pack/*.glb             the baked scenes
asset-pack/authoring/circuits/*.json    elevation authoring, read for provenance
tracks-geo/f1-circuits.geojson          the source outlines, used to verify
```

With those present:

```sh
node tools/export.mjs          # rebuild circuits/, verifying every one
node tools/compress-scenes.mjs --source ../braking-point/apex-edition/www/pack
node tools/validate.mjs
node tools/validate-scenes.mjs
```

The scene compressor also discovers the sibling `braking-point` checkout
automatically. It normalizes skewed placements **before** compression, then
rebuilds the authored details and checks the scene before replacing a published file. Compression
uses the pinned `@gltf-transform/cli@4.5.1` through `npx` and requires npm access
on its first run. `--out /path/to/scenes` stages a separate build for review.

The exporter verifies every circuit against its source outline and **fails
rather than publishing a partial library** — see
[Verification](PROVENANCE.md#verification), which has already caught two
circuits that were a kilometre out while looking perfectly plausible.

## Contributing

The most valuable contribution would be settling the provenance question. A
definite answer would either let this data be more permissive or tell us to
withdraw the geometry.

Corrections to corner names and braking references are welcome. Please cite a
published source.
