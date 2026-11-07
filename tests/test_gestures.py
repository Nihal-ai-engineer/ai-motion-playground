"""Deterministic tests for all four charge-and-release techniques."""
import time

from motion_playground.gestures import GestureRecognizer
from motion_playground.tracker import TrackingResult


def pose(**changes):
    points={
        "nose":(320,80),"left_shoulder":(260,180),"right_shoulder":(380,180),
        "left_elbow":(230,250),"right_elbow":(410,250),
        "left_wrist":(210,310),"right_wrist":(430,310),
        "left_hip":(275,350),"right_hip":(365,350),
        "left_knee":(280,500),"right_knee":(360,500),
        "left_ankle":(280,650),"right_ankle":(360,650),
    }
    points.update(changes)
    return TrackingResult(points,{name:.99 for name in points})


def charge(recognizer, tracked, technique):
    result=recognizer.update(tracked,720)
    assert result.name==f"{technique} CHARGE"
    recognizer.charge_started=time.monotonic()-recognizer.HOLD_SECONDS[technique]-.1


def test_kamehameha():
    recognizer=GestureRecognizer()
    charge(recognizer,pose(left_wrist=(400,300),right_wrist=(420,300)),"KAMEHAMEHA")
    fired=recognizer.update(pose(left_wrist=(300,250),right_wrist=(320,250)),720)
    assert fired.name=="KAMEHAMEHA!" and fired.event


def test_final_flash():
    recognizer=GestureRecognizer()
    charge(recognizer,pose(left_wrist=(160,190),right_wrist=(480,190)),"FINAL FLASH")
    fired=recognizer.update(pose(left_wrist=(300,230),right_wrist=(340,230)),720)
    assert fired.name=="FINAL FLASH!" and fired.event


def test_spirit_bomb():
    recognizer=GestureRecognizer()
    charge(recognizer,pose(left_wrist=(260,30),right_wrist=(380,30)),"SPIRIT BOMB")
    fired=recognizer.update(pose(left_wrist=(280,250),right_wrist=(360,250)),720)
    assert fired.name=="SPIRIT BOMB!" and fired.event


def test_special_beam_cannon():
    recognizer=GestureRecognizer()
    charge(recognizer,pose(left_wrist=(300,90),right_wrist=(450,310)),"SPECIAL BEAM CANNON")
    fired=recognizer.update(pose(left_wrist=(190,190),right_wrist=(450,310)),720)
    assert fired.name=="SPECIAL BEAM CANNON!" and fired.event


def test_other_movements_have_no_effect():
    result=GestureRecognizer().update(pose(left_wrist=(220,70)),720)
    assert result.name=="CHOOSE A TECHNIQUE"


def test_missing_person():
    result=GestureRecognizer().update(TrackingResult(),720)
    assert result.name=="STEP INTO FRAME"
