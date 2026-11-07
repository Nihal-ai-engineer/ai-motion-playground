"""MediaPipe pose and hand tracking with a compact, app-friendly result."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

import cv2
import mediapipe as mp

Point = Tuple[int, int]


@dataclass
class TrackingResult:
    pose: Dict[str, Point] = field(default_factory=dict)
    visibility: Dict[str, float] = field(default_factory=dict)
    hands: List[List[Point]] = field(default_factory=list)
    raw_pose: object = None
    raw_hands: list = field(default_factory=list)


class BodyTracker:
    NAMES = {
        0: "nose", 11: "left_shoulder", 12: "right_shoulder",
        13: "left_elbow", 14: "right_elbow", 15: "left_wrist",
        16: "right_wrist", 23: "left_hip", 24: "right_hip",
        25: "left_knee", 26: "right_knee", 27: "left_ankle", 28: "right_ankle",
    }

    def __init__(self, enable_hands: bool = True, inference_width: int = 640) -> None:
        self.mp_pose = mp.solutions.pose
        self.mp_hands = mp.solutions.hands
        self.inference_width = inference_width
        self.frame_number = 0
        self.hand_interval = 3
        self.last_raw_hands = []
        self.pose = self.mp_pose.Pose(
            static_image_mode=False, model_complexity=0, smooth_landmarks=True,
            enable_segmentation=False, min_detection_confidence=0.48,
            min_tracking_confidence=0.48,
        )
        self.hands = self.mp_hands.Hands(
            static_image_mode=False, max_num_hands=2, model_complexity=0,
            min_detection_confidence=0.50, min_tracking_confidence=0.45,
        ) if enable_hands else None

    def process(self, frame, detect_hands: bool = True) -> TrackingResult:
        h, w = frame.shape[:2]
        self.frame_number += 1
        scale = min(1.0, self.inference_width / max(w, 1))
        work = frame if scale == 1.0 else cv2.resize(
            frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA
        )
        rgb = cv2.cvtColor(work, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        pose_out = self.pose.process(rgb)
        run_hands = self.hands and detect_hands and self.frame_number % self.hand_interval == 0
        hand_out = self.hands.process(rgb) if run_hands else None
        if hand_out is not None:
            self.last_raw_hands = list(hand_out.multi_hand_landmarks or [])
        elif not detect_hands:
            self.last_raw_hands = []
        result = TrackingResult()
        if pose_out.pose_landmarks:
            result.raw_pose = pose_out.pose_landmarks
            for idx, name in self.NAMES.items():
                lm = pose_out.pose_landmarks.landmark[idx]
                result.pose[name] = (int(lm.x * w), int(lm.y * h))
                result.visibility[name] = float(lm.visibility)
        if self.last_raw_hands:
            result.raw_hands = self.last_raw_hands
            for hand in self.last_raw_hands:
                result.hands.append([(int(p.x * w), int(p.y * h)) for p in hand.landmark])
        return result

    def close(self) -> None:
        self.pose.close()
        if self.hands:
            self.hands.close()
