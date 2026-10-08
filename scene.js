// Standalone glTF viewer: orbit, free flight, animations and landmark framing.
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.mjs';
import { createControls } from './flight-controls.js';

let renderer, scene, camera, controls, mixer, currentId = null;
let raf = null, request = 0, visible = true, lastTime = 0;
function dispose(object) {
  object?.traverse(o => {
    o.geometry?.dispose();
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
}
function tick(time) {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
  lastTime = time; controls.update(dt); mixer?.update(dt);
  renderer.render(scene, camera); raf = requestAnimationFrame(tick);
}
export function setVisible(value) {
  visible = value; controls?.setActive(value);
  if (raf !== null) cancelAnimationFrame(raf);
  raf = null; lastTime = 0;
  if (visible && scene) { resizeScene(renderer.domElement); raf = requestAnimationFrame(tick); }
}
export async function showScene(id, canvas, onStat, onMode) {
  const mine = ++request;
  controls?.setActive(false);
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setClearColor(0x14161b);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    camera = new THREE.PerspectiveCamera(48, 1, .1, 30000);
    controls = createControls(camera, canvas, onMode);
  }
  resizeScene(canvas);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`scenes/${encodeURIComponent(id)}.glb`);
  if (mine !== request) { dispose(gltf.scene); return false; }
  if (raf !== null) cancelAnimationFrame(raf);
  mixer?.stopAllAction(); dispose(scene);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe6f2, 0x30343c, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(.6, 1, .35); scene.add(sun);
  scene.add(gltf.scene);
  mixer = gltf.animations.length ? new THREE.AnimationMixer(gltf.scene) : null;
  for (const clip of gltf.animations) mixer.clipAction(clip).play();
  let triangles = 0, meshes = 0;
  gltf.scene.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) / 2;
  camera.far = Math.max(30000, radius * 20); camera.updateProjectionMatrix();
  controls.setHome(box.getCenter(new THREE.Vector3()).toArray(), radius * (camera.aspect < 1 ? 3.5 : 2.6));
  currentId = id; onStat?.({ meshes, triangles: Math.round(triangles) });
  setVisible(visible);
  return true;
}
export function resizeScene(canvas) {
  if (!renderer || !camera) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
export function cancelPending() { ++request; controls?.setActive(visible); }
export function setMode(mode) { controls?.setMode(mode); }
export function setSpeed(value) { controls?.setSpeed(value); }
export function holdMovement(code, held) { controls?.hold(code, held); }
export function resetView() { controls?.reset(); }
export function focusFeature(id, feature) {
  if (id !== currentId) return false;
  controls.frame(feature.position, (feature.viewDistance || 160) * Math.max(1, 1 / camera.aspect), feature.viewDirection);
  return true;
}
