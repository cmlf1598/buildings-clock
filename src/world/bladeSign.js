import * as THREE from "three";
import { MAT } from "../emissive/palette.js";
import {
  SIGN_X,
  SIGN_Y,
  SIGN_Z,
  SIGN_W,
  SIGN_H,
  SIGN_D,
} from "../config.js";

/**
 * The AM/PM blade sign: a panel held off the tower flank by two short
 * brackets, the way a real hotel blade sign hangs.
 *
 * The panel clears the building ENTIRELY in x. That is not cosmetic: the
 * tower flank is at x = 11.3, and any dot placed inboard of that sits inside
 * the building volume and simply does not render. An earlier version centred
 * the sign at 11.6, which buried the inner half of every letter and left the
 * sign unreadable.
 *
 * The brackets are what hide the gap, and because they intersect the wall
 * rather than resting flush against it, no two surfaces are coplanar and
 * there is nothing for z-fighting to latch onto.
 *
 * The lit dots themselves are instances in WindowField, so the AM to PM
 * switch at noon inherits the same staggered fade as a digit change for free.
 */
export function createBladeSign(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: MAT.panel });
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(SIGN_W, SIGN_H, SIGN_D),
    mat,
  );
  panel.position.set(SIGN_X, SIGN_Y, SIGN_Z);

  const group = new THREE.Group();
  group.add(panel);

  // Two brackets back to the wall. They start inside the facade so the
  // junction has no visible seam.
  const armGeo = new THREE.BoxGeometry(1, 1, 1);
  const inner = 11.16; // just inside the tower flank at 11.3
  const outer = SIGN_X - SIGN_W / 2 + 0.05;
  for (const y of [SIGN_Y + SIGN_H * 0.34, SIGN_Y - SIGN_H * 0.34]) {
    const arm = new THREE.Mesh(armGeo, mat);
    arm.position.set((inner + outer) / 2, y, SIGN_Z);
    arm.scale.set(outer - inner, 0.13, 0.1);
    group.add(arm);
  }

  scene.add(group);
  return group;
}
