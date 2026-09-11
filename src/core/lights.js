import * as THREE from "three";

/**
 * Night rig.
 *
 * Every glowing thing in this scene is an unlit MeshBasicMaterial, so these
 * lights contribute nothing to the glow — they exist purely to stop the
 * building bodies and the slab from collapsing into black silhouettes.
 *
 * The trap to avoid: "dark scene, so dark albedo times dark lights". Two dark
 * numbers multiply to ~1e-4 and you get pure black. Keep the albedo mid-dark
 * and the lights moderate, then let the low exposure and ACES do the
 * darkening.
 */
export function createLights(scene) {
  // Cold base fill — nothing is ever pure black.
  const ambient = new THREE.AmbientLight(0x5a6f96, 0.35);

  // The key trick for "night but not flat": cold sky above, warm sodium
  // street bounce below. Roofs pick up cold blue, lower walls pick up warm
  // orange. A free vertical gradient at zero cost.
  const hemi = new THREE.HemisphereLight(0x6d86c4, 0x7a4a1e, 0.5);

  // Cold moon key from the upper LEFT, deliberately opposite the camera (which
  // sits at +X), so the +X side face we can actually see is the shadow side
  // and reads clearly darker than the front. That is what gives the volume.
  const moon = new THREE.DirectionalLight(0xaec4f0, 0.85);
  moon.position.set(-9, 14, 6);
  moon.castShadow = false;

  // Practical: spill from the neon sign onto the last tower. Green rather
  // than warm, because the frame is the brighter half of the sign (luma 1.0
  // against the letters' 0.46) so it dominates what the wall actually catches.
  const signGlow = new THREE.PointLight(0x5cff9a, 4, 7, 2);
  signGlow.position.set(12.3, 6.1, 1.2);
  signGlow.castShadow = false;

  scene.add(ambient, hemi, moon, signGlow);
  return { ambient, hemi, moon, signGlow };
}
