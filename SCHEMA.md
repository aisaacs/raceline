# Schema

Two kinds of file: one index, and one per circuit.

All coordinates are **WGS84 decimal degrees**. All distances are **metres**.
Curvature is **radians per metre**.

## `circuits/index.json`

```jsonc
{
  "count": 40,
  "generated": "2026-10-07",
  "circuits": [{
    "id": "Spa",                      // the filename, and the stable key
    "name": "Circuit de Spa-Francorchamps",
    "lengthMetres": 6992,             // measured along the exported centreline
    "corners": 7,                     // braking decisions, NOT numbered bends
    "elevationRangeMetres": 102,
    "centre": { "lat": 50.4372, "lon": 5.9714 },
    "verifiedWithinMetres": 2.1       // see PROVENANCE.md, Verification
  }]
}
```

## `circuits/<Id>.json`

### Identity and summary

| Field | Meaning |
| --- | --- |
| `id` | Stable key; matches the filename. |
| `name` | Full circuit name. |
| `shortName` | Common name. |
| `lengthMetres` | Measured along the exported centreline. |
| `publishedLengthMetres` | The operator's published figure, for comparison. |
| `trackWidthMetres` | Nominal width. Per-point widths are in `centreline`. |
| `elevationRangeMetres` | Highest point minus lowest, along the lap. |
| `racingLineLengthMetres` | Lap length along the racing line, which differs from `lengthMetres`. |
| `corridorExaggeration` | How much wider the corridor arrays are than nominal (1.8). |
| `elevation` | `{ method, note }` — how this circuit's profile was produced. |
| `notice` | Licence, attribution and share-alike terms, so a lone file carries them. |
| `rulesRevision` | Which revision of the braking authoring this came from. |

`lengthMetres` and `publishedLengthMetres` will differ by a few metres. The
measured figure follows the traced outline; the published one is the
operator's official distance, which is measured along a defined line that is
not necessarily the geometric centre.

### `centreline`

Parallel arrays, all the same length, about **5 m** apart, closed (the last
point joins the first — there is no repeated closing point).

| Field | Meaning |
| --- | --- |
| `lon`, `lat` | Position. |
| `corridorLeftMetres` | Half-width of the game's corridor, left of the centreline. |
| `corridorRightMetres` | Same, to the right. |

Left and right are relative to the direction of travel.

**These are not real track widths.** They describe the game's drivable
corridor, widened to **1.8× nominal** so a circuit reads on a phone — the
factor is in `corridorExaggeration` — and they are **constant along the lap on
every circuit in this release**. `trackWidthMetres` carries the nominal real
figure. The arrays stay per-point so a future build can carry real variation
without a format change; today they do not.

### `racingLine`

Parallel arrays, all the same length, about **2.5 m** apart, closed.
**Every index in `corners` addresses these arrays.**

| Field | Meaning |
| --- | --- |
| `lon`, `lat` | Position. |
| `curvature` | Radians per metre. `1 / curvature` is the radius in metres. |
| `elevationMetres` | Height above this circuit's own lowest point. |
| `distanceMetres` | Cumulative distance along the racing line, from index 0. |

`elevationMetres` is **not** height above sea level, and **not** a single kind
of measurement — see `elevation.method` on the circuit, and
[PROVENANCE.md](PROVENANCE.md#elevation). Three circuits carry a hand-drawn
profile; seven more are scaled.

The racing line is solved, not measured — see
[PROVENANCE.md](PROVENANCE.md#racing-lines).

### `corners`

One entry per **braking decision**, in lap order. This is not the same as the
numbered corners on a circuit map: where several bends form one complex that a
driver brakes for once, this dataset records one corner. Monza has six here
and nineteen numbered bends.

| Field | Meaning |
| --- | --- |
| `name` | Published name where the corner has one, else `T<n>`. |
| `apexIndex` | The turning point. |
| `entryIndex`, `exitIndex` | Where the corner begins and ends. |
| `brakingPointIndex` | Where braking should begin. |
| `brakingWindow` | `[start, end]` — the span treated as an acceptable braking point. |
| `peakCurvature` | Tightest curvature in the corner. `1 / peakCurvature` is the radius. |
| `severity` | Fraction of full speed carried through the corner. 0.35 is the slowest. |
| `intensity` | `heavy`, `medium` or `light`, or `null`. |

All indices address `racingLine`. To get a distance along the lap, **use the
exported array**:

```js
const metres = circuit.racingLine.distanceMetres[index]
```

Do *not* scale an index fraction by `lengthMetres`. `lengthMetres` is measured
along the **centreline**, and the racing line is a different length — 5471 m
against 5566 m at Sepang. That approximation is wrong by up to about 2%, and
it is wrong unevenly, because the racing line is shortest exactly where
corners are tightest.

Indices can exceed the array length where a corner wraps past the start line.
Take them modulo the array length.

`brakingPointIndex` and `brakingWindow` are **game design, not telemetry** —
see [PROVENANCE.md](PROVENANCE.md#corners-and-braking-points).

## Conventions worth knowing

**Closed, not repeated.** Rings do not repeat their first point at the end.
To draw one, close the path yourself.

**Direction of travel** is the racing direction, and the arrays are ordered
along it.

**Index 0 is the exported lap origin**, not a guaranteed physical start/finish
line. For most circuits it is the real one. Two — Monaco and Silverstone —
were explicitly rotated onto their true start lines. But the upstream builder
moves a lap's origin when the first corner lacks braking room, and that shift
is not recorded per circuit here. Treat index 0 as "where this lap begins"
unless you have an independent reference for that circuit.

**Two index spaces.** `centreline` and `racingLine` have different lengths and
their indices are *not* interchangeable. They represent the same fraction of a
lap at the same index ratio, but not the same place on the ground — a racing
line cuts corners, so at a chicane the two are metres apart while being the
same fraction along. Convert by fraction, never by raw index.
