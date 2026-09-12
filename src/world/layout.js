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
  CAR_LANE,
  ROADS_X,
  ROADS_Z,
  SHOP_W,
  SHOP_DX,
  SHOP_POST_W,
  SHOP_PANES,
  SHOP_MULLION_W,
  SHOP_Y0,
  SHOP_H,
  SHOP_FASCIA_H,
  BILLBOARD_EM,
  BILLBOARD_GAP,
  BILLBOARD_PAD,
  BILLBOARD_LEG_H,
  BILLBOARD_LAMP_DROP,
  BILLBOARD_LAMP_OUT,
  PARAPET_T,
  CONE_ROOF,
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

/**
 * The square base and apex of a cone roof, in world units.
 *
 * Both cone roofs are turned 45 degrees, which lands their four base vertices
 * on the axes - so the base is an axis-aligned square of half-extent
 * r * W * cos(45), not r * W. Getting that factor wrong puts a bezel visibly
 * inside or outside the roof it is meant to be tracing.
 */
export function coneRoof(b) {
  const spec = CONE_ROOF[b.roof];
  if (!spec) return null;
  return {
    half: b.W * spec.r * Math.SQRT1_2,
    baseY: b.H,
    apexY: b.H + spec.h,
  };
}

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

const filler = (id, x, z, W, D, H, roof, extra = {}) => ({
  id,
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
  filler("f0", -11.82, -5.7, 3.0, 3.0, 6.2, "tank"),
  filler("f1", -6.88, -5.5, 2.8, 2.8, 5.4, "pitched"),
  filler("f2", -1.83, -5.8, 2.6, 2.6, 7.0, "dome"),
  filler("f3", 3.11, -5.6, 3.0, 3.0, 5.8, "helipad"),
  filler("f4", 8.15, -5.9, 2.6, 2.6, 7.4, "pyramid"),
  filler("f5", 13.21, -5.7, 2.8, 2.8, 4.9, "pitched"),

  // Back row. The 30 degree pitch lifts these by z*sin(pitch) = 5.25 on
  // screen, so every one of them clears the tallest tower and reads as a
  // distinct silhouette against the sky.
  filler("b0", -9.21, -10.5, 3.2, 2.8, 6.6, "flat"),
  // The castle. Raised from 5.2 so its lowest eave clears the 今日 sign
  // standing on tower 1 in front of it - at 5.2 the two crossed on screen.
  filler("b1", -4.48, -10.8, 2.6, 2.6, 6.4, "castle"),
  filler("b2", 0.78, -10.5, 3.0, 3.0, 6.9, "flat"),
  filler("b3", 6.04, -10.6, 2.8, 2.8, 5.4, "flat", { antenna: true }),
  filler("b4", 11.30, -10.4, 2.8, 2.8, 6.0, "tank"),
];

/** Every sign-mountable body, by id. Towers are "t0".."t4" by slot. */
export const BUILDINGS = Object.fromEntries([
  ...TOWERS.map((t) => [`t${t.slot}`, t]),
  ...FILLERS.map((f) => [f.id, f]),
]);

// ---------------------------------------------------------------------------
// Street-level shop fronts
//
// Two to a digit tower, in the blank band under the lowest window row. Some are
// open and some are shuttered, which is the only thing that makes a row of
// them read as a street rather than as a repeated decal - the reference has the
// same mix, and the shut ones do as much work as the lit ones.
//
// `sign` is the fascia hue by name. Levels are NOT stored: levelFor() solves
// each one so every fascia lands on the same luma whatever colour it is.
// ---------------------------------------------------------------------------

export const SHOPS = [
  { host: "t0", side: -1, open: true, sign: "warm" },
  { host: "t0", side: 1, open: false, sign: "cool" },
  { host: "t1", side: -1, open: true, sign: "tail" },
  { host: "t1", side: 1, open: true, sign: "cool" },
  { host: "t3", side: -1, open: false, sign: "warm" },
  { host: "t3", side: 1, open: true, sign: "head" },
  { host: "t4", side: -1, open: true, sign: "warm" },
  { host: "t4", side: 1, open: false, sign: "tail" },
];

export function shopParts() {
  return SHOPS.map((s) => {
    const host = BUILDINGS[s.host];
    if (!host) throw new Error(`shops: unknown host "${s.host}"`);
    const head = SHOP_Y0 + SHOP_H;
    const x = host.x + s.side * SHOP_DX;

    // The glazing, divided. Panes and mullions are derived together from one
    // width so they cannot drift apart - the lit quads come from `panes` and
    // the frame members that separate them from `mullions`, and a gap in the
    // first is exactly a bar in the second.
    const inner = SHOP_W - SHOP_POST_W * 2;
    const paneW = (inner - SHOP_MULLION_W * (SHOP_PANES - 1)) / SHOP_PANES;
    const panes = [];
    const mullions = [];
    for (let i = 0; i < SHOP_PANES; i++) {
      const px = x - inner / 2 + i * (paneW + SHOP_MULLION_W) + paneW / 2;
      panes.push({ x: px, w: paneW });
      if (i < SHOP_PANES - 1) {
        mullions.push({ x: px + (paneW + SHOP_MULLION_W) / 2, w: SHOP_MULLION_W });
      }
    }

    return {
      ...s,
      x,
      z: host.z + host.D / 2, // the facade plane; everything builds forward
      w: SHOP_W,
      inner,
      panes,
      mullions,
      y0: SHOP_Y0,
      y1: head, // top of the opening
      fascia0: head,
      fascia1: head + SHOP_FASCIA_H,
    };
  });
}

// ---------------------------------------------------------------------------
// The painted billboard
//
// Sits on the hours-ones tower, the second digit. Its size comes from its
// CONTENT, like every other sign here, and the lamp positions come off the
// board - so billboard.js, windowLayout.js and lights.js all build from one
// description rather than three guesses that drift apart.
//
// The height matters. Tower 2's parapet is at 10.16 and the scene's bounding
// box tops out at 11.6, so the whole assembly has 1.44 units to live in before
// it grows the box the framing is solved against. That is why the board is
// short and wide rather than tall.
// ---------------------------------------------------------------------------

export const BILLBOARD = {
  host: "t1", // hours, ones
  word: "一日一生", // ichinichi-isshou: one day, one lifetime
  z: 1.0, // toward the front edge of the roof, clear of the rooftop plant
};

export function billboardParts() {
  const host = BUILDINGS[BILLBOARD.host];
  const n = [...BILLBOARD.word].length;
  const span = n * BILLBOARD_EM + (n - 1) * BILLBOARD_GAP;
  const w = span + BILLBOARD_PAD * 2;
  const h = BILLBOARD_EM + BILLBOARD_PAD * 2;
  const deck = host.H + PARAPET_T;
  const y = deck + BILLBOARD_LEG_H + h / 2;

  return {
    host,
    w,
    h,
    deck,
    x: host.x,
    y,
    z: BILLBOARD.z,
    em: BILLBOARD_EM,
    span,
    // Two floodlights under the board, inset from its ends.
    lamps: [-w * 0.27, w * 0.27].map((dx) => ({
      x: host.x + dx,
      y: y - h / 2 - BILLBOARD_LAMP_DROP,
      z: BILLBOARD.z + BILLBOARD_LAMP_OUT,
    })),
  };
}

// ---------------------------------------------------------------------------
// Neon bezels
//
// Tube run along a building's own edges. A bezel only pays for itself on a
// building whose top is clear of the clock towers, which rules out most of the
// fill. f4's pyramid clears tower 5 and sits right behind it; b2's roofline
// clears tower 2. One traces a roof and one traces a box, so the two read as
// the same effect applied to different architecture rather than a special case.
// ---------------------------------------------------------------------------

export const BEZELS = [
  // The pyramid standing behind the minutes-ones tower. It reads better lit
  // than the castle did: a pyramid is four straight edges to a point, so the
  // tube states the whole form, where the castle's tiers gave the tube so much
  // to say that the solid underneath stopped being visible at all.
  { host: "f4", kind: "pyramid", hue: "teal" },
  { host: "b2", kind: "box", hue: "amber" },
];

// ---------------------------------------------------------------------------
// City signs
//
// Two mounts. "roof" stands on a host building's parapet; "blade" hangs off a
// flank on brackets, which is what the AM/PM sign already does. Both name a
// host rather than carrying an absolute y, so a sign follows its building if
// the height ever changes.
//
// Placement is solved against SCREEN position, not world position. The
// projection shears everything - and the shear is easy to get backwards, so do
// not do it in your head: an earlier version of this comment carried
// hand-computed screen x values with the z term's sign flipped, and every one
// of them was wrong by two to four units while the layout itself was fine.
//
// `npm run measure` prints the real screen box of every sign and bezel and
// fails if any two overlap in BOTH axes. That is the actual invariant; trust
// it rather than arithmetic done here.
//
// Every sign also has to stay inside its host's roof footprint and under
// y = 11.6, which is the top of the scene's bounding box (tower 4's rooftop
// plant). Breaking that ceiling grows the box the framing is solved against
// and re-crops the whole diorama - see tools/measure.mjs.
// ---------------------------------------------------------------------------

export const CITY_SIGNS = [
  // Hour / minute / second, hung off tower 1 exactly the way the AM/PM sign is
  // hung off tower 5. The mirror is the point: the two blades bracket the
  // readout, and this one names the units the digits are counting in.
  {
    word: "時分秒",
    mount: "blade",
    dir: "v",
    flicker: true,
    frame: "cyan",
    ink: "amber",
    near: true,
  },

  // "Now", on the same bracket line as the AM/PM sign but below it, the way a
  // real corner stacks its tenants down the building.
  {
    word: "今",
    mount: "blade",
    side: "right",
    dir: "v",
    frame: "magenta",
    ink: "magenta",
    near: true,
  },

  // "Clock". The most literal sign in the city, so it goes high and left where
  // it reads against empty sky.
  {
    word: "時計",
    mount: "roof",
    flicker: true,
    host: "b0",
    x: -8.4,
    z: -9.3,
    em: 1.15,
    dir: "v",
    frame: "magenta",
    ink: "amber",
  },

  // "Today", flat on tower 1's roof - the only sign on a clock tower, and the
  // only one the camera sees at the digits' own depth.
  {
    word: "今日",
    mount: "roof",
    host: "t0",
    x: -9.6,
    z: 0.95,
    em: 1.0,
    dir: "h",
    frame: "cyan",
    ink: "cyan",
    near: true,
  },

  // "Sun and moon" - the idiom for time passing. Unframed, so the back row
  // does not turn into a row of identical boxes.
  {
    word: "日月",
    mount: "roof",
    host: "b2",
    x: 0.6,
    z: -9.2,
    em: 1.1,
    dir: "v",
    ink: "violet",
  },

  // "Date and time". One of the three with a failing tube - see `flicker`
  // below, and neonLife.js for why each one needs its own fault clock.
  //
  // It used to read 正午, "noon", until the preview showed the problem: at the
  // ~20px per character a back-row sign actually gets, 正 is indistinguishable
  // from 五 (five). The strokes were correct - it is the SIZE that cannot carry
  // a character whose only cue is the length of one horizontal spur. 日 and 時
  // survive the same treatment, so the back row gets those instead.
  {
    word: "日時",
    mount: "roof",
    flicker: true,
    host: "b3",
    x: 5.5,
    z: -9.5,
    em: 1.05,
    dir: "v",
    ink: "jade",
  },

  // "Tomorrow", far right, low and wide so it does not fight the AM/PM sign
  // directly below it.
  {
    word: "明日",
    mount: "roof",
    host: "b4",
    x: 11.25,
    z: -9.3,
    em: 0.92,
    dir: "h",
    frame: "amber",
    ink: "magenta",
  },
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

/**
 * Two circuits of the block, running opposite ways.
 *
 * Both are the same rectangle - the front road, the mid road, and the outer
 * pair of roads running along Z - offset to opposite sides of the centreline by
 * CAR_LANE. The offsets are not arbitrary: on every leg of both routes the lane
 * is on the LEFT of travel, because that is the side Japan drives on. Facing
 * +X, left is -Z; facing -Z, left is -X. Work any corner through and it holds.
 *
 * Listed as corners in traversal order and closed implicitly, so reversing a
 * route means reversing this list and flipping its offset.
 */
const [ZF, ZM] = ROADS_Z; // front road, mid road
const XL = ROADS_X[0]; // the two that fall in the tower-row gaps
const XR = ROADS_X[ROADS_X.length - 1];

export const CAR_ROUTES = [
  // Outer lane, anticlockwise seen from above: -X along the front road.
  [
    [XR + CAR_LANE, ZF + CAR_LANE],
    [XL - CAR_LANE, ZF + CAR_LANE],
    [XL - CAR_LANE, ZM - CAR_LANE],
    [XR + CAR_LANE, ZM - CAR_LANE],
  ],
  // Inner lane, clockwise: +X along the front road, passing the outer cars
  // nose to nose the way opposing traffic should.
  [
    [XL + CAR_LANE, ZF - CAR_LANE],
    [XR - CAR_LANE, ZF - CAR_LANE],
    [XR - CAR_LANE, ZM + CAR_LANE],
    [XL + CAR_LANE, ZM + CAR_LANE],
  ],
];

/**
 * Which route each car runs and where it starts, as a FRACTION of that route's
 * length. Cars on one route share a speed, so these gaps are preserved for
 * good - uneven on purpose, since evenly spaced cars read as a metronome.
 */
export const CARS = [
  { route: 0, at: 0.0 },
  { route: 0, at: 0.29 },
  { route: 0, at: 0.63 },
  { route: 1, at: 0.12 },
  { route: 1, at: 0.44 },
  { route: 1, at: 0.79 },
];

export const CAR_W = 0.72;
export const CAR_H = 0.3;
export const CAR_D = 0.34;
