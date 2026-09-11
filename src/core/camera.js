import * as THREE from "three";
import {
  BASE_YAW,
  BASE_PITCH,
  CAM_DIST,
  CAM_TARGET,
  CAM_NEAR,
  CAM_FAR,
  DESIGN_W,
  DESIGN_H,
  TILT_YAW,
  TILT_PITCH,
  DRIFT_YAW,
  DRIFT_PITCH,
  DRIFT_YAW_T,
  DRIFT_PITCH_T,
  DRIFT_PITCH_PHASE,
  CAM_SMOOTH,
  IDLE_DELAY,
  IDLE_RAMP,
  debug,
} from "../config.js";
import { lerp, clamp01 } from "../util/rng.js";

const TAU = Math.PI * 2;

const _tgt = new THREE.Vector3(...CAM_TARGET);
const pointer = { x: 0, y: 0 };
const damped = { yaw: 0, pitch: 0 };
let lastMoveTime = -Infinity;

/**
 * Contain-fit. frustumSize is the VERTICAL extent, so a fixed value would crop
 * the diorama horizontally on tall windows. Growing it when the viewport is
 * narrower than the design box means portrait shrinks the scene rather than
 * cutting it off.
 */
export function frustumSizeFor(aspect) {
  return Math.max(DESIGN_H, DESIGN_W / aspect);
}

export function createCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const f = frustumSizeFor(aspect);
  const camera = new THREE.OrthographicCamera(
    (f * aspect) / -2,
    (f * aspect) / 2,
    f / 2,
    f / -2,
    CAM_NEAR,
    CAM_FAR,
  );
  applyAngles(camera, 0, 0);
  return camera;
}

/**
 * The docs' resize handler sets camera.aspect, which does not exist on an
 * OrthographicCamera — it would silently become a dead property and the view
 * would never update. The frustum has to be recomputed by hand.
 */
export function resizeCamera(camera, w, h) {
  const aspect = w / h;
  const f = frustumSizeFor(aspect);
  camera.left = (f * aspect) / -2;
  camera.right = (f * aspect) / 2;
  camera.top = f / 2;
  camera.bottom = f / -2;
  camera.updateProjectionMatrix();
}

function applyAngles(camera, dYaw, dPitch) {
  const yaw = (debug.flat ? 0 : BASE_YAW) + dYaw;
  const pitch = (debug.flat ? 0 : BASE_PITCH) + dPitch;
  const cp = Math.cos(pitch);
  camera.position.set(
    _tgt.x + CAM_DIST * Math.sin(yaw) * cp,
    _tgt.y + CAM_DIST * Math.sin(pitch),
    _tgt.z + CAM_DIST * Math.cos(yaw) * cp,
  );
  camera.lookAt(_tgt);
}

export function attachPointer(canvas) {
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    // Screen y grows downward; invert so moving the pointer up tips the scene
    // back, which is the direction that reads as "leaning toward you".
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    lastMoveTime = performance.now() / 1000;
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.x = 0;
    pointer.y = 0;
  });
}

/**
 * Blends a damped lean toward the pointer with a slow autonomous drift.
 *
 * `idle` cross-fades 0 -> 1 over IDLE_RAMP seconds once the pointer has been
 * still for IDLE_DELAY, so the handoff between the two never snaps. The two
 * sources are lerped, never summed, which is why the worst-case yaw is
 * BASE + max(TILT, DRIFT) rather than BASE + TILT + DRIFT — the tolerance the
 * building spacing is designed against.
 */
export function updateCamera(camera, t, dt) {
  if (debug.flat) {
    applyAngles(camera, 0, 0);
    return;
  }

  const nowSec = performance.now() / 1000;
  const idle = clamp01((nowSec - lastMoveTime - IDLE_DELAY) / IDLE_RAMP);

  const driftYaw = Math.sin((t / DRIFT_YAW_T) * TAU) * DRIFT_YAW;
  const driftPitch =
    Math.sin((t / DRIFT_PITCH_T) * TAU + DRIFT_PITCH_PHASE) * DRIFT_PITCH;

  const targetYaw = lerp(pointer.x * TILT_YAW, driftYaw, idle);
  const targetPitch = lerp(pointer.y * TILT_PITCH, driftPitch, idle);

  // Frame-rate INDEPENDENT exponential smoothing. A naive lerp(a, b, 0.1)
  // would settle at a different speed on a 144Hz display than on a 60Hz one.
  const k = 1 - Math.exp(-dt * CAM_SMOOTH);
  damped.yaw += (targetYaw - damped.yaw) * k;
  damped.pitch += (targetPitch - damped.pitch) * k;

  applyAngles(camera, damped.yaw, damped.pitch);
}
