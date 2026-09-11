import { debug } from "../config.js";
import { GLYPHS, BLANK } from "../data/font5x7.js";

/**
 * Virtual clock with a debug override.
 *
 * ?t=HH:MM sets the starting time (24h in, converted for display), ?rate
 * multiplies the passage of time. Both let you reach an interesting moment -
 * 11:59 AM to 12:00 PM especially - without waiting for the wall clock.
 */
function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

const realT0 = Date.now();
const overridden = parseHHMM(debug.time);
const virtT0 = overridden ?? realT0;
const rate = Number.isFinite(debug.rate) && debug.rate > 0 ? debug.rate : 1;

export function nowMs() {
  return virtT0 + (Date.now() - realT0) * rate;
}

/**
 * 12-hour readout.
 *
 * The hours-tens tower shows no digit at all for hours 1-9 (its windows fall
 * back to the ambient pattern), and midnight/noon read as 12 rather than 0.
 */
export function readClock() {
  const d = new Date(nowMs());
  const h24 = d.getHours();
  const isPM = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = d.getMinutes();
  return {
    digits: [
      h12 >= 10 ? Math.floor(h12 / 10) : -1, // -1 means blank
      h12 % 10,
      Math.floor(m / 10),
      m % 10,
    ],
    isPM,
    key: `${h12}:${m}:${isPM}`,
  };
}

export function glyphFor(digit) {
  return digit < 0 ? BLANK : GLYPHS[digit];
}

/**
 * Polls for a change. Returns the new reading on the tick it changes, else
 * null, so callers do no work on the vast majority of frames.
 */
export class TimeSource {
  constructor() {
    this.lastKey = null;
    this.cycleStep = -1;
  }

  poll() {
    if (debug.cycle) {
      const step = Math.floor(nowMs() / 1000) % 10;
      if (step === this.cycleStep) return null;
      this.cycleStep = step;
      return {
        digits: [step, step, step, step],
        isPM: step >= 5,
        key: `cycle${step}`,
      };
    }

    const r = readClock();
    if (r.key === this.lastKey) return null;
    this.lastKey = r.key;
    return r;
  }
}
