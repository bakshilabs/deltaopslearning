# Making social animations

This is how the Power Run film was made, written so the same method can produce new films for other labs. Read it alongside `power-run.html`, `power-run.js` and `power-run-world.js`, which are a complete working example.

## The method in one paragraph

Each film is a web page that plays a scripted story in a voxel world, built with the same engine as the homepage game windows (`js/game/engine.js`). The 3D scene is drawn on a canvas, and everything readable (captions, counters, prompt cards, the end card) is plain DOM laid over it, so text stays crisp. A renderer (`render.mjs`) opens the page in headless Chromium and steps one virtual clock for everything: animation frames, `performance.now`, `Date`, timers and CSS animations. It saves a screenshot per frame, and ffmpeg turns the frames into an MP4. Because time is virtual, every frame is exact even when the machine renders slowly.

## What makes a good film (lessons from Power Run)

These came from the user's feedback on earlier drafts. Treat them as requirements.

- **Show how children play.** A film about a lab follows the real game loop: play, reach a decision point, tell the AI what to build, then see the result change the game. Play the real lab first (`/labs-test/?m=<id>`) and write down its loop, its questions and its wording.
- **Bespoke and stylised.** Never just a screen recording. Rebuild the scenes on the engine, with your own camera moves and effects.
- **Bright and vivid.** Use saturated daylight, with a pink and purple sunset at most. No night scenes, no dark gradient scrims and no faded overlays.
- **Things fall into place.** Use the homepage's build-in effect: blocks rain down and bounce into place. Things the AI builds should drop in part by part.
- **More effects than the real game,** such as rings, "+1" pops, light pillars, dust, speed lines, camera shake and fireworks.
- **Never cover the main character.** Decision cards sit in a compact panel along the bottom, and the camera reframes so the hero stays in view above it.
- **Square and readable on a phone.** The page is 540 × 540 CSS pixels rendered at 2× (1080 × 1080). Captions are about 33 px at 540, which is about 66 px in the video.
- **Writing:** British English, full sentences, no em dashes and no "not X, but Y" lines. Name things concretely. Only claim what the product does: the Lab Guide is a pretend AI.

## Anatomy of a film

| File | Job |
|---|---|
| `<name>.html` | The square stage (`.gw.film`, 540 × 540), overlay markup and all overlay CSS |
| `<name>-world.js` | Builds the voxel world and exports props (characters, pickups, buildings) |
| `<name>.js` | The script: actors, timeline, camera, effects and the per-frame loop |
| `render.mjs` | Shared renderer, reused as it is for every film |

### The world (`power-run-world.js`)

- One `Grid` holds the terrain and buildings. `W.addGrid(grid, { origin, delay })` turns it into one merged mesh. **The `delay(x, y, z)` function sets when each voxel drops in** during `W.build()`. Power Run sweeps from the start of the lane outwards: `.1 + y/GH*.7 + x/GW*1.5 + hash*.3`.
- Windows that light up go into their own glass grids, one per house, so each home can switch on separately through its material's `emissive`.
- Small things that are not voxels (lamps, flowers, clouds) use `W.prop(obj, delay)`, so they pop in with the build.
- Props are flat-colour boxes made with `box()` and `group()`. Keep each moving part as its own child (turbine base, tower, nacelle and blades), so it can drop in on its own.
- `W.anchors` exposes the coordinates the script needs: `laneY(x)`, `wx()` and other converters, plus named points such as `town` and `hill`.

### The script (`power-run.js`)

**The course.** Put the layout in constants at the top: stop points (`PRIZES`), jump arcs `[fromX, toX, apex, kind]`, pickup positions and build sites. `pathY(x)` gives the hero's height: the surface, or an arc while inside a jump. A surface can change when something is built; for example, `batTop()` adds battery tops once they exist.

**The timeline.** There are two kinds:
- `CUES`: `[seconds, fn]` pairs from the start of the film, used for the opening captions.
- `SEQS`: one list per stop point, timed from the moment the hero arrives. Motion decides when each stop is reached, so the beats after a stop never drift. The last entry sets `S.run = true` to carry on.

**The hero.** `S.x` advances by `S.speed * dt`, and the speed eases towards a target (slower in wind, zero at a stop). The pose comes from the motion: `run()`, `air()`, `cheer()`, a squash on landing, and a fall from the sky at the start.

**The camera.** It is set every frame, then `W.snapCam()`, so nothing lags.
- *Eye level:* `{ el: .08, az: 0, dist: 18 }`, targeting just ahead of the hero (`look.lead`), with a smoothed height.
- *Reframing:* `look`/`lookT` ease the lead, height, distance and elevation. `promptLook()` raises the camera and pushes the hero into the top half while a card is up.
- *Scripted moves:* `move(TARGET, seconds)` blends from the current view to a target with ease-in-out, for the swoop to the town.
- *Opening:* a wide establishing shot blends into eye level as the hero lands.
- *Shake:* `shake = .3` adds a decaying jitter to the target.

**The sky and light.** The script owns `W.skyStops`, the sun, the hemisphere light and fog each frame. `W.dusk` (0 to 1) blends day into a vivid sunset and drives window glow and lamps.

## Effects catalogue (all in `power-run.js`)

