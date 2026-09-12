import * as THREE from "three";
import {
  CASTLE_TIERS,
  CASTLE_SHRINK,
  CASTLE_EAVE_OVER,
  CASTLE_RISE,
  CASTLE_DRUM,
  CASTLE_RIDGE,
  CASTLE_FLICK,
  CASTLE_FLICK_POW,
  CASTLE_CONCAVE,
  CASTLE_RINGS,
  CASTLE_SAMPLES,
  EAVE_GLOW_DROP,
  EAVE_GLOW_REACH,
} from "../config.js";

/**
 * A tenshu-style tiered castle roof, generated from its host building.
 *
 * It was briefly wearing a neon bezel too, and that is why the shape is
 * generated rather than modelled - but the tube lost that argument. A tenshu is
 * mostly SURFACE, and outlining every eave, ridge and hip put so much light on
 * the silhouette that the solid underneath stopped reading at all. The roof is
 * better as a dark shape against the sky; the tube moved to a pyramid, which is
 * four straight edges to a point and has nothing to lose by being drawn.
 *
 * The form, in the order it matters:
 *
 * 1. THE EAVE LINE. Along each side it dips at the middle and lifts at the two
 *    corners, on a parabola. This is the single most recognisable thing about
 *    the shape and the reason a straight-eaved hip roof never reads as
 *    Japanese no matter how many tiers you stack.
 *
 * 2. THE CONCAVE SECTION. The roof surface rises slowly off the eave and
 *    steeply into the ridge (CASTLE_CONCAVE > 1), so it is dished rather than
 *    flat. This is what flares the eave outward.
 *
 * 3. THE TIERS. Each storey is CASTLE_SHRINK of the one below and carries its
 *    own roof, so the silhouette steps inward as it climbs.
 *
 * Everything is a ratio of the storey it sits on, so the roof scales with
 * whatever building it is put on and the tiers stay in proportion.
 */

/** Eave-to-ridge height profile. Above 1 the surface dishes; at 1 it is flat. */
const profile = (t) => t ** CASTLE_CONCAVE;

/**
 * Resolves the tier stack for a host building.
 *
 * Each tier carries the storey it sits on (sw/sd), the eave it throws (ew/ed,
 * overhanging the storey), how far it rises to the ridge, and how much the
 * corners lift.
 */
export function castleTiers(host) {
  const tiers = [];
  let sw = host.W / 2;
  let sd = host.D / 2;
  let y = host.H;

  for (let i = 0; i < CASTLE_TIERS; i++) {
    const ew = sw * CASTLE_EAVE_OVER;
    const ed = sd * CASTLE_EAVE_OVER;
    const rise = ew * CASTLE_RISE;
    const nextW = sw * CASTLE_SHRINK;

    tiers.push({
      y, // eave height
      sw,
      sd,
      ew,
      ed,
      rise,
      rw: ew * CASTLE_RIDGE, // ridge half-length, along x
      flick: ew * CASTLE_FLICK,
    });

    // The next storey's floor sits at this ridge; its walls rise from there.
    y += rise + nextW * CASTLE_DRUM;
    sw = nextW;
    sd *= CASTLE_SHRINK;
  }
  return tiers;
}

/** Total height of the stack above ground, for bounds checks. */
export const castleTop = (host) => {
  const t = castleTiers(host).at(-1);
  return t.y + t.rise;
};

/**
 * One horizontal ring of the roof surface, from eave (t=0) to ridge (t=1).
 *
 * The ring walks the four sides in order, sampling each. At t=1 the depth has
 * collapsed to zero and every point lands on the ridge line, which is what
 * makes this a hip roof: the two short sides become triangles on their own.
 */
