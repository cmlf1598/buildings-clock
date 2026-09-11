/**
 * Two deliberately separate randomness mechanisms.
 *
 * `mulberry32` is SEQUENTIAL and consumed exactly once, at build time, in a
 * fixed traversal order — that is what makes the city identical on every
 * reload. `hash01` is STATELESS, so animation code can jitter a per-instance
 * delay at any moment without perturbing the generator and reshuffling the
 * city underneath it.
 *
 * Math.random() is never called anywhere in this project.
 */

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless integer avalanche -> [0, 1). */
export function hash01(i) {
  let x = i | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return (x >>> 0) / 4294967296;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
