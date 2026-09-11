/**
 * Builds the flat instance list for WindowField, plus the lookup tables that
 * make applying a glyph a straight 35-iteration loop with no searching.
 *
 * Traversal order is fixed and deterministic — towers front-then-side, then
 * fillers, then sign, then props — because the seeded generator is consumed in
 * exactly this order. That is what makes the city identical on every reload.
 *
 * Brightness model: `current` is a plain multiplier on the LIT colour, so a
 * window's "gain" and its animation value are the same number. No separate
 * gain channel to keep in sync.
 *     lit digit   -> 1.0
 *     ambient     -> 0.5 .. 1.0
 *     dark        -> 0.0
 */

import {
  ROW_MIN,
  WIN_W,
  WIN_H,
  FACE_OFFSET,
  AMBIENT_DENSITY,
  AMBIENT_GAIN_MIN,
  AMBIENT_GAIN_MAX,
  AMBIENT_WARM_CHANCE,
  DIGIT_ROW_TOP,
  SIGN_X,
  SIGN_Z,
  SIGN_D,
  SIGN_DOT_PITCH_X,
  SIGN_DOT_PITCH_Y,
  SIGN_DOT_SIZE,
  SIGN_LETTER_TOPS,
  SIGN_GAIN_OFF,
  SEED,
} from "../config.js";
import {
  TOWERS,
  FILLERS,
  LAMPS,
  CARS,
  CAR_W,
  CAR_H,
  CAR_D,
  LAMP_HEIGHT,
  ROLE_COLON,
  rowY,
  colOffset,
  isSeparatorRow,
  isDigitRow,
  KIND_DIGIT,
  KIND_AMBIENT,
  KIND_SIGN,
  KIND_PROP,
} from "../world/layout.js";
import { GLYPHS, GLYPH_W, GLYPH_H, COLON_W } from "../data/font5x7.js";
import { mulberry32 } from "../util/rng.js";
import {
  HUE_COOL,
  HUE_WARM,
  HUE_LAMP,
  HUE_HEAD,
  HUE_TAIL,
  HUE_BEACON,
} from "./palette.js";

