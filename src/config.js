/**
 * Single source of truth for every tunable number in the scene.
 * Nothing else in the project should hard-code a magic constant.
 */

const q = new URLSearchParams(
  typeof location === "undefined" ? "" : location.search,
);

export const debug = {
  time: q.get("t"), // "10:37" / "23:59" — 24h in, converted to 12h for display
  rate: Number(q.get("rate") ?? 1), // time multiplier, e.g. ?rate=60
  cycle: q.has("cycle"), // all four digits count 0..9, one per second
  flat: q.has("flat"), // yaw = pitch = tilt = drift = 0, dead-on elevation
  orbit: q.has("orbit"), // OrbitControls, dynamically imported
  nobloom: q.has("nobloom"),
  bounds: q.has("bounds"),
  bloom: q.get("bloom"), // "0.85,0.55,0.55" live override
};

export const SEED = 20260911;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

export const BASE_YAW = 18 * DEG;
export const BASE_PITCH = 30 * DEG;
export const CAM_DIST = 60;
// Solved so the projected bounding box of the REAL scene lands on frame
// centre. Measured with ?bounds rather than derived by hand: an analytical
// estimate missed the roof cones, antenna masts and rooftop plant, and
// under-reported the vertical extent by about 15%.
export const CAM_TARGET = [1.14, 5.18, -3.78];
export const CAM_NEAR = 1;
export const CAM_FAR = 200;

// Contain-fit design box. Measured, not guessed: the projected bounding box
// of every solid in the scene, evaluated across the camera's full range of
// tilt and drift, plus a 5% margin. Re-derive these if the slab, the building
// heights or the tilt amplitude change.
// Measured with ?bounds across aspect ratios, plus margin. Two reasons for
// the margin: the camera tilt swings the content around, and UnrealBloomPass
// samples with clamp-to-edge, so a bright object near the border smears its
// halo into a streak along that edge.
// Re-measure with ?bounds if the buildings, slab or tilt amplitude change.
export const DESIGN_W = 37.2;
export const DESIGN_H = 26.6;

export const TILT_YAW = 3.0 * DEG; // pointer deflection amplitude
export const TILT_PITCH = 2.0 * DEG;
export const DRIFT_YAW = 2.2 * DEG; // idle amplitude
export const DRIFT_PITCH = 1.1 * DEG;
export const DRIFT_YAW_T = 47; // seconds; coprime-ish so it never visibly loops
export const DRIFT_PITCH_T = 31;
export const DRIFT_PITCH_PHASE = 1.1;
export const CAM_SMOOTH = 3.0; // exponential smoothing rate (1/s)
export const IDLE_DELAY = 2.5; // seconds before drift takes back over
export const IDLE_RAMP = 1.5; // cross-fade duration, pointer -> drift

// ---------------------------------------------------------------------------
// Window grid
//
// ROW_PITCH is deliberately stretched relative to COL_PITCH so the digit grid
// projects square despite the camera tilt:
//     ROW_PITCH = COL_PITCH * cos(BASE_YAW) / cos(BASE_PITCH)
// Without this the digits render visibly squat.
// ---------------------------------------------------------------------------

export const COL_PITCH = 0.5;
export const ROW_PITCH =
  COL_PITCH * (Math.cos(BASE_YAW) / Math.cos(BASE_PITCH)); // ~0.549

export const ROW_Y0 = 0.45; // world y of row 0
export const ROW_MIN = 1; // lowest windowed row (street level stays blank)
export const ROOF_MARGIN = 0.75; // blank wall above the top row
export const PARAPET_T = 0.16; // roof rim thickness; roof signs stand on top of it

export const WIN_W = 0.34;
export const WIN_H = 0.37;
export const FACE_OFFSET = 0.012; // how far a window quad floats off the wall

// Digit band. Bitmap row 0 is the TOP, so worldRow = DIGIT_ROW_TOP - bitmapRow.
export const DIGIT_ROW_TOP = 11;
export const DIGIT_ROW_BOTTOM = 5;
// Forced permanently dark, to letterbox the glyph away from ambient windows.
export const SEPARATOR_ROWS = [4, 12];

