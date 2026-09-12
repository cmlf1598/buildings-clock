/**
 * Single source of truth for every tunable number in the scene.
 * Nothing else in the project should hard-code a magic constant.
 */

const q = new URLSearchParams(
  typeof location === "undefined" ? "" : location.search,
);

/**
 * A numeric URL flag. Absent or unparseable falls back instead of poisoning the
 * scene with NaN - or, worse, with the 0 that Number(null) quietly returns.
 */
const num = (key, fallback) => {
  const v = Number(q.get(key));
  return q.has(key) && Number.isFinite(v) ? v : fallback;
};

export const debug = {
  time: q.get("t"), // "10:37" / "23:59" — 24h in, converted to 12h for display
  rate: num("rate", 1), // time multiplier, e.g. ?rate=60
  cycle: q.has("cycle"), // all four digits count 0..9, one per second
  flat: q.has("flat"), // yaw = pitch = tilt = drift = 0, dead-on elevation
  orbit: q.has("orbit"), // OrbitControls, dynamically imported
  nobloom: q.has("nobloom"),
  bounds: q.has("bounds"),
  bloom: q.get("bloom"), // "0.85,0.55,0.55" live override
  // Room-toggle rate multiplier: ?rooms=40 watches a night pass in a minute,
  // ?rooms=0 freezes them.
  rooms: num("rooms", 1),
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
export const AMBIENT_GAIN_MAX = 0.3;
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
// WHICH signs have a failing tube is per-sign, in the CITY_SIGNS table. These
// are only the shape of the fault.
//
// The period is a BASE. Each faulty sign scatters around it, because three
// tubes sharing one period would dip in unison and read as the whole block
// browning out rather than as three separate tubes on their way out.
export const CITY_FLICKER_PERIOD = 7.4;
export const CITY_FLICKER_SPREAD = 0.28; // +/- fraction, so 5.3s to 9.5s
export const CITY_FLICKER_LEN = 0.38; // seconds of misbehaviour per period
export const CITY_FLICKER_DIP = 0.2; // level during a dropout

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

export const CASTLE_TIERS = 4;
export const CASTLE_SHRINK = 0.75; // each storey against the one below
export const CASTLE_EAVE_OVER = 1.2; // eave overhang, against its own storey
export const CASTLE_RISE = 0.4; // roof rise, against the eave half-width
export const CASTLE_DRUM = 0.5; // storey wall height, against its half-width
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
// Night rig
//
// THE PLACE TO TUNE OVERALL SCENE BRIGHTNESS. These used to be literals inside
// core/lights.js; they are here because they are exactly the numbers you want
// to sit and nudge, and config.js is where this project keeps those.
//
// Know their relative strength before reaching for one, because it is not what
// you would guess. Measured on a roof facing straight up, the three fills
// contribute roughly:
//
//     moon (directional)   0.33   <- dominates anything facing up or +Z
//     hemisphere sky       0.13
//     ambient              0.06 at intensity 0.35
//
// So AMBIENT_INTENSITY is the gentlest of the three and the safest to push: it
// lifts the surfaces the moon misses - the +X flanks and everything in shadow -
// without flattening the moon's modelling. It is also weak enough that large
// numbers here are normal. Doubling it does not double the scene.
//
// There is enormous headroom before any of this matters to the readout. A roof
// sits near luma 0.03 against the dimmest ambient WINDOW at 0.28 and the bloom
// threshold at 0.58, so the buildings can be lifted several times over before
// they start competing with the windows. What they cannot survive is the
// albedo trap in the note below.
// ---------------------------------------------------------------------------

export const AMBIENT_COLOUR = 0x5a6f96;
export const AMBIENT_INTENSITY = 0.75;

export const HEMI_SKY = 0x6d86c4;
export const HEMI_GROUND = 0x7a4a1e;
export const HEMI_INTENSITY = 0.5;

export const MOON_COLOUR = 0xaec4f0;
export const MOON_INTENSITY = 2.5;
export const MOON_DIR = [-9, 14, 6];

// ---------------------------------------------------------------------------
// Street-level shop fronts
//
// Two to a digit tower, in the blank band below the lowest window row. That
// band is why ROW_MIN is 1 and not 0 - street level was always meant to be
// something other than more windows.
//
// The vertical budget is tight and fixed: row 1's window reaches down to
// y = 0.81, so sill + opening + fascia has to finish under it. The numbers
// below stop at 0.72 and leave a strip of bare wall, which is what a real
// frontage has between the fascia and the first floor.
// ---------------------------------------------------------------------------

export const SHOP_W = 1.4; // frontage per shop
export const SHOP_DX = 0.8; // from the tower centre, so two sit side by side
export const SHOP_Y0 = 0.04; // sill
export const SHOP_H = 0.42; // opening
// The fascia carries the shop's sign and is the loudest part of a frontage in
// the reference, so it takes a real share of the height rather than a trim
// strip. Opening to fascia is about 1.75:1; sill + opening + fascia = 0.70,
// still under row 1's window at 0.81.
export const SHOP_FASCIA_H = 0.24;
export const SHOP_PROJ = 0.1; // how far the surround stands off the facade
export const SHOP_POST_W = 0.09;
export const SHOP_SHUTTER_RIBS = 5;

// The glazing is divided rather than one sheet. The division is made of REAL
// gaps with a frame member standing in each - not dark bars laid over one lit
// quad, which bloom would have closed back up. Each pane is its own instance
// and the gap between them is genuinely unlit, so the mullion survives.
export const SHOP_PANES = 3;
export const SHOP_MULLION_W = 0.05;
export const SHOP_MULLION_D = 0.06; // stands proud of the glass

// Open shops glow from inside; the fascia above them is a lit sign. Both are
// solved WELL under the 0.58 bloom threshold. A shop front is a large area
// compared with a window - five times one - and area reads as brightness, so
// matching a window's luma would have made the street the loudest thing here.
// Both are TARGET LUMA, not instance levels - levelFor() solves the level per
// hue, so a red fascia and a white one land at the same brightness instead of
// the red one disappearing.
export const SHOP_GLOW = 0.44; // shop interior
export const SHOP_SIGN_GLOW = 0.5; // the fascia sign above it

// ---------------------------------------------------------------------------
// The painted billboard
//
// The one sign in the city that is not neon. It is a flat board with black
// characters, floodlit from below - so unlike everything else here it is LIT
// rather than emissive, and that is the whole reason it reads as a different
// era of signage sitting among the tubes.
//
// Being lit is also what constrains it. A genuinely white panel comes out at
// luma 0.67 under this rig, past the 0.58 bloom threshold, and glows like a
// lightbox - which is exactly what it must not look like. MAT.billboard is
// solved to 0.31 instead: seven times brighter than any building face, so it
// still reads as white paint, with room left for the lamps to lift its lower
// half without crossing over.
// ---------------------------------------------------------------------------

export const BILLBOARD_EM = 0.52; // character cell
export const BILLBOARD_GAP = 0.07;
export const BILLBOARD_PAD = 0.2; // board edge to the nearest character
export const BILLBOARD_D = 0.1; // board thickness
export const BILLBOARD_FRAME = 0.055; // the surround, proud of the board
export const BILLBOARD_LEG_H = 0.24; // stands clear of the parapet
export const BILLBOARD_LEG_W = 0.08;

// Painted strokes are far fatter than neon tube relative to their character -
// a brush is not a 12mm tube - so this is nearly double CITY_TUBE_RATIO.
export const BILLBOARD_STROKE = 0.062;

// The floodlights, solved rather than picked. A point light this close to a
// panel is all hot spot: at the first standoff tried, 0.16 below and 0.3 in
// front, the board peaked at luma 3.1 - five times the bloom threshold, two
// glaring blobs where the wash should be. The board can only stand 0.24 clear
// of the parapet, so the lamps cannot simply drop further away from it; the
// intensity has to come down with the standoff.
//
// These land the panel at 0.52 peak against the 0.58 threshold, with the
// bottom 1.65x the top - a wash that reads as floodlighting and stops short of
// glowing. Raise the intensity and the bottom edge blooms before anything else
// in the scene does.
export const BILLBOARD_LAMP_DROP = 0.26; // below the board's bottom edge
export const BILLBOARD_LAMP_OUT = 0.45; // in front of the board face
export const BILLBOARD_LAMP_COLOUR = 0xffdcae;
export const BILLBOARD_LAMP_INTENSITY = 0.25;
export const BILLBOARD_LAMP_RANGE = 2.4;

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

// ---------------------------------------------------------------------------
// Room life
//
// Ambient windows switching themselves on and off, so the city is not a still
// photograph with a clock painted on it.
//
// ROOM_TOGGLE_RATE is expressed CITY-WIDE - toggles per second across every
// room there is - because that is the number you can actually judge by eye.
// The per-room interval is derived from it and the room count, so adding
// buildings does not quietly make the city busier.
//
// Rooms fade slower than digits (0.28/0.45) on purpose. They are background
// motion, and anything that snaps at the digits' speed competes with them.
// ---------------------------------------------------------------------------

export const ROOM_TOGGLE_RATE = 0.6; // toggles per second, whole city
export const ROOM_ON_DURATION = 0.6;
export const ROOM_OFF_DURATION = 1.1;

// ---------------------------------------------------------------------------
// The second hand
//
// Once a second, a few windows on the digit towers' front faces swap: the same
// number on as off, so the lit count on those faces never moves and the tick
// reads as a CHANGE rather than as a pulse of brightness.
//
// These windows belong to the tick alone and are kept out of the slow room
// toggling - two systems driving one window would disagree about whether it is
// lit, and the loser would flicker.
//
// Fades are quick, near the digits' own speed, because a slow tick is not a
// tick. They can afford to be: an ambient window peaks at luma 0.4 against a
// digit's 1.39, so being fast does not make them loud.
// ---------------------------------------------------------------------------

export const TICK_MIN = 3; // windows swapped per second
export const TICK_MAX = 4;
export const TICK_ON_DURATION = 0.22;
export const TICK_OFF_DURATION = 0.32;

export const BEACON_PERIOD = 2.4; // rooftop antenna blink
