import * as THREE from "three";
import { MAT } from "../emissive/palette.js";
import { SLAB, ROAD_W, ROADS_X, ROADS_Z, ROAD_Y } from "../config.js";

/**
 * The diorama slab and its road grid.
 *
 * The slab top doubles as the sidewalk surface, with roads cut into it as
 * darker inset strips - which is how the reference reads, and it avoids a
 * separate mesh for every kerb. The sides get their own darker material so
 * the block reads as a solid object floating in the dark rather than a
 * flat plane.
 */
export function createGround(scene) {
  const group = new THREE.Group();
  const w = SLAB.x1 - SLAB.x0;
  const d = SLAB.z1 - SLAB.z0;
  const cx = (SLAB.x0 + SLAB.x1) / 2;
  const cz = (SLAB.z0 + SLAB.z1) / 2;

  const topMat = new THREE.MeshLambertMaterial({ color: MAT.slab });
  const sideMat = new THREE.MeshLambertMaterial({ color: MAT.slabSide });
  const roadMat = new THREE.MeshLambertMaterial({ color: MAT.road });

  // BoxGeometry material order is +X, -X, +Y, -Y, +Z, -Z.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, SLAB.thickness, d), [
    sideMat,
    sideMat,
    topMat,
    sideMat,
    sideMat,
    sideMat,
  ]);
  slab.position.set(cx, -SLAB.thickness / 2, cz);
  group.add(slab);

  const roadGeo = new THREE.BoxGeometry(1, 1, 1);
  const addRoad = (x, z, rw, rd) => {
    const m = new THREE.Mesh(roadGeo, roadMat);
    m.position.set(x, ROAD_Y / 2, z);
    m.scale.set(rw, ROAD_Y, rd);
    group.add(m);
  };

  for (const z of ROADS_Z) addRoad(cx, z, w, ROAD_W);
  for (const x of ROADS_X) addRoad(x, cz, ROAD_W, d);

  scene.add(group);
  return group;
}
