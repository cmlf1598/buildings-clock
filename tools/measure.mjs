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
import { createBillboard } from "../src/world/billboard.js";
import { createShops } from "../src/world/shops.js";
import { createProps } from "../src/world/props.js";
import { Traffic } from "../src/world/traffic.js";
import { NeonSign } from "../src/world/neonSign.js";
import { CitySigns } from "../src/world/citySigns.js";
import { CITY_SIGNS, BEZELS, BILLBOARD } from "../src/world/layout.js";
import { NeonBezels } from "../src/world/neonBezel.js";
import { WindowField } from "../src/emissive/WindowField.js";

const DEG = 180 / Math.PI;

const scene = new THREE.Scene();
createGround(scene);
createBuildings(scene);
const billboard = createBillboard(scene);
createShops(scene);
createProps(scene);
const traffic = new Traffic(scene);
new NeonSign(scene);
const citySigns = new CitySigns(scene);
const bezels = new NeonBezels(scene);
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
const offX = (a + b) / 2;
const offY = (c + d) / 2;
console.log(
  `\nat base angles        w ${(b - a).toFixed(2)}  h ${(d - c).toFixed(2)}` +
    `   centring offset x ${offX.toFixed(2)} y ${offY.toFixed(2)}`,
);

// Solve the correction rather than just reporting the error. The offset is in
// VIEW space, so it comes back to world space along the camera's own right and
// up axes - which is why this works at any yaw and pitch with no special case.
if (Math.abs(offX) > 0.02 || Math.abs(offY) > 0.02) {
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  const fixed = target
    .clone()
    .addScaledVector(right, offX)
    .addScaledVector(up, offY);
  console.log(
    `off centre - CAM_TARGET should be ` +
      `[${fixed.x.toFixed(2)}, ${fixed.y.toFixed(2)}, ${fixed.z.toFixed(2)}]`,
  );
} else {
  console.log("centred");
}

// ---------------------------------------------------------------------------
// Sign and bezel layout
//
// The invariant the placement table is actually solved against: no two lit
// objects may overlap on screen. Screen position is a SHEAR of world position
// and the shear is easy to get backwards by hand, so it is measured here
// rather than reasoned about in a comment.
// ---------------------------------------------------------------------------

const lit = [
  ...citySigns.signs.map((s, i) => [CITY_SIGNS[i].word, s.group, CITY_SIGNS[i].host]),
  ...bezels.bezels.map((b, i) => [`bezel ${BEZELS[i].host}`, b.mesh, BEZELS[i].host]),
  // The painted board is not emissive, but it is the brightest surface in the
  // city and collides with a neon sign just as badly.
  ["billboard", billboard.group, BILLBOARD.host],
];

/**
 * Screen footprint of one object: its projected vertices, reduced to a convex
 * hull.
 *
 * An axis-aligned box is not good enough here. A pyramid bezel's screen box is
 * mostly the empty triangle corners, so box-against-box reported it colliding
 * with a sign it visibly clears - and a collision test that cries wolf is one
 * that gets ignored. Hulls are tight enough to be believed.
 */
function footprint(obj) {
  const pts = [];
  const p = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const attr = o.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      p.fromBufferAttribute(attr, i)
        .applyMatrix4(o.matrixWorld)
        .applyMatrix4(cam.matrixWorldInverse);
      pts.push([p.x, p.y]);
    }
  });
  return hull(pts);
}

/** Andrew's monotone chain. */
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (src) => {
    const out = [];
    for (const q of src) {
      while (out.length >= 2 && cross(out.at(-2), out.at(-1), q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half([...p].reverse())];
}

/** Separating-axis test on two convex polygons. */
function overlaps(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const q = poly[(i + 1) % poly.length];
      const ax = -(q[1] - poly[i][1]);
      const ay = q[0] - poly[i][0];
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const [x, y] of a) {
        const d = x * ax + y * ay;
        aMin = Math.min(aMin, d); aMax = Math.max(aMax, d);
      }
      for (const [x, y] of b) {
        const d = x * ax + y * ay;
        bMin = Math.min(bMin, d); bMax = Math.max(bMax, d);
      }
      if (aMax <= bMin || bMax <= aMin) return false;
    }
  }
  return true;
}

const boxes = lit.map(([name, obj, host]) => {
  const poly = footprint(obj);
  return {
    name,
    host,
    poly,
    x0: Math.min(...poly.map((q) => q[0])),
    x1: Math.max(...poly.map((q) => q[0])),
    y0: Math.min(...poly.map((q) => q[1])),
    y1: Math.max(...poly.map((q) => q[1])),
  };
});

console.log("\nlit objects, on screen (world units from frame centre):");
for (const b of [...boxes].sort((p, q) => p.x0 - q.x0)) {
  console.log(
    `  ${b.name.padEnd(12)} x [${b.x0.toFixed(2).padStart(6)},` +
      `${b.x1.toFixed(2).padStart(6)}]   y [${b.y0.toFixed(2).padStart(6)},` +
      `${b.y1.toFixed(2).padStart(6)}]`,
  );
}

const clashes = [];
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const p = boxes[i], q = boxes[j];
    // A sign STANDING on a bezelled building shares its footprint with the
    // bezel by construction. That is the design, not a collision.
    if (p.host && p.host === q.host) continue;
    if (overlaps(p.poly, q.poly)) clashes.push(`${p.name} / ${q.name}`);
  }
}
console.log(
  clashes.length
    ? `\nOVERLAPPING ON SCREEN:\n  ${clashes.join("\n  ")}`
    : "\nno two lit objects overlap on screen",
);

// The design box must CONTAIN the swept extent or the diorama gets cropped.
// The headroom above that is margin for UnrealBloomPass, which samples with
// clamp-to-edge and smears a bright object near the border into a streak along
// it - so a sign that merely fits is not yet safe.
const cropping = w > DESIGN_W || h > DESIGN_H;
console.log(
  cropping
    ? "\nCROPPING - the scene no longer fits the design box, update config.js"
    : "\nok - the scene fits inside the design box",
);
process.exit(cropping || clashes.length ? 1 : 0);
