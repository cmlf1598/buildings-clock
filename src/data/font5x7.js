/**
 * 5x7 dot-matrix font.
 *
 * Glyphs are authored as arrays of seven 5-character strings so they can be
 * proof-read by eye in source, then decoded once to Uint8Array(35) with
 * index = row * 5 + col, row 0 = TOP.
 *
 * Shapes are chosen for legibility at 5x7, where the usual confusions are
 * 0/8, 6/8, 9/8 and 1/7:
 *   - 0 carries a diagonal through the counter; 8 has a clean waist.
 *   - 6 opens at the top where 8 closes; 9 opens at the bottom.
 *   - 6 and 9 are exact 180 degree rotations, so they read as a pair.
 *   - 1 has a top-left serif and a full base, so it is never a bare stroke.
 */

export const GLYPH_W = 5;
export const GLYPH_H = 7;

const RAW = {
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  A: ["..#..", ".#.#.", "#...#", "#...#", "#####", "#...#", "#...#"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
};

// Import-time validation. Catches the one class of bug that is genuinely
// annoying to diagnose visually, at the cheapest possible moment.
for (const [ch, rows] of Object.entries(RAW)) {
  if (rows.length !== GLYPH_H) {
    throw new Error(`glyph ${ch}: ${rows.length} rows, need ${GLYPH_H}`);
  }
  for (const line of rows) {
    if (line.length !== GLYPH_W || /[^#.]/.test(line)) {
      throw new Error(`glyph ${ch}: bad row "${line}"`);
    }
  }
}

function decode(rows) {
  const out = new Uint8Array(GLYPH_W * GLYPH_H);
  for (let r = 0; r < GLYPH_H; r++) {
    for (let c = 0; c < GLYPH_W; c++) {
      out[r * GLYPH_W + c] = rows[r][c] === "#" ? 1 : 0;
    }
  }
  return out;
}

export const GLYPHS = Object.fromEntries(
  Object.entries(RAW).map(([ch, rows]) => [ch, decode(rows)]),
);

/** Building 0 at hours 1-9: no digit at all. */
export const BLANK = new Uint8Array(GLYPH_W * GLYPH_H);

// The colon tower is narrow, so the colon is its own 2x7 glyph: two 2x2 dots.
export const COLON_W = 2;
export const COLON_RAW = ["..", "##", "##", "..", "##", "##", ".."];
export const COLON = (() => {
  const out = new Uint8Array(COLON_W * GLYPH_H);
  for (let r = 0; r < GLYPH_H; r++) {
    for (let c = 0; c < COLON_W; c++) {
      out[r * COLON_W + c] = COLON_RAW[r][c] === "#" ? 1 : 0;
    }
  }
  return out;
})();

/** Flat indices of the colon's lit cells — 8 of them. */
export const COLON_LIT = (() => {
  const lit = [];
  for (let i = 0; i < COLON.length; i++) if (COLON[i]) lit.push(i);
  return Int32Array.from(lit);
})();

/** ASCII art of every glyph, for eyeballing in the console. */
export function renderAll() {
  const keys = Object.keys(RAW);
  const lines = [];
  for (let r = 0; r < GLYPH_H; r++) {
    lines.push(keys.map((k) => RAW[k][r]).join("  "));
  }
  return `${keys.map((k) => ` ${k}   `).join("")}\n${lines.join("\n")}`;
}
