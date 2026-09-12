import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { neon, CITY_HUE, CITY_BEZEL_LUMA } from "../emissive/palette.js";
import { breathe, lifeFor } from "../emissive/neonLife.js";
import { BEZELS, BUILDINGS, coneRoof } from "./layout.js";
import { tubeFrom } from "./tube.js";
import { BEZEL_TUBE, BEZEL_LIFT, PARAPET_T } from "../config.js";

/**
 * Neon run along a building's own edges.
 *
 * This is the AM/PM sign's tube frame, scaled up and wrapped around the
 * architecture instead of around a panel - which is what a Tokyo block actually
 * does after dark, and the reason the effect transplants so cleanly: it is the
 * same mechanism, the same palette and the same `tubeFrom` as every other lit
 * thing in the scene.
 *
 * Two kinds. A "box" bezel traces the roofline and the vertical corners of an
 * ordinary building. A "pyramid" bezel traces the base square and the four hip
 * edges of a cone roof - derived from the same CONE_ROOF entry the solid is
 * built from, so the tube is drawing the roof that is really there rather than
 * an artist's impression of it.
 *
 * All of one bezel's tubes merge into a single geometry, so a bezel is one
 * mesh and one draw call.
 */

/**
 * Roofline loop plus the four vertical corners, lifted clear of the wall.
 *
 * BEZEL_LIFT matters: a tube whose centreline sits exactly on the corner is
 * half buried in two walls at once, and the buried half z-fights along its
 * whole length. Pushing the line outward along the corner's diagonal puts the
 * entire tube in open air.
 */
function boxLines(b) {
  const hw = b.W / 2 + BEZEL_LIFT;
  const hd = b.D / 2 + BEZEL_LIFT;
  const top = b.H + PARAPET_T + BEZEL_LIFT;
  const corners = [
    [hw, hd],
    [-hw, hd],
    [-hw, -hd],
    [hw, -hd],
  ];

  const lines = [
    {
      points: corners.map(
        ([dx, dz]) => new THREE.Vector3(b.x + dx, top, b.z + dz),
      ),
      closed: true,
    },
  ];
  for (const [dx, dz] of corners) {
    lines.push({
      points: [
        new THREE.Vector3(b.x + dx, top, b.z + dz),
        new THREE.Vector3(b.x + dx, 0, b.z + dz),
      ],
      closed: false,
    });
  }
  return lines;
}

/**
 * Base square and the four edges running up to the apex.
 *
 * Everything is pushed outward from the roof's axis by the tube radius plus a
 * margin, and the apex is pushed up by the same. The hip edges lie exactly ON
 * the cone surface otherwise, and the solid would win the depth test along
 * their whole length.
 */
function pyramidLines(b) {
  const cone = coneRoof(b);
  if (!cone) {
    throw new Error(
      `neonBezel: "${b.id}" has roof "${b.roof}", which is not a cone`,
    );
  }
  const lift = BEZEL_TUBE + BEZEL_LIFT;
  const h = cone.half + lift;
  const apex = new THREE.Vector3(b.x, cone.apexY + lift, b.z);
  const corners = [
    [h, h],
    [-h, h],
    [-h, -h],
    [h, -h],
  ].map(([dx, dz]) => new THREE.Vector3(b.x + dx, cone.baseY, b.z + dz));

  return [
    { points: corners, closed: true },
    ...corners.map((c) => ({ points: [c, apex], closed: false })),
  ];
}

class Bezel {
  constructor(spec, index) {
    const host = BUILDINGS[spec.host];
    if (!host) throw new Error(`neonBezel: unknown host "${spec.host}"`);

    const lines =
      spec.kind === "pyramid" ? pyramidLines(host) : boxLines(host);

    // One segment per ~0.12 world units: enough that the eave's parabola and
    // the hips' dish read as curves rather than as chords, and no more.
    const parts = lines.map(({ points, closed }) =>
      tubeFrom(points, closed, BEZEL_TUBE, 1, Math.max(8, points.length)),
    );
    const geometry = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();

    this.base = neon(CITY_HUE[spec.hue], CITY_BEZEL_LUMA);
    this.material = new THREE.MeshBasicMaterial({ color: this.base });
    this.mesh = new THREE.Mesh(geometry, this.material);

    // Offset from the signs' seeds so a bezel never breathes in lockstep with
    // the sign standing on the same roof.
    Object.assign(this, lifeFor(index + 31));
    this.level = 1;
  }

  step(t) {
    const level = breathe(t, this.period, this.phase);
    if (Math.abs(level - this.level) < 0.002) return;
    this.level = level;
    this.material.color.copy(this.base).multiplyScalar(level);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

export class NeonBezels {
  constructor(scene) {
    const group = new THREE.Group();
    this.bezels = BEZELS.map((spec, i) => {
      const b = new Bezel(spec, i);
      group.add(b.mesh);
      return b;
    });
    scene.add(group);
    this.group = group;
  }

  step(t) {
    for (const b of this.bezels) b.step(t);
  }

  dispose() {
    for (const b of this.bezels) b.dispose();
  }
}

for (const spec of BEZELS) {
  if (!CITY_HUE[spec.hue]) {
    throw new Error(`neonBezel: "${spec.host}" has unknown hue "${spec.hue}"`);
  }
}
