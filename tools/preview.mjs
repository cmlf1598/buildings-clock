/**
 * Renders the scene to a PNG without a browser.
 *
 *     node tools/preview.mjs out.png [width] [height]
 *     T=23:59 node tools/preview.mjs out.png          # a different reading
 *     TGT=-4.5,7.5,-10.8 FH=8 node tools/preview.mjs out.png   # zoom in
 *     RT=3600 node tools/preview.mjs out.png          # the city an hour in
 *
 * TGT and FH move and tighten the camera for inspecting one detail. They do
 * NOT change the scene - the shipped framing is whatever config.js says, and
 * these only exist so a roofline can be looked at closely.
 *
 * A z-buffered software rasteriser over the real scene graph. It is not a
 * substitute for looking at the running app - it approximates the lighting and
 * fakes the bloom - but it answers the questions that are expensive to get
 * wrong and slow to check by hand: does a sign land where the layout table
 * says, does it overlap another one on screen, does a building occlude it,
 * does anything fall off the slab.
 *
 * Known difference: this shades FLAT, one value per triangle from its first
 * vertex. three's MeshLambertMaterial shades per fragment (the lighting
 * includes sit in meshlambert's fragment stage), so a point light close to a
 * large face - the billboard's floodlights, say - shows a hard diagonal seam
 * here and a smooth gradient in the browser. Judge falloff by the numbers, not
 * by this.
 *
 * Orthographic camera, so projection is just a scale of view-space x and y.
 */

import zlib from "node:zlib";
import fs from "node:fs";
import * as THREE from "three";
import {
  BASE_YAW,
  BASE_PITCH,
  CAM_DIST,
  CAM_TARGET,
  DESIGN_W,
  DESIGN_H,
  EXPOSURE,
  BLOOM_STRENGTH,
  BLOOM_THRESHOLD,
} from "../src/config.js";
import { createLights } from "../src/core/lights.js";
import { createGround } from "../src/world/ground.js";
import { createBuildings } from "../src/world/buildings.js";
import { createBillboard } from "../src/world/billboard.js";
import { createProps } from "../src/world/props.js";
import { NeonSign } from "../src/world/neonSign.js";
import { CitySigns } from "../src/world/citySigns.js";
import { NeonBezels } from "../src/world/neonBezel.js";
import { WindowField } from "../src/emissive/WindowField.js";
import { Animator } from "../src/emissive/animator.js";
import { RoomLife } from "../src/emissive/roomLife.js";
import { SecondTick } from "../src/emissive/secondTick.js";
import { TOWERS, DIGIT_SLOTS } from "../src/world/layout.js";
import { glyphFor } from "../src/time/clock.js";
import { GLYPH_W, GLYPH_H, COLON, COLON_W } from "../src/data/font5x7.js";

const OUT = process.argv[2] ?? "preview.png";
const W = Number(process.argv[3] ?? 1000);
const H = Number(process.argv[4] ?? 700);

const scene = new THREE.Scene();
createLights(scene);
createGround(scene);
createBuildings(scene);
createBillboard(scene);
createProps(scene);
const amPm = new NeonSign(scene);
amPm.setPM(false); // "am" lit, matching a fresh morning load
amPm.step(10); // settle the cross-fade instead of catching it mid-fade
new CitySigns(scene);
new NeonBezels(scene);
const field = new WindowField();
scene.add(field.mesh);

// Light a real reading, so the preview shows the brightness LADDER the whole
// palette is arranged around: digits over sign over ambient window. A preview
// with dark digits cannot tell you whether the signs are competing with them.
const animator = new Animator(field);
animator.applyGlyph(
  field.colonMap, COLON, new Uint8Array(COLON_W * GLYPH_H), 2, COLON_W,
);
const READING = (process.env.T ?? "10:37").split(":");
const hh = Number(READING[0]) % 12 || 12;
const digits = [
  hh >= 10 ? 1 : -1, hh % 10,
  Math.floor(Number(READING[1]) / 10), Number(READING[1]) % 10,
];
DIGIT_SLOTS.forEach((slot, i) => {
  animator.applyGlyph(
    field.digitMap[slot], glyphFor(digits[i]),
    new Uint8Array(GLYPH_W * GLYPH_H), TOWERS[slot].slot,
  );
});
// Fast-forward the room toggling, so a still can show the city some way into
// its own evening rather than only at t=0 where nothing has happened yet.
const rooms = new RoomLife(field, animator);
const secondTick = new SecondTick(field, animator);
const RT = Number(process.env.RT ?? 0);
if (RT > 0) {
  for (let t = 0; t <= RT; t += 1) {
    rooms.step(t);
    secondTick.step(t);
    animator.step(1); // a whole second per tick: every fade lands immediately
  }
  console.log(`room life advanced to t=${RT}s`);
}

