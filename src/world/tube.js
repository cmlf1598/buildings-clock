import * as THREE from "three";

/**
 * Neon tube primitives, shared by the AM/PM blade and the kanji city signs.
 *
 * Both signs are built the same way and for the same reason: neon IS bent
 * tube, so the geometry is a TubeGeometry swept along a hand-authored
 * centreline. An outline font or a dot matrix cannot give you the continuous
 * stroke and the round cross-section that make the glow read right.
 */

/** Dense rounded-rectangle polyline, centred on the origin. */
export function roundedRectPoints(w, h, r, perCorner = 6) {
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  const pts = [];
  const corners = [
    [hw, hh, 0],
    [-hw, hh, Math.PI / 2],
    [-hw, -hh, Math.PI],
    [hw, -hh, -Math.PI / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = a0 + (i / perCorner) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), 0));
    }
  }
  return pts;
}

/**
 * Sweeps a tube along a polyline.
 *
 * `segmentsPerPoint` and `minSegments` exist because the two signs arrive with
 * very differently shaped inputs. The AM/PM script glyphs are a handful of
 * widely spaced control points describing a curve, so they need oversampling
 * to come out smooth. The kanji arrive ALREADY densified to a fixed spacing,
 * so one segment per point is exactly right and a 16-segment floor would
 * quadruple the triangle count of every short stroke - and a kanji is mostly
 * short strokes.
 */
export function tubeFrom(
  points,
  closed,
  radius,
  segmentsPerPoint = 6,
  minSegments = 16,
) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  const segs = Math.max(minSegments, points.length * segmentsPerPoint);
  return new THREE.TubeGeometry(curve, segs, radius, 6, closed);
}

/**
 * Subdivides a polyline so no segment is longer than maxSeg.
 *
 * This is what lets the kanji be authored as plain corner points. A
 * Catmull-Rom through three points rounds the middle one across the whole
 * span, which turns the square bowl of 日 into a blob; run the same spline
 * through a dense sample of the SAME polyline and the straights stay straight,
 * because every interior control point is already collinear with its
 * neighbours, and only the last maxSeg before a turn bends. The result is a
 * fillet of a known, small radius on every corner - which is exactly what a
 * tube bender leaves behind, and the reason the corners look real rather than
 * either mitred or melted.
 */
export function densify(points, maxSeg) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / maxSeg));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
