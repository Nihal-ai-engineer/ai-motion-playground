# Formlab fitness app

The new local fitness app is available alongside the original project.

Run `python3 fitness.py` or double-click **Start Formlab.command**. Open http://127.0.0.1:8765.

Includes a movement studio, illustrative shadow practice, three camera-supported exercises, manual gym/calisthenics logs, a powerlifting planning preview, and saved progress. See [fitness/README.md](fitness/README.md) for use, limitations and checks.

---

# AI Motion Playground — Dragon Ball Edition

A focused real-time webcam experience built with Python, OpenCV, and MediaPipe. Your body becomes the controller for four Dragon Ball-inspired techniques. Every technique uses a deliberate **charge pose → release movement** sequence, reducing accidental activations.

This is a fan-made visual programming project. It uses original OpenCV-generated effects and includes no Dragon Ball images, audio, or other media assets.

## Techniques

| Technique | Charge pose | Fire movement | Effect |
|---|---|---|---|
| Kamehameha | Join both hands near either hip and hold for 0.5 seconds | Thrust the joined hands across your body | Blue-white energy beam |
| Final Flash | Extend both arms wide at shoulder height and hold for 0.5 seconds | Bring both palms together in front of your chest | Large gold beam with electric palms |
| Spirit Bomb | Raise separated hands above your head and hold for 0.7 seconds | Lower both hands | Huge blue energy sphere descending through the scene |
| Special Beam Cannon | Hold one wrist/two fingers near your forehead for 0.5 seconds | Thrust that hand away from your forehead | Focused purple spiral beam |

No effects are assigned to waving, leaning, punching, squatting, jumping, clapping, or simply raising one hand.

## Performance and interface

- Mirrored 960×540 webcam feed
- Lightweight MediaPipe pose model at 640-pixel inference width
- Hand landmarks processed every third frame
- Half-resolution glow caching and bounded particle counts
- Live skeleton, gesture confidence, technique hints, and smoothed FPS
- Camera-free demo that cycles through all four techniques
- Clear camera and startup error messages

## Requirements

- macOS 11 or newer
- Python 3.10, 3.11, or 3.12
- Webcam

Python 3.13 and 3.14 are not recommended for the MediaPipe Solutions release used by this project.

## Setup on macOS

```bash
cd /Users/nihaljanjua/chitprojects/ai-motion-playground
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python main.py
```

When macOS asks, allow Terminal camera access. You can change this later under **System Settings → Privacy & Security → Camera**.

## Controls

| Key | Action |
|---|---|
| `S` | Toggle pose skeleton |
| `E` | Toggle Dragon Ball effects |
| `H` | Toggle hand tracking and hand landmarks |
| `Q` or `Esc` | Quit |

## Run options

```bash
python main.py                         # normal webcam mode
python main.py --demo                  # cycle effects without a camera
python main.py --camera 1              # choose another camera
python main.py --width 800 --height 450
python main.py --no-hands              # higher FPS; pose fallback remains
python main.py --check                 # validate imports and configuration
```

## Getting reliable recognition

- Show your head, shoulders, hips, elbows, and hands in the frame.
- Face the camera and keep both arms inside the image.
- Use even front lighting and avoid a bright window behind you.
- Hold the charge pose until its name appears on screen, then perform the release movement.
- For Special Beam Cannon, visible hand landmarks improve the two-finger pose confidence.
- If FPS is low, press `H` or run at `800×450`.

## Project structure

```text
ai-motion-playground/
├── main.py
├── requirements.txt
├── README.md
├── motion_playground/
│   ├── app.py          Camera, render loop, demo, and controls
│   ├── tracker.py      Optimized MediaPipe pose and hand tracking
│   ├── gestures.py     Four charge-and-release state machines
│   ├── effects.py      Four Dragon Ball-inspired visual effects
│   └── ui.py           Skeleton, HUD, confidence, FPS, and hints
└── tests/
    ├── test_gestures.py
    └── test_effects.py
```

## Troubleshooting

- **Camera unavailable:** close FaceTime/Zoom, verify camera permission, or try `python main.py --camera 1`.
- **Low FPS:** press `H`, or run `python main.py --no-hands --width 800 --height 450`.
- **No technique starts:** step back so the complete upper body is visible and hold the charge pose longer.
- **Package installation fails:** verify `python --version` shows Python 3.10–3.12 and recreate `.venv`.
- **Remote/headless session:** use `python main.py --check`; the live window requires a macOS desktop session.

## Validation

The project includes deterministic checks for all four charge gestures, all four release gestures, unrelated-motion rejection, missing-person handling, and all eight charge/fire render paths.

```bash
pip install pytest
pytest
```
