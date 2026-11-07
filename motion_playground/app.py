"""Main capture, tracking, gesture, effects, and UI loop."""
from __future__ import annotations

import platform
import time

import cv2

from .effects import EffectsEngine
from .gestures import Gesture, GestureRecognizer
from .tracker import BodyTracker
from .ui import demo_background, draw_hud, draw_skeleton


class MotionPlayground:
    WINDOW = "AI Motion Playground"

    def __init__(self, args) -> None:
        cv2.setUseOptimized(True)
        cv2.setNumThreads(2)
        self.args = args
        self.skeleton = True
        self.effects_on = True
        self.hands_enabled = not args.no_hands
        self.hand_marks = not args.no_hands
        self.fx = EffectsEngine()
        self.gestures = GestureRecognizer()

    def _open_camera(self):
        backend = cv2.CAP_AVFOUNDATION if platform.system() == "Darwin" else cv2.CAP_ANY
        cap = cv2.VideoCapture(self.args.camera, backend)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.args.width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.args.height)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened():
            cap.release()
            raise RuntimeError(
                f"Camera {self.args.camera} is unavailable. On macOS allow camera access in "
                "System Settings > Privacy & Security > Camera, or run with --demo."
            )
        return cap

    def run(self) -> int:
        cv2.namedWindow(self.WINDOW, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(self.WINDOW, min(self.args.width, 1280), min(self.args.height, 720))
        if self.args.demo:
            return self._demo_loop()
        tracker = BodyTracker(self.hands_enabled)
        cap = None
        try:
            cap = self._open_camera()
            return self._camera_loop(cap, tracker)
        finally:
            if cap: cap.release()
            tracker.close()
            cv2.destroyAllWindows()

    def _camera_loop(self, cap, tracker) -> int:
        last=time.perf_counter(); fps=0.0; failures=0
        while True:
            ok, frame=cap.read()
            if not ok:
                failures += 1
                if failures > 20: raise RuntimeError("Camera stopped returning frames. Reconnect it and try again.")
                continue
            failures=0
            frame=cv2.flip(frame,1)
            tracked=tracker.process(frame, detect_hands=self.hand_marks)
            gesture=self.gestures.update(tracked,frame.shape[0])
            if self.skeleton: draw_skeleton(frame,tracked,tracker,self.hand_marks)
            if self.effects_on:
                self.fx.draw(frame, tracked.pose, gesture)
            now=time.perf_counter(); instant=1/max(now-last,1e-6); last=now
            fps=instant if not fps else fps*.9+instant*.1
            draw_hud(frame,gesture,fps,self.skeleton,self.effects_on,self.hand_marks)
            cv2.imshow(self.WINDOW,frame)
            if self._key(cv2.waitKey(1)&0xFF): return 0

    def _demo_loop(self) -> int:
        start=time.perf_counter(); last=start; fps=0.0
        try:
            while True:
                now=time.perf_counter(); t=now-start
                frame=demo_background(self.args.width,self.args.height,t)
                cx=self.args.width//2; cy=self.args.height//2
                actions=("KAMEHAMEHA CHARGE","KAMEHAMEHA!","FINAL FLASH CHARGE","FINAL FLASH!",
                         "SPIRIT BOMB CHARGE","SPIRIT BOMB!","SPECIAL BEAM CANNON CHARGE","SPECIAL BEAM CANNON!")
                action=actions[int(t/2)%len(actions)]
                pose={"nose":(cx,cy-120),"left_shoulder":(cx-65,cy-55),"right_shoulder":(cx+65,cy-55),
                      "left_wrist":(cx-35,cy+10),"right_wrist":(cx+35,cy+10)}
                if action=="FINAL FLASH CHARGE": pose.update(left_wrist=(cx-260,cy),right_wrist=(cx+260,cy))
                if action=="SPIRIT BOMB CHARGE": pose.update(left_wrist=(cx-90,70),right_wrist=(cx+90,70))
                if action=="SPECIAL BEAM CANNON CHARGE": pose.update(left_wrist=(cx-20,cy-120))
                if action=="SPECIAL BEAM CANNON!": pose.update(left_wrist=(cx-180,cy-30))
                gesture=Gesture(action,.96)
                if self.effects_on: self.fx.draw(frame,pose,gesture)
                instant=1/max(now-last,1e-6); last=now; fps=instant if not fps else fps*.9+instant*.1
                draw_hud(frame,gesture,fps,self.skeleton,self.effects_on,self.hand_marks,True)
                cv2.imshow(self.WINDOW,frame)
                if self._key(cv2.waitKey(1)&0xFF): return 0
        finally: cv2.destroyAllWindows()

    def _key(self,key) -> bool:
        if key in (ord('q'),27): return True
        if key==ord('s'): self.skeleton=not self.skeleton
        if key==ord('e'): self.effects_on=not self.effects_on
        if key==ord('h'): self.hand_marks=not self.hand_marks
        return False
