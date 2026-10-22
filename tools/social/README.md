# Social films

`power-run.html` and `power-run.js` are a 56 second square film (1080 × 1080) for social media. It plays in the Eco Town world and uses the game HUD from the homepage. Eco Town loses power at 8pm, and the children try three plans:

1. Burn more gas. The lights stay on all night and smoke fills the sky.
2. Solar panels and a battery. The air stays clean and the lights go out at 03:00.
3. Solar, a battery and wind turbines. The lights stay on all night with clean air.

The film ends on a Power Run end card with the Delta Learning logo and URL.

## Watch it live

Serve the repository root (`python3 -m http.server 8765`) and open http://localhost:8765/tools/social/power-run.html.

## Render the video

`render.mjs` drives the page on a virtual clock (animation frames, timers and CSS animations), so every frame is exact however slow the machine is.

```sh
python3 -m http.server 8765 &
node tools/social/render.mjs frames 56 /tmp/power-run-frames
ffmpeg -framerate 30 -i /tmp/power-run-frames/f%05d.png -c:v libx264 -pix_fmt yuv420p -crf 17 -preset slow -movflags +faststart power-run-1080.mp4
```

For a few test stills: `node tools/social/render.mjs stills 3,12.5,30 /tmp/stills`.

All the timings live in the `CUES` list in `power-run.js`.
