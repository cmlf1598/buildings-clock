import * as THREE from "three";
import "./style.css";

import { debug, CAM_TARGET } from "./config.js";
import { createRenderer } from "./core/renderer.js";
import { createScene } from "./core/scene.js";
import {
  createCamera,
  resizeCamera,
  updateCamera,
  attachPointer,
} from "./core/camera.js";
import { createLights } from "./core/lights.js";
import { createComposer, resizeComposer } from "./core/composer.js";

import { createBuildings } from "./world/buildings.js";
import { createGround } from "./world/ground.js";
import { createProps } from "./world/props.js";
import { NeonSign } from "./world/neonSign.js";
import { CitySigns } from "./world/citySigns.js";
import { TOWERS, DIGIT_SLOTS } from "./world/layout.js";

import { WindowField } from "./emissive/WindowField.js";
import { Animator } from "./emissive/animator.js";

import { TimeSource, glyphFor } from "./time/clock.js";
import { GLYPH_W, GLYPH_H, COLON, COLON_W } from "./data/font5x7.js";

const canvas = document.getElementById("canvas");
const renderer = createRenderer(canvas);
const scene = createScene();
const camera = createCamera();
createLights(scene);

createGround(scene);
createBuildings(scene);
createProps(scene);
const sign = new NeonSign(scene);
const citySigns = new CitySigns(scene);

const field = new WindowField();
scene.add(field.mesh);

const animator = new Animator(field);
const timeSource = new TimeSource();

// Previous bitmap per tower, so a minute tick only schedules cells that
// actually flipped.
const prevGlyph = {};
for (const slot of DIGIT_SLOTS) {
  prevGlyph[slot] = new Uint8Array(GLYPH_W * GLYPH_H);
}

// The colon is static content - it is lit once and then pulsed every frame.
animator.applyGlyph(
  field.colonMap,
  COLON,
  new Uint8Array(COLON_W * GLYPH_H),
  2,
  COLON_W,
);

let isPM = null;

function applyReading(r) {
  DIGIT_SLOTS.forEach((slot, idx) => {
    const tower = TOWERS[slot];
    animator.applyGlyph(
      field.digitMap[slot],
      glyphFor(r.digits[idx]),
      prevGlyph[slot],
      tower.slot,
    );
  });

  if (r.isPM !== isPM) {
    isPM = r.isPM;
    sign.setPM(isPM);
  }
}

applyReading(timeSource.poll() ?? { digits: [-1, 0, 0, 0], isPM: false });

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  resizeCamera(camera, w, h);
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  resizeComposer(composer, bloomPass, w, h);
}

const { composer, bloomPass } = createComposer(renderer, scene, camera);
window.addEventListener("resize", onResize);
attachPointer(canvas);
onResize();

if (debug.orbit) {
  const { OrbitControls } = await import(
    "three/addons/controls/OrbitControls.js"
  );
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...CAM_TARGET);
  controls.update();
}

if (debug.bounds) {
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const b = new THREE.Box3();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    b.union(bb);
  });
  const v = new THREE.Vector3();
  let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  for (const sx of [b.min.x, b.max.x])
    for (const sy of [b.min.y, b.max.y])
      for (const sz of [b.min.z, b.max.z]) {
        v.set(sx, sy, sz).project(camera);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
  console.log(
    `BOUNDS vp=${window.innerWidth}x${window.innerHeight} ` +
      `frustum L${camera.left.toFixed(2)} R${camera.right.toFixed(2)} ` +
      `T${camera.top.toFixed(2)} B${camera.bottom.toFixed(2)} | ` +
      `ndc x[${x0.toFixed(3)},${x1.toFixed(3)}] y[${y0.toFixed(3)},${y1.toFixed(3)}]`,
  );
}

/**
 * THREE.Clock is deprecated as of r185 (it warns on import), so this uses
 * Timer. connect(document) is the part that matters: it zeroes the delta
 * while the tab is hidden. With Clock, returning to a backgrounded tab
 * produced one enormous delta that snapped every in-flight window fade
 * straight to its endpoint.
 */
const timer = new THREE.Timer();
timer.connect(document);

// Belt and braces for a long stall (GC, a slow first frame): a huge dt would
// jump the fades rather than play them.
const MAX_DT = 1 / 20;

function animate(timestamp) {
  requestAnimationFrame(animate);
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), MAX_DT);
  const t = timer.getElapsed();

  if (!debug.orbit) updateCamera(camera, t, dt);

  const reading = timeSource.poll();
  if (reading) applyReading(reading);

  field.pulseColon(t);
  field.pulseBeacons(t);
  animator.step(dt);
  sign.step(dt);
  citySigns.step(t);
  field.flush();

  composer.render(); // NOT renderer.render()
}

animate();

if (import.meta.env?.DEV) {
  // renderer.info resets on every renderer.render(), and the composer's last
  // pass is a fullscreen quad - so reading it after composer.render() would
  // report 1 and tell us nothing. Measure with one direct pass instead.
  renderer.render(scene, camera);
  console.log(
    `windows ${field.count} · ` +
      `scene draw calls ${renderer.info.render.calls} · ` +
      `triangles ${renderer.info.render.triangles}`,
  );
}
