/**
 * Re-derives the framing constants (DESIGN_W, DESIGN_H, CAM_TARGET) without a
 * browser.
 *
 *     node tools/measure.mjs
 *
 * This is the same measurement `?bounds` performs in the running app, and it
 * agrees with it because it builds the REAL scene: it imports world/ and
 * emissive/ and lets them construct their actual geometry. None of those
 * modules touch a GL context - only main.js does - so the whole diorama builds
 * happily in Node. Nothing here re-describes the scene, so nothing here can
 * drift away from it.
 *
 * What it measures, and why it is bigger than you expect: the union of every
 * mesh's world AABB, projected as a BOX. That box has corners the geometry
 * does not - (max x, max y, max z) is empty sky above the slab's front-right
 * corner - so the number is conservative. It is also what `?bounds` reports
 * and what the contain-fit is solved against, so the two must agree.
 *
 * The camera is orthographic, so view-space x and y ARE screen extents in
 * world units; no perspective divide, no frustum needed to measure.
 */

import * as THREE from "three";
import {
  BASE_YAW,
  BASE_PITCH,
  CAM_DIST,
  CAM_TARGET,
  TILT_YAW,
  TILT_PITCH,
  DRIFT_YAW,
  DRIFT_PITCH,
  DESIGN_W,
  DESIGN_H,
} from "../src/config.js";
import { createGround } from "../src/world/ground.js";
import { createBuildings } from "../src/world/buildings.js";
import { createProps } from "../src/world/props.js";
import { NeonSign } from "../src/world/neonSign.js";
import { CitySigns } from "../src/world/citySigns.js";
import { WindowField } from "../src/emissive/WindowField.js";

const DEG = 180 / Math.PI;

const scene = new THREE.Scene();
createGround(scene);
createBuildings(scene);
createProps(scene);
new NeonSign(scene);
new CitySigns(scene);
scene.add(new WindowField().mesh);
scene.updateMatrixWorld(true);

const box = new THREE.Box3();
let meshes = 0;
scene.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  o.geometry.computeBoundingBox();
  box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
});

console.log(`${meshes} meshes`);
console.log(
  `scene aabb  x[${box.min.x.toFixed(2)}, ${box.max.x.toFixed(2)}]  ` +
    `y[${box.min.y.toFixed(2)}, ${box.max.y.toFixed(2)}]  ` +
    `z[${box.min.z.toFixed(2)}, ${box.max.z.toFixed(2)}]`,
);

// Tilt and drift CROSS-FADE, they never sum - so the worst case on each axis
// is base + the larger of the two, not base + both. This is the same
// assumption the tower spacing is designed against.
const dYaw = Math.max(TILT_YAW, DRIFT_YAW);
const dPitch = Math.max(TILT_PITCH, DRIFT_PITCH);

const target = new THREE.Vector3(...CAM_TARGET);
const cam = new THREE.Camera();
const v = new THREE.Vector3();

let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
let worst = null;

for (const sy of [-1, 0, 1]) {
  for (const sp of [-1, 0, 1]) {
    const yaw = BASE_YAW + sy * dYaw;
    const pitch = BASE_PITCH + sp * dPitch;
    const cp = Math.cos(pitch);
    cam.position.set(
      target.x + CAM_DIST * Math.sin(yaw) * cp,
      target.y + CAM_DIST * Math.sin(pitch),
      target.z + CAM_DIST * Math.cos(yaw) * cp,
    );
    cam.lookAt(target);
    cam.updateMatrixWorld(true);

    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const px of [box.min.x, box.max.x])
      for (const py of [box.min.y, box.max.y])
        for (const pz of [box.min.z, box.max.z]) {
          v.set(px, py, pz).applyMatrix4(cam.matrixWorldInverse);
          a = Math.min(a, v.x); b = Math.max(b, v.x);
          c = Math.min(c, v.y); d = Math.max(d, v.y);
        }

    if (b - a > x1 - x0 || d - c > y1 - y0) {
      worst = `yaw ${(yaw * DEG).toFixed(1)}deg pitch ${(pitch * DEG).toFixed(1)}deg`;
    }
    x0 = Math.min(x0, a); x1 = Math.max(x1, b);
    y0 = Math.min(y0, c); y1 = Math.max(y1, d);
  }
}

const w = x1 - x0;
const h = y1 - y0;
console.log(`\nswept screen extent  w ${w.toFixed(2)}  h ${h.toFixed(2)}  (worst at ${worst})`);
console.log(`config.js design box  w ${DESIGN_W.toFixed(2)}  h ${DESIGN_H.toFixed(2)}`);
console.log(
  `headroom              w ${((DESIGN_W / w - 1) * 100).toFixed(1)}%   ` +
    `h ${((DESIGN_H / h - 1) * 100).toFixed(1)}%`,
);

// CAM_TARGET is solved so the content lands on frame centre. Under the base
// angles the projected centre should sit at view-space (0, 0).
const cp = Math.cos(BASE_PITCH);
cam.position.set(
  target.x + CAM_DIST * Math.sin(BASE_YAW) * cp,
  target.y + CAM_DIST * Math.sin(BASE_PITCH),
  target.z + CAM_DIST * Math.cos(BASE_YAW) * cp,
);
cam.lookAt(target);
cam.updateMatrixWorld(true);
let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
for (const px of [box.min.x, box.max.x])
  for (const py of [box.min.y, box.max.y])
    for (const pz of [box.min.z, box.max.z]) {
      v.set(px, py, pz).applyMatrix4(cam.matrixWorldInverse);
      a = Math.min(a, v.x); b = Math.max(b, v.x);
      c = Math.min(c, v.y); d = Math.max(d, v.y);
    }
console.log(
  `\nat base angles        w ${(b - a).toFixed(2)}  h ${(d - c).toFixed(2)}` +
    `   centring offset x ${((a + b) / 2).toFixed(2)} y ${((c + d) / 2).toFixed(2)}` +
    `  (offsets should be ~0)`,
);

// The design box must CONTAIN the swept extent or the diorama gets cropped.
// The headroom above that is margin for UnrealBloomPass, which samples with
// clamp-to-edge and smears a bright object near the border into a streak along
// it - so a sign that merely fits is not yet safe.
const fail = w > DESIGN_W || h > DESIGN_H;
console.log(
  fail
    ? "\nCROPPING - the scene no longer fits the design box, update config.js"
    : "\nok - the scene fits inside the design box",
);
process.exit(fail ? 1 : 0);
