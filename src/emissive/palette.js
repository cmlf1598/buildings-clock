import * as THREE from "three";

/**
 * Every colour here is LINEAR and deliberately HDR.
 *
 * InstancedMesh.setColorAt does no colour conversion — it is a plain
 * color.toArray() into the buffer — and the shader multiplies the diffuse in
 * linear working space, unclamped. So:
 *
 *   - setHex() converts sRGB -> linear for us. Good.
 *   - multiplyScalar() then scales in LINEAR space, which is the physically
 *     correct place to do it.
 *   - setRGB(r, g, b, SRGBColorSpace) with a value above 1.0 is WRONG: that
 *     transfer curve is only meaningful on [0, 1] and would turn 2.6 into
 *     roughly 9.6.
 *
 * Values above 1.0 survive because the composer's render target is
 * HalfFloatType. ACES in OutputPass then rolls them off into a warm-cored,
 * slightly desaturated highlight — which is exactly what makes the bloom
 * threshold a meaningful separator instead of a hard cutoff.
 *
 * The multipliers are SOLVED, not guessed: each is chosen so the resulting
 * Rec.709 luma lands on a target, which is what makes one bloom threshold
 * separate the layers cleanly.
 *
 *     lit digit window      1.39   hero light, blooms strongly
 *     brightest ambient     0.56   grazes the threshold, soft halo only
 *     dimmest ambient       0.28   glows, never bleeds
 *     brightest roof face  ~0.06   nowhere near it
 *
 * Getting this wrong is the single most likely way to wreck the look: with
 * the first pass every lit window sat at luma 2.13 — ambient windows exactly
 * as bright as the digits — and the whole skyline bloomed into white mush.
 */

export const LIT_COOL = new THREE.Color(0xdfeaff).multiplyScalar(1.7);
export const LIT_WARM = new THREE.Color(0xffb85c).multiplyScalar(2.46);
export const OFF = new THREE.Color(0x0a1420).multiplyScalar(1.6);

// Neon sign. Green tube frame, red script letters - the unlit box keeps just
// enough level that the letterform still reads as glass rather than vanishing.
//
// The red is deliberately pushed toward magenta (0xff0048, not a pure red).
// ACES shifts saturated bright reds toward orange, so a "correct" red hue
// renders as orange once the tube core goes above 1.0. Biasing the input
// toward magenta lands it back on crimson. Any pure red is also intrinsically
// low-luma (Rec.709 weights it 0.2126), which is why the multiplier has to be
// this high to clear the bloom threshold at all.
export const SIGN_GREEN = new THREE.Color(0x3bff7a).multiplyScalar(1.35);
export const SIGN_RED = new THREE.Color(0xff0048).multiplyScalar(2.1);
export const SIGN_DIM = {
  green: new THREE.Color(0x3bff7a).multiplyScalar(0.1),
  red: new THREE.Color(0xff0048).multiplyScalar(0.16),
};

export const LAMP = new THREE.Color(0xffd9a0).multiplyScalar(1.09);
export const HEADLIGHT = new THREE.Color(0xfff0d0).multiplyScalar(0.85);
export const TAILLIGHT = new THREE.Color(0xff3a2a).multiplyScalar(1.84);
export const BEACON = new THREE.Color(0xff4444).multiplyScalar(4.26);

// Body materials. Mid-dark albedo, not near-black — see lights.js.
export const MAT = {
  body: 0x2b3242,
  roof: 0x39415a,
  slab: 0x333c52,
  slabSide: 0x2a3145,
  road: 0x151a25,
  panel: 0x1a1d24,
  prop: 0x2a3143,
};

/**
 * Hue slots. WindowField indexes straight into HUES with a Uint8Array, so a
 * per-instance colour choice costs one byte and no branching beyond a lookup.
 */
export const HUE_COOL = 0;
export const HUE_WARM = 1;
export const HUE_LAMP = 2;
export const HUE_HEAD = 3;
export const HUE_TAIL = 4;
export const HUE_BEACON = 5;

export const HUES = [
  LIT_COOL,
  LIT_WARM,
  LAMP,
  HEADLIGHT,
  TAILLIGHT,
  BEACON,
];
