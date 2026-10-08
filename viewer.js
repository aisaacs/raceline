// Raceline viewer.
//
// Plain scripts, no build step, no CDN. Everything is fetched from the same
// origin, so the page works from a file server, from GitHub Pages, or from a
// clone with `python3 -m http.server`.
//
// The plan view is drawn from the CENTRELINE as a filled ribbon using the
// corridor half-widths, not as a stroked path of fixed weight — so a wide
// circuit reads as wide. Those corridors are the game's, 1.8x real width and
// constant along each lap; they are not surveyed track edges.

const $ = (id) => document.getElementById(id);

const COLOURS = {
  road: '#4a515e',
  edge: '#5c6472',
  line: '#b14fe8',
  brake: '#ffb020',
  start: '#17c964',
  grid: '#1b1e24',
};

let index = null;
let current = null;
let signatureIndex = null;

// ---------------------------------------------------------------------------
// geometry

// Equirectangular about the circuit's own centre. Over a 7 km loop the error
// against a real projection is well under a metre, and it keeps the aspect
// ratio honest at every latitude — plotting raw degrees squashes Sakhir and
// stretches Zandvoort.
function toLocal(lon, lat, lon0, lat0) {
  const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return [(lon - lon0) * mPerLon, -(lat - lat0) * 111320];
}

function project(c) {
  const lat0 = c.centreline.lat.reduce((a, v) => a + v, 0) / c.centreline.lat.length;
  const lon0 = c.centreline.lon.reduce((a, v) => a + v, 0) / c.centreline.lon.length;
  const centre = c.centreline.lon.map((lon, i) => toLocal(lon, c.centreline.lat[i], lon0, lat0));
  const race = c.racingLine.lon.map((lon, i) => toLocal(lon, c.racingLine.lat[i], lon0, lat0));
  return { centre, race };
}

function fit(points, w, h, pad) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const s = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
  const ox = (w - (maxX + minX) * s) / 2;
  const oy = (h - (maxY + minY) * s) / 2;
  return ([x, y]) => [x * s + ox, y * s + oy];
}

