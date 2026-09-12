import { hash01 } from "../util/rng.js";
import {
  CITY_BREATHE,
  CITY_BREATHE_T,
  CITY_FLICKER_PERIOD,
  CITY_FLICKER_SPREAD,
  CITY_FLICKER_LEN,
  CITY_FLICKER_DIP,
} from "../config.js";

/**
 * What keeps the neon in this city from looking printed on.
 *
 * Two effects, deliberately unequal. Breathing is on everything and is almost
 * subliminal; a failing tube is on a named few and is gated to a short window
 * on a long cycle. Neither may pull the eye off the clock, which is the one
 * thing the whole palette is arranged to protect - a sign that strobes
 * continuously wins that fight every time.
 *
 * Both are pure functions of time, so nothing here holds state and nothing
 * drifts out of sync after a stall or a backgrounded tab.
 */

/** Slow amplitude wander, +/- CITY_BREATHE. */
export const breathe = (t, period, phase) =>
  1 + CITY_BREATHE * Math.sin((t / period) * Math.PI * 2 + phase);

/**
 * A tube on its way out: brief, irregular dropouts on a long cycle.
 *
 * Every argument past `t` exists so that two faulty signs never fail together.
 * The offset moves a tube's dropout to its own moment, the period stops the
 * moments recurring in lockstep afterwards, and the seed gives each tube its
 * own stutter pattern DURING a dropout - without it three tubes would blink the
 * same irregular rhythm at three different times, which is its own kind of
 * wrong.
 */
export function flicker(t, period, offset, seed) {
  const u = t + offset;
  if (u % period >= CITY_FLICKER_LEN) return 1;
  return hash01(Math.floor(u * 19) + seed) < 0.45 ? CITY_FLICKER_DIP : 1;
}

/**
 * Both of the seeded tables below hash `index + 1`, never `index`.
 *
 * hash01(0) is exactly 0, so index 0 would otherwise land on the extreme of
 * every range it is asked for - zero phase, zero offset, the short end of the
 * period - which is the opposite of the scatter these exist to provide. The
 * first sign in the table is a blade beside the clock, so it is the last one
 * that should be predictable.
 */
const seeded = (index, salt) => hash01((index + 1) * salt);

/** Seeded period and phase, so the city breathes identically on every reload. */
export const lifeFor = (index) => ({
  period: CITY_BREATHE_T[index % CITY_BREATHE_T.length],
  phase: seeded(index, 977) * Math.PI * 2,
});

/** Seeded fault clock, scattered so no two failing tubes dip together. */
export const faultFor = (index) => ({
  faultPeriod:
    CITY_FLICKER_PERIOD *
    (1 + (seeded(index, 5501) * 2 - 1) * CITY_FLICKER_SPREAD),
  faultOffset: seeded(index, 8677) * CITY_FLICKER_PERIOD,
  faultSeed: (seeded(index, 2903) * 0xffff) | 0,
});
