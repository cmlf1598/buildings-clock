/**
 * Kanji for the city signs, authored as tube centrelines.
 *
 * Same idea as data/scriptGlyphs.js and for the same reason, only more so:
 * neon is bent tube, and a kanji IS a stroke sequence. Every character below
 * is written the way it is brushed - one polyline per stroke, in stroke order
 * - so the tube the renderer sweeps follows the path a hand would. Tracing an
 * outline font and filling it would give you a flat decal; this gives you
 * glass.
 *
 * Coordinate space: a unit em box, origin bottom-left, y UP. Characters fill
 * roughly 0.03..0.97 on both axes, because kanji are square - unlike the Latin
 * glyphs next door there is no baseline and no per-glyph advance, every
 * character occupies the same cell. That is what lets them stack into a
 * vertical sign with even spacing and no kerning table.
 *
 * Stroke corners are deliberately plain polyline corners. The renderer
 * densifies each segment before lofting, so a Catmull-Rom through the result
 * keeps the straights straight and rounds only the last fraction before a
 * turn - which is exactly how a real bent tube behaves. Do NOT pre-round these
 * by hand; you would be applying the same fillet twice.
 *
 * Every character here means something about TIME, and the words they spell
 * are in WORDS below. Nothing is decorative gibberish: a street sign that
 * reads as nonsense to anyone who can actually read it is worse than no sign.
 */

export const KANJI = {
  // One. A single stroke, and the only glyph here that is one stroke.
  一: {
    gloss: "one",
    strokes: [[[0.07, 0.50], [0.93, 0.50]]],
  },

  // To live. The long stem runs the full height and everything crosses it; the
  // bottom bar is the widest stroke, which is what keeps it upright.
  生: {
    gloss: "life, to live",
    strokes: [
      [[0.54, 0.97], [0.12, 0.70]],
      [[0.16, 0.72], [0.82, 0.72]],
      [[0.08, 0.41], [0.88, 0.41]],
      [[0.52, 0.92], [0.52, 0.06]],
      [[0.04, 0.06], [0.96, 0.06]],
    ],
  },

  // Sun, day. Narrow and tall; the middle bar sits just above centre.
  日: {
    gloss: "sun, day",
    strokes: [
      [[0.30, 0.93], [0.30, 0.06]],
      [[0.30, 0.93], [0.70, 0.93], [0.70, 0.06]],
      [[0.30, 0.50], [0.70, 0.50]],
      [[0.30, 0.06], [0.70, 0.06]],
    ],
  },

  // Moon, month. The left stroke is the tell: it leans out and flicks away at
  // the bottom, which is the only thing separating it from a wide 日.
  月: {
    gloss: "moon, month",
    strokes: [
      [[0.33, 0.94], [0.29, 0.52], [0.25, 0.18], [0.15, 0.04]],
      [[0.33, 0.94], [0.74, 0.94], [0.74, 0.15], [0.64, 0.05]],
      [[0.31, 0.67], [0.74, 0.67]],
      [[0.28, 0.40], [0.74, 0.40]],
    ],
  },

  // Hour, time. 日 compressed on the left, 寺 on the right. Ten strokes.
  時: {
    gloss: "hour, time",
    strokes: [
      [[0.06, 0.84], [0.06, 0.19]],
      [[0.06, 0.84], [0.37, 0.84], [0.37, 0.19]],
      [[0.06, 0.52], [0.37, 0.52]],
      [[0.06, 0.19], [0.37, 0.19]],
      [[0.53, 0.86], [0.87, 0.86]],
      [[0.71, 0.95], [0.71, 0.61]],
      [[0.46, 0.61], [0.99, 0.61]],
      [[0.49, 0.40], [0.96, 0.40]],
      [[0.77, 0.53], [0.77, 0.13], [0.67, 0.06]],
      [[0.57, 0.31], [0.67, 0.22]],
    ],
  },

  // To measure, to count. 言 on the left, 十 on the right. Paired with 時 it
  // spells the most literal sign in the city.
  計: {
    gloss: "measure, count",
    strokes: [
      [[0.23, 0.97], [0.26, 0.88]],
      [[0.04, 0.80], [0.46, 0.80]],
      [[0.10, 0.67], [0.40, 0.67]],
      [[0.10, 0.54], [0.40, 0.54]],
      [[0.10, 0.40], [0.10, 0.07]],
      [[0.10, 0.40], [0.40, 0.40], [0.40, 0.07]],
      [[0.10, 0.07], [0.40, 0.07]],
      [[0.53, 0.50], [0.99, 0.50]],
      [[0.76, 0.90], [0.76, 0.07]],
    ],
  },

  // Now. Four strokes: the 𠆢 roof, a dot, and the bottom bend.
  今: {
    gloss: "now",
    strokes: [
      [[0.51, 0.97], [0.29, 0.72], [0.03, 0.50]],
      [[0.51, 0.97], [0.73, 0.72], [0.99, 0.50]],
      [[0.41, 0.49], [0.51, 0.33]],
      [[0.26, 0.22], [0.72, 0.22], [0.66, 0.03]],
    ],
  },

  // Minute (and, on its own, "to divide"). 八 over 刀.
  分: {
    gloss: "minute, to divide",
    strokes: [
      [[0.42, 0.95], [0.26, 0.76], [0.08, 0.59]],
      [[0.58, 0.95], [0.74, 0.76], [0.92, 0.59]],
      [[0.15, 0.48], [0.73, 0.48], [0.73, 0.19], [0.60, 0.07]],
      [[0.53, 0.48], [0.37, 0.25], [0.14, 0.04]],
    ],
  },

  // Second. 禾 on the left, 少 on the right.
  秒: {
    gloss: "second",
    strokes: [
      [[0.37, 0.94], [0.26, 0.86]],
      [[0.02, 0.79], [0.46, 0.79]],
      [[0.26, 0.86], [0.26, 0.06]],
      [[0.26, 0.57], [0.14, 0.41], [0.02, 0.28]],
      [[0.26, 0.57], [0.38, 0.41], [0.49, 0.27]],
      [[0.76, 0.89], [0.76, 0.53]],
      [[0.61, 0.85], [0.56, 0.68]],
      [[0.89, 0.85], [0.96, 0.68]],
      [[0.93, 0.57], [0.77, 0.28], [0.56, 0.05]],
    ],
  },

  // Bright, dawn - and the first half of "tomorrow". 日 and 月, the sun and
  // the moon side by side, which is the nicest etymology on the whole skyline.
  明: {
    gloss: "bright, dawn",
    strokes: [
      [[0.05, 0.86], [0.05, 0.20]],
      [[0.05, 0.86], [0.40, 0.86], [0.40, 0.20]],
      [[0.05, 0.53], [0.40, 0.53]],
      [[0.05, 0.20], [0.40, 0.20]],
      [[0.57, 0.94], [0.54, 0.52], [0.50, 0.18], [0.41, 0.04]],
      [[0.57, 0.94], [0.96, 0.94], [0.96, 0.15], [0.87, 0.05]],
      [[0.55, 0.67], [0.96, 0.67]],
      [[0.52, 0.40], [0.96, 0.40]],
    ],
  },
};

