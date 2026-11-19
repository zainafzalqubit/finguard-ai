# FinGuard demo recording

Records the FinGuard demo video from the running app and renders it as a smooth 1080p, 60 fps MP4.
Output: `output/finguard-demo.mp4`, and with the voice-over `output/finguard-demo-voice-andrew.mp4`.

## How it works

1. `record.mjs` drives the real app in headless Edge.
   The steps follow the demo script in PLAN.md section 11: title card, upload, live audit, findings with evidence, invoice preview, passed invoices, history, closing card.
   It captures every repaint as a frame with its real timestamp.
   Zooms and captions are only marked at this stage.
2. `render.mjs` builds the video with ffmpeg (bundled through `ffmpeg-static`, nothing installed system-wide).
   - It re-times the frames to a constant 60 fps.
   - It applies eased camera zooms.
   - It overlays captions drawn in the app's own font.
   - It fades the video in and out.

The cursor is animated inside the page at display rate, so it moves smoothly.
Frames are captured at 1.5x the output size (2160x1215), so zoomed text stays sharp.

## Run it

Start the app on an empty demo database, so the video starts on a clean dashboard and your own audits are untouched:

```bash
cd ../finguard
FINGUARD_DB=data/demo.db pnpm dev
```

Then, in this folder:

```bash
pnpm install
MODEL="Demo mode" pnpm run demo   # quick, scripted agents, about 1 min of video
pnpm run demo                     # real Gemini run; the waiting stretch plays 8x faster with a badge
```

Recording takes about as long as the demo itself.
Rendering takes about 8 minutes.

`pnpm run narrate` adds the voice-over without changing the picture: the video stream is copied, and an AAC track is added.
- The voice is Microsoft's free "Andrew" neural voice, through the Edge Read Aloud service, so it needs internet. Only the narration text is sent.
- Each line starts with its scene, and the script stops if a line would run past its scene.
- Finished lines are cached, so a dropped connection only re-fetches what failed.
- To change what is said, edit `SCRIPT` in `narrate.mjs`.

## Notes

- Clear the demo database between takes, or the history scene shows older runs.
  Either delete `../finguard/data/demo.db` while the server is stopped, or empty its `runs`, `events` and `files` tables.
- The Gemini version needs free-tier quota left for the day.
  One audit uses about 60 requests.
  If the quota runs out mid-run, the app marks the invoices "not fully checked", and the recording stops when it cannot find the finding it wants to open.
- `frames/` and `output/` are ignored by git.
  Only the scripts are meant to be committed.
