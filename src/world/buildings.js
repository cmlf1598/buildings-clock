import * as THREE from "three";
import { MAT } from "../emissive/palette.js";
import { TOWERS, FILLERS } from "./layout.js";

/**
 * Building bodies and roof details.
 *
 * Bodies are always boxes so the window grid logic stays uniform across every
 * building; the visual variety comes from the roof treatment instead. Roofs
 * get their own lighter material because the 30 degree camera pitch makes the
 * top faces prominent - that tonal split between roof and wall is most of what
 * gives the reference image its faceted low-poly read.
 *
 * MeshLambertMaterial throughout: the cheapest material that still separates
 * faces by normal, per the docs' Basic > Lambert > Phong > Standard ordering.
 */
export function createBuildings(scene) {
  const bodyMat = new THREE.MeshLambertMaterial({ color: MAT.body });
  const roofMat = new THREE.MeshLambertMaterial({ color: MAT.roof });
  const propMat = new THREE.MeshLambertMaterial({ color: MAT.prop });

  const group = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  const addBox = (mat, x, y, z, w, h, d) => {
    const m = new THREE.Mesh(boxGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    group.add(m);
    return m;
  };

  const addBody = (b) => addBox(bodyMat, b.x, b.H / 2, b.z, b.W, b.H, b.D);

  /** Thin rim around the roof edge. Reads as a parapet from this angle. */
  const addParapet = (b) => {
    const t = 0.16;
    addBox(roofMat, b.x, b.H + t / 2, b.z, b.W + 0.06, t, b.D + 0.06);
  };

  for (const t of TOWERS) {
    addBody(t);
    addParapet(t);
    // A little rooftop plant, so the tops are not bare slabs.
    addBox(roofMat, t.x - t.W * 0.22, t.H + 0.3, t.z - t.D * 0.16, 0.5, 0.4, 0.5);
    if (t.W > 2) {
      addBox(roofMat, t.x + t.W * 0.25, t.H + 0.22, t.z + t.D * 0.2, 0.36, 0.24, 0.36);
    }
  }

  for (const f of FILLERS) {
    addBody(f);

    switch (f.roof) {
      case "pitched": {
        // A prism: a 4-sided cone rotated 45 degrees is a pyramid, but with
        // radial segments 4 and a half-turn it makes a clean ridge roof.
        const g = new THREE.CylinderGeometry(0, f.W * 0.78, 0.9, 4, 1);
        const m = new THREE.Mesh(g, roofMat);
        m.position.set(f.x, f.H + 0.45, f.z);
        m.rotation.y = Math.PI / 4;
        group.add(m);
        break;
      }
      case "pyramid": {
        const g = new THREE.ConeGeometry(f.W * 0.72, 1.6, 4);
        const m = new THREE.Mesh(g, roofMat);
        m.position.set(f.x, f.H + 0.8, f.z);
        m.rotation.y = Math.PI / 4;
        group.add(m);
        break;
      }
      case "dome": {
        const g = new THREE.SphereGeometry(
          f.W * 0.5,
          16,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2,
        );
        const m = new THREE.Mesh(g, roofMat);
        m.position.set(f.x, f.H, f.z);
        group.add(m);
        break;
      }
      case "helipad": {
        addParapet(f);
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(f.W * 0.38, f.W * 0.38, 0.1, 20),
          roofMat,
        );
        pad.position.set(f.x, f.H + 0.28, f.z);
        group.add(pad);
        // The H, as three little bars.
        const barMat = new THREE.MeshLambertMaterial({ color: 0x8f9bb5 });
        const bar = (dx, w, d) => {
          const m = new THREE.Mesh(boxGeo, barMat);
          m.position.set(f.x + dx, f.H + 0.34, f.z);
          m.scale.set(w, 0.03, d);
          group.add(m);
        };
        bar(-0.22, 0.09, 0.62);
        bar(0.22, 0.09, 0.62);
        bar(0, 0.44, 0.1);
        break;
      }
      case "tank": {
        addParapet(f);
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.7, 12),
          roofMat,
        );
        tank.position.set(f.x + f.W * 0.2, f.H + 0.72, f.z);
        group.add(tank);
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            addBox(
              propMat,
              f.x + f.W * 0.2 + sx * 0.22,
              f.H + 0.2,
              f.z + sz * 0.22,
              0.06,
              0.4,
              0.06,
            );
          }
        }
        break;
      }
      default:
        addParapet(f);
        addBox(roofMat, f.x, f.H + 0.3, f.z + f.D * 0.2, 0.55, 0.36, 0.45);
    }

    if (f.antenna) {
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.05, 1.5, 6),
        propMat,
      );
      mast.position.set(f.x, f.H + 0.75, f.z);
      group.add(mast);
    }
  }

  scene.add(group);
  return group;
}