export function buildWindowLayout() {
  const rng = mulberry32(SEED);

  const items = []; // { x, y, z, rotY, w, h, kind, hue, base, start }
  const digitMap = {}; // tower slot -> Int32Array(GLYPH_W * GLYPH_H)
  let colonMap = null;
  const signLetters = []; // 4 x Int32Array of lit-cell instance indices
  const beacons = [];

  const push = (o) => {
    items.push(o);
    return items.length - 1;
  };

  /** One ambient draw: returns [level, hue], level 0 when the room is dark. */
  const ambientRoll = () => {
    const on = rng() < AMBIENT_DENSITY;
    const level = on
      ? AMBIENT_GAIN_MIN + rng() * (AMBIENT_GAIN_MAX - AMBIENT_GAIN_MIN)
      : 0;
    const hue = rng() < AMBIENT_WARM_CHANCE ? HUE_WARM : HUE_COOL;
    return [level, hue];
  };

  const addFace = (b, face, cols, onCell) => {
    for (let r = ROW_MIN; r <= b.rMax; r++) {
      for (let c = 0; c < cols; c++) {
        const isFront = face === "front";
        const x = isFront
          ? b.x + colOffset(c, cols)
          : b.x + b.W / 2 + FACE_OFFSET;
        const z = isFront
          ? b.z + b.D / 2 + FACE_OFFSET
          : b.z + colOffset(c, cols);
        onCell(r, c, {
          x,
          y: rowY(r),
          z,
          rotY: isFront ? 0 : Math.PI / 2,
          w: WIN_W,
          h: WIN_H,
        });
      }
    }
  };

  // -- Clock towers ---------------------------------------------------------
  for (const t of TOWERS) {
    const isColon = t.role === ROLE_COLON;
    const bandCols = isColon ? COLON_W : GLYPH_W;
    const map = new Int32Array(bandCols * GLYPH_H).fill(-1);

    addFace(t, "front", t.frontCols, (r, c, p) => {
      const inBand = isDigitRow(r) && c < bandCols;

      if (inBand) {
        // Tower 0 shows no digit for hours 1-9, so its band cells carry an
        // ambient level to fall back to. Same density as everywhere else —
        // special-casing it would read as a suspicious rectangle.
        const [level, hue] = t.slot === 0 ? ambientRoll() : [0, HUE_COOL];
        const i = push({
          ...p,
          kind: KIND_DIGIT,
          hue: t.slot === 0 ? hue : HUE_COOL,
          base: level,
          start: level,
        });
        map[(DIGIT_ROW_TOP - r) * bandCols + c] = i;
        return;
      }

      if (isSeparatorRow(r)) {
        // Letterboxes the glyph away from the ambient windows above and below.
        push({ ...p, kind: KIND_AMBIENT, hue: HUE_COOL, base: 0, start: 0 });
        return;
      }

      const [level, hue] = ambientRoll();
      push({ ...p, kind: KIND_AMBIENT, hue, base: level, start: level });
    });

    addFace(t, "side", t.sideCols, (r, c, p) => {
      const [level, hue] = ambientRoll();
      push({ ...p, kind: KIND_AMBIENT, hue, base: level, start: level });
    });

    if (isColon) colonMap = map;
    else digitMap[t.slot] = map;
  }

  // -- Filler buildings -----------------------------------------------------
  for (const f of FILLERS) {
    addFace(f, "front", f.frontCols, (r, c, p) => {
      const [level, hue] = ambientRoll();
      push({ ...p, kind: KIND_AMBIENT, hue, base: level, start: level });
    });
    addFace(f, "side", f.sideCols, (r, c, p) => {
      const [level, hue] = ambientRoll();
      push({ ...p, kind: KIND_AMBIENT, hue, base: level, start: level });
    });
    if (f.antenna) {
      beacons.push(
        push({
          x: f.x,
          y: f.H + 1.5,
          z: f.z,
          rotY: 0,
          w: 0.1,
          h: 0.1,
          kind: KIND_PROP,
          hue: HUE_BEACON,
          base: 0,
          start: 0,
        }),
      );
    }
  }

  // -- Blade sign -----------------------------------------------------------
  const letters = ["A", "M", "P", "M"];
  for (let li = 0; li < letters.length; li++) {
    const glyph = GLYPHS[letters[li]];
    const top = SIGN_LETTER_TOPS[li];
    const lit = [];
    for (let r = 0; r < GLYPH_H; r++) {
      for (let c = 0; c < GLYPH_W; c++) {
        if (!glyph[r * GLYPH_W + c]) continue;
        lit.push(
          push({
            x: SIGN_X + (c - (GLYPH_W - 1) / 2) * SIGN_DOT_PITCH_X,
            y: top - r * SIGN_DOT_PITCH_Y,
            z: SIGN_Z + SIGN_D / 2 + 0.008,
            rotY: 0,
            w: SIGN_DOT_SIZE,
            h: SIGN_DOT_SIZE,
            kind: KIND_SIGN,
            hue: HUE_WARM,
            base: SIGN_GAIN_OFF,
            start: SIGN_GAIN_OFF,
          }),
        );
      }
    }
    signLetters.push(Int32Array.from(lit));
  }

  // -- Props ----------------------------------------------------------------
  for (const l of LAMPS) {
    push({
      x: l.x,
      y: LAMP_HEIGHT,
      z: l.z,
      rotY: 0,
      w: 0.13,
      h: 0.13,
      kind: KIND_PROP,
      hue: HUE_LAMP,
      base: 1.0,
      start: 1.0,
    });
  }

  for (const car of CARS) {
    const zFace = car.z + CAR_D / 2 + 0.01;
    push({
      x: car.x + car.dir * (CAR_W / 2 - 0.1),
      y: CAR_H * 0.62,
      z: zFace,
      rotY: 0,
      w: 0.09,
      h: 0.07,
      kind: KIND_PROP,
      hue: HUE_HEAD,
      base: 0.95,
      start: 0.95,
    });
    push({
      x: car.x - car.dir * (CAR_W / 2 - 0.1),
      y: CAR_H * 0.62,
      z: zFace,
      rotY: 0,
      w: 0.08,
      h: 0.07,
      kind: KIND_PROP,
      hue: HUE_TAIL,
      base: 0.55,
      start: 0.55,
    });
  }

  return { items, digitMap, colonMap, signLetters, beacons };
}
