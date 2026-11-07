"""Portfolio-style HUD and MediaPipe landmark drawing."""
from __future__ import annotations

import cv2
import numpy as np

ACTION_COLORS = {
    "KAMEHAMEHA CHARGE": (255,180,40), "KAMEHAMEHA!": (255,220,100),
    "FINAL FLASH CHARGE": (40,220,255), "FINAL FLASH!": (80,245,255),
    "SPIRIT BOMB CHARGE": (255,105,25), "SPIRIT BOMB!": (255,155,45),
    "SPECIAL BEAM CANNON CHARGE": (255,45,210), "SPECIAL BEAM CANNON!": (255,80,235),
}

HINTS = {
    "KAMEHAMEHA CHARGE": "HOLD AT HIP  •  THEN THRUST ACROSS",
    "FINAL FLASH CHARGE": "HOLD ARMS WIDE  •  THEN JOIN PALMS",
    "SPIRIT BOMB CHARGE": "HOLD HANDS OVERHEAD  •  THEN LOWER",
    "SPECIAL BEAM CANNON CHARGE": "HOLD FINGERS AT FOREHEAD  •  THEN THRUST",
}


def rounded_panel(frame, a, b, color=(12, 16, 32), alpha=.78, radius=18):
    layer = frame.copy()
    x1,y1=a; x2,y2=b
    cv2.rectangle(layer, (x1+radius,y1), (x2-radius,y2), color, -1)
    cv2.rectangle(layer, (x1,y1+radius), (x2,y2-radius), color, -1)
    for x,y in ((x1+radius,y1+radius),(x2-radius,y1+radius),(x1+radius,y2-radius),(x2-radius,y2-radius)):
        cv2.circle(layer,(x,y),radius,color,-1)
    cv2.addWeighted(layer, alpha, frame, 1-alpha, 0, frame)


def draw_skeleton(frame, tracked, tracker, draw_hands=True):
    if tracked.raw_pose:
        mp = __import__("mediapipe")
        mp.solutions.drawing_utils.draw_landmarks(
            frame, tracked.raw_pose, tracker.mp_pose.POSE_CONNECTIONS,
            mp.solutions.drawing_utils.DrawingSpec((255,90,190),2,3),
            mp.solutions.drawing_utils.DrawingSpec((80,230,255),2,2))
    if draw_hands and tracked.raw_hands:
        mp = __import__("mediapipe")
        for hand in tracked.raw_hands:
            mp.solutions.drawing_utils.draw_landmarks(frame, hand, tracker.mp_hands.HAND_CONNECTIONS,
                mp.solutions.drawing_utils.DrawingSpec((255,210,80),2,2),
                mp.solutions.drawing_utils.DrawingSpec((100,255,210),2,1))


def draw_hud(frame, gesture, fps, skeleton, effects, hand_marks, demo=False):
    h,w=frame.shape[:2]
    action_color=ACTION_COLORS.get(gesture.name,(80,235,255))
    rounded_panel(frame,(20,16),(min(w-20,500),108))
    cv2.putText(frame,"DRAGON BALL MOTION LAB  /  LIVE",(40,48),cv2.FONT_HERSHEY_DUPLEX,.61,(245,245,255),1,cv2.LINE_AA)
    cv2.putText(frame,gesture.name,(40,85),cv2.FONT_HERSHEY_DUPLEX,.82,action_color,2,cv2.LINE_AA)
    score=f"{int(gesture.score*100):02d}%" if gesture.score else "--"
    cv2.putText(frame,score,(405,84),cv2.FONT_HERSHEY_DUPLEX,.60,action_color,2,cv2.LINE_AA)
    bar_width=int(210*max(0,min(1,gesture.score)))
    cv2.rectangle(frame,(40,93),(250,98),(55,65,85),-1)
    cv2.rectangle(frame,(40,93),(40+bar_width,98),action_color,-1)
    hint=HINTS.get(gesture.name,"KAMEHAMEHA  •  FINAL FLASH  •  SPIRIT BOMB  •  SPECIAL BEAM CANNON")
    rounded_panel(frame,(20,116),(min(w-20,620),154),alpha=.74,radius=12)
    cv2.putText(frame,hint,(39,141),cv2.FONT_HERSHEY_SIMPLEX,.43,(145,225,255),1,cv2.LINE_AA)
    rounded_panel(frame,(w-180,16),(w-20,70))
    cv2.putText(frame,f"{fps:4.1f} FPS",(w-158,51),cv2.FONT_HERSHEY_DUPLEX,.60,(130,255,185),1,cv2.LINE_AA)

    if w >= 850:
        rounded_panel(frame,(w-235,88),(w-20,258),alpha=.68,radius=14)
        cv2.putText(frame,"TRY AN ACTION",(w-214,116),cv2.FONT_HERSHEY_DUPLEX,.45,(230,235,250),1,cv2.LINE_AA)
        actions=("KAMEHAMEHA","FINAL FLASH","SPIRIT BOMB","SPECIAL BEAM","HOLD, THEN RELEASE")
        for i,label in enumerate(actions):
            color=(90,230,255) if i%2==0 else (255,110,205)
            cv2.circle(frame,(w-211,140+i*23),3,color,-1,cv2.LINE_AA)
            cv2.putText(frame,label,(w-200,145+i*23),cv2.FONT_HERSHEY_SIMPLEX,.39,(215,220,238),1,cv2.LINE_AA)
    rounded_panel(frame,(20,h-56),(min(w-20,680),h-14),alpha=.7,radius=13)
    status=f"[S] Skeleton {'ON' if skeleton else 'OFF'}   [E] Effects {'ON' if effects else 'OFF'}   [H] Hands {'ON' if hand_marks else 'OFF'}   [Q] Quit"
    cv2.putText(frame,status,(38,h-29),cv2.FONT_HERSHEY_SIMPLEX,.46,(220,225,240),1,cv2.LINE_AA)
    if demo:
        cv2.putText(frame,"DEMO MODE",(w-168,102),cv2.FONT_HERSHEY_DUPLEX,.48,(100,160,255),1,cv2.LINE_AA)


def demo_background(width, height, t):
    y,x=np.mgrid[0:height,0:width]
    base=np.zeros((height,width,3),np.uint8)
    base[:,:,0]=(18+18*x/width).astype(np.uint8)
    base[:,:,1]=(10+14*y/height).astype(np.uint8)
    base[:,:,2]=(30+18*x/width).astype(np.uint8)
    for i in range(7):
        cx=int((i*211+t*22)% (width+240)-120); cy=int(height*(.18+(i%4)*.2))
        cv2.circle(base,(cx,cy),80,(45,20,65),-1,cv2.LINE_AA)
    return cv2.GaussianBlur(base,(0,0),30)
