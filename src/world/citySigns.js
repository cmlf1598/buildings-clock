import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  neon,
  CITY_HUE,
  CITY_INK_NEAR,
  CITY_INK_FAR,
  CITY_FRAME_LUMA,
  CITY_PANEL,
} from "../emissive/palette.js";
import { KANJI, WORDS, chars } from "../data/kanjiGlyphs.js";
import { CITY_SIGNS, BUILDINGS } from "./layout.js";
import { roundedRectPoints, tubeFrom, densify } from "./tube.js";
import { breathe, flicker, lifeFor } from "../emissive/neonLife.js";
import {
  PARAPET_T,
  SIGN_X,
  SIGN_Y,
  SIGN_Z,
  CITY_EM,
  CITY_CHAR_GAP,
  CITY_PAD,
  CITY_PANEL_D,
  CITY_TUBE_RATIO,
  CITY_FRAME_INSET,
  CITY_CORNER_R,
  CITY_LEG_H,
  CITY_LEG_W,
  CITY_BRACKET_T,
  CITY_FLICKER_SIGN,
  CITY_BLADE_X,
  CITY_BLADE_INNER,
  CITY_BLADE_EM,
  CITY_UNDER_Y,
  CITY_UNDER_EM,
} from "../config.js";

/**
 * The kanji signs on the skyline: five standing on rooftops, two hung off
 * tower flanks the way the AM/PM blade is.
 *
 * Same construction as the AM/PM sign - TubeGeometry swept along hand-authored
 * centrelines - which is why a kanji suits this scene so well. A kanji is
 * already a stroke sequence, so it maps onto bent tube with nothing lost,
 * where a Latin letter has to be talked into it.
 *
 * Everything is sized from CONTENT: the panel is characters + gaps + padding,
 * the brackets run from the panel edge back into the host facade, and the legs
 * run from the panel down to the host's parapet. Change an em size or a
 * character count and the whole assembly resizes, with nothing left to keep in
 * sync by hand.
 *
 * Draw calls: the panels, legs and brackets of ALL signs share one material,
 * so they merge into a single mesh. Only the lit tubes need one mesh each,
 * because each sign is its own colour.
 */

const CELL_MAX_SEG = 0.055; // fillet radius on stroke corners, in em units

/**
 * Lofts one word into a single merged geometry, centred on the origin.
 *
 * Vertical is the default for a Japanese sign and the reason these read as
 * signage rather than as a caption: a blade is a column of square cells, so
 * the characters need no kerning and the panel is exactly one em wide.
 */
function buildWord(word, em, dir) {
  const cs = chars(word);
  const n = cs.length;
  const span = n * em + (n - 1) * CITY_CHAR_GAP; // along the reading direction
  const radius = em * CITY_TUBE_RATIO;
  const parts = [];

  cs.forEach((ch, i) => {
    // Bottom-left corner of this character's em box, in sign space.
    const ox = dir === "h" ? -span / 2 + i * (em + CITY_CHAR_GAP) : -em / 2;
    const oy =
      dir === "h"
        ? -em / 2
        : span / 2 - (i + 1) * em - i * CITY_CHAR_GAP;

    for (const stroke of KANJI[ch].strokes) {
      const pts = densify(stroke, CELL_MAX_SEG).map(([x, y]) =>
        new THREE.Vector3(ox + x * em, oy + y * em, 0),
      );
      parts.push(tubeFrom(pts, false, radius, 1, 4));
    }
  });

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();

  return {
    geometry: merged,
    w: dir === "h" ? span + CITY_PAD * 2 : em + CITY_PAD * 2,
    h: dir === "h" ? em + CITY_PAD * 2 : span + CITY_PAD * 2,
  };
}

/** Where a sign's panel centre sits, and what structure holds it up. */
function mount(spec, w, h) {
  if (spec.mount === "roof") {
    const host = BUILDINGS[spec.host];
    if (!host) throw new Error(`citySigns: unknown host "${spec.host}"`);
    // The parapet top, not the roof slab: a sign sitting flush on the deck
    // reads as a billboard that fell over.
    const deck = host.H + PARAPET_T;
    const y = deck + CITY_LEG_H + h / 2;
    return {
      pos: [spec.x, y, spec.z],
      // Two legs, inset from the panel edges so they read as a stand.
      struts: [-w * 0.3, w * 0.3].map((dx) => ({
        pos: [spec.x + dx, deck + (y - h / 2 - deck) / 2, spec.z],
        scale: [CITY_LEG_W, y - h / 2 - deck, CITY_LEG_W],
      })),
    };
  }

  // Blade: hung off a tower flank on two arms that start INSIDE the facade,
  // so the junction has no seam and no coplanar faces to z-fight.
  const right = spec.side === "right";
  const x = right ? SIGN_X : CITY_BLADE_X;
  const y = right ? CITY_UNDER_Y : SIGN_Y;
  const inner = right ? -CITY_BLADE_INNER : CITY_BLADE_INNER;
  // The arms run from the facade out to the panel's INBOARD edge, which is the
  // one nearer the tower - opposite sides for the left and right blades.
  const outer = right ? x - w / 2 + 0.05 : x + w / 2 - 0.05;
  return {
    pos: [x, y, SIGN_Z],
    struts: [y + h * 0.3, y - h * 0.3].map((ay) => ({
      pos: [(inner + outer) / 2, ay, SIGN_Z],
      scale: [Math.abs(outer - inner), CITY_BRACKET_T, 0.1],
    })),
  };
}

