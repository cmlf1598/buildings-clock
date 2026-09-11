import * as THREE from "three";
import { EXPOSURE } from "../config.js";

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true, // NOTE: inert once we render through EffectComposer.
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // OutputPass reads both of these at the end of the chain and applies them
  // exactly once. Do NOT also add a GammaCorrectionShader pass.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.setClearColor(0x05070c, 1);
  renderer.shadowMap.enabled = false; // nothing in this scene casts

  return renderer;
}
