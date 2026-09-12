# Buildings Clock

A night city on a floating diorama slab, seen through an orthographic camera. Five towers in the
front row are a dot-matrix clock: lit windows spell the time. A neon blade sign on the last tower
shows AM/PM in pink script inside a cyan tube frame, seven kanji signs stand on the rooftops and
hang off the flanks, and the camera leans toward your pointer and drifts on its own when you leave
it alone.

```
npm install
npm run dev
```

Then open the printed URL. `npm run build` / `npm run preview` for production.

## How it reads the time

| tower | shows |
|---|---|
| 1 | hours, tens — **no digit at all for 1–9 o'clock**, just its ordinary ambient windows. Carries the 時分秒 blade on its outer flank and 今日 on its roof |
| 2 | hours, ones |
| 3 | the colon, pulsing once per second |
| 4 | minutes, tens |
| 5 | minutes, ones, with the neon AM/PM sign hanging off its flank |

12-hour format. Midnight reads 12:00 AM, noon 12:00 PM.

When the minute rolls over, only the windows that actually changed animate: they fade on fast from
the bottom up (a fluorescent tube snapping on) and off slower from the top down (a filament
cooling). On an hour rollover all four digits change at once and the stagger becomes a wave across
the skyline.

## The signs

Seven neon signs, and every character on them is about time. None of it is decorative gibberish:
a sign that reads as nonsense to anyone who can actually read it is worse than no sign at all.

| sign | reading | means | where |
|---|---|---|---|
| 時分秒 | ji-fun-byō | hours, minutes, seconds | blade off tower 1's flank |
| 今 | ima | now | small blade under the AM/PM sign |
| 時計 | tokei | clock | rooftop, back left |
| 今日 | kyō | today | rooftop of tower 1 — the only sign on a clock tower |
| 日月 | jitsugetsu | sun and moon; the passing of time | rooftop, back centre |
| 日時 | nichiji | date and time | rooftop, back right |
| 明日 | asu | tomorrow | rooftop, far right |

The 時分秒 blade is a deliberate mirror of the AM/PM sign at the other end: same height, same
bracket line, same construction. The two of them bracket the readout, and the left one names the
units the digits are counting in.

**They are built as strokes, not as letterforms.** A kanji *is* a stroke sequence, so it maps onto
bent tube with nothing lost — which is the same argument `scriptGlyphs.js` makes for the script
"am"/"pm", only more so. Each character in `data/kanjiGlyphs.js` is a list of polylines in a unit
em box, written in stroke order, and lofted into `TubeGeometry` exactly like the AM/PM sign. There
is no font, no texture and no atlas anywhere in the project.

**Corners are plain polyline corners, and that is load-bearing.** A Catmull-Rom through three
points rounds the middle one across the whole span, which turns the square bowl of 日 into a blob.
`tube.js` densifies each stroke to a fixed spacing *first*, so every interior control point is
already collinear with its neighbours; the straights then stay straight and only the last 0.055 em
before a turn bends. That leaves a fillet of a known, small radius on every corner — which is what
a tube bender actually produces, and why the corners read as neither mitred nor melted. Do not
pre-round the stroke data by hand; you would be applying the same fillet twice.

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
  world/             layout data, building bodies + roofs, ground slab, props, signs
  world/tube.js      neon tube sweeping, shared by both kinds of sign
  world/neonSign.js  the AM/PM blade
  world/citySigns.js the seven kanji signs
  emissive/          the instanced light field, palette, animator
  data/font5x7.js    digit bitmaps, validated at import time
  data/scriptGlyphs.js  neon tube centrelines for the script "am" / "pm"
  data/kanjiGlyphs.js   kanji stroke data + what every word means
  time/clock.js      time source and 12-hour conversion
tools/
  measure.mjs        re-derives DESIGN_W/H/CAM_TARGET headlessly
  preview.mjs        software-rasterises the scene to a PNG
```

Both tools build the **real** scene — they import `world/` and `emissive/` and let them construct
their actual geometry, so neither can drift away from what ships. Nothing under `src/` except
`main.js` touches a GL context, which is the property that makes this possible.

```
npm run measure   # does the scene still fit the frame?
npm run preview   # what does it look like?
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
cross-fades by tweening material colours rather than going through the window animator.

**The kanji signs cost 13 meshes between them, not 28.** Every panel, leg and bracket in the city
shares one material, so they merge into a single mesh; only the lit tubes need one each, because
each sign is its own colour. Whole scene: 95 draw calls, 27k triangles. (Draw calls exceed the mesh
count by five because the slab carries a material array, and three.js issues one call per geometry
group.)

Everything random is seeded (`mulberry32`, consumed once at build time in a fixed traversal order),
so the city is identical on every reload. `Math.random()` is never called.

## Twelve things that look wrong but are deliberate

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

**5. The palette multipliers are solved, not chosen.** Every neon colour goes through
`neon(hex, targetLuma)`, so the number in the source is the *target* and the multiplier is its
output. The ladder, top to bottom: digits 1.39, AM/PM frame 1.00, near kanji sign 0.72, far kanji
sign 0.60, brightest ambient window 0.56, bloom threshold 0.58, sign frames 0.46. The first attempt
at the windows had ambient at luma 2.13 — *exactly as bright as the digits* — and the whole skyline
bloomed into white mush. If you raise `AMBIENT_GAIN_MAX` toward 1.0, or push the city signs up
toward the AM/PM sign, you will reproduce that.