animator.step(10); // run every fade straight to its endpoint
field.flush();
scene.updateMatrixWorld(true);

// --- camera ----------------------------------------------------------------
const target = new THREE.Vector3(
  ...(process.env.TGT ? process.env.TGT.split(",").map(Number) : CAM_TARGET),
);
const cam = new THREE.Camera();
const cp = Math.cos(BASE_PITCH);
cam.position.set(
  target.x + CAM_DIST * Math.sin(BASE_YAW) * cp,
  target.y + CAM_DIST * Math.sin(BASE_PITCH),
  target.z + CAM_DIST * Math.cos(BASE_YAW) * cp,
);
cam.lookAt(target);
cam.updateMatrixWorld(true);
const view = cam.matrixWorldInverse;

const aspect = W / H;
const fh = process.env.FH
  ? Number(process.env.FH)
  : Math.max(DESIGN_H, DESIGN_W / aspect);
const fw = fh * aspect;

// --- lighting ---------------------------------------------------------------
// Read off the real rig rather than restated here, so re-tinting a light in
// core/lights.js shows up in the preview instead of silently diverging.
let ambient = new THREE.Color(0, 0, 0);
const hemis = [];
const dirs = [];
const points = [];
scene.traverse((o) => {
  if (o.isAmbientLight) {
    ambient.add(o.color.clone().multiplyScalar(o.intensity));
  } else if (o.isHemisphereLight) {
    hemis.push({
      sky: o.color.clone().multiplyScalar(o.intensity),
      ground: o.groundColor.clone().multiplyScalar(o.intensity),
    });
  } else if (o.isDirectionalLight) {
    dirs.push({
      col: o.color.clone().multiplyScalar(o.intensity),
      dir: o.position.clone().normalize(),
    });
  } else if (o.isPointLight) {
    points.push({
      pos: o.position.clone(),
      col: o.color.clone().multiplyScalar(o.intensity),
      d: o.distance,
    });
  }
});
console.log(
  `lights: ${hemis.length} hemi, ${dirs.length} directional, ${points.length} point`,
);

const color = new Float32Array(W * H * 3);
const depth = new Float32Array(W * H).fill(Infinity);

const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
const nA = new THREE.Vector3();
const wp = new THREE.Vector3();
const nm = new THREE.Matrix3();

function tri(ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / area;
      const w1 = ((px - ax) * (cy - ay) - (py - ay) * (cx - ax)) / area;
      if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
      const z = az + w1 * (bz - az) + w0 * (cz - az);
      const i = y * W + x;
      if (z >= depth[i]) continue;
      depth[i] = z;
      color[i * 3] = r; color[i * 3 + 1] = g; color[i * 3 + 2] = b;
    }
  }
}

const toLight = new THREE.Vector3();

function shade(mat, n, worldPos, out) {
  if (mat.isMeshBasicMaterial) {
    out.copy(mat.color);
    return;
  }
  out.copy(ambient);
  const up = (n.y + 1) / 2;
  for (const h of hemis) {
    out.r += h.sky.r * up + h.ground.r * (1 - up);
    out.g += h.sky.g * up + h.ground.g * (1 - up);
    out.b += h.sky.b * up + h.ground.b * (1 - up);
  }
  for (const d of dirs) {
    const nd = Math.max(0, n.dot(d.dir));
    out.r += d.col.r * nd;
    out.g += d.col.g * nd;
    out.b += d.col.b * nd;
  }
  for (const p of points) {
    toLight.subVectors(p.pos, worldPos);
    const dist = toLight.length();
    if (dist >= p.d) continue;
    // three's physically-correct falloff: 1/d^2, windowed to zero at `distance`.
    const atten = (1 / Math.max(dist * dist, 0.01)) * (1 - dist / p.d) ** 2;
    const nl = Math.max(0, n.dot(toLight.divideScalar(dist)));
    out.r += p.col.r * atten * nl;
    out.g += p.col.g * atten * nl;
    out.b += p.col.b * atten * nl;
  }
  out.multiply(mat.color);
}

