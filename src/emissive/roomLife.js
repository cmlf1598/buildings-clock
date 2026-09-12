import { hash01 } from "../util/rng.js";
import {
  AMBIENT_DENSITY,
  AMBIENT_GAIN_MIN,
  AMBIENT_GAIN_MAX,
  ROOM_TOGGLE_RATE,
  ROOM_ON_DURATION,
  ROOM_OFF_DURATION,
  debug,
} from "../config.js";

/**
 * Rooms switching their lights on and off, so the city is not a still
 * photograph with a clock painted on it.
 *
 * It owns no drawing and no tweening. When a room's turn comes it hands the
 * change to the same Animator the digits use, which already knows how to fade
 * one instance from wherever it happens to be - so a room caught mid-fade
 * re-tweens with no pop, and the whole thing costs one more entry on an active
 * list that was already there.
 *
 * WHAT IT MAY TOUCH. Only `field.rooms`, which windowLayout fills with the
 * ordinary ambient windows and nothing else. Digit cells belong to the glyph
 * animator, the colon and the beacons are written directly every frame, and
 * the separator rows are ambient but deliberately dark. Any of those flipping
 * on its own would be a bug you would have to stare at for a while.
 *
 * TIMING. A two-state Markov chain per room, with exponentially distributed
 * waits, so gaps are genuinely irregular rather than a jittered metronome.
 *
 * The two waits are DELIBERATELY unequal, and this is the part to not
 * "simplify". Draw both from the same distribution and every room ends up lit
 * half the time, so the city drifts from its designed 18% occupancy to 50% and
 * quietly gets twice as bright as it was built to be. Splitting the cycle by
 * AMBIENT_DENSITY makes that density the chain's stationary distribution
 * instead: rooms come and go forever and the lit fraction stays put.
 *
 * The cycle length is derived from the city-wide rate and the room count, which
 * is why ROOM_TOGGLE_RATE stays meaningful when buildings are added.
 *
 * Randomness comes from the STATELESS hash, never the seeded generator. The
 * generator is consumed once at build time in a fixed order and that is what
 * makes the city identical on every reload; drawing from it here would reshuffle
 * which windows start lit every time this file changed. For the same reason a
 * room's lit level is derived from its instance index rather than rolled - the
 * existing city comes out byte for byte identical to before this file existed.
 */
/**
 * The level a window glows at when lit.
 *
 * A room that starts dark has no stored level, so one is derived from its
 * instance index with the STATELESS hash. Rolling it from the seeded generator
 * would reshuffle which windows start lit and change the city.
 */
export function litLevelFor(field, i) {
  const base = field.base[i];
  return base > 0
    ? base
    : AMBIENT_GAIN_MIN +
        hash01(i * 0x9e3779b1) * (AMBIENT_GAIN_MAX - AMBIENT_GAIN_MIN);
}

export class RoomLife {
  constructor(field, animator) {
    this.field = field;
    this.animator = animator;
    this.rooms = field.rooms;

    const n = this.rooms.length;
    this.lit = new Float32Array(n); // the level this room glows at when on
    this.on = new Uint8Array(n);
    this.next = new Float32Array(n); // absolute time of this room's next flip
    this.seq = new Uint32Array(n); // draws taken, so each is a fresh sample

    // Rate is per SECOND across the whole city. One room therefore completes a
    // full on-off cycle every 2n/rate seconds, and that cycle splits by
    // AMBIENT_DENSITY so the lit fraction holds where it started.
    const cycle = (2 * n) / (ROOM_TOGGLE_RATE * Math.max(0.0001, debug.rooms));
    this.meanOn = AMBIENT_DENSITY * cycle;
    this.meanOff = (1 - AMBIENT_DENSITY) * cycle;

    for (let k = 0; k < n; k++) {
      const i = this.rooms[k];
      this.on[k] = field.base[i] > 0 ? 1 : 0;
      this.lit[k] = litLevelFor(field, i);
      this.next[k] = this.#wait(k, this.on[k] === 1);
    }
  }

  /**
   * How long this room stays in the state it is entering, exponentially
   * distributed. A lit room's stay is short and a dark room's is long, in the
   * ratio that holds the city at AMBIENT_DENSITY.
   */
  #wait(k, isOn) {
    const u = hash01(this.rooms[k] * 0x27d4eb2d + this.seq[k]++);
    const mean = isOn ? this.meanOn : this.meanOff;
    return -mean * Math.log(1 - Math.min(u, 0.999999));
  }

  /**
   * Takes ABSOLUTE elapsed time, not a delta.
   *
   * That matters for backgrounded tabs. The loop's Timer is connected to the
   * document and zeroes its delta while hidden, so elapsed time freezes with
   * it - come back after an hour and the city carries on from where it was
   * rather than firing every room it "missed" in one burst.
   *
   * The scan is linear over ~1200 rooms and compares one float each. A sorted
   * queue would be cheaper in theory and worse in every other way.
   */
  step(t) {
    const rooms = this.rooms;
    for (let k = 0; k < rooms.length; k++) {
      if (t < this.next[k]) continue;

      const turningOn = this.on[k] === 0;
      this.on[k] = turningOn ? 1 : 0;
      this.animator.schedule(
        rooms[k],
        turningOn ? this.lit[k] : 0,
        0,
        turningOn ? ROOM_ON_DURATION : ROOM_OFF_DURATION,
        turningOn ? 1 : 0,
      );
      this.next[k] = t + this.#wait(k, turningOn);
    }
  }
}
