import * as THREE from "three";
import { HEADLIGHT, TAILLIGHT, MAT } from "../emissive/palette.js";
import { CAR_ROUTES, CARS, CAR_W, CAR_H, CAR_D } from "./layout.js";
import {
  CAR_SPEED,
  CAR_HEAD_W,
  CAR_TAIL_W,
  CAR_LIGHT_H,
  ROAD_Y,
} from "../config.js";

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Cars driving a circuit of the block.
 *
 * The bodies AND their lights live here together, which is the whole reason
 * this module exists. The lights used to be quads in WindowField, where every
 * instance matrix is written once at build time and never touched again -
 * correct for a window, useless for a headlight. Moving them means writing
 * matrices every frame, and re-uploading WindowField's whole 1477-instance
 * buffer to move twelve of them would be absurd. Two small meshes that are
 * expected to change beat one large one that is not.
 *
 * Position comes from arc length along a closed polyline, so a car's heading is
 * just the tangent of whatever segment it is on and corners need no special
 * case. A route's total length is measured once at construction; after that a
 * frame is one modulo and a walk over four segments.
 *
 * The lights do NOT rotate with the car. They are flat quads standing in for
 * points of light, and a point of light has no orientation - turning them with
 * the body would make them vanish edge-on halfway round every corner.
 */
export class Traffic {
  constructor(scene) {
    // Measure each route once: cumulative distance at every corner.
    this.routes = CAR_ROUTES.map((corners) => {
      const cum = [0];
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % corners.length];
        cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
      return { corners, cum, length: cum[cum.length - 1] };
    });

    this.cars = CARS.map((c) => {
      const route = this.routes[c.route];
      return { route, speed: CAR_SPEED[c.route], start: c.at * route.length };
    });

    const n = this.cars.length;
    const body = new THREE.BoxGeometry(1, 1, 1);
    this.bodies = new THREE.InstancedMesh(
      body,
      new THREE.MeshLambertMaterial({ color: MAT.prop }),
      n,
    );
    this.bodies.frustumCulled = false;

    // Head and tail lights, one instanced mesh between them. Colours are fixed,
    // so instanceColor is written once here and never again.
    const quad = new THREE.PlaneGeometry(1, 1);
    this.lights = new THREE.InstancedMesh(
      quad,
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      n * 2,
    );
    this.lights.frustumCulled = false;
    this.lights.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(n * 2 * 3),
      3,
    );
    for (let i = 0; i < n; i++) {
      this.lights.setColorAt(i * 2, HEADLIGHT);
      this.lights.setColorAt(i * 2 + 1, TAILLIGHT);
    }
    this.lights.instanceColor.needsUpdate = true;

    this.step(0);
    scene.add(this.bodies, this.lights);
  }

  /** Position and heading at distance `d` around a route. */
  #sample(route, d) {
    const { corners, cum } = route;
    let i = 0;
    while (i < corners.length - 1 && d >= cum[i + 1]) i++;
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const segLen = cum[i + 1] - cum[i];
    const t = segLen > 0 ? (d - cum[i]) / segLen : 0;
    return {
      x: a[0] + (b[0] - a[0]) * t,
      z: a[1] + (b[1] - a[1]) * t,
      dx: (b[0] - a[0]) / segLen,
      dz: (b[1] - a[1]) / segLen,
    };
  }

  /**
   * Takes ABSOLUTE elapsed time, like the rest of the animated layer. The loop's
   * Timer freezes while the tab is hidden, so the traffic resumes where it was
   * rather than teleporting a lap forward.
   */
  step(t) {
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const d = (car.start + t * car.speed) % car.route.length;
      const p = this.#sample(car.route, d);

      // Rotating by rotY sends local +X to (cos, -sin), and the body is built
      // long along +X - so this is the angle that points the car forward.
      const rotY = Math.atan2(-p.dz, p.dx);

      _pos.set(p.x, CAR_H / 2, p.z);
      _quat.setFromAxisAngle(_up, rotY);
      _scale.set(CAR_W, CAR_H, CAR_D);
      this.bodies.setMatrixAt(i, _m.compose(_pos, _quat, _scale));

      // Lights at each end, held square to the camera rather than to the car.
      const nose = CAR_W / 2 - 0.1;
      const y = CAR_H * 0.62;
      _quat.identity();
      _pos.set(p.x + p.dx * nose, y, p.z + p.dz * nose + CAR_D / 2 + 0.01);
      _scale.set(CAR_HEAD_W, CAR_LIGHT_H, 1);
      this.lights.setMatrixAt(i * 2, _m.compose(_pos, _quat, _scale));

      _pos.set(p.x - p.dx * nose, y, p.z - p.dz * nose + CAR_D / 2 + 0.01);
      _scale.set(CAR_TAIL_W, CAR_LIGHT_H, 1);
      this.lights.setMatrixAt(i * 2 + 1, _m.compose(_pos, _quat, _scale));
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.lights.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.bodies.geometry.dispose();
    this.bodies.material.dispose();
    this.lights.geometry.dispose();
    this.lights.material.dispose();
  }
}
