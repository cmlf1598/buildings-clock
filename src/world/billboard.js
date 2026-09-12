import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MAT } from "../emissive/palette.js";
import { WORDS } from "../data/kanjiGlyphs.js";
import { BILLBOARD, billboardParts } from "./layout.js";
import { wordTubes } from "./tube.js";
import {
  BILLBOARD_GAP,
  BILLBOARD_D,
  BILLBOARD_FRAME,
  BILLBOARD_LEG_H,
  BILLBOARD_LEG_W,
  BILLBOARD_STROKE,
} from "../config.js";

/**
 * The painted board on the hours-ones tower: black characters on white, lit
 * from below by two floodlights.
 *
 * It is the one sign in the city that is not neon, and everything interesting
 * about it follows from that. Every other lit thing here is an unlit
 * MeshBasicMaterial carrying an HDR colour - it IS its own brightness. This is
 * MeshLambertMaterial: it has an albedo and it waits to be lit, which is what
 * makes it read as an older kind of signage sitting among the tubes.
 *
 * It also means it cannot be white. A true white panel resolves to luma 0.67
 * under the night rig, past the 0.58 bloom threshold, and glows like a
 * lightbox - the exact thing a painted board is not. MAT.billboard is solved to
 * 0.31 instead, seven times brighter than any building face, which reads as
 * white paint and leaves the lamps room to lift its lower half.
 *
 * The characters are the same stroke data as the neon, swept with a tube nearly
 * twice as fat relative to the character. A brush is not a 12mm tube, and at
 * this weight the strokes read as painted rather than as glass that happens to
 * be off.
 *
 * Three draw calls: the board, everything dark (frame, legs, lamp housings)
 * merged into one, and the lettering. The lamps' own glow is not here - those
 * are two quads in WindowField, so they cost nothing and bloom with every other
 * light in the city.
 */
export function createBillboard(scene) {
  if (!WORDS[BILLBOARD.word]) {
    throw new Error(
      `billboard: "${BILLBOARD.word}" is not in kanjiGlyphs WORDS - the board ` +
        `has to actually say something`,
    );
  }

  const b = billboardParts();
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);

  // -- the board ------------------------------------------------------------
  const panelMat = new THREE.MeshLambertMaterial({ color: MAT.billboard });
  const panel = new THREE.Mesh(box, panelMat);
  panel.position.set(b.x, b.y, b.z);
  panel.scale.set(b.w, b.h, BILLBOARD_D);
  group.add(panel);

  // -- everything dark, merged ----------------------------------------------
  const dark = [];
  const add = (x, y, z, w, h, d) =>
    dark.push(
      box
        .clone()
        .applyMatrix4(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, y, z),
            new THREE.Quaternion(),
            new THREE.Vector3(w, h, d),
          ),
        ),
    );

  // Surround, standing proud of the board on all four edges.
  const fz = b.z + BILLBOARD_D / 2;
  const ow = b.w + BILLBOARD_FRAME * 2;
  const oh = b.h + BILLBOARD_FRAME * 2;
  add(b.x, b.y + b.h / 2 + BILLBOARD_FRAME / 2, fz, ow, BILLBOARD_FRAME, 0.06);
  add(b.x, b.y - b.h / 2 - BILLBOARD_FRAME / 2, fz, ow, BILLBOARD_FRAME, 0.06);
  for (const sx of [-1, 1]) {
    add(b.x + sx * (b.w / 2 + BILLBOARD_FRAME / 2), b.y, fz, BILLBOARD_FRAME, oh, 0.06);
  }

  // Legs down to the parapet. They start inside the board so the junction has
  // no seam, the way the sign brackets do.
  const legTop = b.y - b.h / 2 + 0.05;
  for (const sx of [-1, 1]) {
    add(
      b.x + sx * b.w * 0.3,
      (b.deck + legTop) / 2,
      b.z,
      BILLBOARD_LEG_W,
      legTop - b.deck,
      BILLBOARD_LEG_W,
    );
  }

  // Floodlight housings, on short arms reaching out from under the board.
  for (const l of b.lamps) {
    add(l.x, l.y, l.z, 0.16, 0.1, 0.12);
    add(l.x, l.y + 0.04, (l.z + b.z) / 2, 0.05, 0.05, l.z - b.z);
  }

  const darkMat = new THREE.MeshLambertMaterial({ color: MAT.billboardFrame });
  const darkMesh = new THREE.Mesh(mergeGeometries(dark, false), darkMat);
  for (const g of dark) g.dispose();
  group.add(darkMesh);

  // -- the lettering --------------------------------------------------------
  const { geometry } = wordTubes(
    BILLBOARD.word,
    b.em,
    BILLBOARD_GAP,
    "h",
    b.em * BILLBOARD_STROKE,
  );
  const inkMat = new THREE.MeshLambertMaterial({ color: MAT.billboardInk });
  const ink = new THREE.Mesh(geometry, inkMat);
  // Sunk most of the way into the board, so the strokes read as paint on it
  // rather than as pipes bolted to it.
  ink.position.set(b.x, b.y, b.z + BILLBOARD_D / 2 - b.em * BILLBOARD_STROKE * 0.4);
  group.add(ink);

  box.dispose();
  scene.add(group);
  return { group, panelMat, darkMat, inkMat };
}
