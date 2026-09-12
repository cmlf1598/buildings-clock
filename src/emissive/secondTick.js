import { hash01 } from "../util/rng.js";
import { litLevelFor } from "./roomLife.js";
import {
  TICK_MIN,
  TICK_MAX,
  TICK_ON_DURATION,
  TICK_OFF_DURATION,
} from "../config.js";

/**
 * The second hand, made out of the city itself.
 *
 * Once a second a few windows on the digit towers' front faces swap: the same
 * number come on as go off. The equal count is the whole trick. A burst that
 * only lit windows would read as the building brightening and the eye would
 * tire of it in a minute; swapping keeps the lit total on those faces exactly
 * constant, so what registers is CHANGE, which is what a tick is.
 *
 * WHERE. Only `field.tickRooms` - ambient windows on the front faces of the
 * four towers that carry digits. The digit band itself sits between them with a
 * dark separator row above and below, so the movement frames the numerals
 * without ever touching them. The colon tower keeps the slow room life instead.
 *
 * These windows are kept OUT of RoomLife. Two systems driving one window would
 * disagree about whether it is lit, and whichever held the stale belief would
 * fight the other every time it fired.
 *
 * WHEN. On each whole second of elapsed time. This is the ONLY thing marking
 * seconds now - the colon used to pulse on the same beat, and two indicators
 * for one quantity is one too many when the second of them sits dead centre.
 * Elapsed time freezes with a backgrounded tab, so returning to one does not
 * fire every missed second at once; it simply carries on.
 */
export class SecondTick {
  constructor(field, animator) {
    this.field = field;
    this.animator = animator;
    this.pool = field.tickRooms;

    const n = this.pool.length;
    this.lit = new Float32Array(n);
    this.on = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      const i = this.pool[k];
      this.on[k] = field.base[i] > 0 ? 1 : 0;
      this.lit[k] = litLevelFor(field, i);
    }

    // Scratch, refilled each tick and never reallocated.
    this.litIdx = [];
    this.darkIdx = [];

    this.lastTick = 0; // so the first swap is at t = 1, not on the load frame
    this.draws = 0;
  }

  /** Stateless stream, seeded by the tick so a second is reproducible. */
  #rand(tick) {
    return hash01(tick * 0x9e3779b1 + this.draws++);
  }

  /** Takes n distinct entries off the front of `list`, Fisher-Yates style. */
  #take(list, n, tick) {
    for (let j = 0; j < n; j++) {
      const r = j + Math.floor(this.#rand(tick) * (list.length - j));
      const tmp = list[j];
      list[j] = list[r];
      list[r] = tmp;
    }
  }

  step(t) {
    const tick = Math.floor(t);
    if (tick === this.lastTick) return;
    this.lastTick = tick;

    const { litIdx, darkIdx, on } = this;
    litIdx.length = 0;
    darkIdx.length = 0;
    for (let k = 0; k < on.length; k++) (on[k] ? litIdx : darkIdx).push(k);

    // Clamped to what is actually available, so the swap stays balanced even if
    // the pool is ever small or lopsided.
    let n = TICK_MIN + Math.floor(this.#rand(tick) * (TICK_MAX - TICK_MIN + 1));
    n = Math.min(n, litIdx.length, darkIdx.length);
    if (n <= 0) return;

    this.#take(darkIdx, n, tick);
    this.#take(litIdx, n, tick);

    for (let j = 0; j < n; j++) {
      const k = darkIdx[j];
      on[k] = 1;
      this.animator.schedule(this.pool[k], this.lit[k], 0, TICK_ON_DURATION, 1);
    }
    for (let j = 0; j < n; j++) {
      const k = litIdx[j];
      on[k] = 0;
      this.animator.schedule(this.pool[k], 0, 0, TICK_OFF_DURATION, 0);
    }
  }
}
