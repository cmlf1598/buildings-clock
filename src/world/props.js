import * as THREE from "three";
import { MAT } from "../emissive/palette.js";
import { LAMPS, CARS, CAR_W, CAR_H, CAR_D, LAMP_HEIGHT } from "./layout.js";

const _dummy = new THREE.Object3D();

/**
 * Streetlamp posts and car bodies.
 *
 * Both are instanced, so the whole prop layer costs two draw calls no matter
 * how many get added later. Their light sources are NOT here - lamp heads,
 * headlights and taillights live in WindowField so they bloom with everything
 * else in the scene.
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

  const carGeo = new THREE.BoxGeometry(1, 1, 1);
  const cars = new THREE.InstancedMesh(carGeo, mat, CARS.length);
  cars.frustumCulled = false;
  CARS.forEach((c, i) => {
    _dummy.position.set(c.x, CAR_H / 2, c.z);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(CAR_W, CAR_H, CAR_D);
    _dummy.updateMatrix();
    cars.setMatrixAt(i, _dummy.matrix);
  });
  cars.instanceMatrix.needsUpdate = true;
  group.add(cars);

  scene.add(group);
  return group;
}