export const AMBIENT_DENSITY = 0.18;
// Ambient tops out well below the digit level (1.0). If these two climb
// toward 1.0 the ambient windows bloom as hard as the digits and the
// readout stops reading.
export const AMBIENT_GAIN_MIN = 0.2;
export const AMBIENT_GAIN_MAX = 0.4;
export const AMBIENT_WARM_CHANCE = 0.2; // reference reads cool, so warm is the minority

export const DIGIT_GAIN = 1.0;

// ---------------------------------------------------------------------------
// Blade sign (AM/PM), mounted on the +X flank of the last clock tower
// ---------------------------------------------------------------------------

// Tower 5's flank is at x = 11.3. The sign must clear it ENTIRELY: anything
// inboard of that sits inside the building volume and never renders. It hangs
// outboard on short brackets, the way a real blade sign does.
export const SIGN_X = 12.6;
// DERIVED, not a literal: the sign is centred on the digit band so it reads
// as part of the same row as the numerals rather than floating above them.
// Keeping this expression means it stays aligned if the band or the row pitch
// ever move.
export const SIGN_Y =
  ROW_Y0 + ((DIGIT_ROW_TOP + DIGIT_ROW_BOTTOM) / 2) * ROW_PITCH;
export const SIGN_Z = 0.2;
export const SIGN_W = 2.2; // backing panel
export const SIGN_H = 4.2;
export const SIGN_D = 0.14;

// Two neon boxes stacked on the panel: "am" above, "pm" below.
export const SIGN_BOX_W = 2.0;
export const SIGN_BOX_H = 1.8;
export const SIGN_BOX_GAP = 0.3;
export const SIGN_BOX_PAD = 0.22; // inset from the frame to the lettering
export const SIGN_CORNER_R = 0.16;
export const SIGN_TUBE_BORDER = 0.045;
export const SIGN_TUBE_LETTER = 0.05;
export const SIGN_FADE = 0.45; // seconds to cross-fade at noon and midnight

// ---------------------------------------------------------------------------
// City signs (kanji)
//
// Signs are sized from their CONTENT, not from literals: a panel is
// characters + gaps + padding, so changing the em size or the character count
// resizes the panel and its brackets without anything else to keep in sync.
// ---------------------------------------------------------------------------

export const CITY_EM = 1.05; // default character cell, world units
export const CITY_CHAR_GAP = 0.16; // between character cells
export const CITY_PAD = 0.3; // panel edge to the nearest character cell
export const CITY_PANEL_D = 0.12;

// Tube radius is a FRACTION of the em rather than an absolute, so legibility
// is scale invariant: a bigger sign gets a proportionally fatter tube and the
// strokes stay the same distance apart in glyph terms. It is thinner than the
// AM/PM sign's 0.05 relative to its letters because kanji are far denser -
// 計 packs three horizontals into 0.13 em, and a fatter tube welds them shut.
export const CITY_TUBE_RATIO = 0.036;
export const CITY_FRAME_INSET = 0.13; // panel edge to the frame tube
export const CITY_CORNER_R = 0.14;

// Rooftop signs stand on legs above the parapet, the way a real one does -
// sitting flush on the deck reads as a billboard lying on the roof.
export const CITY_LEG_H = 0.26;
export const CITY_LEG_W = 0.09;
export const CITY_BRACKET_T = 0.12; // flank-mounted signs, arm thickness

// Slow brightness breathe. Neon does not sit perfectly still, but this has to
// stay well under the threshold of "something is flashing at me" - the clock
// is the only thing in the scene allowed to demand attention.
export const CITY_BREATHE = 0.05; // +/- fraction of the sign's solved level
export const CITY_BREATHE_T = [13.7, 19.3, 23.1]; // seconds; mutually coprime-ish

// One tube in the city is failing, because one always is. Kept to a single
// sign and a long duty cycle so it reads as texture rather than a strobe.
export const CITY_FLICKER_SIGN = "日時"; // the "date and time" sign
export const CITY_FLICKER_PERIOD = 7.4;
export const CITY_FLICKER_LEN = 0.38; // seconds of misbehaviour per period

// The left-hand blade, mounted on tower 1 the way the AM/PM sign is mounted on
// tower 5. Mirrored deliberately: the two blades bracket the whole readout.
export const CITY_BLADE_X = -SIGN_X;
export const CITY_BLADE_INNER = -11.16; // starts inside tower 1's facade
export const CITY_BLADE_EM = 1.2;

