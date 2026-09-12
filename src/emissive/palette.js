import * as THREE from "three";

/** Rec.709 luma of a LINEAR colour. Every brightness target here is one. */
const luma709 = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

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
 * The multipliers are solved against Rec.709 luma, not guessed, which is what
 * lets one bloom threshold separate the layers cleanly. Measured today, with
 * the bloom threshold at 0.58:
 *
 *                          cool    warm
 *     lit digit window     0.899   1.385   hero light
 *     brightest ambient    0.270   0.416   glows, never bleeds
 *     dimmest ambient      0.180   0.277
 *     brightest roof face  0.043           nowhere near it, and scales with
 *                                          AMBIENT_INTENSITY in config.js
 *
 * COOL AND WARM ARE NOT MATCHED, and that is the thing to know before touching
 * either. They were - both landed on 1.39 - until LIT_COOL was dimmed from 1.7
 * to 1.1 to take the digits down, and LIT_WARM was left where it was. So a warm
 * window is 1.54x a cool one at the same level, and the handful of warm ambient
 * windows are the brightest ordinary windows in the city by some margin. That
 * is the current intent, not an oversight; LIT_WARM = 1.59 would restore parity
 * if it ever stops being.
 *
 * The digits are no longer the brightest thing in the scene either - the AM/PM
 * sign's frame sits at 1.00 against their 0.899. README note 5 carries the full
 * ladder; re-measure it after changing anything here.
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
  // Solved, not picked: 0.31 luma on a +Z face under the night rig. White paint
  // at night is not white - see the note above BILLBOARD_EM in config.js.
  billboard: 0xbdb6a8,
  billboardInk: 0x15171c, // near black, but not a hole
  billboardFrame: 0x2f333d,
  shop: 0x232a39, // the surround, darker than the wall it sits on
  // Roller shutters are pale metal and read markedly lighter than the building
  // even unlit - which is the whole point, since a closed shop has nothing
  // else to say it is there.
  shutter: 0x6b7285,
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

/**
 * The instance LEVEL that puts a given hue on a target luma.
 *
 * The hues are not equally bright - TAILLIGHT carries a third of LIT_WARM's
 * luma - so asking for a level directly means a red sign and a white one at
 * "the same" level look nothing alike. Asking for a luma is asking for the
 * thing you actually care about. Clamped at 1, which is the brightest an
 * instance goes; a hue too dark to reach the target comes out dimmer rather
 * than wrong.
 */
export const levelFor = (hue, targetLuma) =>
  Math.min(1, targetLuma / luma709(HUES[hue]));

export const HUES = [
  LIT_COOL,
  LIT_WARM,
  LAMP,
  HEADLIGHT,
  TAILLIGHT,
  BEACON,
];
