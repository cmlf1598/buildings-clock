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
export const CAM_TARGET = [1.21, 5.32, -3.89];
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

// Tower 4 flank is at x = 11.3. The panel must clear it ENTIRELY: at 11.6
// the inner half of every letter (x < 11.3) sat inside the building volume
// and was invisible, which made the sign unreadable. Mounted outboard on
// short brackets instead, the way a real blade sign hangs.
export const SIGN_X = 12.05;
export const SIGN_Y = 5.13;
export const SIGN_Z = 0.2;
export const SIGN_W = 1.4;
export const SIGN_H = 7.6;
export const SIGN_D = 0.14;
// Same tilt pre-compensation as the window grid: the vertical pitch is
// stretched by cos(yaw)/cos(pitch) so the letterforms project with correct
// proportions instead of the squashed look a uniform pitch would give.
export const SIGN_DOT_PITCH_X = 0.24;
export const SIGN_DOT_PITCH_Y =
  SIGN_DOT_PITCH_X * (Math.cos(BASE_YAW) / Math.cos(BASE_PITCH));
export const SIGN_DOT_SIZE = 0.17;
export const SIGN_GAIN_ON = 0.85; // relative to a lit digit
export const SIGN_GAIN_OFF = 0.05; // ghosted, but the letterform stays readable
// World y of each letter TOP dot row: A, M, (wider gap), P, M.
// The extra space before P groups these as two words, not four loose letters.
export const SIGN_LETTER_TOPS = [8.7, 6.898, 4.916, 3.114];

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