// The small blade under the AM/PM sign, on the same bracket line.
export const CITY_UNDER_Y = 1.75;
export const CITY_UNDER_EM = 0.95;

// ---------------------------------------------------------------------------
// Neon bezels
//
// Tube run along a building's own edges, the way a Tokyo block outlines its
// architecture after dark. Same mechanism as the sign frames - this is the
// building wearing one.
// ---------------------------------------------------------------------------

export const BEZEL_TUBE = 0.035;
export const BEZEL_LIFT = 0.03; // float off the wall, so the tube never z-fights

// Cone roofs, as ratios of their building's width. These used to be literals
// inside buildings.js; they are here because the bezel has to trace the SAME
// pyramid the solid is built from, and two copies of "0.72" in two files is
// exactly how that stops being true.
//
// Both entries are 4-sided cones turned 45 degrees, which is why a square base
// half-extent is r * W * cos(45) rather than r * W.
export const CONE_ROOF = {
  pyramid: { r: 0.72, h: 1.6 },
  pitched: { r: 0.78, h: 0.9 },
};

// ---------------------------------------------------------------------------
// Castle roof (tenshu)
//
// A tiered donjon roof, generated rather than modelled. Every number below is
// a RATIO of the storey it sits on, so the whole thing scales with its host
// building and the tiers stay in proportion to each other.
//
// The two that carry the look:
//
// CASTLE_CONCAVE is the exponent on the roof's vertical profile. Above 1 the
// surface rises slowly off the eave and steeply into the ridge, which is the
// dished, flared section every Japanese roof has. At exactly 1 you get a plain
// straight-sided hip roof and the whole silhouette stops reading as Japanese.
//
// CASTLE_FLICK is the other half: the eave line lifts at the corners and dips
// at the middle of each side, on a parabola. That single curve is the most
// recognisable thing about the form, which is why the bezel traces it.
// ---------------------------------------------------------------------------

export const CASTLE_TIERS = 3;
export const CASTLE_SHRINK = 0.7; // each storey against the one below
export const CASTLE_EAVE_OVER = 1.2; // eave overhang, against its own storey
export const CASTLE_RISE = 0.4; // roof rise, against the eave half-width
export const CASTLE_DRUM = 0.42; // storey wall height, against its half-width
export const CASTLE_RIDGE = 0.45; // ridge half-length, against the eave half-width
export const CASTLE_FLICK = 0.095; // corner lift, against the eave half-width
// Exponent on the corner lift. At 2 (a plain parabola) the rise is spread over
// the whole side and the eave reads as a sagging hammock; a real eave runs
// straight for most of its span and turns up only in the last quarter, which
// is what a higher power gives.
export const CASTLE_FLICK_POW = 3.4;
export const CASTLE_CONCAVE = 1.7;
export const CASTLE_RINGS = 5; // loft rings from eave to ridge
export const CASTLE_SAMPLES = 5; // eave points per side

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

export const SLAB = { x0: -14, x1: 14, z0: -13.0, z1: 5.5, thickness: 1.2 };
export const ROAD_W = 1.1;
export const ROADS_Z = [3.2, -2.8, -8.0]; // roads running along X
export const ROADS_X = [-7.2, -2.4, 2.4, 7.2]; // roads running along Z
export const ROAD_Y = 0.015;

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

export const BLOOM_STRENGTH = 0.42;
// Tight. At 0.6 the halos of adjacent digit windows merged and the glyph
// lost its dot-matrix structure.
export const BLOOM_RADIUS = 0.35;
// Sits just above the brightest ambient window (luma 0.56), so ambient
// windows glow without bleeding and only the digits truly bloom.
export const BLOOM_THRESHOLD = 0.58;
export const EXPOSURE = 1.0;

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export const ON_DURATION = 0.28; // fluorescent tube snapping on
export const OFF_DURATION = 0.45; // filament cooling
export const STAGGER_ON_ROW = 0.045; // bottom-up
export const STAGGER_OFF_ROW = 0.035; // top-down
export const STAGGER_JITTER_ON = 0.1;
export const STAGGER_JITTER_OFF = 0.08;
export const BUILDING_CASCADE = 0.06; // left-to-right delay per clock tower

export const COLON_FLOOR = 0.25; // colon never fully dies
export const BEACON_PERIOD = 2.4; // rooftop antenna blink