const lit = new THREE.Color();
const m4 = new THREE.Matrix4();

function drawGeometry(geo, matrix, mat, instColor) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const idx = geo.index;
  const n = idx ? idx.count : pos.count;
  nm.getNormalMatrix(matrix);

  for (let t = 0; t < n; t += 3) {
    const ia = idx ? idx.getX(t) : t;
    const ib = idx ? idx.getX(t + 1) : t + 1;
    const ic = idx ? idx.getX(t + 2) : t + 2;

    if (nrm) {
      nA.fromBufferAttribute(nrm, ia).applyMatrix3(nm).normalize();
    } else {
      nA.set(0, 1, 0);
    }
    wp.fromBufferAttribute(pos, ia).applyMatrix4(matrix);
    shade(mat, nA, wp, lit);
    if (instColor) lit.multiply(instColor);

    const pts = [];
    let behind = false;
    for (const i of [ia, ib, ic]) {
      const v = i === ia ? vA : i === ib ? vB : vC;
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix).applyMatrix4(view);
      if (v.z > -0.1) behind = true;
      pts.push([(v.x / fw + 0.5) * W, (0.5 - v.y / fh) * H, -v.z]);
    }
    if (behind) continue;
    tri(
      pts[0][0], pts[0][1], pts[0][2],
      pts[1][0], pts[1][1], pts[1][2],
      pts[2][0], pts[2][1], pts[2][2],
      lit.r, lit.g, lit.b,
    );
  }
}

const ic = new THREE.Color();
scene.traverse((o) => {
  if (!o.isMesh) return;
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  if (o.isInstancedMesh) {
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m4);
      m4.premultiply(o.matrixWorld);
      if (o.instanceColor) {
        ic.fromBufferAttribute(o.instanceColor, i);
        drawGeometry(o.geometry, m4, mat, ic);
      } else {
        drawGeometry(o.geometry, m4, mat, null);
      }
    }
  } else {
    drawGeometry(o.geometry, o.matrixWorld, mat, null);
  }
});

// --- cheap stand-in for UnrealBloomPass ------------------------------------
const bright = new Float32Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  const l =
    0.2126 * color[i * 3] + 0.7152 * color[i * 3 + 1] + 0.0722 * color[i * 3 + 2];
  if (l <= BLOOM_THRESHOLD) continue;
  const k = (l - BLOOM_THRESHOLD) / l;
  for (let c = 0; c < 3; c++) bright[i * 3 + c] = color[i * 3 + c] * k;
}
for (let pass = 0; pass < 3; pass++) {
  const tmp = new Float32Array(bright.length);
  const R = 3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0, n = 0;
        for (let d = -R; d <= R; d++) {
          const xx = x + d;
          if (xx < 0 || xx >= W) continue;
          s += bright[(y * W + xx) * 3 + c]; n++;
        }
        tmp[(y * W + x) * 3 + c] = s / n;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0, n = 0;
        for (let d = -R; d <= R; d++) {
          const yy = y + d;
          if (yy < 0 || yy >= H) continue;
          s += tmp[(yy * W + x) * 3 + c]; n++;
        }
        bright[(y * W + x) * 3 + c] = s / n;
      }
}

// ACES approximation, the same curve OutputPass applies.
const aces = (v) => {
  v *= EXPOSURE;
  return Math.max(0, Math.min(1, (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14)));
};

const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  for (let x = 0; x < W; x++)
    for (let c = 0; c < 3; c++) {
      const i = (y * W + x) * 3 + c;
      const v = aces(color[i] + bright[i] * BLOOM_STRENGTH * 3);
      raw[y * (W * 3 + 1) + 1 + x * 3 + c] = Math.round(v ** (1 / 2.2) * 255);
    }
}

// --- PNG --------------------------------------------------------------------
const table = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[n] = c;
}
const crc = (b) => {
  let c = -1;
  for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
fs.writeFileSync(
  OUT,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
console.log(`${W}x${H} -> ${OUT}`);
