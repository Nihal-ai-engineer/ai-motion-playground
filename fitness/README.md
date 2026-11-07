# Formlab — local fitness app

Start from the parent project directory:

```sh
python3 fitness.py
```

Visit http://127.0.0.1:8765. Use the same address and browser to retain your history.
The original Dragon Ball application remains available with `python main.py`.

## Included

- Dashboard, responsive exercise library, profile and weekly activity.
- Local MediaPipe pose inference. All runtime/model assets are bundled; no CDN is needed while using the app.
- Side-view bodyweight squat and push-up repetition checks, plus forearm-plank timing.
- Independent illustrative reference skeleton: fixed-tempo follow mode or body-scaled phase comparison.
- Optional spoken cues, per-joint visibility gates, tracking-loss resets and minimum phase dwell times.
- Clearly labelled simulated demo mode. Demo results cannot be saved as workouts.
- Manual logs for nine exercises across gym, powerlifting, calisthenics and mobility.
- Powerlifting planning preview using entered working weights, experience, readiness and recent logged effort.
- Local history, training trends, basic estimated 1RM, rep timing/range summaries, recoverable set removal, JSON export and deduplicating history import.

## Use

1. Enter your profile with the gear button.
2. Open Movement studio, choose a supported exercise, and follow the camera placement instructions.
3. Try demo first, or click Start camera and grant camera access in your browser.
4. Begin in the extended position for repetition counting. Only complete bend-and-return cycles count.
5. Finish & save opens a reviewable set form. The count can be corrected before saving.
6. Use Log a set for unsupported exercises and powerlifting sets.
7. Enter comfortable working weights, not tested maxima, in Powerlifting. Review the explanatory draft.
8. Export history periodically. Import merges sets and their measurements without overwriting existing set IDs. Profile/program settings in a backup are for reference and are not automatically imported.

No camera frames are recorded, stored or uploaded. Derived set summaries are stored in the browser. The Python server binds only to this computer and serves only the fitness directory.

## Limitations

This is a functional prototype, not a validated coaching product. Camera checks use projected 2D angles and a fixed side-view heuristic. They do not assess all dimensions of form, competition depth, bar path, forces, muscle activation, injury risk, or recovery. Occlusion, camera placement and body proportions affect accuracy. The shadow is generated geometry, not a coach-approved motion capture sequence. Body-scaled comparison aligns a generic reference rather than learning a personalized ideal technique.

Powerlifting uses explicit prototype heuristics. It does not learn individual physiology or prescribe from body shape. The app links to ACSM's general resistance-training guidance; the app-specific effort thresholds and load adjustments are not validated by ACSM. Low readiness and high effort reduce draft loads, large relative increases are blocked, and a pain response pauses suggestions. A coach-reviewed exercise dataset and real-person validation are needed before stronger claims or broader camera support.

The UI works at phone widths, but the local server is only reachable on this computer. Phone-camera access requires a separately configured secure deployment; this version does not publish a service or expose your machine on the network.

## Checks

```sh
node --test fitness/tests/core.test.mjs
```

With the app running, visit `/tests/vision.html` for an actual local model inference check using the official MediaPipe pose fixture. This verifies model loading and landmark output, not exercise correctness. Live webcam performance and form feedback still require a real workout trial.

## Files

- `../fitness.py`: standard-library local launcher/server.
- `index.html`, `styles.css`: application shell and responsive design.
- `app.mjs`: interface, local persistence, camera lifecycle and shadow renderer.
- `core.mjs`: exercise definitions, angle measurements, repetition/hold state machine, log validation, planner and backup merge.
- `tests/`: movement-rule tests and browser model integration check.
- `vendor/`: pinned MediaPipe Tasks Vision 0.10.22-rc.20250304, CPU WASM runtimes and pose landmarker lite float16 v1 model.

## Third-party sources

- MediaPipe Tasks Vision: https://www.npmjs.com/package/@mediapipe/tasks-vision
- Model: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
- Model documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Test fixture: https://storage.googleapis.com/mediapipe-assets/pose.jpg
- General training guidance: https://acsm.org/resistance-training-guidelines-update-2026/

MediaPipe's Apache 2.0 license is included in `vendor/LICENSE`. Original app artwork is SVG geometry; no external image service or font service is used.
