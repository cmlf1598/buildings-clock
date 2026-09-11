# Buildings Clock

A night city on a floating diorama slab, seen through an orthographic camera. Five towers in the
front row are a dot-matrix clock: lit windows spell the time. A neon blade sign on the last tower
shows AM/PM in red script inside a green tube frame, and the camera leans toward your pointer and
drifts on its own when you leave it alone.

```
npm install
npm run dev
```

Then open the printed URL. `npm run build` / `npm run preview` for production.

## How it reads the time

| tower | shows |
|---|---|
| 1 | hours, tens — **no digit at all for 1–9 o'clock**, just its ordinary ambient windows |
| 2 | hours, ones |
| 3 | the colon, pulsing once per second |
| 4 | minutes, tens |
| 5 | minutes, ones, with the neon AM/PM sign hanging off its flank |

12-hour format. Midnight reads 12:00 AM, noon 12:00 PM.

When the minute rolls over, only the windows that actually changed animate: they fade on fast from
the bottom up (a fluorescent tube snapping on) and off slower from the top down (a filament
cooling). On an hour rollover all four digits change at once and the stagger becomes a wave across
the skyline.

## Debug flags

Append to the URL. No rebuild needed.

| flag | does |
|---|---|
| `?t=HH:MM` | start at a given time, 24h in. `?t=11:59` is the interesting one |
| `?rate=60` | run the clock 60x faster, so a minute rolls every second |
| `?cycle` | every digit counts 0→9, one per second. The fastest legibility check there is |
| `?flat` | kill all yaw, pitch, tilt and drift. Tells "bad glyph" apart from "bad angle" |
| `?orbit` | OrbitControls, dynamically imported so it stays out of the production bundle |
| `?nobloom` | turn the bloom pass off, to see the raw scene |
| `?bloom=0.42,0.35,0.58` | live strength,radius,threshold override |
| `?bounds` | log the scene's NDC bounds — use this to re-derive the framing |

Worth trying: `?t=11:59&rate=120` exercises the AM→PM switch, the 12-hour conversion and a
three-digit change all at once.

## Architecture

```
src/
  config.js          every tunable number + the URL flags. Single source of truth
  core/              renderer, scene, camera, lights, composer
  world/             layout data, building bodies + roofs, ground slab, props, neon sign
  emissive/          the instanced light field, palette, animator
  data/font5x7.js    digit bitmaps, validated at import time
  data/scriptGlyphs.js  neon tube centrelines for the script "am" / "pm"
  time/clock.js      time source and 12-hour conversion
```

**A single InstancedMesh carries every glowing window.** `WindowField` (~1440 unit quads) is every
facade window, streetlamp, car light and rooftop beacon — one draw call. It uses
`MeshBasicMaterial` with a white base colour so `instanceColor` *is* the output, and brightness is
just a per-instance multiplier, which is what makes the digit fades and the colon pulse the same
mechanism.

**The neon sign is real tube geometry**, not a texture or a dot matrix: `TubeGeometry` swept along
hand-authored centrelines in `data/scriptGlyphs.js`, because neon *is* bent tube and nothing else
gives you the continuous stroke and round cross-section that makes the glow read right. All strokes
of one box merge into a single geometry, so the sign is four meshes — two frames, two words — and it
cross-fades by tweening material colours rather than going through the window animator. Whole scene:
82 draw calls, 11k triangles.

Everything random is seeded (`mulberry32`, consumed once at build time in a fixed traversal order),
so the city is identical on every reload. `Math.random()` is never called.

## Seven things that look wrong but are deliberate

These each cost real debugging time. Please don't "fix" them back.

**1. The window row pitch is not the column pitch.** `ROW_PITCH = COL_PITCH * cos(yaw) / cos(pitch)`.
A vertical facade tilted 30° from the viewer projects to 0.866 of its height but keeps 0.951 of its
width, so a uniform grid renders visibly squat digits. The stretch makes the grid project at
0.6667 against an ideal 5:7 grid's 0.6667. The blade sign does the same thing.

**2. `toneMapped: false` is deliberately NOT set on the emissive materials.** It is inert inside an
EffectComposer — in-material tone mapping is only compiled in when the render target is null
(`WebGLPrograms.js:178`). The glow mechanism is HDR instance colours instead: `instanceColor`
multiplies the diffuse linearly and unclamped, and the composer's render target is `HalfFloatType`,
so values above 1.0 survive and ACES rolls them off.

**3. `OutputPass`, not `GammaCorrectionShader`.** With `outputColorSpace = SRGBColorSpace` already
set, a gamma pass encodes a second time and gives milky blacks — *and* the chain never tone-maps at
all. `OutputPass` does both exactly once and must be last.

**4. The composer gets an explicit render target with `samples: 4`.** `WebGLRenderer({antialias:
true})` is silently inert once you render through a composer (the default target is `samples: 0`).
Without this the hard window edges crawl badly while the camera moves.

**5. The palette multipliers are solved, not chosen.** Each is set so the resulting luma hits a
target: digits 1.39, brightest ambient 0.56, threshold 0.58. The first attempt had
ambient windows at luma 2.13 — *exactly as bright as the digits* — and the whole skyline bloomed
into white mush. If you raise `AMBIENT_GAIN_MAX` toward 1.0 you will reproduce that.

**6. The sign clears tower 5 entirely in x.** The tower flank is at x = 11.3; anything placed
inboard of that sits inside the building volume and simply does not render. An earlier version
centred the sign at 11.6 and buried the inner half of every letter. The brackets hide the gap.

**7. The neon red is biased toward magenta (`0xff0048`), not a pure red.** ACES shifts saturated
bright reds toward orange, so a "correct" red hue renders as orange once the tube core goes above
1.0 — which it must, because a pure red is intrinsically low-luma (Rec.709 weights it 0.2126) and
would otherwise never clear the bloom threshold. Biasing the input toward magenta lands it back on
crimson. The green frame needs no such trick.

## Tolerances

Two numbers are tighter than they look:

- **Tower spacing.** The 1.4 gap is sized against the visible side face, which projects to
  `D·sin(yaw)`. At the worst-case yaw of 21° (base 18° + tilt 3°; tilt and drift cross-fade, they
  never sum) that is 1.003. Re-check this before changing yaw, building depth or tilt amplitude.
- **Framing.** `DESIGN_W/H` and `CAM_TARGET` are measured with `?bounds`, not derived by hand — an
  analytical estimate missed the roof cones, antenna masts and rooftop plant and under-reported the
  vertical extent by ~15%, which clipped the skyline at 16:9. Re-measure if the buildings, the slab
  or the tilt amplitude change.

## Notes

Built against `three@0.185.1`. `THREE.Clock` is deprecated as of r185, so the loop uses
`THREE.Timer` with `connect(document)` — which also zeroes the delta while the tab is hidden, so
returning to a backgrounded tab no longer snaps every in-flight fade to its endpoint.