/**
 * The signs as WORDS rather than loose characters, with what they actually
 * say. Anything the city puts on a wall has to be in here.
 */
export const WORDS = {
  時計: { romaji: "tokei", means: "clock" },
  // A Zen saying: one day, one lifetime - live each day as if it were the
  // whole of your life. The painted board on tower 2 carries this one.
  一日一生: { romaji: "ichinichi-isshou", means: "one day, one lifetime" },
  今日: { romaji: "kyou", means: "today" },
  日時: { romaji: "nichiji", means: "date and time" },
  日月: { romaji: "jitsugetsu", means: "sun and moon; the passing of time" },
  明日: { romaji: "asu", means: "tomorrow" },
  時分秒: { romaji: "ji-fun-byou", means: "hours, minutes, seconds" },
  時: { romaji: "ji", means: "hour" },
  分: { romaji: "fun", means: "minute" },
  秒: { romaji: "byou", means: "second" },
  今: { romaji: "ima", means: "now" },
};

/**
 * Splits a word into characters. Every kanji here is in the Basic Multilingual
 * Plane, so spreading and .split("") agree - but spreading is the one that
 * stays correct if a character outside it ever shows up.
 */
export const chars = (word) => [...word];

// Fail loudly at import rather than rendering a blank sign at runtime.
for (const [word, meta] of Object.entries(WORDS)) {
  if (!meta.means) throw new Error(`kanjiGlyphs: "${word}" has no meaning`);
  for (const ch of chars(word)) {
    const g = KANJI[ch];
    if (!g) throw new Error(`kanjiGlyphs: missing kanji "${ch}" for "${word}"`);
    if (!g.strokes.length) throw new Error(`kanjiGlyphs: "${ch}" has no strokes`);
    for (const s of g.strokes) {
      if (s.length < 2) {
        throw new Error(`kanjiGlyphs: "${ch}" has a stroke with fewer than 2 points`);
      }
      for (const [x, y] of s) {
        if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) {
          throw new Error(
            `kanjiGlyphs: "${ch}" has a point outside the em box: ${x},${y}`,
          );
        }
      }
    }
  }
}
