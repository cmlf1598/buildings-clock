import {
  ON_DURATION,
  OFF_DURATION,
  STAGGER_ON_ROW,
  STAGGER_OFF_ROW,
  STAGGER_JITTER_ON,
  STAGGER_JITTER_OFF,
  BUILDING_CASCADE,
} from "../config.js";
import { GLYPH_W, GLYPH_H } from "../data/font5x7.js";
import { hash01 } from "../util/rng.js";

/**
 * Scheduler for the staggered fades.
 *
 * Split of responsibility: WindowField knows HOW to draw a brightness, this
 * knows WHEN. It mutates the field typed arrays directly and keeps its own
 * active list so a frame between minute ticks touches nothing at all.
 *
 * The active list is a dense Int32Array plus a reverse index, so adding,
 * removing and re-scheduling are all O(1) and allocation-free. Completed
 * tweens are removed by swapping with the last entry.
 */
export class Animator {
  constructor(field) {
    this.f = field;
    const n = field.count;
    this.activeList = new Int32Array(n);
    this.activeSlot = new Int32Array(n).fill(-1);
    this.activeCount = 0;
  }

  #add(i) {
    if (this.activeSlot[i] !== -1) return;
    const s = this.activeCount++;
    this.activeList[s] = i;
    this.activeSlot[i] = s;
  }

  #removeAt(s) {
    const i = this.activeList[s];
    const last = --this.activeCount;
    const moved = this.activeList[last];
    this.activeList[s] = moved;
    this.activeSlot[moved] = s;
    this.activeSlot[i] = -1;
  }

  /**
   * Retargets one instance. Starting from the CURRENT value rather than from
   * the previous target means a window interrupted mid-fade re-tweens from
   * wherever it actually is, with no pop.
   */
  schedule(i, target, delay, duration, mode) {
    const f = this.f;
    f.from[i] = f.current[i];
    f.target[i] = target;
    f.phase[i] = 0;
    f.speed[i] = 1 / duration;
    f.delay[i] = delay;
    f.mode[i] = mode;
    this.#add(i);
  }

  /**
   * Applies a glyph to one tower, scheduling ONLY the cells whose state
   * actually changed. A normal minute tick flips a handful of windows.
   *
   * `prev` is mutated to hold the new bitmap.
   *
   * ON is fast and eases out, like a fluorescent tube snapping on, and ripples
   * bottom-up. OFF is slower and eases in, like a filament cooling, and runs
   * top-down. The asymmetry is what makes it read as rooms rather than pixels,
   * and the opposing directions stop a change looking like a symmetric wipe.
   */
  applyGlyph(map, next, prev, slot, cols = GLYPH_W) {
    const f = this.f;
    const cells = cols * GLYPH_H;
    const cascade = slot * BUILDING_CASCADE;

    for (let k = 0; k < cells; k++) {
      const i = map[k];
      if (i < 0) continue;

      const on = next[k] === 1;
      // Blank glyph falls back to the ambient level, so the hours-tens tower
      // reads as an ordinary inhabited building rather than a dead one.
      const want = on ? 1 : f.base[i];
      if (next[k] === prev[k] && Math.abs(f.target[i] - want) < 1e-4) continue;

      const row = (k / cols) | 0;
      const rising = want > f.current[i];
      const stagger = rising
        ? (GLYPH_H - 1 - row) * STAGGER_ON_ROW + hash01(i) * STAGGER_JITTER_ON
        : row * STAGGER_OFF_ROW + hash01(i * 7919) * STAGGER_JITTER_OFF;

      this.schedule(
        i,
        want,
        cascade + stagger,
        rising ? ON_DURATION : OFF_DURATION,
        rising ? 1 : 0,
      );
    }
    prev.set(next);
  }

  step(dt) {
    const f = this.f;
    for (let s = 0; s < this.activeCount; ) {
      const i = this.activeList[s];

      if (f.delay[i] > 0) {
        f.delay[i] -= dt;
        if (f.delay[i] > 0) {
          s++;
          continue;
        }
      }

      const p = Math.min(1, f.phase[i] + dt * f.speed[i]);
      f.phase[i] = p;
      const e = f.mode[i] === 1 ? 1 - (1 - p) * (1 - p) * (1 - p) : p * p;
      f.current[i] = f.from[i] + (f.target[i] - f.from[i]) * e;
      f.writeColor(i);

      // Do NOT advance s here: the swap moved a new instance into this slot.
      if (p >= 1) this.#removeAt(s);
      else s++;
    }
  }
}
