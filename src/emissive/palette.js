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
 *     brightest roof face   0.04   nowhere near it, and scales with
 *                                   AMBIENT_INTENSITY in config.js
 *
 * Getting this wrong is the single most likely way to wreck the look: with
 * the first pass every lit window sat at luma 2.13 — ambient windows exactly
 * as bright as the digits — and the whole skyline bloomed into white mush.
 */

export const LIT_COOL = new THREE.Color(0xdfeaff).multiplyScalar(1.1);
export const LIT_WARM = new THREE.Color(0xffb85c).multiplyScalar(2.46);
export const OFF = new THREE.Color(0x0a1420).multiplyScalar(1.6);

// ---------------------------------------------------------------------------
// Neon
//
// Every neon colour in the scene goes through neon(hex, targetLuma). The
// multipliers used to be hand-solved literals; they are now the OUTPUT of
// that solve, which means the target luma - the number that actually governs
// how the thing reads against the bloom threshold - is the number in the
// source. Re-hueing is then safe by construction: change the hex, keep the
// target, and the new colour lands at the same brightness as the old one.
//
// The peak cap is the second half of that safety. ACES shifts a saturated
// colour toward orange once its brightest CHANNEL passes ~1.0, and a hue with
// little blue in it (a pure red, say) carries so little Rec.709 luma that
// hitting a luma target sends its red channel far past that point - which is
// how an earlier pure-red sign rendered visibly orange. Capping the peak
// channel makes that impossible; a hue too dark to reach its target under the
// cap simply comes out dimmer, which is the honest answer rather than the
// wrong hue.
// ---------------------------------------------------------------------------

const luma709 = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** Highest any single channel may reach. Above this ACES starts eating hue. */
export const NEON_PEAK = 1.7;

export function neon(hex, targetLuma) {
  const c = new THREE.Color(hex); // sRGB -> linear, which is what we scale in
  const byLuma = targetLuma / luma709(c);
  const byPeak = NEON_PEAK / Math.max(c.r, c.g, c.b);
  return c.multiplyScalar(Math.min(byLuma, byPeak));
}

// The AM/PM sign. Named for ROLE, not hue, so a palette change does not leave
// the constants lying about what colour they are. The frame sits just above
// the 0.58 bloom threshold and the letters just under it, so the frame is what
// actually blooms and the letters stay crisp inside it.
//
// The unlit box keeps just enough level that the letterform still reads as
// unlit glass rather than vanishing.
export const SIGN_FRAME = neon(0x2ff0ff, 1.0);
export const SIGN_LETTER = neon(0xff3fa0, 0.46);
export const SIGN_DIM = {
  frame: neon(0x2ff0ff, 0.07),
  letter: neon(0xff3fa0, 0.044),
};

// ---------------------------------------------------------------------------
// City signs (the kanji ones)
//
// These are SCENERY, not readout, so every one of them is solved below the
// AM/PM sign, which is in turn below the digits. The ladder is the whole
// point: digits 1.39, AM/PM frame 1.00, near city sign 0.72, far city sign
// 0.60, sign frame 0.46. Raise these and the skyline starts competing with
// the clock for the eye, which is the exact failure mode note 5 describes.
//
// NEAR and FAR are aerial perspective, not decoration: the back row of signs
// is ~10 units further into the scene and reads wrong if it is as hot as the
// ones on the clock towers.
// ---------------------------------------------------------------------------

export const CITY_HUE = {
  amber: 0xffb347,
  teal: 0x5fe0d4, // the castle's roof tiles, straight off the reference
  magenta: 0xff8fd0,
  cyan: 0x4fe3ff,
  violet: 0xc9a6ff,
  jade: 0x5cffb8,
};

// A bezel is metres of continuous tube rather than a few short strokes, so it
// puts far more lit area on screen for the same luma. It is solved BELOW the
// far signs for that reason: matched by luma it would out-glow them badly.
export const CITY_BEZEL_LUMA = 0.5;

export const CITY_INK_NEAR = 0.72;
export const CITY_INK_FAR = 0.6;
export const CITY_FRAME_LUMA = 0.46;

// Darker than MAT.panel: a kanji is a dense tangle of strokes and needs more
// separation behind it than two script letters do.
export const CITY_PANEL = 0x141820;

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
