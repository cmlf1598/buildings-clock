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
  billboardParts,
  ROLE_COLON,
  rowY,
  colOffset,
  isSeparatorRow,
  isDigitRow,
  KIND_DIGIT,
  KIND_AMBIENT,
  KIND_PROP,
} from "../world/layout.js";
import { GLYPH_W, GLYPH_H, COLON_W } from "../data/font5x7.js";
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
  const beacons = [];

  const push = (o) => {
    items.push(o);
    return items.length - 1;
  };

  /**
   * An ambient window that is allowed to switch itself on and off later.
   *
   * Not every KIND_AMBIENT window qualifies. The separator rows are also
   * ambient and also dark, but they are dark ON PURPOSE - they letterbox the
   * digit band away from the ordinary windows - so they go through plain
   * push() and never end up in here. Light one of those and the glyph loses
   * the blank gutter that makes it readable.
   */
  const rooms = [];
  const pushRoom = (o) => {
    const i = push(o);
    rooms.push(i);
    return i;
  };

  /**
   * An ambient window on a DIGIT tower's front face, driven by the second hand
   * instead of by the slow room toggling.
   *
   * Deliberately disjoint from `rooms`. Two systems driving one window would
   * disagree about whether it is currently lit, and the one holding the stale
   * belief would fight the other every time it fired.
   */
  const tickRooms = [];
  const pushTick = (o) => {
    const i = push(o);
    tickRooms.push(i);
    return i;
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
        // ambient LEVEL to fall back to. Same density as everywhere else —
        // special-casing that would read as a suspicious rectangle.
        //
        // The hue is NOT taken from the roll, though, and this matters. A band
        // cell is part of a numeral whenever a digit is up, and a warm one
        // renders that stroke orange - so the 1 came out in mixed white and
        // amber while every other tower was clean cool white, which read
        // exactly like ambient windows sitting inside the digit. The roll is
        // still consumed, so the density and the rest of the city are
        // untouched; only the hue is discarded.
        const [level] = t.slot === 0 ? ambientRoll() : [0];
        const i = push({
          ...p,
          kind: KIND_DIGIT,
          hue: HUE_COOL,
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

      // The colon tower has no digit, so its front face keeps the slow life.
      const [level, hue] = ambientRoll();
      const add = isColon ? pushRoom : pushTick;
      add({ ...p, kind: KIND_AMBIENT, hue, base: level, start: level });
    });

    addFace(t, "side", t.sideCols, (r, c, p) => {
      const [level, hue] = ambientRoll();
      pushRoom({ ...p, kind: KIND_AMBIENT, hue, base: level, start: level });
    });

    if (isColon) colonMap = map;
    else digitMap[t.slot] = map;
  }

  // -- Filler buildings -----------------------------------------------------
  for (const f of FILLERS) {
    addFace(f, "front", f.frontCols, (r, c, p) => {
      const [level, hue] = ambientRoll();
      pushRoom({ ...p, kind: KIND_AMBIENT, hue, base: level, start: level });
    });
    addFace(f, "side", f.sideCols, (r, c, p) => {
      const [level, hue] = ambientRoll();
      pushRoom({ ...p, kind: KIND_AMBIENT, hue, base: level, start: level });
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

  // The painted billboard's two floodlights. Appended AFTER the seeded section,
  // and the props consume no randomness, so the city is unaffected.
  for (const l of billboardParts().lamps) {
    push({
      x: l.x,
      y: l.y,
      z: l.z + 0.07,
      rotY: 0,
      w: 0.1,
      h: 0.08,
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

  return {
    items,
    digitMap,
    colonMap,
    beacons,
    rooms: Int32Array.from(rooms),
    tickRooms: Int32Array.from(tickRooms),
  };
}
