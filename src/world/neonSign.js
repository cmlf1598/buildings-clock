import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MAT, SIGN_GREEN, SIGN_RED, SIGN_DIM } from "../emissive/palette.js";
import { GLYPHS, SLANT, wordWidth } from "../data/scriptGlyphs.js";
import {
  SIGN_X,
  SIGN_Y,
  SIGN_Z,
  SIGN_W,
  SIGN_H,
  SIGN_D,
  SIGN_BOX_W,
  SIGN_BOX_H,
  SIGN_BOX_GAP,
  SIGN_BOX_PAD,
  SIGN_CORNER_R,
  SIGN_TUBE_BORDER,
  SIGN_TUBE_LETTER,
  SIGN_FADE,
} from "../config.js";

/**
 * The AM/PM sign, as actual neon: a green tube frame with red script letters
 * inside, one box for "am" and one for "pm". Only the active box is lit; the
 * other sits dark enough to read as unlit glass but bright enough that you can
 * still see the letterform, which is what a real double-sided sign looks like.
 *
 * Everything here is TubeGeometry swept along the centrelines in
 * data/scriptGlyphs.js, because neon IS bent tube - an outline font or a
 * dot matrix cannot give you the continuous stroke and the round cross-section
 * that makes the glow read correctly.
 *
 * All the tubes of one box are merged into a single geometry, so the whole
 * sign is four meshes (two frames, two words) rather than one per stroke.
 */

/** Dense rounded-rectangle polyline, centred on the origin. */
function roundedRectPoints(w, h, r, perCorner = 6) {
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  const pts = [];
  const corners = [
    [hw, hh, 0],
    [-hw, hh, Math.PI / 2],
    [-hw, -hh, Math.PI],
    [hw, -hh, -Math.PI / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = a0 + (i / perCorner) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), 0));
    }
  }
  return pts;
}

function tubeFrom(points, closed, radius, segmentsPerPoint = 6) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  const segs = Math.max(16, points.length * segmentsPerPoint);
  return new THREE.TubeGeometry(curve, segs, radius, 6, closed);
}

/**
 * Lofts one word into a single merged geometry.
 * `scale` maps glyph units to world units; the word is centred on (0, 0).
 */
function buildWord(word, scale, baselineY, radius) {
  const totalW = wordWidth(word) * scale;
  let penX = -totalW / 2;
  const parts = [];

  for (const ch of word) {
    const glyph = GLYPHS[ch];
    for (const stroke of glyph.strokes) {
      const pts = stroke.points.map(([x, y]) => {
        // Shear for the italic slant, then place on the baseline.
        const sx = (x + y * SLANT) * scale + penX;
        const sy = y * scale + baselineY;
        return new THREE.Vector3(sx, sy, 0);
      });
      parts.push(tubeFrom(pts, stroke.closed === true, radius));
    }
    penX += glyph.advance * scale;
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

class SignBox {
  constructor(word, centreY) {
    const group = new THREE.Group();

    // Green frame.
    const frameGeo = tubeFrom(
      roundedRectPoints(SIGN_BOX_W, SIGN_BOX_H, SIGN_CORNER_R),
      true,
      SIGN_TUBE_BORDER,
      3,
    );
    this.frameMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const frame = new THREE.Mesh(frameGeo, this.frameMat);
    frame.position.set(0, 0, 0.05);
    group.add(frame);

    // Red letters, scaled to fit the box interior.
    const innerW = SIGN_BOX_W - SIGN_BOX_PAD * 2;
    const scale = innerW / wordWidth(word);
    const letterGeo = buildWord(word, scale, -scale * 0.42, SIGN_TUBE_LETTER);
    this.letterMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const letters = new THREE.Mesh(letterGeo, this.letterMat);
    letters.position.set(0, 0, 0.09);
    group.add(letters);

    group.position.set(SIGN_X, centreY, SIGN_Z + SIGN_D / 2);
    this.group = group;

    this.level = 0; // 0 = dark, 1 = lit
    this.target = 0;
    this.applyLevel();
  }

  applyLevel() {
    const t = this.level;
    this.frameMat.color.copy(SIGN_DIM.green).lerp(SIGN_GREEN, t);
    this.letterMat.color.copy(SIGN_DIM.red).lerp(SIGN_RED, t);
  }

  step(dt) {
    if (this.level === this.target) return false;
    const d = (this.target - this.level) * Math.min(1, dt / SIGN_FADE);
    this.level += d;
    if (Math.abs(this.target - this.level) < 0.002) this.level = this.target;
    this.applyLevel();
    return true;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    this.frameMat.dispose();
    this.letterMat.dispose();
  }
}

export class NeonSign {
  constructor(scene) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: MAT.panel });

    // Dark backing panel. It clears tower 5's flank entirely in x, for the
    // same reason the old sign had to: anything inboard of the flank sits
    // inside the building volume and never renders.
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(SIGN_W, SIGN_H, SIGN_D),
      mat,
    );
    panel.position.set(SIGN_X, SIGN_Y, SIGN_Z);
    group.add(panel);

    // Two brackets back to the wall. They start inside the facade, so the
    // junction has no seam and no coplanar surfaces to z-fight.
    const armGeo = new THREE.BoxGeometry(1, 1, 1);
    const inner = 11.16;
    const outer = SIGN_X - SIGN_W / 2 + 0.05;
    for (const y of [SIGN_Y + SIGN_H * 0.33, SIGN_Y - SIGN_H * 0.33]) {
      const arm = new THREE.Mesh(armGeo, mat);
      arm.position.set((inner + outer) / 2, y, SIGN_Z);
      arm.scale.set(outer - inner, 0.13, 0.1);
      group.add(arm);
    }

    const offset = (SIGN_BOX_H + SIGN_BOX_GAP) / 2;
    this.am = new SignBox("am", SIGN_Y + offset);
    this.pm = new SignBox("pm", SIGN_Y - offset);
    group.add(this.am.group, this.pm.group);

    scene.add(group);
    this.group = group;
  }

  /** Lights one box and darkens the other. */
  setPM(isPM) {
    this.am.target = isPM ? 0 : 1;
    this.pm.target = isPM ? 1 : 0;
  }

  step(dt) {
    this.am.step(dt);
    this.pm.step(dt);
  }

  dispose() {
    this.am.dispose();
    this.pm.dispose();
  }
}
