"""AI Motion Playground - webcam pose-controlled visual effects."""
from __future__ import annotations

import argparse
import sys

from motion_playground.app import MotionPlayground


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AI Motion Playground")
    parser.add_argument("--camera", type=int, default=0, help="Camera device index")
    parser.add_argument("--width", type=int, default=960, help="Requested capture width")
    parser.add_argument("--height", type=int, default=540, help="Requested capture height")
    parser.add_argument("--no-hands", action="store_true", help="Disable hand tracking for more FPS")
    parser.add_argument("--demo", action="store_true", help="Run animated UI demo without a camera")
    parser.add_argument("--check", action="store_true", help="Validate imports and exit")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.check:
        print("AI Motion Playground: imports and configuration OK")
        return 0
    try:
        return MotionPlayground(args).run()
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(f"\nCould not start AI Motion Playground: {exc}", file=sys.stderr)
        print("Try: python main.py --demo", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
