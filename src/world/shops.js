import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MAT } from "../emissive/palette.js";
import { shopParts } from "./layout.js";
import {
  SHOP_PROJ,
  SHOP_POST_W,
  SHOP_FASCIA_H,
  SHOP_SHUTTER_RIBS,
  SHOP_MULLION_W,
  SHOP_MULLION_D,
} from "../config.js";

/**
 * Shop fronts along the bottom of the digit towers.
 *
 * The whole point is the MIX. A row of identical lit units reads as a repeated
 * decal; it is the shuttered ones that turn it into a street, because a closed
 * shop is a thing that happened rather than a thing that was drawn. The
 * reference does the same - two pulled-down shutters among the lit frontages -
 * and they carry more of the look than the lit ones do.
 *
 * What is here is only the SOLID half: surround, sill, fascia box, the mullions
 * dividing an open shop's glazing, and on the closed ones the shutter and its
 * ribs. The glow of an open shop and the light
 * in its fascia sign are quads in WindowField, built from the same shopParts()
 * description, so they cost no draw call and bloom with everything else in the
 * city.
 *
 * A closed shop therefore has no emissive part at all. That is not an omission:
 * it is the entire difference between the two states, and the shutter is left
 * to read on albedo alone - which it can, at five times the luma of the wall
 * around it.
 *
 * Two draw calls: everything dark merged, and the shutters, which need their
 * own paler material.
 */
export function createShops(scene) {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);

  const dark = [];
  const shutters = [];
  const put = (into, x, y, z, w, h, d) =>
    into.push(
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

  for (const s of shopParts()) {
    const zMid = s.z + SHOP_PROJ / 2;
    const hOpen = s.y1 - s.y0;

    // Side posts, framing the opening.
    for (const sx of [-1, 1]) {
      put(
        dark,
        s.x + sx * (s.w / 2 - SHOP_POST_W / 2),
        (s.y0 + s.y1) / 2,
        zMid,
        SHOP_POST_W,
        hOpen,
        SHOP_PROJ,
      );
    }

    // Sill, and the fascia band above the opening.
    put(dark, s.x, s.y0 / 2, zMid, s.w, s.y0, SHOP_PROJ);
    put(
      dark,
      s.x,
      (s.fascia0 + s.fascia1) / 2,
      zMid,
      s.w,
      SHOP_FASCIA_H,
      SHOP_PROJ,
    );

    if (s.open) {
      // Frame members between the panes. They stand proud of the glass so the
      // division reads as joinery rather than as a gap in the lighting.
      for (const m of s.mullions) {
        put(
          dark,
          m.x,
          (s.y0 + s.y1) / 2,
          s.z + SHOP_MULLION_D / 2,
          SHOP_MULLION_W,
          hOpen,
          SHOP_MULLION_D,
        );
      }
      continue;
    }

    // Shuttered: a panel across the opening, plus ribs. The ribs are what make
    // it read as a roller shutter rather than as a boarded hole - corrugation
    // is the only cue at this size, since the whole thing is barely 40px wide.
    const inner = s.w - SHOP_POST_W * 2;
    put(shutters, s.x, (s.y0 + s.y1) / 2, s.z + 0.03, inner, hOpen, 0.02);
    for (let r = 0; r < SHOP_SHUTTER_RIBS; r++) {
      const y = s.y0 + ((r + 0.5) / SHOP_SHUTTER_RIBS) * hOpen;
      put(shutters, s.x, y, s.z + 0.045, inner, hOpen / SHOP_SHUTTER_RIBS * 0.45, 0.015);
    }
  }

  const darkMat = new THREE.MeshLambertMaterial({ color: MAT.shop });
  group.add(new THREE.Mesh(mergeGeometries(dark, false), darkMat));
  for (const g of dark) g.dispose();

  const shutterMat = new THREE.MeshLambertMaterial({ color: MAT.shutter });
  group.add(new THREE.Mesh(mergeGeometries(shutters, false), shutterMat));
  for (const g of shutters) g.dispose();

  box.dispose();
  scene.add(group);
  return { group, darkMat, shutterMat };
}