function ring(tier, t, cx, cz) {
  const w = THREE.MathUtils.lerp(tier.ew, tier.rw, t);
  const d = THREE.MathUtils.lerp(tier.ed, 0, t);
  const y = tier.y + tier.rise * profile(t);
  // The corner lift fades out as the ring climbs - a ridge has no corners.
  const flick = tier.flick * (1 - t);

  const corners = [
    [w, d],
    [-w, d],
    [-w, -d],
    [w, -d],
  ];
  const pts = [];
  for (let c = 0; c < 4; c++) {
    const [ax, az] = corners[c];
    const [bx, bz] = corners[(c + 1) % 4];
    for (let k = 0; k < CASTLE_SAMPLES; k++) {
      const s = k / CASTLE_SAMPLES;
      // 1 at both corners, 0 at the middle of the side, and - at a power above
      // 2 - flat across most of the span so the turn happens near the corner.
      const lift = Math.abs(2 * s - 1) ** CASTLE_FLICK_POW;
      pts.push(
        new THREE.Vector3(
          cx + ax + (bx - ax) * s,
          y + flick * lift,
          cz + az + (bz - az) * s,
        ),
      );
    }
  }
  return pts;
}

/**
 * Where to stand the practicals that light this roof stack.
 *
 * One per tier ABOVE the bottom, because a light only earns its place if there
 * is a roof under it to catch it - a source at the bottom eave would hang
 * against the host building's wall and light nothing the camera reads as roof.
 *
 * Each sits just beneath its tier's eave, which puts it above the whole of the
 * roof below, and is offset toward the two VISIBLE eaves rather than sitting on
 * the building's axis. A central light would rake the ridge and leave the near
 * eaves dark, which is backwards - the light is meant to be coming from under
 * the eave, not from inside the building.
 */
export function castleEaveGlows(host) {
  return castleTiers(host)
    .slice(1)
    .map((tier) => ({
      x: host.x + tier.ew * 0.45,
      y: tier.y - EAVE_GLOW_DROP,
      z: host.z + tier.ed * 0.45,
      range: tier.ew * EAVE_GLOW_REACH,
    }));
}

/**
 * The solid: each roof lofted between rings, plus the storey walls that hold
 * the upper tiers up.
 *
 * Degenerate quads are dropped rather than emitted. The top ring collapses
 * onto the ridge line, so without that check the two short sides would each
 * contribute a strip of zero-area triangles - which computeVertexNormals then
 * turns into NaN normals and a black roof.
 */
export function castleSolid(host) {
  const position = [];
  const index = [];
  const per = CASTLE_SAMPLES * 4;

  for (const tier of castleTiers(host)) {
    const base = position.length / 3;
    for (let r = 0; r <= CASTLE_RINGS; r++) {
      for (const p of ring(tier, r / CASTLE_RINGS, host.x, host.z)) {
        position.push(p.x, p.y, p.z);
      }
    }
    for (let r = 0; r < CASTLE_RINGS; r++) {
      for (let k = 0; k < per; k++) {
        const a = base + r * per + k;
        const b = base + r * per + ((k + 1) % per);
        const c = a + per;
        const d = b + per;
        const va = new THREE.Vector3().fromArray(position, a * 3);
        const vb = new THREE.Vector3().fromArray(position, b * 3);
        const vc = new THREE.Vector3().fromArray(position, c * 3);
        const vd = new THREE.Vector3().fromArray(position, d * 3);
        if (va.distanceToSquared(vb) > 1e-8 && vc.distanceToSquared(va) > 1e-8) {
          index.push(a, c, b);
        }
        if (vd.distanceToSquared(vc) > 1e-8 && vb.distanceToSquared(vd) > 1e-8) {
          index.push(b, c, d);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Storey walls between the tiers, as boxes for buildings.js to place. */
export function castleWalls(host) {
  const tiers = castleTiers(host);
  const walls = [];
  for (let i = 1; i < tiers.length; i++) {
    const t = tiers[i];
    // Start inside the roof below, so the junction has nothing to z-fight.
    const y0 = tiers[i - 1].y + tiers[i - 1].rise * 0.25;
    walls.push({
      x: host.x,
      y: (y0 + t.y) / 2,
      z: host.z,
      w: t.sw * 2,
      h: t.y - y0,
      d: t.sd * 2,
    });
  }
  return walls;
}
