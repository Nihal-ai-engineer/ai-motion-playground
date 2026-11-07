"""Stateful recognition for four Dragon Ball-inspired techniques."""
from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from .tracker import Point, TrackingResult


@dataclass
class Gesture:
    name: str = "READY"
    score: float = 0.0
    event: bool = False


class GestureRecognizer:
    """Recognize a charge pose followed by a deliberate release movement."""

    HOLD_SECONDS = {
        "KAMEHAMEHA": .48,
        "FINAL FLASH": .52,
        "SPIRIT BOMB": .68,
        "SPECIAL BEAM CANNON": .50,
    }
    ACTIVE_SECONDS = {
        "KAMEHAMEHA": 1.15,
        "FINAL FLASH": 1.15,
        "SPIRIT BOMB": 1.45,
        "SPECIAL BEAM CANNON": 1.20,
    }

    def __init__(self) -> None:
        self.pending: Optional[str] = None
        self.charge_started = 0.0
        self.charge_origin: Optional[Point] = None
        self.charge_wrist = "left_wrist"
        self.release_started: Optional[float] = None
        self.active_name = ""
        self.active_until = 0.0

    @staticmethod
    def _dist(a: Point, b: Point) -> float:
        return math.hypot(a[0] - b[0], a[1] - b[1])

    @staticmethod
    def _mid(a: Point, b: Point) -> Point:
        return ((a[0] + b[0]) // 2, (a[1] + b[1]) // 2)

    def _reset_charge(self) -> None:
        self.pending = None
        self.charge_started = 0.0
        self.charge_origin = None
        self.release_started = None

    def _fire(self, technique: str, now: float) -> Gesture:
        self.active_name = f"{technique}!"
        self.active_until = now + self.ACTIVE_SECONDS[technique]
        self._reset_charge()
        return Gesture(self.active_name, 1.0, True)

    def _two_fingers_extended(self, hands) -> bool:
        """Optional confidence boost for the Special Beam Cannon pose."""
        for hand in hands:
            if len(hand) < 21:
                continue
            index_up = hand[8][1] < hand[6][1]
            middle_up = hand[12][1] < hand[10][1]
            ring_folded = hand[16][1] > hand[14][1]
            pinky_folded = hand[20][1] > hand[18][1]
            if index_up and middle_up and ring_folded and pinky_folded:
                return True
        return False

    def update(self, tracked: TrackingResult, frame_h: int) -> Gesture:
        del frame_h  # All thresholds are normalized to shoulder width.
        p = tracked.pose
        now = time.monotonic()
        core = ("nose", "left_shoulder", "right_shoulder", "left_hip", "right_hip")
        core_visibility = sum(tracked.visibility.get(key, 0.0) for key in core) / len(core)
        if not p or core_visibility < .28:
            self._reset_charge()
            return Gesture("STEP INTO FRAME", 0.0)

        if now < self.active_until:
            return Gesture(self.active_name, 1.0, False)

        left, right = p["left_wrist"], p["right_wrist"]
        hand_mid = self._mid(left, right)
        hand_distance = self._dist(left, right)
        shoulder_width = max(60.0, self._dist(p["left_shoulder"], p["right_shoulder"]))
        shoulder_y = (p["left_shoulder"][1] + p["right_shoulder"][1]) / 2
        hip_y = (p["left_hip"][1] + p["right_hip"][1]) / 2
        torso_x = (p["left_shoulder"][0] + p["right_shoulder"][0]) / 2
        torso_len = max(60.0, hip_y - shoulder_y)

        kame_charge = (
            hand_distance < shoulder_width * .82
            and abs(hand_mid[0] - torso_x) > shoulder_width * .34
            and shoulder_y - shoulder_width * .15 < hand_mid[1] < hip_y + torso_len * .28
        )
        final_charge = (
            hand_distance > shoulder_width * 1.85
            and abs(left[1] - shoulder_y) < shoulder_width * .72
            and abs(right[1] - shoulder_y) < shoulder_width * .72
        )
        spirit_charge = (
            left[1] < p["nose"][1] - shoulder_width * .08
            and right[1] < p["nose"][1] - shoulder_width * .08
            and hand_distance > shoulder_width * .60
        )
        left_head_distance = self._dist(left, p["nose"])
        right_head_distance = self._dist(right, p["nose"])
        special_wrist = "left_wrist" if left_head_distance <= right_head_distance else "right_wrist"
        special_distance = min(left_head_distance, right_head_distance)
        special_charge = special_distance < shoulder_width * .67
        two_fingers = self._two_fingers_extended(tracked.hands)

        conditions = {
            "KAMEHAMEHA": kame_charge,
            "FINAL FLASH": final_charge,
            "SPIRIT BOMB": spirit_charge,
            "SPECIAL BEAM CANNON": special_charge,
        }

        if self.pending:
            elapsed = now - self.charge_started
            hold = self.HOLD_SECONDS[self.pending]
            charged = elapsed >= hold
            origin = self.charge_origin or hand_mid

            if self.pending == "KAMEHAMEHA":
                fire_pose = hand_distance < shoulder_width * 1.08 and self._dist(hand_mid, origin) > shoulder_width * .38
            elif self.pending == "FINAL FLASH":
                fire_pose = hand_distance < shoulder_width * .72 and shoulder_y - shoulder_width < hand_mid[1] < hip_y
            elif self.pending == "SPIRIT BOMB":
                fire_pose = hand_mid[1] > shoulder_y + shoulder_width * .10
            else:
                wrist = p[self.charge_wrist]
                fire_pose = self._dist(wrist, origin) > shoulder_width * .72

            if charged and fire_pose:
                return self._fire(self.pending, now)

            if conditions[self.pending]:
                self.release_started = None
                progress = min(1.0, elapsed / hold)
                confidence = .82 + progress * .17
                if self.pending == "SPECIAL BEAM CANNON" and two_fingers:
                    confidence = min(1.0, confidence + .03)
                return Gesture(f"{self.pending} CHARGE", confidence)

            if charged:
                if self.release_started is None:
                    self.release_started = now
                if now - self.release_started < .85:
                    return Gesture(f"{self.pending} CHARGE", .96)

            self._reset_charge()

        # The charge poses are intentionally distinct and checked in priority order.
        for technique in ("SPIRIT BOMB", "FINAL FLASH", "KAMEHAMEHA", "SPECIAL BEAM CANNON"):
            if conditions[technique]:
                self.pending = technique
                self.charge_started = now
                self.release_started = None
                if technique == "SPECIAL BEAM CANNON":
                    self.charge_wrist = special_wrist
                    self.charge_origin = p[special_wrist]
                else:
                    self.charge_origin = hand_mid
                confidence = .86 if technique != "SPECIAL BEAM CANNON" or not two_fingers else .91
                return Gesture(f"{technique} CHARGE", confidence)

        return Gesture("CHOOSE A TECHNIQUE", .72)
