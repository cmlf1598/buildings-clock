/**
 * Hand-authored script letterforms for the neon sign, as tube centrelines.
 *
 * Neon is bent tube, so these are STROKES (paths the tube follows), not
 * outlines. Each glyph is a list of strokes; each stroke is a list of [x, y]
 * control points that get lofted into a TubeGeometry. A closed stroke joins
 * back on itself, which is how the bowls of "a" and "p" are made.
 *
 * Coordinate space per glyph: baseline at y = 0, x-height at y = 1, advance
 * measured in the same units. Descenders go negative. The italic slant is NOT
 * baked into these points - it is applied as a shear when the tubes are built,
 * so the upright shapes stay easy to edit.
 *
 * Only a, m and p exist, because the sign only ever spells "am" and "pm".
 */

export const X_HEIGHT = 1.0;
export const SLANT = 0.14; // shear applied at build time, x += y * SLANT

export const GLYPHS = {
  a: {
    advance: 0.82,
    strokes: [
      {
        // bowl
        closed: true,
        points: [
          [0.66, 0.52],
          [0.61, 0.75],
          [0.43, 0.87],
          [0.22, 0.8],
          [0.1, 0.58],
          [0.1, 0.34],
          [0.22, 0.12],
          [0.43, 0.05],
          [0.61, 0.18],
          [0.66, 0.38],
        ],
      },
      {
        // stem down the right of the bowl, with an exit flick
        points: [
          [0.71, 0.86],
          [0.69, 0.6],
          [0.68, 0.32],
          [0.7, 0.12],
          [0.78, 0.03],
          [0.9, 0.04],
        ],
      },
    ],
  },

  m: {
    advance: 1.12,
    strokes: [
      {
        // first stem, with a small entry curve at the top
        points: [
          [0.04, 0.6],
          [0.09, 0.73],
          [0.09, 0.42],
          [0.09, 0.05],
        ],
      },
      {
        // first shoulder into the second stem
        points: [
          [0.08, 0.55],
          [0.17, 0.73],
          [0.33, 0.76],
          [0.45, 0.6],
          [0.46, 0.32],
          [0.46, 0.05],
        ],
      },
      {
        // second shoulder into the third stem, with an exit flick
        points: [
          [0.45, 0.55],
          [0.54, 0.73],
          [0.7, 0.76],
          [0.82, 0.6],
          [0.83, 0.32],
          [0.84, 0.1],
          [0.96, 0.04],
        ],
      },
    ],
  },

  p: {
    advance: 0.84,
    strokes: [
      {
        // stem carrying on well below the baseline
        points: [
          [0.16, 0.74],
          [0.13, 0.44],
          [0.11, 0.1],
          [0.08, -0.2],
          [0.02, -0.46],
        ],
      },
      {
        // bowl, hung off the stem
        points: [
          [0.13, 0.63],
          [0.32, 0.76],
          [0.53, 0.66],
          [0.58, 0.43],
          [0.5, 0.2],
          [0.31, 0.1],
          [0.13, 0.16],
        ],
      },
    ],
  },
};

/** Total advance width of a word, in glyph units. */
export function wordWidth(word) {
  let w = 0;
  for (const ch of word) w += GLYPHS[ch].advance;
  return w;
}

// Fail loudly at import if a glyph the sign needs is missing or malformed.
for (const word of ["am", "pm"]) {
  for (const ch of word) {
    const g = GLYPHS[ch];
    if (!g) throw new Error(`scriptGlyphs: missing glyph "${ch}"`);
    if (!g.strokes.length) throw new Error(`scriptGlyphs: "${ch}" has no strokes`);
    for (const s of g.strokes) {
      if (s.points.length < 3) {
        throw new Error(`scriptGlyphs: "${ch}" stroke needs 3+ points`);
      }
    }
  }
}
