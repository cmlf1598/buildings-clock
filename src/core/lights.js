import * as THREE from "three";
import {
  SIGN_X,
  SIGN_Y,
  CITY_BLADE_X,
  AMBIENT_COLOUR,
  AMBIENT_INTENSITY,
  HEMI_SKY,
  HEMI_GROUND,
  HEMI_INTENSITY,
  MOON_COLOUR,
  MOON_INTENSITY,
  MOON_DIR,
  BILLBOARD_LAMP_COLOUR,
  BILLBOARD_LAMP_INTENSITY,
  BILLBOARD_LAMP_RANGE,
} from "../config.js";
import { billboardParts } from "../world/layout.js";

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
 *
 * Every number in here lives in config.js. Tune scene brightness there -
 * AMBIENT_INTENSITY first, since it lifts what the moon misses without
 * flattening the moon's modelling. The comment above those constants has the
 * measured strength of each fill, which is worth reading before reaching for
 * one: they are not equally powerful, and ambient is the weakest of the three.
 */
export function createLights(scene) {
  // Cold base fill — nothing is ever pure black. This is the knob that lifts
  // shadowed faces without touching the moon's contrast.
  const ambient = new THREE.AmbientLight(AMBIENT_COLOUR, AMBIENT_INTENSITY);

  // The key trick for "night but not flat": cold sky above, warm sodium
  // street bounce below. Roofs pick up cold blue, lower walls pick up warm
  // orange. A free vertical gradient at zero cost.
  const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY);

  // Cold moon key from the upper LEFT, deliberately opposite the camera (which
  // sits at +X), so the +X side face we can actually see is the shadow side
  // and reads clearly darker than the front. That is what gives the volume.
  const moon = new THREE.DirectionalLight(MOON_COLOUR, MOON_INTENSITY);
  moon.position.set(...MOON_DIR);
  moon.castShadow = false;

  // Practical: spill from the neon sign onto the last tower. Tinted to the
  // FRAME colour, since the frame is the brighter half of the sign (luma 1.0
  // against the letters' 0.46) and dominates what the wall actually catches.
  // Re-tint this if the sign is re-hued.
  const signGlow = new THREE.PointLight(0x5ce8ff, 4, 7, 2);
  signGlow.position.set(SIGN_X - 0.3, SIGN_Y, 1.2);
  signGlow.castShadow = false;

  // The same practical for the kanji blade at the other end, so the mirror
  // holds in the lighting too and the left side of the diorama is not dead.
  // Tinted AMBER, not cyan, because the balance is inverted on that sign: its
  // characters are the bright half (luma 0.72) and its frame the dim one
  // (0.46), so the ink is what the wall actually catches. Intensity and falloff
  // are matched to signGlow, then scaled by the ratio of the two signs' bright
  // halves - this blade is the dimmer of the pair and has to light like it.
  const bladeGlow = new THREE.PointLight(0xffb347, 4 * 0.72, 7, 2);
  bladeGlow.position.set(CITY_BLADE_X + 0.3, SIGN_Y, 1.2);
  bladeGlow.castShadow = false;

  // The painted board's two floodlights, under it and slightly in front, so
  // the wash falls up the panel and dies out toward its top edge. The panel is
  // solved to sit at luma 0.31 unlit; these lift its lower half without
  // carrying it over the 0.58 bloom threshold, which is the line between a
  // floodlit board and a lightbox.
  const boardLamps = billboardParts().lamps.map((l) => {
    const light = new THREE.PointLight(
      BILLBOARD_LAMP_COLOUR,
      BILLBOARD_LAMP_INTENSITY,
      BILLBOARD_LAMP_RANGE,
      2,
    );
    light.position.set(l.x, l.y, l.z);
    light.castShadow = false;
    return light;
  });

  scene.add(ambient, hemi, moon, signGlow, bladeGlow, ...boardLamps);
  return { ambient, hemi, moon, signGlow, bladeGlow, boardLamps };
}
