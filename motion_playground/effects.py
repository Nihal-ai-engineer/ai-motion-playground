"""High-energy visuals for four Dragon Ball-inspired techniques only."""
from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass
from typing import Dict, List, Tuple

import cv2
import numpy as np

Point = Tuple[int, int]
Color = Tuple[int, int, int]


@dataclass
class Particle:
    x: float
    y: float
    vx: float
    vy: float
    life: float
    size: float
    color: Color


@dataclass
class Ring:
    center: Point
    radius: float
    speed: float
    life: float
    color: Color


class EffectsEngine:
    COLORS = {
        "KAMEHAMEHA CHARGE": (255, 185, 45),
        "KAMEHAMEHA!": (255, 215, 90),
        "FINAL FLASH CHARGE": (40, 220, 255),
        "FINAL FLASH!": (80, 245, 255),
        "SPIRIT BOMB CHARGE": (255, 105, 25),
        "SPIRIT BOMB!": (255, 155, 45),
        "SPECIAL BEAM CANNON CHARGE": (255, 45, 210),
        "SPECIAL BEAM CANNON!": (255, 80, 235),
    }

    def __init__(self) -> None:
        self.particles: List[Particle] = []
        self.rings: List[Ring] = []
        self.rng = random.Random()
        self.last_action = ""
        self.action_started = time.monotonic()
        self.frame_number = 0
        self.glow_cache = None

    @staticmethod
    def _mid(a: Point, b: Point) -> Point:
        return ((a[0] + b[0]) // 2, (a[1] + b[1]) // 2)

    def _emit(self, point: Point, color: Color, amount: int, speed=(1.0, 7.0)) -> None:
        for _ in range(amount):
            angle = self.rng.uniform(0, math.tau)
            velocity = self.rng.uniform(*speed)
            self.particles.append(Particle(
                point[0], point[1], math.cos(angle) * velocity,
                math.sin(angle) * velocity, self.rng.uniform(.55, 1.0),
                self.rng.uniform(2.0, 7.0), color,
            ))

    def _on_action_start(self, action: str, pose: Dict[str, Point]) -> None:
        self.action_started = time.monotonic()
        left, right = pose.get("left_wrist"), pose.get("right_wrist")
        if not left or not right:
            return
        center = self._mid(left, right)
        color = self.COLORS.get(action, (255,255,255))
        if action.endswith("!"):
            amount = 120 if action == "SPIRIT BOMB!" else 80
            self._emit(center, color, amount, (4.0, 15.0))
            self.rings.extend(Ring(center, 18+i*12, 20+i*3, 1.0, color) for i in range(5))

    def _energy_core(self, frame, overlay, center: Point, radius: int, color: Color) -> None:
        cv2.circle(overlay, center, radius + 28, color, -1, cv2.LINE_AA)
        cv2.circle(frame, center, radius + 7, tuple(int(c*.72) for c in color), -1, cv2.LINE_AA)
        cv2.circle(frame, center, radius, color, -1, cv2.LINE_AA)
        cv2.circle(frame, center, max(5, radius//2), (255,255,255), -1, cv2.LINE_AA)
        cv2.circle(frame, center, radius + 4, (255,255,255), 2, cv2.LINE_AA)

    def _horizontal_beam(self, frame, overlay, start: Point, direction: int, color: Color,
                         outer: int, core: int) -> None:
        h, w = frame.shape[:2]
        del h
        end_x = w + 120 if direction > 0 else -120
        beam = np.array([(start[0],start[1]-18),(end_x,start[1]-outer),
                         (end_x,start[1]+outer),(start[0],start[1]+18)],np.int32)
        white = np.array([(start[0],start[1]-8),(end_x,start[1]-core),
                          (end_x,start[1]+core),(start[0],start[1]+8)],np.int32)
        cv2.fillPoly(overlay,[beam],color,cv2.LINE_AA)
        cv2.fillPoly(frame,[white],(255,255,255),cv2.LINE_AA)
        for offset in range(90, abs(end_x-start[0]), 105):
            x=start[0]+offset*direction
            cv2.ellipse(overlay,(x,start[1]),(13,outer),0,0,360,color,3,cv2.LINE_AA)

    def _kamehameha(self, frame, overlay, pose, action, elapsed) -> None:
        left, right = pose.get("left_wrist"), pose.get("right_wrist")
        if not left or not right:
            return
        center = self._mid(left,right)
        if action.endswith("CHARGE"):
            radius=int(22+min(24,elapsed*25)+5*math.sin(elapsed*14))
            self._energy_core(frame,overlay,center,radius,(255,180,35))
            for i in range(7):
                angle=elapsed*5+i*math.tau/7
                source=(int(center[0]+math.cos(angle)*radius*1.6),int(center[1]+math.sin(angle)*radius*1.6))
                cv2.line(overlay,source,center,(255,220,130),2,cv2.LINE_AA)
            self._emit(center,(255,180,35),3,(1.0,4.0))
        else:
            shoulders=[pose.get("left_shoulder"),pose.get("right_shoulder")]
            shoulders=[point for point in shoulders if point]
            torso_x=sum(point[0] for point in shoulders)//len(shoulders) if shoulders else frame.shape[1]//2
            direction=1 if center[0]>=torso_x else -1
            width=int(76+15*math.sin(elapsed*17))
            self._horizontal_beam(frame,overlay,center,direction,(255,125,25),width,25)
            self._energy_core(frame,overlay,center,39,(255,200,70))

    def _final_flash(self, frame, overlay, pose, action, elapsed) -> None:
        left, right = pose.get("left_wrist"), pose.get("right_wrist")
        if not left or not right:
            return
        center=self._mid(left,right)
        gold=(45,225,255)
        if action.endswith("CHARGE"):
            for wrist in (left,right):
                radius=int(18+8*math.sin(elapsed*12))
                self._energy_core(frame,overlay,wrist,radius,gold)
                self._emit(wrist,gold,2,(1.0,4.5))
                for _ in range(2):
                    end=(wrist[0]+self.rng.randint(-55,55),wrist[1]+self.rng.randint(-55,55))
                    cv2.line(overlay,wrist,end,(100,245,255),2,cv2.LINE_AA)
        else:
            direction=1 if center[0]>=frame.shape[1]//2 else -1
            width=int(92+18*math.sin(elapsed*18))
            self._horizontal_beam(frame,overlay,center,direction,(35,210,255),width,34)
            self._energy_core(frame,overlay,center,45,(90,245,255))

    def _spirit_bomb(self, frame, overlay, pose, action, elapsed) -> None:
        left, right = pose.get("left_wrist"), pose.get("right_wrist")
        if not left or not right:
            return
        hand_center=self._mid(left,right)
        color=(255,105,20)
        if action.endswith("CHARGE"):
            center=(hand_center[0],max(75,min(left[1],right[1])-55))
            radius=int(46+min(42,elapsed*36)+7*math.sin(elapsed*9))
            self._energy_core(frame,overlay,center,radius,color)
            for i in range(14):
                angle=i*math.tau/14+elapsed*.8
                start=(int(center[0]+math.cos(angle)*(radius+70)),int(center[1]+math.sin(angle)*(radius+70)))
                cv2.line(overlay,start,center,(255,155,70),2,cv2.LINE_AA)
            self._emit(center,color,4,(.5,3.5))
        else:
            h,w=frame.shape[:2]
            progress=min(1.0,elapsed/1.25)
            center=(hand_center[0],int(-80+(h+160)*progress))
            radius=int(92+16*math.sin(elapsed*10))
            cv2.circle(overlay,center,radius+45,color,-1,cv2.LINE_AA)
            self._energy_core(frame,overlay,center,radius,(255,135,35))
            for i in range(10):
                angle=i*math.tau/10+elapsed*2
                tail=(int(center[0]+math.cos(angle)*(radius+35)),int(center[1]+math.sin(angle)*(radius+35)))
                cv2.line(overlay,tail,center,(255,190,100),3,cv2.LINE_AA)

    def _special_beam(self, frame, overlay, pose, action, elapsed) -> None:
        left, right = pose.get("left_wrist"), pose.get("right_wrist")
        nose=pose.get("nose")
        if not left or not right or not nose:
            return
        wrist=left if math.dist(left,nose)<math.dist(right,nose) else right
        purple=(255,45,210)
        if action.endswith("CHARGE"):
            radius=int(20+8*math.sin(elapsed*15))
            self._energy_core(frame,overlay,wrist,radius,purple)
            for i in range(4):
                angle=elapsed*7+i*math.pi/2
                point=(int(wrist[0]+math.cos(angle)*(radius+18)),int(wrist[1]+math.sin(angle)*(radius+18)))
                cv2.circle(overlay,point,5,purple,-1,cv2.LINE_AA)
            self._emit(wrist,purple,3,(1.0,4.0))
        else:
            wrist=left if math.dist(left,nose)>math.dist(right,nose) else right
            direction=1 if wrist[0]>=nose[0] else -1
            outer=int(35+7*math.sin(elapsed*20))
            self._horizontal_beam(frame,overlay,wrist,direction,(255,35,210),outer,8)
            self._energy_core(frame,overlay,wrist,25,(255,80,235))

    def draw(self, frame, pose: Dict[str, Point], gesture) -> None:
        self.frame_number += 1
        action=gesture.name
        if action!=self.last_action:
            self.last_action=action
            self._on_action_start(action,pose)
        overlay=np.zeros_like(frame)
        elapsed=time.monotonic()-self.action_started

        if action.startswith("KAMEHAMEHA"):
            self._kamehameha(frame,overlay,pose,action,elapsed)
        elif action.startswith("FINAL FLASH"):
            self._final_flash(frame,overlay,pose,action,elapsed)
        elif action.startswith("SPIRIT BOMB"):
            self._spirit_bomb(frame,overlay,pose,action,elapsed)
        elif action.startswith("SPECIAL BEAM CANNON"):
            self._special_beam(frame,overlay,pose,action,elapsed)

        alive=[]
        for particle in self.particles[-450:]:
            particle.x+=particle.vx
            particle.y+=particle.vy
            particle.life-=.035
            if particle.life>0:
                alive.append(particle)
                cv2.circle(overlay,(int(particle.x),int(particle.y)),
                           max(1,int(particle.size*particle.life)),particle.color,-1,cv2.LINE_AA)
        self.particles=alive

        rings=[]
        for ring in self.rings:
            ring.radius+=ring.speed
            ring.life-=.065
            if ring.life>0:
                rings.append(ring)
                cv2.circle(overlay,ring.center,int(ring.radius),ring.color,max(2,int(7*ring.life)),cv2.LINE_AA)
        self.rings=rings

        if self.frame_number%2==0 or self.glow_cache is None or self.glow_cache.shape!=frame.shape:
            small=cv2.resize(overlay,None,fx=.5,fy=.5,interpolation=cv2.INTER_AREA)
            glow=cv2.GaussianBlur(small,(0,0),8)
            self.glow_cache=cv2.resize(glow,(frame.shape[1],frame.shape[0]),interpolation=cv2.INTER_LINEAR)
        cv2.addWeighted(frame,1.0,self.glow_cache,.58,0,frame)
        cv2.addWeighted(frame,1.0,overlay,.92,0,frame)
