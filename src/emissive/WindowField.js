import * as THREE from "three";
import { OFF, HUES } from "./palette.js";
import { buildWindowLayout } from "./windowLayout.js";
import { COLON_LIT } from "../data/font5x7.js";
import { COLON_FLOOR, BEACON_PERIOD } from "../config.js";

// Module-scope scratch. Reused forever so the hot path allocates nothing.
const _dummy = new THREE.Object3D();
const _c = new THREE.Color();

/**
 * Every glowing quad in the scene: facade windows, streetlamps, car lights
 * and rooftop beacons. One InstancedMesh, one draw call.
 *
 * Geometry is a UNIT plane; per-instance scale gives each quad its real size,
 * which is what lets a 0.34 facade window and a 0.09 car light share one mesh.
 *
 * The material is MeshBasicMaterial with a white base colour, so instanceColor
 * IS the output. Note that toneMapped:false is deliberately NOT set here: it
 * is inert once we render through a composer (in-material tone mapping is only
 * compiled in when the render target is null), and the HDR instance colours
 * are the actual glow mechanism.
 */
export class WindowField {
  constructor() {
    const layout = buildWindowLayout();
    const { items } = layout;
    const n = items.length;

    this.count = n;
    this.digitMap = layout.digitMap;
    this.colonMap = layout.colonMap;
    this.beacons = layout.beacons;
    this.rooms = layout.rooms;
    this.tickRooms = layout.tickRooms;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geometry, material, n);
    this.mesh.frustumCulled = false;

    // Allocate instanceColor up front, as the docs specify. Leaving it to
    // setColorAt lazy allocation would fill the buffer with 1.0 and every
    // window would start out white.
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(n * 3),
      3,
    );

    // Animation state. Allocated once, never resized.
    this.current = new Float32Array(n);
    this.from = new Float32Array(n);
    this.target = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.delay = new Float32Array(n);
    this.base = new Float32Array(n); // level to fall back to when unlit
    this.hue = new Uint8Array(n);
    this.mode = new Uint8Array(n); // 0 fading off, 1 fading on

    for (let i = 0; i < n; i++) {
      const it = items[i];
      _dummy.position.set(it.x, it.y, it.z);
      _dummy.rotation.set(0, it.rotY, 0);
      _dummy.scale.set(it.w, it.h, 1);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);

      this.hue[i] = it.hue;
      this.base[i] = it.base;
      this.current[i] = it.start;
      this.target[i] = it.start;
      this.writeColor(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.dirty = false;
  }

  /**
   * Writes one instance colour. Assigns the scratch Color components directly
   * rather than going through setHex/setRGB, which skips all colour-space
   * conversion - the palette is already linear - and allocates nothing.
   */
  writeColor(i) {
    const t = this.current[i];
    const L = HUES[this.hue[i]];
    _c.r = OFF.r + (L.r - OFF.r) * t;
    _c.g = OFF.g + (L.g - OFF.g) * t;
    _c.b = OFF.b + (L.b - OFF.b) * t;
    this.mesh.setColorAt(i, _c);
    this.dirty = true;
  }

  /** Continuous heartbeat rather than a square blink; never fully dies. */
  pulseColon(t) {
    const wave = 0.5 + 0.5 * Math.cos(t * Math.PI * 2);
    const b = COLON_FLOOR + (1 - COLON_FLOOR) * Math.pow(wave, 2.2);
    for (let k = 0; k < COLON_LIT.length; k++) {
      const i = this.colonMap[COLON_LIT[k]];
      if (i < 0) continue;
      this.current[i] = b;
      this.writeColor(i);
    }
  }

  pulseBeacons(t) {
    if (!this.beacons.length) return;
    const phase = (t % BEACON_PERIOD) / BEACON_PERIOD;
    const b = phase < 0.12 ? Math.sin((phase / 0.12) * Math.PI) : 0;
    for (const i of this.beacons) {
      this.current[i] = b;
      this.writeColor(i);
    }
  }

  flush() {
    if (!this.dirty) return;
    this.mesh.instanceColor.needsUpdate = true;
    this.dirty = false;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
