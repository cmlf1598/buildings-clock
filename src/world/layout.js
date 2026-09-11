/**
 * Pure geometry data for the diorama. No THREE imports — everything here is
 * plain numbers, so it can be unit-checked in Node.
 *
 * Conventions:
 *   - Clock towers sit in a row at z = 0, facing +Z (toward the camera).
 *   - Filler buildings sit behind them, at negative z.
 *   - Only the +Z front face and +X side face are ever windowed: the camera
 *     lives at +X and never swings past ~21 degrees of yaw, so the -X and
 *     back faces are never visible. This halves the instance count for free.
 */

import {
  COL_PITCH,
  ROW_PITCH,
  ROW_Y0,
  ROOF_MARGIN,
  DIGIT_ROW_TOP,
  DIGIT_ROW_BOTTOM,
  SEPARATOR_ROWS,
} from "../config.js";

export const FACE_FRONT = 0;
export const FACE_SIDE = 1;
export const FACE_PROP = 2;

export const KIND_DIGIT = 0;
export const KIND_AMBIENT = 1;
export const KIND_PROP = 2;

export const ROLE_DIGIT = "digit";
export const ROLE_COLON = "colon";

/** World y of window row r. Identical across every building, so rows line up. */
export const rowY = (r) => ROW_Y0 + r * ROW_PITCH;

/** Highest windowed row that still leaves ROOF_MARGIN of blank wall on top. */
export const topRow = (H) => Math.floor((H - ROOF_MARGIN - ROW_Y0) / ROW_PITCH);

/** Local x of column c, for a face that is `cols` columns wide. */
export const colOffset = (c, cols) => (c - (cols - 1) / 2) * COL_PITCH;

/** How many ambient columns fit on a face of the given width. */
export const colsFor = (width) =>
  Math.max(2, Math.floor((width - 0.6) / COL_PITCH));

export const isSeparatorRow = (r) => SEPARATOR_ROWS.includes(r);
export const isDigitRow = (r) => r >= DIGIT_ROW_BOTTOM && r <= DIGIT_ROW_TOP;

// ---------------------------------------------------------------------------
// Clock row
//
// Tower pitch is 4.8 against a body width of 3.4, giving a 1.4 gap. Visible
// side faces project to D * sin(yaw); at the tilt+drift peak of ~21 degrees
// that is 2.8 * 0.358 = 1.00, comfortably inside the gap. This is the layout's
// tightest tolerance — re-check it before changing yaw, depth or tilt.
// ---------------------------------------------------------------------------

const tower = (role, slot, x, W, D, H) => ({
  role,
  slot, // 0..4, left to right; drives the cascade delay
  x,
  z: 0,
  W,
  D,
  H,
  frontCols: role === ROLE_COLON ? 2 : 5,
  sideCols: role === ROLE_COLON ? 3 : 5,
  rMax: topRow(H),
});

export const TOWERS = [
  tower(ROLE_DIGIT, 0, -9.6, 3.4, 2.8, 8.8), // hours, tens
  tower(ROLE_DIGIT, 1, -4.8, 3.4, 2.8, 10.0), // hours, ones
  tower(ROLE_COLON, 2, 0.0, 1.6, 2.0, 8.0), // colon
  tower(ROLE_DIGIT, 3, 4.8, 3.4, 2.8, 11.1), // minutes, tens
  tower(ROLE_DIGIT, 4, 9.6, 3.4, 2.8, 9.4), // minutes, ones
];

/** Indices into TOWERS that carry a digit, in display order. */
export const DIGIT_SLOTS = [0, 1, 3, 4];
export const COLON_SLOT = 2;

// ---------------------------------------------------------------------------
// Filler buildings
//
// Positioned so they land in the on-screen GAPS between clock towers rather
// than directly behind them. Screen x = x*cos(yaw) + z*sin(yaw), so for the
// back rows the x values below are solved against the gap centres.
//
// Height is capped at 7.5 so a filler never crowds a digit band. They sit at
// negative z, strictly behind the clock row, so they can never occlude a digit
// — they only show through the gaps, which is exactly the reference look.
//
// Bodies are always boxes so the window logic stays uniform; variety comes
// from the roof treatment.
// ---------------------------------------------------------------------------

const filler = (x, z, W, D, H, roof, extra = {}) => ({
  x,
  z,
  W,
  D,
  H,
  roof,
  rMax: topRow(H),
  frontCols: colsFor(W),
  sideCols: colsFor(D),
  antenna: false,
  ...extra,
});

export const FILLERS = [
  // Front row. Partly occluded by the clock towers, which is the intent —
  // they fill the narrow gaps and break up the skyline behind.
  filler(-11.82, -5.7, 3.0, 3.0, 6.2, "tank"),
  filler(-6.88, -5.5, 2.8, 2.8, 5.4, "pitched"),
  filler(-1.83, -5.8, 2.6, 2.6, 7.0, "dome"),
  filler(3.11, -5.6, 3.0, 3.0, 5.8, "helipad"),
  filler(8.15, -5.9, 2.6, 2.6, 7.4, "pyramid"),
  filler(13.21, -5.7, 2.8, 2.8, 4.9, "pitched"),

  // Back row. The 30 degree pitch lifts these by z*sin(pitch) = 5.25 on
  // screen, so every one of them clears the tallest tower and reads as a
  // distinct silhouette against the sky.
  filler(-9.21, -10.5, 3.2, 2.8, 6.6, "flat"),
  filler(-4.48, -10.8, 2.6, 2.6, 5.2, "pitched"),
  filler(0.78, -10.5, 3.0, 3.0, 6.9, "flat"),
  filler(6.04, -10.6, 2.8, 2.8, 5.4, "flat", { antenna: true }),
  filler(11.30, -10.4, 2.8, 2.8, 6.0, "tank"),
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export const LAMP_HEIGHT = 1.15;

/** Streetlamps, placed just off the kerb of the front and mid roads. */
export const LAMPS = [
  [-13.0, 3.95],
  [-8.5, 3.95],
  [-4.0, 3.95],
  [0.5, 3.95],
  [5.0, 3.95],
  [9.5, 3.95],
  [14.0, 3.95],
  [-10.5, -2.05],
  [-3.0, -2.05],
  [6.0, -2.05],
  [12.5, -2.05],
].map(([x, z]) => ({ x, z }));

/** Parked cars: [x, z, facing] where facing is +1 (+X) or -1 (-X). */
export const CARS = [
  { x: -11.0, z: 3.2, dir: 1 },
  { x: -2.4, z: 3.45, dir: 1 },
  { x: 6.2, z: 2.95, dir: -1 },
  { x: 12.0, z: 3.3, dir: -1 },
  { x: -7.6, z: -3.05, dir: 1 },
  { x: 3.4, z: -2.6, dir: -1 },
];

export const CAR_W = 0.72;
export const CAR_H = 0.3;
export const CAR_D = 0.34;
