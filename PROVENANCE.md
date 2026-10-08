# Provenance

Where every number in this dataset came from, including the parts we cannot
fully establish. Read this before relying on the data for anything that
matters, and before assuming the licence choice is more settled than it is.

## Summary

| Layer | Origin | Licence here |
| --- | --- | --- |
| Circuit outlines | [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits), traced from map data | **ODbL 1.0** |
| Elevation | SRTM for 37 circuits, hand-authored for 3 | Public domain / original, under ODbL with the rest |
| Racing lines | Solved here by minimum-curvature optimisation | Original derived work, released under ODbL with the database |
| Corner geometry | Detected here from curvature | Original derived work |
| Corner names, braking points | Authored here | Original creative work |
| Scene landscape | OpenStreetMap extracts via Overpass | **ODbL 1.0** |
| Scene art | Modelled here | **CC BY-SA 4.0** |
| Viewer and tools | Written here | **MIT** |

## The circuit outlines, and the honest uncertainty about them

The geometry descends from
[bacinger/f1-circuits](https://github.com/bacinger/f1-circuits), forty
circuits as closed GeoJSON rings, which its author distributes under the MIT
licence.

**We have attributed that geometry to OpenStreetMap, and that attribution is
an inference rather than an upstream statement.** It is worth being exact
about what is and is not known:

- The upstream repository's README does **not** mention OpenStreetMap. It
  names its "initial circuits data source" as a Google My Maps document, and
  cites Wikipedia for the circuit list and a Formula 1 article for altitudes.
- Our own asset-pack record
  (`apex-edition/docs/SOURCES.md`) states that "layout traces originate from
  © OpenStreetMap contributors" and instructs that the credit be preserved
  when distributing derived circuit data.
- We have not independently verified which is correct, and we are not the
  upstream author.

**This is why the data here is ODbL rather than MIT, which is the more
permissive option we would otherwise have taken.** The reasoning:

1. If the geometry is OSM-derived, then ODbL applies and we have no choice.
   OpenStreetMap data cannot be relicensed; the OSM Foundation is
   contractually unable to permit it, and share-alike binds every derivative
   database.
2. A dataset of circuit coordinates published for other people to use is a
   **Derivative Database** under ODbL, not a Produced Work. The test is
   whether the published result is intended for extraction of the underlying
   data, and a data library plainly is.
3. An upstream MIT label cannot grant rights the upstream author did not
   hold. If the traces are OSM-derived, the MIT notice does not cure that,
   and relying on it would place the obligation on everyone downstream of us.
4. ODbL therefore satisfies the OSM case if it applies.

**ODbL is a precaution, not a finding, and it is not free.** Share-alike is a
real restriction: anyone extending this database must publish their version
under ODbL too. If the geometry turns out to be independently drawn, that
restriction will have been imposed for nothing. We judged an unnecessary
restriction better than an unmet obligation, but it is a judgement and you are
entitled to disagree with it.

**What ODbL does not fix.** A Google My Maps document is a user-created map;
it does not by itself show that anyone traced Google's imagery, and we are not
asserting that they did. But we cannot show the opposite either. If the
underlying trace were made from imagery whose terms forbid it, no choice of
open licence would cure that.

**That uncertainty is not only a commercial problem.** Unresolved rights in the
source affect publication and non-commercial reuse as well. Anyone relying on
this should read the chain above and reach their own view.

If you can settle this question, please open an issue — a definite answer
would let this dataset be more permissive, or would tell us to withdraw the
geometry.

## Elevation

**Not a single process, and an earlier version of this document wrongly said
it was.** Every circuit now carries its own `elevation.method` and a note
saying what was done to it. Three cases:

| `method` | Circuits | What it means |
| --- | --- | --- |
| `authored` | Baku, Miami, Monaco | A hand-drawn profile. **Never saw SRTM.** |
| `srtm-scaled` | 7, incl. Mexico City | SRTM, then multiplied by an artistic factor — as low as **0.15** at Mexico City, so its relief is 15% of measured. |
| `srtm` | the rest | SRTM, smoothed. Spa over 28 samples. |

SRTM is public domain; the USGS requests credit, which is given.

Why the departures exist: **SRTM is a surface model, so over a city it
measures the skyline rather than the ground.** Marina Bay and Las Vegas are
genuinely flat and ship flat. Baku, Miami and Monaco are not flat, and the
sampled profile over them was contaminated by buildings, so a profile was
drawn by hand instead. Gradients everywhere are eroded to a maximum of 18%,
the steepest thing in Formula One, because a 30 m grid turns parapets into
cliffs.

The consequence for a consumer is blunt: **this is approximate terrain for
legibility, not survey data, and on ten circuits it is not a measurement at
all.** It is metres above each circuit's own lowest point, not height above
sea level. Check `elevation.method` before using it quantitatively.

## Racing lines

There is no racing line in any of the source data; the rings are centre
lines. The lines here are solved by minimum-curvature optimisation inside the
track corridor, coarse to fine, and are **plausible rather than measured**.

Where an independent optimiser exists for comparison they agree to a few
metres of radius — Austin 25 m against 25, Zandvoort 33 against 33,
Silverstone 28 against 27. That is agreement with another optimiser, not with
a real lap. No telemetry was used and none is claimed.

## Corners and braking points

Corners are detected from curvature: a Menger estimator over a 21 m chord,
smoothed, thresholded at a 262 m radius, with complexes merged into single
decisions.

**The braking points are game design, not telemetry.** They are solved from
the distance available since the previous corner, on the physical reasoning
that braking distance scales with the square of arrival speed and arrival
speed comes from the preceding straight. Published braking references were
read to decide which corner complexes deserve emphasis; no telemetry
distances or times were copied. Do not treat them as real braking markers.

Corner names follow published circuit maps and the FIA corner sequence where
one exists. A merged complex may carry one name where a circuit map shows
several numbered corners, because the dataset records braking decisions
rather than every numbered bend.

## Track widths

**These are not real track widths.** The `corridorLeftMetres` and
`corridorRightMetres` arrays describe the game's drivable corridor, which is
deliberately widened to 1.8× nominal so a circuit reads on a phone, and which
is **constant along the lap on every circuit in this release**. `trackWidthMetres`
is the nominal real figure; `corridorExaggeration` records the factor.

The arrays remain per-point so a future build can carry real variation without
a format change, but today they do not. An earlier version of this
documentation claimed they did.

## What is not here

**Pikes Peak is deliberately excluded.** It is a hillclimb rather than a
circuit, and it is a separate dataset with its own frozen Overpass extracts
and its own ODbL notice. Excluding it removes no obligation from this
library — it was already ODbL and already attributed — it simply is not a
racing circuit and does not belong in a circuit library.

**No photographs, logos or official models.** The scenes were authored
against published references — operator site plans, circuit guides, aerial
imagery — but reproduce none of them. Every mesh is original stylised
geometry. Landmark dimensions are interpretations, not surveys.

## The 3D scenes

A compound, and both parts bind a redistributor:

- **Mapped landscape** — water polygons, coastlines, woodland boundaries, and
  some Monaco building footprints — comes from dated OpenStreetMap extracts
  pulled through the Overpass API and projected into each circuit's frame.
  © OpenStreetMap contributors, ODbL 1.0.
- **Everything else is original art**: buildings, grandstand forms, trees,
  barriers, landmark silhouettes. CC BY-SA 4.0.

Two deliberate departures from the map worth knowing. Jacarepaguá's current
OSM extract includes redevelopment-era decorative water, which is filtered out
because the circuit modelled is the historic one. Watkins Glen's woodland is
hand-composed from an aerial view rather than taken from OSM forest polygons,
and is recorded as such rather than passed off as mapped.

Scenes are republished here compressed with `EXT_meshopt_compression`.
The original scene geometry was reduced from 1.39 GB to 241 MB using
quantization. Authored geometry and scenery openings add to that total. Their
separate meshopt buffers are losslessly encoded, preserving exact junction
coordinates and the original baseline for repeatable rebuilding.

### Placement transforms

The upstream mapped-placement groups include affine transforms with shear
(rotation, nonuniform scale, then another rotation). A single glTF node must
decompose into translation, rotation and scale. Importing those invalid
matrices as one node altered the placement, separating buildings from their
foundations and causing roofs to cover the road.

Raceline preserves each original mapping as a pair of valid parent/child
transforms. `tools/scene-transforms.json` records the exact source matrices,
their child names and source file hashes. The repair changed 46 placements
across 37 scenes without changing any compressed binary geometry. Comparing
their rendered mesh bounds with the exact source transforms gives a maximum
difference below 0.016 m, including existing quantization.

`tools/validate-scenes.mjs` checks the rendered geometry after all parent
transforms, including grandstands, pit buildings, landmarks and mapped city
buildings. Actual projected triangles are tested against the road, including
the Suzuka bridge deck. The 40-scene audit found road overlaps in 14 scenes
before repair and none afterward. The before/after reports and source-bounds
comparison are in `validation/`. The checks do not measure terrain contact,
building-to-building clearance, or accuracy against a survey. Intentional
bridges and tunnels outside these architecture groups are excluded.

### Signature and pit-lane additions

`authoring/scene-context.json` freezes the source scene coordinate frame,
path elevations, mapped structure footprints and retained landmark locations.
Its footprint coordinates are local X/Z metres, not longitude/latitude.
`authoring/raceway-extracts/` contains public OpenStreetMap ways and source
metadata. These map-derived inputs and exported pit routes retain ODbL
attribution. No reference photograph or official drawing is embedded in a GLB.

New landmark shapes are original stylised geometry under the scene artwork
licence. Factual references include the [Red Bull Ring history](https://www.redbullring.com/en/history/),
[Shanghai circuit architecture](https://english.jiading.gov.cn/2013-07/12/c_709347.htm),
[Imola tower](https://www.autodromoimola.it/en/business/the-tower/),
[Monza banking](https://www.monzanet.it/sopraelevata-monza/), and mapped
footprints linked from the signature catalogue. These references identify
features; they are not architectural surveys or licensed source models.

Montreal’s corrected pit route follows [OSM way 413000959](https://www.openstreetmap.org/way/413000959)
and was checked against the user-supplied 2019 FIA pit-lane diagram and the
[FIA’s 2025 pit-lane drawing](https://www.fia.com/system/files/decision-document/2025_canadian_grand_prix_-_event_notes_-_circuit_map_pit_lane_emergency_exits_map_ers_battery_containment_area_red_zones.pdf).
It bypasses the final chicane and continues to the Senna S exit. An earlier
procedural route placed both connections incorrectly; it has been replaced.
The garage apron, ten marked stopping positions and separator are stylised
additions. The apron follows the mapped facade edge and clears the original
guardrails across the garage fronts. Vertical placement fits the supplied
terrain rather than representing a survey.

Pit junctions reuse the main track surface where the routes overlap. Added
asphalt is clipped to the track boundary, fitted to its exact elevation, and
uses the same material. The historic Monza curves are assembled across map-way
boundaries; banking eases into the straights and only mapped bridge crossings
are lifted over the current circuit.

`authoring/pit-facilities.json` records a visual reference review for all 40
circuits, including the relevant season/configuration and explicit selected
map ways. The current routes are `reference-authored`, except Montreal's
existing `mapped` route. The earlier procedural corridor fallback is no longer
used by any shipped circuit. FIA pit drawings, circuit plans and aerial or
trackside photographs informed route selection and building placement; the
manifest links every reference and records the observations. None of those
images are redistributed as scene textures or source artwork.

Specific corrections include F1's shorter Portimão approach, Lusail's post-2023
entry, Shanghai's missing entry connector, and Yas Marina's underground exit.
New or replacement garage artwork covers Melbourne, Bahrain, Jeddah, Monaco,
Indianapolis, Madrid, Jacarepaguá and Watkins Glen. Monaco's frontage follows
the FIA garage-allocation arrangement. Watkins Glen's detached Kendall garages
and open pit boxes replace an incorrectly identified outside-track pit building.
Its outside structure is modelled as the frontstretch grandstand.

The source roads are widened to suit the game. Where a mapped pit lane shares
that wider asphalt, the scene reuses it. Map-network endpoints connect road
centrelines; the rendered approaches instead occupy an edge lane, easing back
to the unchanged mapped branch at the asphalt boundary. Shared approaches have
one pit divider and retain the track's outside edge marking. Two separate pit
edge stripes are used only on the separated lane. Madrid's straight and Yas Marina's tunnel
approach have documented lateral adjustments to preserve usable driving space.
Endpoint blending, vertical fitting, garage aprons, foundations, separators and
pit-box markings are authored adaptations. Terrain beneath the paving and
intersecting barriers, street walls, catch fencing, lamps and brake boards are
cut away. Wear overlays cannot conceal the new markings.

Historical Jacarepaguá is an archival reconstruction. Madrid combines the
supplied concept track with the referenced two-group pit arrangement; it is not
an as-built 2026 survey. Kyalami's pit route follows the real circuit direction;
the supplied source centreline order and some corner labels run the other way.
Building silhouettes and dimensions remain stylised, including retained
original garage models. Geometry checks do not establish survey accuracy.

`validation/details.json` checks all exported GLBs for continuous pit surface
coverage, ground burial, road contact at both endpoints, bounded grades,
duplicate asphalt, junction height gaps, and a three-dimensional driving
corridor with 2.8 m clear height. It also tests the six-metre centre corridor of
the main track, architecture against the complete road/pit surface, and new pit
buildings against retained architecture. This detects vertical fencing that a
projected-area test alone misses. The Yas tunnel must retain at least its
specified four metres of headroom; the hotel and historic Monza banking
crossings require seven metres over the main road. A separate marking check
counts the exported paint stripes at each shared-road endpoint. This catches
the paired lines ending in the racing surface that passed the earlier paving
and clearance checks. Collapsed source road triangles are excluded from polygon
clipping, and regression coverage includes an Estoril triangle that previously
duplicated paving because floating-point cancellation gave it a nonzero area.

All 40 facilities and 80 entry/exit joins were inspected in browser renders.
`tools/review-pits.html` reproduces those camera views, and `validation/pit-views/`
contains the visual audit captures. These are model screenshots, not reference
photographs. Validation concerns the included obstacle classes and driving
corridors; it is not a certification of a race circuit or a physics simulation.

## Verification

Every circuit in this dataset was checked against the original GeoJSON ring
it descends from before being written. **Every** exported centreline point —
at the rounded precision actually published — must fall within 25 m of the
source outline, measured to segments rather than vertices, and the lap length
must be within 4% of the published figure. A circuit that fails either test is
not published, and the export fails rather than quietly shipping the rest.

(An earlier version of this file claimed every point while the code sampled
every third. It now does what it says.)

Observed worst case across the forty is 9.5 m at Las Vegas, where the source
ring is most coarsely traced; most circuits land within 3 m. The per-circuit
figure is in `circuits/index.json` as `verifiedWithinMetres`.

This check caught a real error. The coordinate recovery was first anchored on
each circuit's recorded start/finish point, which is wrong for Monaco and
Silverstone — the asset pack rotates those two laps onto their real start
lines without moving that field. They came out 525 m and 1111 m from their
true positions while looking entirely plausible in isolation. Anchoring on
arc-length-weighted centroids instead fixed both.

## Not affiliated

This dataset is not associated with, endorsed by, or connected to Formula 1,
the FIA, or any circuit operator. Circuit names are used descriptively to
identify real places.