// Unit normal at i, from the neighbours rather than the next point alone:
// a one-sided normal flickers wherever two resampled points land close.
function normalAt(pts, i) {
  const a = pts[(i - 1 + pts.length) % pts.length];
  const b = pts[(i + 1) % pts.length];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

// ---------------------------------------------------------------------------
// plan view

function drawMap(c) {
  const cv = $('map');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const { centre, race } = project(c);

  // The canvas takes the circuit's own proportions rather than a square.
  // Spa is twice as tall as it is wide and Baku the other way round; forcing
  // both into a square either wastes half the panel or makes a tall circuit
  // so large it runs off the page.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of centre) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const w = Math.max(320, cv.clientWidth || 900);
  const aspect = (maxY - minY) / (maxX - minX);
  const h = Math.max(260, Math.min(620, w * aspect));

  cv.style.height = h + 'px';
  cv.width = w * dpr;
  cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const at = fit(centre, w, h, 28);

  // The road as a filled ribbon, built from each point's own half widths.
  const left = [], right = [];
  for (let i = 0; i < centre.length; i++) {
    const [nx, ny] = normalAt(centre, i);
    const wl = c.centreline.corridorLeftMetres[i];
    const wr = c.centreline.corridorRightMetres[i];
    left.push([centre[i][0] + nx * wl, centre[i][1] + ny * wl]);
    right.push([centre[i][0] - nx * wr, centre[i][1] - ny * wr]);
  }

  ctx.beginPath();
  left.forEach((p, i) => { const q = at(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
  for (let i = right.length - 1; i >= 0; i--) { const q = at(right[i]); ctx.lineTo(q[0], q[1]); }
  ctx.closePath();
  ctx.fillStyle = COLOURS.road;
  ctx.fill();
  ctx.strokeStyle = COLOURS.edge;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Racing line.
  ctx.beginPath();
  race.forEach((p, i) => { const q = at(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
  ctx.closePath();
  ctx.strokeStyle = COLOURS.line;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Start / finish, across the road at racing-line index 0.
  const [snx, sny] = normalAt(centre, 0);
  const a = at([centre[0][0] + snx * 14, centre[0][1] + sny * 14]);
  const b = at([centre[0][0] - snx * 14, centre[0][1] - sny * 14]);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = COLOURS.start;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Braking points, numbered.
  ctx.font = '600 11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  c.corners.forEach((corner, i) => {
    const p = at(race[corner.brakingPointIndex % race.length]);
    ctx.beginPath();
    ctx.arc(p[0], p[1], 8, 0, Math.PI * 2);
    ctx.fillStyle = COLOURS.brake;
    ctx.fill();
    ctx.fillStyle = '#17110a';
    ctx.fillText(String(i + 1), p[0], p[1] + 0.5);
  });
}

// ---------------------------------------------------------------------------
// elevation

function drawElevation(c) {
  const cv = $('elev');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 900, h = 170;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const e = c.racingLine.elevationMetres;
  const max = Math.max(...e), min = Math.min(...e);
  const measured = max - min;          // what the circuit actually does
  const span = Math.max(1, measured);  // only to keep the plot from dividing by zero
  const pad = 16;
  const x = (i) => (i / (e.length - 1)) * (w - pad * 2) + pad;
  const y = (v) => h - pad - ((v - min) / span) * (h - pad * 2);

  // A flat circuit should LOOK flat. Scaling every profile to fill the box
  // would draw Monaco's 55 m and Yas Marina's 4 m as the same hill, which is
  // the most misleading thing an elevation chart can do — so the vertical
  // scale is shared across the library and only the baseline moves.
  const LIBRARY_MAX = 120;
  const yShared = (v) => h - pad - ((v - min) / LIBRARY_MAX) * (h - pad * 2);
  const plot = span > LIBRARY_MAX ? y : yShared;

  ctx.strokeStyle = COLOURS.grid;
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const yy = pad + ((h - pad * 2) * g) / 4;
    ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(w - pad, yy); ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(x(0), h - pad);
  for (let i = 0; i < e.length; i++) ctx.lineTo(x(i), plot(e[i]));
  ctx.lineTo(x(e.length - 1), h - pad);
  ctx.closePath();
  ctx.fillStyle = 'rgba(177,79,232,0.16)';
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < e.length; i++) {
    const p = [x(i), plot(e[i])];
    i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  }
  ctx.strokeStyle = COLOURS.line;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.fillStyle = '#878d99';
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${measured.toFixed(measured < 10 ? 1 : 0)} m range`, pad, 14);
  ctx.textAlign = 'right';
  ctx.fillText(`${(c.lengthMetres / 1000).toFixed(3)} km`, w - pad, h - 4);
}

// ---------------------------------------------------------------------------
// detail

// Straight from the exported cumulative distance. This used to scale an index
// fraction by the lap length, which is measured along the CENTRELINE — 95 m
// adrift of the racing line at Sepang.
function metresAt(c, i) {
  const d = c.racingLine.distanceMetres;
  return d[((i % d.length) + d.length) % d.length];
}

function show(c) {
  current = c;
  $('empty').hidden = true;
  $('view').hidden = false;

  $('cName').textContent = c.name;
  $('cId').textContent = `${c.id}  ·  ${c.rulesRevision || 'no rules revision'}`;
  $('fLength').textContent = `${(c.lengthMetres / 1000).toFixed(3)} km`;
  $('fCorners').textContent = c.corners.length;
  $('fElev').textContent = `${c.elevationRangeMetres} m`;
  $('fWidth').textContent = `${c.trackWidthMetres} m`;

  const body = $('corners').querySelector('tbody');
  body.textContent = '';
  c.corners.forEach((corner, i) => {
    const radius = corner.peakCurvature ? Math.round(1 / corner.peakCurvature) : null;
    const brakeM = metresAt(c, corner.apexIndex) - metresAt(c, corner.brakingPointIndex);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="num dim">${i + 1}</td>
      <td class="name">${corner.name || '—'}</td>
      <td class="num">${Math.round(metresAt(c, corner.apexIndex))} m</td>
      <td class="num">${brakeM > 0 ? Math.round(brakeM) + ' m' : '—'}</td>
      <td class="num">${radius ? radius + ' m' : '—'}</td>
      <td class="dim">${corner.intensity || '—'}</td>`;
    body.appendChild(tr);
  });

  const raw = $('raw');
  raw.href = `circuits/${c.id}.json`;
  raw.setAttribute('download', `${c.id}.json`);

  $('modelDownload').href = `scenes/${encodeURIComponent(c.id)}.glb`;
  $('modelDownload').download = `${c.id}.glb`;
  showLandmarks(c.id);
  setTab('3d');
  drawMap(c);
  drawElevation(c);
  location.hash = encodeURIComponent(c.id);
}

// Every request carries a token. Clicking through the list faster than the
// network answers used to let an earlier circuit's response arrive last and
// overwrite the one actually selected — including the address bar.
let token = 0;
async function load(id) {
  const mine = ++token;
  const r = await fetch(`circuits/${id}.json`);
  if (!r.ok) throw new Error(`${id}: ${r.status}`);
  const size = r.headers.get('content-length');
  const c = await r.json();
  if (mine !== token) return;
  $('rawSize').textContent = size ? `${Math.round(size / 1024)} KB` : '';
  show(c);
}

function renderList(filter) {
  const ol = $('circuits');
  ol.textContent = '';
  const q = filter.trim().toLowerCase();
  for (const c of index.circuits) {
    if (q && !(`${c.name} ${c.id}`.toLowerCase().includes(q))) continue;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="nm">${c.name}</span>`
      + `<span class="sm">${(c.lengthMetres / 1000).toFixed(3)} km · ${c.corners} corners</span>`;
    if (current && current.id === c.id) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => {
      load(c.id).then(() => renderList($('filter').value)).catch(console.error);
    });
    li.appendChild(b);
    ol.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// the 3D tab
//
// One asynchronous load owns the viewport. Late responses cannot replace a
// newer selection, and changing tabs pauses input and rendering.

let sceneMod = null;
let sceneShownFor = null;
let sceneRequestedFor = null;
let sceneRequest = 0;

function showLandmarks(id) {
  $('landmarks').replaceChildren();
  for (const feature of signatureIndex?.circuits[id]?.features || []) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = feature.name; button.disabled = true;
    button.addEventListener('click', () => {
      if (sceneMod?.focusFeature(id, feature)) {
        $('landmarkNote').textContent = feature.note;
        for (const other of $('landmarks').children) other.setAttribute('aria-pressed', String(other === button));
        $('scene').focus({ preventScroll: true });
      }
    });
    button.setAttribute('aria-pressed', 'false'); $('landmarks').appendChild(button);
  }
  $('landmarkNote').textContent = signatureIndex?.circuits[id]?.note || 'Select a landmark to move the camera closer.';
}

function cameraMode(mode) {
  const fly = mode === 'fly';
  $('flyMode').setAttribute('aria-pressed', String(fly));
  $('orbitMode').setAttribute('aria-pressed', String(!fly));
  $('speedControl').hidden = !fly; $('flightPad').hidden = !fly;
  $('cameraHelp').textContent = fly
    ? 'Click the view · WASD / arrows to fly · Q/E down/up · Shift faster · drag to look · Esc releases keys'
    : 'Drag to orbit · right-drag to pan · scroll or pinch to zoom';
}

async function openScene() {
  if (!current) return;
  const id = current.id;
  sceneMod?.setVisible(true);
  if (sceneShownFor === id) {
    if (sceneRequestedFor && sceneRequestedFor !== id) { ++sceneRequest; sceneRequestedFor = null; sceneMod.cancelPending(); }
    for (const button of $('landmarks').children) button.disabled = false;
    return;
  }
  if (sceneRequestedFor === id) return;
  sceneRequestedFor = id;
  const mine = ++sceneRequest;
  $('sceneStat').textContent = 'loading…';
  try {
    if (!sceneMod) sceneMod = await import('./scene.js');
    if (mine !== sceneRequest) return;
    sceneMod.setVisible(!$('sceneFig').hidden);
    const shown = await sceneMod.showScene(id, $('scene'), ({ meshes, triangles }) => {
        if (mine !== sceneRequest) return;
        $('sceneStat').textContent =
          `${meshes} meshes · ${(triangles / 1000).toFixed(0)}k triangles`;
      }, cameraMode);
    if (shown && mine === sceneRequest) {
      sceneShownFor = id;
      for (const button of $('landmarks').children) button.disabled = false;
    }
  } catch (e) {
    if (mine !== sceneRequest) return;
    // A WebGL-less browser should lose the 3D tab, not the whole page.
    $('sceneStat').textContent = 'scene unavailable: ' + e.message;
    console.error(e);
  } finally {
    if (mine === sceneRequest) sceneRequestedFor = null;
  }
}

function setTab(which) {
  const is3d = which === '3d';
  $('tabPlan').setAttribute('aria-selected', String(!is3d));
  $('tab3d').setAttribute('aria-selected', String(is3d));
  $('planFig').hidden = is3d;
  $('sceneFig').hidden = !is3d;
  if (is3d) openScene();
  else { sceneMod?.setVisible(false); if (current) drawMap(current); }
}

$('tabPlan').addEventListener('click', () => setTab('plan'));
$('tab3d').addEventListener('click', () => setTab('3d'));
$('orbitMode').addEventListener('click', () => sceneMod?.setMode('orbit'));
$('flyMode').addEventListener('click', () => { sceneMod?.setMode('fly'); $('scene').focus({ preventScroll: true }); });
$('resetCamera').addEventListener('click', () => sceneMod?.resetView());
$('flySpeed').addEventListener('input', e => {
  sceneMod?.setSpeed(Number(e.target.value)); $('speedValue').textContent = `${e.target.value} m/s`;
});
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('sceneViewport').requestFullscreen();
  } catch { $('cameraHelp').textContent = 'Full screen is unavailable in this browser. Flight controls still work in this view.'; }
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
  sceneMod?.resizeScene($('scene'));
});
for (const button of $('flightPad').querySelectorAll('button')) {
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); sceneMod?.holdMovement(button.dataset.move, true); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => sceneMod?.holdMovement(button.dataset.move, false));
}

// Deep links and the back button. Changing only the hash is a same-document
// navigation, so without this the page keeps showing whatever it loaded first
// — which is exactly what someone following a shared link to one circuit gets.
window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id || (current && current.id === id)) return;
  if (!index || !index.circuits.some(c => c.id === id)) return;
  load(id).then(() => renderList($('filter').value)).catch(console.error);
});

(async function init() {
  [index, signatureIndex] = await Promise.all([
    fetch('circuits/index.json').then(r => r.json()),
    fetch('scenes/signatures.json').then(r => { if (!r.ok) throw new Error('Signature catalogue unavailable'); return r.json(); }).catch(e => { console.warn(e); return null; }),
  ]);
  $('statCircuits').textContent = index.count;
  $('statCorners').textContent = index.circuits.reduce((a, c) => a + c.corners, 0);
  renderList('');
  $('filter').addEventListener('input', (e) => renderList(e.target.value));

  const wanted = decodeURIComponent(location.hash.slice(1));
  const first = index.circuits.find(c => c.id === wanted) || index.circuits[0];
  if (first) await load(first.id).then(() => renderList(''));
})();

// Canvases are sized from their laid-out width, so they have to be redrawn
// when that changes. Without this the plan view is drawn once at the phone
// width and then stretched by CSS for the rest of the session.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!current) return;
    drawMap(current);
    drawElevation(current);
    if (sceneMod) sceneMod.resizeScene($('scene'));
  }, 120);
});
