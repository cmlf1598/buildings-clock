import { hash01 } from "../util/rng.js";
import {
  CITY_BREATHE,
  CITY_BREATHE_T,
  CITY_FLICKER_PERIOD,
  CITY_FLICKER_LEN,
} from "../config.js";

/**
 * What keeps the neon in this city from looking printed on.
 *
 * Two effects, deliberately unequal. Breathing is on everything and is almost
 * subliminal; the failing tube is on exactly one object and is gated to a short
 * window on a long period. Neither may pull the eye off the clock, which is the
 * one thing the whole palette is arranged to protect - a sign that strobes
 * continuously wins that fight every time.
 *
 * Both are pure functions of time, so nothing here holds state and nothing
 * drifts out of sync after a stall or a backgrounded tab.
 */

/** Slow amplitude wander, +/- CITY_BREATHE. */
export const breathe = (t, period, phase) =>
  1 + CITY_BREATHE * Math.sin((t / period) * Math.PI * 2 + phase);

/** A tube on its way out: brief, irregular dropouts on a long cycle. */
export function flicker(t) {
  if (t % CITY_FLICKER_PERIOD >= CITY_FLICKER_LEN) return 1;
  return hash01(Math.floor(t * 19)) < 0.45 ? 0.2 : 1;
}

/** Seeded period and phase, so the city breathes identically on every reload. */
export const lifeFor = (index) => ({
  period: CITY_BREATHE_T[index % CITY_BREATHE_T.length],
  phase: hash01(index * 977) * Math.PI * 2,
});
