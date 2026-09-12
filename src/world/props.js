import * as THREE from "three";
import { MAT } from "../emissive/palette.js";
import { LAMPS, LAMP_HEIGHT } from "./layout.js";

const _dummy = new THREE.Object3D();

/**
 * Streetlamp posts.
 *
 * Instanced, so the lamp layer costs one draw call however many get added. The
 * lamp HEADS are not here - those are quads in WindowField, so they bloom with
 * everything else in the scene.
 *
 * The cars used to live here too. They moved to traffic.js when they started
 * driving: a parked car is a matrix written once, and a moving one is a matrix
 * written every frame, which is a different kind of object.
 */
export function createProps(scene) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: MAT.prop });

  const postGeo = new THREE.CylinderGeometry(0.035, 0.05, LAMP_HEIGHT, 6);
  const posts = new THREE.InstancedMesh(postGeo, mat, LAMPS.length);
  posts.frustumCulled = false;
  LAMPS.forEach((l, i) => {
    _dummy.position.set(l.x, LAMP_HEIGHT / 2, l.z);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    posts.setMatrixAt(i, _dummy.matrix);
  });
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);

  scene.add(group);
  return group;
}
