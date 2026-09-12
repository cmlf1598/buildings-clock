# Buildings Clock

A night city on a floating diorama slab, seen through an orthographic camera. Five towers in the
front row are a dot-matrix clock: lit windows spell the time. A neon blade sign on the last tower
shows AM/PM in pink script inside a cyan tube frame, seven kanji signs stand on the rooftops and
hang off the flanks, two buildings at the back are outlined in neon, one of them under a tiered
castle roof, a floodlit painted board stands on the hours-ones tower, and the camera leans toward
your pointer and drifts on its own when you leave it alone.

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
| 3 | the colon, lit steady at digit level |
| 4 | minutes, tens |
| 5 | minutes, ones, with the neon AM/PM sign hanging off its flank |

12-hour format. Midnight reads 12:00 AM, noon 12:00 PM.

**The seconds are the city itself.** Once a second, three or four ambient windows on the digit
towers' front faces come on and the same number go off — see [The second hand](#the-second-hand).
That is the *only* thing marking seconds. The colon used to pulse on the same beat and no longer
does: two indicators for one quantity is one too many when the second of them sits dead centre, and
the moving one took the eye every time.

Behind the readout the city keeps its own hours: ordinary windows switch themselves on and off at
random, about **0.6 changes a second** across the whole block. See [Room life](#room-life).

When the minute rolls over, only the windows that actually changed animate: they fade on fast from
the bottom up (a fluorescent tube snapping on) and off slower from the top down (a filament
cooling). On an hour rollover all four digits change at once and the stagger becomes a wave across
the skyline.

## Room life

Ambient windows turn themselves on and off, so the city is not a still photograph with a clock
painted on it. Tune it with **`ROOM_TOGGLE_RATE`** in `src/config.js` — expressed city-wide, as
toggles per second across every room there is, because that is the number you can judge by eye. The
per-room interval is derived from it and the room count, so adding buildings does not quietly make
the city busier. `?rooms=40` in the URL speeds it up 40x for checking; `?rooms=0` freezes it.

Each room is a two-state Markov chain with exponentially distributed waits, so the gaps are
genuinely irregular rather than a jittered metronome. **The two waits are deliberately unequal, and
that is the part not to "simplify".** Draw both from the same distribution and every room ends up
lit half the time — the city drifts from its designed 18% occupancy (`AMBIENT_DENSITY`) to 50% and
quietly gets twice as bright as it was built to be. Splitting the cycle by that density makes it the
chain's stationary distribution instead: rooms come and go forever and the lit fraction stays put.
Simulated over an hour it holds at 18–19%.

Two things it must not touch, both of which would take a while to debug if it did:

- **Digit cells** belong to the glyph animator, and the rooftop beacons are written directly every
  frame. Only `field.rooms` is eligible.
- **The separator rows** are ambient windows and dark, but dark *on purpose* — they letterbox the
  digit band away from the ordinary windows. `windowLayout` builds them through plain `push()` so
  they never enter the room list at all. There are exactly 44 of them.

It owns no drawing and no tweening: when a room's turn comes it hands the change to the same
`Animator` the digits use, which already knows how to fade one instance from wherever it happens to
be. Randomness comes from the **stateless** hash, never the seeded generator — including a
dark room's lit level, which is derived from its instance index rather than rolled. That is what
keeps the city byte-for-byte identical to before this existed, which is checked rather than assumed.

## The second hand

Once a second, a few ambient windows on the digit towers' front faces swap: **the same number come
on as go off.** The equal count is the whole trick. A burst that only lit windows would read as the
building brightening, and the eye tires of that in a minute; swapping keeps the lit total on those
faces exactly constant, so what registers is *change* — which is what a tick is. Simulated over a
minute the total never moves off 27.

Size is `TICK_MIN`/`TICK_MAX` in `src/config.js`, currently 3–4, out of a pool of 125 windows. That
recycles the lit set roughly every eight seconds.

**Where.** Only ambient windows on the front faces of the four towers that carry digits. The digit
band sits between them with a dark separator row above and below, so the movement frames the
numerals and never touches them. The colon tower is excluded and keeps the slow room life.

**When.** On each whole second of *elapsed* time. Elapsed time freezes with a backgrounded tab, so
coming back to one does not fire every missed second at once.

Those 125 windows are deliberately kept **out** of `RoomLife`. Two systems driving one window would
disagree about whether it is lit, and whichever held the stale belief would fight the other every
time it fired — a flicker that would take a long evening to track down. `windowLayout` splits them
at build time into `rooms` and `tickRooms`, and the two lists are disjoint by construction.

Fades are quick, near the digits' own speed, because a slow tick is not a tick. They can afford to
be: an ambient window peaks at luma 0.4 against a digit's 1.39, so being fast does not make them
loud.

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

**Three of them have a tube on its way out** — 時分秒, 時計 and 日時, marked `flicker: true` in the
`CITY_SIGNS` table. Each dips for `CITY_FLICKER_LEN` (0.38s) out of a cycle near
`CITY_FLICKER_PERIOD` (7.4s), so any one is misbehaving about 5% of the time.

The cycles are deliberately **scattered** rather than shared, and that is the part not to tidy up.
Three tubes on one period dip in unison, which reads as the whole block browning out rather than as
three separate tubes failing. Each gets its own period (±28%), its own offset, and its own seed for
the stutter *during* a dropout — without the last one they would blink the same irregular rhythm at
three different times, which is its own kind of wrong. Measured over five minutes: some sign is
dipping 13% of the time, but two coincide only 0.9%.

The seeded tables hash `index + 1`, never `index`, because `hash01(0)` is exactly 0 — index 0 would
otherwise land on the extreme of every range it asks for, and index 0 is the blade standing next to
the clock.

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

## Traffic

Six cars drive a circuit of the block rather than sitting parked. Two routes,
**running opposite ways**, on the front road, the mid road, and the outer pair of roads running
along Z — which is the detail that makes it worth doing: those two fall exactly in the gaps between
the clock towers, so a car crossing the tower row appears and disappears between buildings instead
of sliding past a flat wall.

**Both routes drive on the left.** `CAR_LANE` offsets each to its own side of the centreline, and
the offsets are not arbitrary — on every leg of both circuits the lane is on the left of travel,
because that is the side Japan drives on. Facing +X, left is −Z; facing −Z, left is −X. Work any
corner through and it holds. The two routes then pass each other nose to nose the way opposing
traffic should.

Position is arc length along a closed polyline, so heading is just the tangent of whatever segment
a car is on and corners need no special case. Each route's length is measured once; a frame is one
modulo and a walk over four segments.

**Cars on one route share a speed** and so keep their spacing for good — they can never drift into
each other. The variety comes from the two routes running at different speeds, not from jittering
cars around one loop, which only looks alive until the fast one catches the slow one and drives
through it. Their start offsets are uneven on purpose; evenly spaced cars read as a metronome.

The bodies and their lights live in the same module, which is the point of it existing. The lights
were quads in `WindowField`, where every instance matrix is written once at build time — right for
a window, useless for a headlight. The lights do *not* rotate with the car: they are flat quads
standing in for points of light, and turning them with the body would make them vanish edge-on
halfway round every corner.

## Shop fronts

The digit towers carry two shops each along the bottom, in the blank band under the lowest window
row — which is what `ROW_MIN = 1` was always reserving. Five are open and three are shuttered.

**The mix is the whole point.** A row of identical lit units reads as a repeated decal; the closed
ones are what turn it into a street, because a shut shop is a thing that *happened* rather than a
thing that was drawn. The reference does the same, and its two pulled-down shutters carry more of
the look than the lit frontages do.

An **open** shop is four quads in `WindowField` — three panes of glazing plus the lit fascia sign
above them — inside a solid surround.

**The glazing is divided with real gaps, not with bars drawn over one lit sheet.** Each pane is its
own instance and the space between them is genuinely unlit, with a frame member standing in it. That
distinction is the difference between the division surviving and not: a dark bar laid over a single
bright quad is exactly the kind of thin dark line bloom closes back up. Panes and mullions are
derived together from one width in `shopParts()`, so a gap in the first is exactly a bar in the
second and they cannot drift apart. A **closed** one has no emissive part at all — no glazing to divide, either. That
is not an omission: it *is* the difference between the two states. The shutter reads on albedo
alone, which it can, at five times the luma of the wall around it (0.115 against 0.022), with ribs
across it because corrugation is the only cue for "roller shutter" at forty pixels wide.

Fascia colours are stored by name and their **levels are solved, not stored**. `levelFor(hue, luma)`
puts any hue on a target brightness, because the hues are not equally bright — `TAILLIGHT` carries a
third of `LIT_WARM`'s luma, so a red sign and a white one at "the same level" look nothing alike.
The red one clamps at level 1 and lands slightly under, which is the honest failure.

Both glows sit well under the bloom threshold. A shop front is about five times the area of a
window, and area reads as brightness — matching a window's luma would have made the street the
loudest thing in the frame.

The vertical budget is fixed and tight: row 1's window reaches down to y = 0.81, so sill, opening
and fascia have to finish under it. They stop at 0.70 and leave a strip of bare wall, which is what
a real frontage has between the fascia and the first floor.

## The painted board

One sign in the city is not neon. A flat board stands on the hours-ones tower reading **一日一生**
(*ichinichi-isshō*) — a Zen saying, "one day, one lifetime": live each day as if it were the whole
of your life. Black characters on white, floodlit from below by two lamps.

**Being lit rather than emissive is the whole point.** Every other lit thing here is an unlit
`MeshBasicMaterial` carrying an HDR colour — it *is* its own brightness. This is
`MeshLambertMaterial`: it has an albedo and waits to be lit, which is what makes it read as an older
kind of signage sitting among the tubes.

It also means **it cannot actually be white.** A true white panel resolves to luma 0.67 under the
night rig — past the 0.58 bloom threshold — and glows like a lightbox, the exact thing a painted
board is not. `MAT.billboard` is solved to **0.31** instead: seven times brighter than any building
face, which reads as white paint, with room left for the lamps.

**The floodlights are solved, not placed.** A point light this close to a panel is all hot spot: the
first standoff tried (0.16 below, 0.3 in front, intensity 1.1) peaked the board at luma **3.1** —
five times the threshold, two glaring blobs where the wash should be. The board can only stand 0.24
clear of the parapet, so the lamps cannot simply drop further away; the intensity had to come down
with the standoff. The shipped values land the panel at **0.52 peak** with the bottom 1.65× the top:
floodlighting that stops short of glowing.

The characters are the same stroke data as the neon signs, swept through the same `wordTubes`, with
a tube nearly twice as fat relative to the character — a brush is not a 12mm tube, and at that
weight the strokes read as painted rather than as glass that happens to be off. The lamps' own glow
is not part of the board: those are two quads in `WindowField`, so they cost no draw call and bloom
with every other light in the city.

## The bezels, and the castle

Two buildings in the back wear their neon instead of carrying it: tube run along the building's own
edges, which is what a Tokyo block does after dark. It is the AM/PM sign's frame scaled up and
wrapped around architecture — same palette, same `tubeFrom`, same everything.

- **`b2`** gets the plain treatment: roofline loop plus the four vertical corners.
- **`f4`**, the pyramid standing behind the minutes-ones tower, gets its base square and its four
  hip edges traced.

The pyramid's dimensions come from `CONE_ROOF` in `config.js`, which is also what `buildings.js`
builds the solid from. Two copies of `0.72` in two files is exactly how a bezel stops tracing the
roof it is supposed to be tracing. Note the `cos(45°)`: both cone roofs are four-sided and turned
45°, so the base is an axis-aligned square of half-extent `r · W · cos(45°)`, not `r · W`.

**The castle keeps its shape and loses its bezel.** `b1` carries a generated tenshu — three tiers,
each storey a fixed ratio of the one below — and it was outlined in neon first. That was worse. A
tenshu is mostly *surface*, and lighting every eave, ridge and hip put so much line on the
silhouette that the solid underneath stopped reading; it came out as a stack of glowing hoops rather
than a roof. A pyramid has nothing to lose by being drawn, because it is four straight edges to a
point and the tube states the entire form. The castle is better as a dark shape against the sky.

Two things still make that shape read as Japanese rather than as a generic pagoda, and both are
tunable:

- **`CASTLE_FLICK_POW`** — the eave lifts at the corners on a curve of this power. At 2 (a plain
  parabola) the rise spreads over the whole side and the eave sags like a hammock. A real eave runs
  straight for most of its span and turns up only in the last quarter, so the exponent is 3.4.
- **`CASTLE_CONCAVE`** — the exponent on the roof's vertical profile. Above 1 the surface rises
  slowly off the eave and steeply into the ridge, which is the dished section that flares the eave
  outward. At exactly 1 you get a plain straight-sided hip roof and the whole thing stops reading.

`CASTLE_FLICK` — how far the corners lift — started at 0.13 of the eave half-width and read as a
Chinese temple. A tenshu's lift is about half that.

Ridges and hips lie exactly *on* the surface they trace, so every bezel line is lifted clear of its
solid by the tube radius plus a margin. Without that the solid wins the depth test along the whole
length and the tube simply is not there.

## Scene brightness

**Tune it in `src/config.js`, under "Night rig".** `AMBIENT_INTENSITY` first.

The three fills are nowhere near equal, which is the thing to know before reaching for one.
Measured on a roof facing straight up:

| fill | contribution | what it touches |
|---|---|---|
| `MOON_INTENSITY` (directional) | 0.33 | anything facing up or +Z. Dominates, and carries the modelling |
| `HEMI_INTENSITY` (hemisphere) | 0.13 | cold from above, warm sodium bounce from below |
| `AMBIENT_INTENSITY` | 0.06 at intensity 0.35 | everything, flatly |

So ambient is the **gentlest** of the three and the safest to push: it lifts the faces the moon
misses — the +X flanks and everything in shadow — without flattening the moon's contrast. It is
also weak enough that large values are normal here. Doubling it does not double the scene: 0.35 → 1.2
moves a roof from luma 0.031 to 0.039, because a dark ambient colour times a deliberately dark
building albedo is a small number twice over.

There is a lot of headroom. The brightest building face sits at luma 0.04 against the *dimmest*
ambient window at 0.28, so the buildings can be lifted several times over before they start
competing with the windows, let alone the digits. Two things to watch as you climb:

- Around 4 and up it stops reading as night — the shadowed faces catch up with the lit ones and the
  moon's modelling goes flat.
- Unlit windows are `MeshBasicMaterial` and do not respond to any of this, so raising the fill
  raises the *wall* behind them and the dark window grid becomes more visible against it. That is
  usually what you want — it is what the reference does — but it is a look change, not just a
  brightness change.

If you want more than the fills can give, the real lever is `MAT.body` / `MAT.roof` in
`emissive/palette.js`. Everything multiplies by the albedo, so it moves the scene far harder than
any light does — and straight into the trap in note 5 if you overdo it.

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
| `?rooms=40` | speed the window toggling up 40x, so a night's worth passes in a minute. `?rooms=0` freezes it |
| `?bounds` | log the scene's NDC bounds — use this to re-derive the framing |

Worth trying: `?t=11:59&rate=120` exercises the AM→PM switch, the 12-hour conversion and a
three-digit change all at once.

## Architecture

```
src/
  config.js          every tunable number + the URL flags. Single source of truth
  core/              renderer, scene, camera, lights, composer
  world/             layout data, building bodies + roofs, ground slab, props, signs
  world/tube.js      neon tube sweeping, shared by every lit sign and bezel
  world/neonSign.js  the AM/PM blade
  world/citySigns.js the seven kanji signs
  world/billboard.js the one painted, floodlit sign
  world/shops.js     street-level frontages, open and shuttered
  world/traffic.js   cars driving the block, bodies and lights
  world/neonBezel.js buildings outlined in tube
  world/castleRoof.js  the generated tenshu roof
  emissive/neonLife.js breathing and the failing tubes
  emissive/roomLife.js rooms switching themselves on and off
  emissive/secondTick.js the once-a-second window swap
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
facade window, shop front, streetlamp head and rooftop beacon that stays put — one draw call. It uses
`MeshBasicMaterial` with a white base colour so `instanceColor` *is* the output, and brightness is
just a per-instance multiplier, which is what makes the digit fades, the room toggles and the
second-hand swap all the same mechanism.

**The neon sign is real tube geometry**, not a texture or a dot matrix: `TubeGeometry` swept along
hand-authored centrelines in `data/scriptGlyphs.js`, because neon *is* bent tube and nothing else
gives you the continuous stroke and round cross-section that makes the glow read right. All strokes
of one box merge into a single geometry, so the sign is four meshes — two frames, two words — and it
cross-fades by tweening material colours rather than going through the window animator.

**The kanji signs cost 13 meshes between them, not 28.** Every panel, leg and bracket in the city
shares one material, so they merge into a single mesh; only the lit tubes need one each, because
each sign is its own colour. Whole scene: 100 draw calls, 30k triangles. (Draw calls exceed the mesh
count by five because the slab carries a material array, and three.js issues one call per geometry
group.) The two bezels are one mesh each and 960 triangles between them.

Everything random is seeded (`mulberry32`, consumed once at build time in a fixed traversal order),
so the city is identical on every reload. `Math.random()` is never called.

## Thirteen things that look wrong but are deliberate

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
output; `levelFor(hue, luma)` does the same job for an instance level. The ladder as measured today,
top to bottom:

| luma | |
|---|---|
| 1.000 | AM/PM frame |
| 0.899 | lit digit window |
| 0.720 | near kanji sign ink |
| 0.600 | far kanji sign ink |
| **0.580** | **bloom threshold** — everything above this halos |
| 0.500 | shop fascia sign, bezel |
| 0.460 | AM/PM letters, sign frames |
| 0.440 | shop interior |
| 0.416 | brightest ambient window (warm) |
| 0.310 | billboard panel unlit (0.52 under its floodlights) |
| 0.180 | dimmest ambient window (cool) |
| 0.043 | brightest building face |

The first attempt at the windows had ambient at luma 2.13 — *exactly as bright as the digits* — and
the whole skyline bloomed into white mush. If you raise `AMBIENT_GAIN_MAX` toward 1.0, or push the
city signs up toward the AM/PM sign, you will reproduce that.

Two things in that table are worth knowing rather than inheriting. The AM/PM frame now **outranks
the digits**, which was not true when it was solved — the digits were 1.39 then. And `LIT_COOL` has
been dimmed without `LIT_WARM` following, so a **warm window is 1.54x a cool one at the same level**
even though the comment above them says each hue is solved to the same target. Re-measure this table
after touching either.

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

**11. Sign placement is solved against screen position, and the layout table deliberately does not
record it.** The projection shears everything, and the shear is easy to get backwards: an earlier
version of `CITY_SIGNS` carried hand-computed screen x values with the z term's sign flipped, and
every one of them was wrong by two to four units while the layout itself was perfectly fine. Wrong
documentation is worse than none, so the numbers are gone and `npm run measure` prints the real
screen footprint of every sign and bezel and fails if any two overlap. A sign standing on a
bezelled building is exempt — that pair shares a footprint by construction.

The footprints are convex **hulls**, not boxes, and that distinction is load-bearing: a pyramid
bezel's screen box is mostly the empty triangle corners, so a box-against-box test reported it
colliding with the 日時 sign it visibly clears. A collision check that cries wolf is one that gets
ignored.

**12. Every sign tops out below y = 11.6, which is not a coincidence.** That is the top of the
scene's bounding box (tower 4's rooftop plant), and `DESIGN_W`/`DESIGN_H` are solved against that
box. Keeping the signs under the existing ceiling meant seven new objects changed the framing by
exactly nothing. Break it and the contain-fit re-crops the whole diorama — `npm run measure` will
tell you, and it exits non-zero when it happens.

**13. The hours-tens tower's band cells are the only digit cells in the city carrying an ambient
level, and they are read two different ways.** That tower shows nothing at all for 1–9 o'clock, so
its 35 band cells hold an ambient level to fall back to — otherwise it would be a dead rectangle
while every other tower is inhabited. But the fallback applies **only when the glyph is blank**. With
a digit on screen those cells go dark like everywhere else, because leaving them lit put nine
ambient windows *inside* the numeral and blurred its edges. `applyGlyph` therefore decides the
fallback per GLYPH, not per cell — do not simplify `on ? 1 : blank ? base : 0` back to
`on ? 1 : base`.

Their **hue** is forced cool for the same reason, and the ambient roll's hue is deliberately
discarded. A band cell becomes part of a numeral whenever a digit is up, and a warm one renders that
stroke orange — the 1 came out in mixed white and amber while the other three towers were clean cool
white, which read exactly like ambient windows sitting in the digit. The roll is still *consumed* so
the density and the rest of the city are untouched; only the hue is dropped.

The payoff is the hour rollover: the windows fade out as the 1 arrives at ten o'clock, and come
back when it leaves at one.

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
  in the browser) if the buildings, the slab or the tilt amplitude change. Current headroom is 6.5%
  horizontal and 3.3% vertical, so the vertical is the one to watch. `measure` also solves the
  corrected `CAM_TARGET` rather than just reporting that it is off — replacing b1's pitched roof
  with the castle shrank the scene's bounding box (a cone rotated 45° has a surprisingly large AABB)
  and knocked the centring out by 0.16, which is how the current value was derived.
- **The sign ceiling.** A new sign must stay inside its host's roof footprint *and* under y = 11.6.
  The first keeps it from floating off the side of its building; the second keeps it out of the
  scene's bounding box, which is what the framing is solved against.

## Notes

Built against `three@0.185.1`. `THREE.Clock` is deprecated as of r185, so the loop uses
`THREE.Timer` with `connect(document)` — which also zeroes the delta while the tab is hidden, so
returning to a backgrounded tab no longer snaps every in-flight fade to its endpoint.