**6. The sign clears tower 5 entirely in x.** The tower flank is at x = 11.3; anything placed
inboard of that sits inside the building volume and simply does not render. An earlier version
centred the sign at 11.6 and buried the inner half of every letter. The brackets hide the gap.

**7. The sign's colour constants are named for role, not hue** — `SIGN_FRAME` and `SIGN_LETTER`,
with multipliers solved per hue so a re-colour keeps the same luma balance (frame 1.00, letters
0.46). Read this before re-hueing: ACES shifts saturated bright colours toward orange as the tube
core passes 1.0, and a hue carrying little blue has such low Rec.709 luma that it needs a large
multiplier and lands squarely in that trap. An earlier pure-red version rendered visibly orange and
had to be biased toward magenta to compensate. Cyan and pink both carry blue, so they need smaller
multipliers (1.43 and 1.68) and hold their hue with no such trick.

**8. The kanji signs are dimmer than the AM/PM sign, and the back row is dimmer still.** They are
scenery, not readout. `CITY_INK_NEAR` (0.72) and `CITY_INK_FAR` (0.60) are aerial perspective, not
decoration — the back row sits ~10 units further into the scene and reads wrong if it burns as hot
as the signs on the clock towers. Sign *frames* land at 0.46, under the bloom threshold, so the
characters lead and the box around them only glows. This is the opposite balance to the AM/PM
sign, where the frame is the bright half — different job, different answer.

**9. `neon()` caps the peak channel at 1.7, and will refuse to hit a luma target.** ACES shifts a
saturated colour toward orange once its brightest channel passes ~1.0, and a hue carrying little
blue has so little Rec.709 luma that reaching a target sends its red channel far past that — which
is how an earlier pure-red sign rendered visibly orange. A hue too dark to reach its target under
the cap simply comes out dimmer. That is the honest failure; the wrong hue is not.

**10. The "noon" sign says 日時, not 正午.** It said 正午 first, and `tools/preview.mjs` showed the
problem: at the ~20px per character a back-row sign actually gets, 正 is indistinguishable from 五.
The stroke data was *correct* — checked against a deliberately drawn 五 at 300px — but the character
is carried entirely by the length of one horizontal spur, and that cue does not survive the size.
日 and 時 do. Legibility here is a function of glyph *and* render size, and only the second one was
negotiable.

**11. Sign placement is solved against screen x, not world x.** `screenX = x·cos(yaw) + z·sin(yaw)`,
so a back-row sign at z = −9.3 lands 2.9 units left of where its world x suggests. Every entry in
`CITY_SIGNS` carries the screen x it actually hits, and they are spread across the frame rather
than clustered. Two signs may share a screen x only if their screen *y* ranges are disjoint — the
pair at −11.9 and −10.9 do, by nearly four units.

**12. Every sign tops out below y = 11.6, which is not a coincidence.** That is the top of the
scene's bounding box (tower 4's rooftop plant), and `DESIGN_W`/`DESIGN_H` are solved against that
box. Keeping the signs under the existing ceiling meant seven new objects changed the framing by
exactly nothing. Break it and the contain-fit re-crops the whole diorama — `npm run measure` will
tell you, and it exits non-zero when it happens.

## Tolerances

Three values are less arbitrary than they look:

- **Tower spacing.** The 1.4 gap is sized against the visible side face, which projects to
  `D·sin(yaw)`. At the worst-case yaw of 21° (base 18° + tilt 3°; tilt and drift cross-fade, they
  never sum) that is 1.003. Re-check this before changing yaw, building depth or tilt amplitude.
- **Sign height.** `SIGN_Y` is an expression, not a literal: it resolves to the centre of the digit
  band, so the sign stays in line with the numerals if the band or the row pitch ever move. Note
  that world-space alignment is not screen-space alignment here — under the isometric projection
  screen y depends on x and z too, and the towers' own digit bands descend diagonally across the
  frame. The sign is aligned to tower 5, the one it hangs off, where the residual offset is 0.08
  world units.
- **Framing.** `DESIGN_W/H` and `CAM_TARGET` are measured, not derived by hand — an analytical
  estimate missed the roof cones, antenna masts and rooftop plant and under-reported the vertical
  extent by ~15%, which clipped the skyline at 16:9. Re-measure with `npm run measure` (or `?bounds`
  in the browser) if the buildings, the slab or the tilt amplitude change. Current headroom is 5.8%
  horizontal and 1.9% vertical, so the vertical is the one to watch.
- **The sign ceiling.** A new sign must stay inside its host's roof footprint *and* under y = 11.6.
  The first keeps it from floating off the side of its building; the second keeps it out of the
  scene's bounding box, which is what the framing is solved against.

## Notes

Built against `three@0.185.1`. `THREE.Clock` is deprecated as of r185, so the loop uses
`THREE.Timer` with `connect(document)` — which also zeroes the delta while the tab is hidden, so
returning to a backgrounded tab no longer snaps every in-flight fade to its endpoint.
