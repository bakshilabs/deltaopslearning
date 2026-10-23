# Social films

For how to make a new film with this method, read [GUIDE.md](GUIDE.md).

## Power Run 2 (the playable game)

`labs-test/power-run-2/` is the Power Run lab rebuilt as a playable game in the style of the film, on the same world module (`js/game/power-run-world.js`). It sits alongside the original Power Run, which still opens at `labs-test/?m=powerrun`. Power Run 2 is live at https://deltaopslearning.com/labs-test/power-run-2/ and is not linked from the lab list yet.

- `index.html` holds the markup, `game.css` the UI and `game.js` the game.
- Controls: arrow keys or A and D to run, and Space, W or up to jump. Touch screens get large on-screen buttons. Jumps have buffering, coyote time and a variable height.
- Prize 1 (Wind turbines, Solar panels or Water wheels) changes how you climb the high wall: the wind lifts you, solar powers floating platforms, and a water wheel in the stream pumps a jet. Prize 2 (no battery, 1 battery or 4 batteries) builds battery stairs, and only 4 reach the high spark shelf.
- At the last prize the evening plays in the town from 4 pm to 9 pm. Solar with no battery goes dark at 7 pm, and with 1 battery at 8 pm; every other plan stays lit until bedtime. Every 2 sparks switch on one of the 11 homes. The result card gives stars, the reasons and the plan.
- To test: `window.__power` exposes the state, and the scratchpad bot used for checks played every route with the renderer's virtual clock. Physics live in `physics()`, and the course layout constants are at the top of `game.js`.


## Power Run (square, 1080 × 1080)

A 51 second film for social media that shows how children play the Power Run lab. It is a bespoke animation on the site's voxel engine (`js/game/engine.js`), not a recording of the game. The real game is at `/labs-test/?m=powerrun` and was used as the reference for the flow.

### The story, in order

1. The level builds itself out of falling blocks, like the homepage worlds. The blue hero drops in and the camera lands at eye level. Caption: "Eco Town has lost its power!"
2. The hero runs and jumps a stream and a critter, collecting sparks ("+1" pops and rings). Caption: "Run, jump and grab the sparks!"
3. **Power prize 1.** A prompt card slides up along the bottom: "What should make the town's power?" with the child's prompt "Use …". A finger taps Wind turbines, then Send to the AI. The Lab Guide (pretend AI) replies, and three turbines fall into place part by part. On Play on, the hero rides the wind up onto the high wall.
4. **Power prize 2.** "How many batteries should I add?" A finger taps 4 batteries. Battery stairs fall into place and the hero climbs them to the high sparks.
5. **Power prize 3.** The camera swoops out over Eco Town and turbines rain onto the hill. A Town power panel counts from 4 pm to 9 pm while the sky turns pink and the 11 homes switch on.
6. Stars, the "Clean energy hero" badge and fireworks, then "Every choice changes what gets built." and the end card (Power Run, one line, deltaopslearning.com, DeltaOps Learning logo).

### Files

- `power-run.html`: the page, overlay markup and all overlay CSS (captions, prompt card, Town power panel, rings, speed lines, end card).
- `power-run.js`: the script. The course layout (`PRIZES`, `JUMPS`, `SPARK_X`, `BATS`, `WIND_X`) is at the top. `CUES` holds the opening captions. `SEQS` holds one timed sequence per prize, with times in seconds after the hero reaches that prize. `frame()` runs everything per frame: hero motion, drops, camera, sky and effects.
- `js/game/power-run-world.js`: the voxel world (runner lane at the front, Eco Town behind, hill at the back) and the props (hero, critter, spark, prize, turbine, battery).
- `render.mjs`: renders the page frame by frame on a virtual clock (animation frames, timers and CSS animations all step together), so the output is exact however slow the machine is.

### Watch it live

```sh
python3 -m http.server 8765
```

Then open http://localhost:8765/tools/social/power-run.html.

### Render the video

```sh
python3 -m http.server 8765 &
node tools/social/render.mjs frames 51 /tmp/power-run-frames
ffmpeg -framerate 30 -i /tmp/power-run-frames/f%05d.png -c:v libx264 -pix_fmt yuv420p -crf 17 -preset slow -movflags +faststart tools/social/power-run-1080.mp4
```

A full render takes about 15 minutes in a cloud container, since WebGL there runs on the CPU. To check a few moments first, render stills: `node tools/social/render.mjs stills 3,12.5,30 /tmp/stills`. The MP4 is ignored by git, so it stays out of the website repo.

### Things to know

- The web server must be running on port 8765, or the render fails at once with no frames.
- Keep the prompt card compact at the bottom. While a card is up, `promptLook()` reframes the camera so the hero stays visible above it. The user asked for this explicitly.
- Hidden overlays must sit fully off frame. The Town power panel once peeked 18 px into the top of every frame. It now uses `visibility:hidden` as well as the offset.
- The user wants bright, saturated colour, with no dark scenes and no dark gradient scrims. The evening is a pink and purple sunset, never night.
- Writing style: British English, no em dashes, full sentences in captions, and no "not X, but Y" lines.
- The partner brands and the Lab Guide are pretend, and nothing on screen should claim a live AI.

### Status (23 October 2026)

- The film was approved ("This looks really fun").
- The stray white bar at the top (the Town power panel) is fixed. The video was re-rendered with the fix, the top edge was checked across the whole film, and it was sent to the user.
- Everything is on the branch `social/power-run-film`. No pull request has been opened.