| Effect | How |
|---|---|
| World builds from falling blocks | `W.build()` on the first frame, with the grid's `delay` function |
| Parts fall into place with a bounce | `dropParts(parts, t0, { gap, h, dur, onLand })`. Use `partsOf(group)` to order children bottom to top |
| Pop-in with overshoot | `easeBack(clamp((ft - t0) / .45))` on scale |
| Particle bursts | `burst(pos, colours, n, speed, gravity)` on the unlit `fx` particles |
| Dust and footsteps | the lit `dust` particles, and `landFx(obj)` for impacts |
| Shockwave ring | `ring(worldPos, colour, size, 'big')`, a DOM ring at the projected point |
| "+1" pops | `plus(worldPos, '+1')` |
| Light pillar | `pillar(pos)`, a tall additive sprite that fades |
| Wind column | small white particles rising with spread |
| Speed lines | the `.speed` overlay, with opacity tied to the hero's speed |
| Flash | `.flash` gets `on` (re-trigger by removing the class and forcing a reflow) |
| Fireworks | timed `burst()` calls high above the town |
| End-card confetti | DOM pieces kept to the side margins so text stays clean |

## Overlays (all in `<name>.html`)

- **Sticker captions:** `say('Text with *highlight*', 'yellow' | 'blue' | 'green' | 'pink' | 'blue low')` and `unsay()`. Use one caption at a time, about 2 to 3 seconds each. Add `low` when the top of the frame is busy.
- **Counters:** white pills at the top left, with a `bump` animation on change, plus the brand pill at the top right.
- **Prompt card:** `openCard({ n, q, before, after, tiles })`, then `choose(i, text)` fills the blank. A tap on `send()` leads to `reply(text)` (typed) and then `play()`. The finger is the game HUD's `hud.point(el)` and `hud.tap()`.
- **Status panel:** `.tpanel` at the top, for things like the hour and homes on.
- **Pins:** DOM icons that follow world points through `view.project(v3)` each frame.
- **Celebration:** `hud.celebrate(stars, text, { badge, style: 'confetti' })` from `js/game/hud.js`.
- **End card:** a circle-wipe reveal on a light gradient with the lab name, one sentence, the URL pill and the logo.

## Making a new film, step by step

1. **Play the real lab** at `/labs-test/?m=<id>` (or `/play/?trailer=<id>` for the loop). Write down its loop, decision points, questions, answers and the AI's replies.
2. **Write the beat sheet:** a hook (2 to 3 seconds), play, two or three decision points that each change the world, a payoff, a one-line message and the end card. Aim for 30 to 50 seconds.
3. **Copy the three files** to `<name>.html`, `<name>.js` and `<name>-world.js`, and change the import path in the script.
4. **Build the world:** lay out terrain, the play lane, buildings, build sites and anchors. Give it a `delay` function that sweeps from where the camera starts.
5. **Write the course** constants and a `SEQS` entry for each decision point.
6. **Check stills often** (see below) before any full render.
7. **Do a full render,** then check a contact sheet of the MP4 and the frame edges.

## Rendering

```sh
python3 -m http.server 8765 &                                         # must be running
node tools/social/render.mjs stills 3,12.5,30 /tmp/stills             # quick checks
node tools/social/render.mjs frames 51 /tmp/frames                    # every frame
ffmpeg -framerate 30 -i /tmp/frames/f%05d.png -c:v libx264 -pix_fmt yuv420p -crf 17 -preset slow -movflags +faststart tools/social/<name>-1080.mp4
```

- Another page: `FILM_URL=http://localhost:8765/tools/social/<name>.html node tools/social/render.mjs …`
- Speed: about 0.4 seconds per frame in a cloud container (WebGL runs on the CPU there), so a 50 second film takes about 15 minutes. Run full renders in the background.
- Contact sheet: `ffmpeg -i film.mp4 -vf "select='not(mod(n\,90))',scale=320:320,tile=6x3" -frames:v 1 sheet.png`
- Edge check: `ffmpeg -i film.mp4 -vf "select='not(mod(n\,150))',crop=1080:160:0:0,scale=540:-1,tile=1x11" -frames:v 1 tops.png`. Repeat it for the bottom edge.
- MP4s are ignored by git (`tools/social/*.mp4`). Send the file to the user instead of committing it.

## Pitfalls already met

- **The server is down:** the renderer gets no page and fails with zero frames. Start `http.server` first.
- **Hidden overlays peek into the frame:** a panel parked with `translateY(-160%)` showed 18 px at the top of every frame. Park overlays fully off frame and add `visibility:hidden`.
- **Animation and transform clash:** a CSS animation on `transform` overrides an inline `transform` used for positioning, so a pinned icon jumps to (0, 0). Animate the separate `scale` property instead, or wrap the element.
- **Module query strings must match:** import the engine as `/js/game/engine.js?v=20261018b`, exactly as `worlds.js` and `hud.js` do. A different query string loads a second engine with its own renderer.
- **Real-time timers:** anything on `setTimeout` is virtualised by the renderer, but code that reads the real clock in other ways is not. Drive everything from `ft`, the film time.
- **Emoji may not render** in headless Chromium. Use inline SVG icons.
- **Photographed text hides behind overlays:** check that the caption, card and pins never cover the hero or each other at any moment. The renderer's stills are the quickest way to catch this.
- **Camera framing at square aspect:** `World.frame` multiplies distance by about 1.44 at 1:1, so distances feel larger than in the wide homepage windows.