class CitySign {
  constructor(spec, index, structure) {
    const em =
      spec.em ??
      (spec.mount === "blade"
        ? spec.side === "right"
          ? CITY_UNDER_EM
          : CITY_BLADE_EM
        : CITY_EM);

    const { geometry, w, h } = buildWord(spec.word, em, spec.dir);
    const { pos, struts } = mount(spec, w, h);
    const group = new THREE.Group();

    // Panel and structure go into the shared merged mesh, not this group.
    structure.push({ pos, scale: [w, h, CITY_PANEL_D] }, ...struts);

    const inkLuma = spec.near ? CITY_INK_NEAR : CITY_INK_FAR;
    this.ink = neon(CITY_HUE[spec.ink], inkLuma);
    this.inkMat = new THREE.MeshBasicMaterial({ color: this.ink });
    const letters = new THREE.Mesh(geometry, this.inkMat);
    letters.position.set(0, 0, CITY_PANEL_D / 2 + 0.04);
    group.add(letters);

    this.frameMat = null;
    if (spec.frame) {
      const frameGeo = tubeFrom(
        roundedRectPoints(
          w - CITY_FRAME_INSET * 2,
          h - CITY_FRAME_INSET * 2,
          CITY_CORNER_R,
        ),
        true,
        em * CITY_TUBE_RATIO,
        2,
      );
      this.frame = neon(CITY_HUE[spec.frame], CITY_FRAME_LUMA);
      this.frameMat = new THREE.MeshBasicMaterial({ color: this.frame });
      const frame = new THREE.Mesh(frameGeo, this.frameMat);
      frame.position.set(0, 0, CITY_PANEL_D / 2 + 0.01);
      group.add(frame);
    }

    group.position.set(...pos);
    this.group = group;

    // Seeded, so the city breathes identically on every reload.
    Object.assign(this, lifeFor(index));
    this.faulty = spec.word === CITY_FLICKER_SIGN;
    this.level = 1;
  }

  /** Slow breathe, plus - on exactly one sign - a tube on its way out. */
  step(t) {
    let level = breathe(t, this.period, this.phase);
    if (this.faulty) level *= flicker(t);

    if (Math.abs(level - this.level) < 0.002) return;
    this.level = level;
    this.inkMat.color.copy(this.ink).multiplyScalar(level);
    if (this.frameMat) this.frameMat.color.copy(this.frame).multiplyScalar(level);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    this.inkMat.dispose();
    this.frameMat?.dispose();
  }
}

export class CitySigns {
  constructor(scene) {
    const group = new THREE.Group();
    const structure = [];

    this.signs = CITY_SIGNS.map((spec, i) => {
      const sign = new CitySign(spec, i, structure);
      group.add(sign.group);
      return sign;
    });

    // One mesh for every panel, leg and bracket in the city.
    const box = new THREE.BoxGeometry(1, 1, 1);
    const parts = structure.map(({ pos, scale }) =>
      box
        .clone()
        .applyMatrix4(
          new THREE.Matrix4().compose(
            new THREE.Vector3(...pos),
            new THREE.Quaternion(),
            new THREE.Vector3(...scale),
          ),
        ),
    );
    this.structureMat = new THREE.MeshLambertMaterial({ color: CITY_PANEL });
    this.structure = new THREE.Mesh(
      mergeGeometries(parts, false),
      this.structureMat,
    );
    for (const p of parts) p.dispose();
    box.dispose();
    group.add(this.structure);

    scene.add(group);
    this.group = group;
  }

  step(t) {
    for (const s of this.signs) s.step(t);
  }

  dispose() {
    for (const s of this.signs) s.dispose();
    this.structure.geometry.dispose();
    this.structureMat.dispose();
  }
}

// Fail loudly at import if a sign spells something that is not a real word.
for (const spec of CITY_SIGNS) {
  if (!WORDS[spec.word]) {
    throw new Error(
      `citySigns: "${spec.word}" is not in kanjiGlyphs WORDS - every sign in ` +
        `this city has to actually mean something`,
    );
  }
  if (!CITY_HUE[spec.ink]) {
    throw new Error(`citySigns: "${spec.word}" has unknown ink "${spec.ink}"`);
  }
}
