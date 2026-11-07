"""Every Dragon Ball technique must render without relying on external assets."""
import cv2
import numpy as np

from motion_playground.effects import EffectsEngine
from motion_playground.gestures import Gesture


POSE={
    "nose":(320,95),"left_shoulder":(255,180),"right_shoulder":(385,180),
    "left_wrist":(285,230),"right_wrist":(355,230),
}


def test_all_dragon_ball_effects_render():
    actions=(
        "KAMEHAMEHA CHARGE","KAMEHAMEHA!",
        "FINAL FLASH CHARGE","FINAL FLASH!",
        "SPIRIT BOMB CHARGE","SPIRIT BOMB!",
        "SPECIAL BEAM CANNON CHARGE","SPECIAL BEAM CANNON!",
    )
    engine=EffectsEngine()
    for action in actions:
        frame=np.zeros((480,640,3),dtype=np.uint8)
        engine.draw(frame,POSE,Gesture(action,.95,action.endswith("!")))
        assert cv2.countNonZero(cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY))>0
