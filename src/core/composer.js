import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  BLOOM_STRENGTH,
  BLOOM_RADIUS,
  BLOOM_THRESHOLD,
  debug,
} from "../config.js";

/**
 * RenderPass -> UnrealBloomPass -> OutputPass.
 *
 * Two things worth knowing, neither of which the skill docs mention:
 *
 * 1. OutputPass, not GammaCorrectionShader. In-material tone mapping is
 *    compiled out whenever we render to a render target, so the docs' chain
 *    never tone-maps at all — and with outputColorSpace already set to sRGB,
 *    a GammaCorrectionShader would encode a second time and wash the blacks
 *    out. OutputPass applies tone map + transfer exactly once, and must be
 *    last.
 *
 * 2. The explicit render target. EffectComposer's default is HalfFloatType
 *    with samples: 0, which means renderer({antialias:true}) is silently
 *    inert. Without MSAA here the hard window edges crawl badly while the
 *    camera moves. HalfFloat is kept so instance colours above 1.0 survive
 *    the chain and ACES can roll them off into a warm highlight.
 */
export function createComposer(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());

  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: 4,
  });

  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  let strength = BLOOM_STRENGTH;
  let radius = BLOOM_RADIUS;
  let threshold = BLOOM_THRESHOLD;
  if (debug.bloom) {
    const parts = debug.bloom.split(",").map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      [strength, radius, threshold] = parts;
    }
  }

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    strength,
    radius,
    threshold,
  );
  bloomPass.enabled = !debug.nobloom;
  composer.addPass(bloomPass);

  composer.addPass(new OutputPass());

  return { composer, bloomPass };
}

export function resizeComposer(composer, bloomPass, w, h) {
  composer.setSize(w, h); // already propagates setSize() to every pass
  bloomPass.resolution.set(w, h);
}
