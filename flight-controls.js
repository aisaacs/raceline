import { Vector3, Spherical } from './vendor/three.module.js';

// One controller per canvas. Keyboard movement belongs to the focused viewport,
// and all held input is cleared on blur, tab changes and circuit changes.
export function createControls(camera, canvas, onMode = () => {}) {
  const events = new AbortController(), signal = events.signal;
  const keys = new Set(), touches = new Map();
  const target = new Vector3(), spherical = new Spherical(1000, .95, .6);
  const forward = new Vector3(), right = new Vector3(), up = new Vector3(0, 1, 0);
  let mode = 'orbit', active = true, yaw = 0, pitch = 0, speed = 60, home = null;
  const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
  function orbit() {
    spherical.phi = Math.max(.025, Math.min(Math.PI - .025, spherical.phi));
    spherical.radius = Math.max(2, Math.min(30000, spherical.radius));
    camera.position.copy(target).add(new Vector3().setFromSpherical(spherical));
    camera.lookAt(target);
  }
  function orientFly() { camera.rotation.set(pitch, yaw, 0, 'YXZ'); }
  function syncFly() {
    camera.getWorldDirection(forward);
    yaw = Math.atan2(-forward.x, -forward.z);
    pitch = Math.asin(Math.max(-1, Math.min(1, forward.y)));
  }
  function setMode(next) {
    keys.clear(); touches.clear(); mode = next;
    if (mode === 'fly') syncFly();
    else {
      camera.getWorldDirection(forward);
      target.copy(camera.position).addScaledVector(forward, Math.min(spherical.radius, 400));
      spherical.setFromVector3(camera.position.clone().sub(target));
      orbit();
    }
    canvas.dataset.mode = mode; onMode(mode);
  }
  function frame(position, radius, direction = [.6, .85, 1]) {
    keys.clear(); target.fromArray(position);
    const offset = new Vector3(...direction).normalize().multiplyScalar(radius);
    spherical.setFromVector3(offset);
    orbit(); syncFly();
  }
  function pan(dx, dy) {
    const scale = spherical.radius * .0017;
    right.setFromMatrixColumn(camera.matrix, 0);
    const vertical = new Vector3().setFromMatrixColumn(camera.matrix, 1);
    target.addScaledVector(right, -dx * scale).addScaledVector(vertical, dy * scale);
    orbit();
  }
  canvas.addEventListener('contextmenu', e => e.preventDefault(), { signal });
  canvas.addEventListener('pointerdown', e => {
    if (!active) return;
    canvas.focus({ preventScroll: true });
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    canvas.setPointerCapture(e.pointerId);
  }, { signal });
  canvas.addEventListener('pointermove', e => {
    const old = touches.get(e.pointerId);
    if (!old || !active) return;
    const dx = e.clientX - old.x, dy = e.clientY - old.y;
    if (touches.size === 2) {
      const other = [...touches.entries()].find(([id]) => id !== e.pointerId)[1];
      const before = Math.hypot(old.x - other.x, old.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (mode === 'orbit') { spherical.radius *= before / Math.max(1, after); pan(dx / 2, dy / 2); }
      else { camera.getWorldDirection(forward); camera.position.addScaledVector(forward, (after - before) * .6); }
    } else if (mode === 'fly') {
      yaw -= dx * .004; pitch = Math.max(-1.5, Math.min(1.5, pitch - dy * .004)); orientFly();
    } else if (old.button === 2 || e.shiftKey) pan(dx, dy);
    else { spherical.theta -= dx * .005; spherical.phi -= dy * .005; orbit(); }
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY, button: old.button });
  }, { signal });
  const release = e => { touches.delete(e.pointerId); if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); };
  canvas.addEventListener('pointerup', release, { signal });
  canvas.addEventListener('pointercancel', release, { signal });
  canvas.addEventListener('wheel', e => {
    if (!active) return;
    e.preventDefault();
    if (mode === 'orbit') { spherical.radius *= Math.exp(Math.max(-200, Math.min(200, e.deltaY)) * .0015); orbit(); }
    else { camera.getWorldDirection(forward); camera.position.addScaledVector(forward, -Math.sign(e.deltaY) * speed * .2); }
  }, { passive: false, signal });
  canvas.addEventListener('keydown', e => {
    if (!active) return;
    if (e.code === 'Escape') { keys.clear(); canvas.blur(); return; }
    if (e.code === 'KeyF' && !e.repeat) { setMode(mode === 'fly' ? 'orbit' : 'fly'); e.preventDefault(); }
    if (e.code === 'KeyR' && home) { frame(...home); e.preventDefault(); }
    if (mode === 'fly' && movement.has(e.code)) { keys.add(e.code); e.preventDefault(); }
  }, { signal });
  window.addEventListener('keyup', e => keys.delete(e.code), { signal });
  const clear = () => { keys.clear(); touches.clear(); };
  canvas.addEventListener('blur', clear, { signal });
  window.addEventListener('blur', clear, { signal });
  document.addEventListener('visibilitychange', clear, { signal });
  return {
    get mode() { return mode; }, setMode, frame,
    setHome(position, radius) { home = [position, radius]; frame(...home); },
    reset() { if (home) frame(...home); },
    setSpeed(value) { speed = Math.max(1, Math.min(500, value)); },
    setActive(value) { active = value; clear(); },
    hold(code, held) { if (active && mode === 'fly') held ? keys.add(code) : keys.delete(code); },
    update(dt) {
      if (!active || mode !== 'fly' || !keys.size) return;
      camera.getWorldDirection(forward); right.crossVectors(forward, up).normalize();
      const move = new Vector3();
      if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(forward);
      if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(forward);
      if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
      if (keys.has('KeyE')) move.add(up);
      if (keys.has('KeyQ')) move.sub(up);
      const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4 : 1;
      camera.position.addScaledVector(move.normalize(), speed * boost * Math.min(dt, .05));
    },
    dispose() { events.abort(); clear(); },
  };
}
