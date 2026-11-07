export const EXERCISES = [
  {
    id: "squat",
    name: "Bodyweight squat",
    category: "Gym",
    tracking: "reps",
    target: 8,
    unit: "reps",
    view: "Side view · whole body",
    desc: "Practise a controlled squat with a side-view knee-angle estimate.",
    setup:
      "Place the camera at hip height, directly beside you. Keep your shoulders, hips, knees and feet visible.",
    checks:
      "Counts a bend-and-return cycle using the visible knee. Does not assess spinal position, balance, or competition depth.",
  },
  {
    id: "pushup",
    name: "Push-up",
    category: "Calisthenics",
    tracking: "reps",
    target: 8,
    unit: "reps",
    view: "Side view · floor level",
    desc: "Build repeatable push-ups with elbow-angle and body-line feedback.",
    setup:
      "Place the camera beside you, low enough to see your shoulder, elbow, wrist, hip and ankle.",
    checks:
      "Estimates elbow bend and shoulder–hip–ankle alignment. Does not assess shoulder loading or hand pressure.",
  },
  {
    id: "plank",
    name: "Forearm plank",
    category: "Calisthenics",
    tracking: "hold",
    target: 30,
    unit: "sec",
    view: "Side view · floor level",
    desc: "Accumulate a tracked hold while keeping your body line steady.",
    setup:
      "Place the camera beside you. Keep your shoulders, elbows, hips and ankles visible. Start on your forearms.",
    checks:
      "Times a near-horizontal body with a straight shoulder–hip–ankle line and bent elbows. Cannot verify contact or muscle engagement.",
  },
  {
    id: "back-squat",
    name: "Barbell squat",
    category: "Powerlifting",
    target: 5,
    unit: "reps",
    desc: "Log your working sets, load and effort.",
    setup:
      "Manual logging. Camera technique assessment is not available for this lift.",
  },
  {
    id: "bench",
    name: "Bench press",
    category: "Powerlifting",
    target: 5,
    unit: "reps",
    desc: "Track pressing strength and session effort.",
    setup:
      "Manual logging. Camera technique assessment is not available for this lift.",
  },
  {
    id: "deadlift",
    name: "Deadlift",
    category: "Powerlifting",
    target: 5,
    unit: "reps",
    desc: "Record your pulls and follow your strength trend.",
    setup:
      "Manual logging. Camera technique assessment is not available for this lift.",
  },
  {
    id: "pullup",
    name: "Pull-up",
    category: "Calisthenics",
    target: 5,
    unit: "reps",
    desc: "Track repetitions and assistance in your notes.",
    setup: "Manual logging. Record band or machine assistance in your notes.",
  },
  {
    id: "lunge",
    name: "Lunge",
    category: "Gym",
    target: 10,
    unit: "reps",
    desc: "Log repetitions per leg and any external load.",
    setup: "Manual logging. Use repetitions per leg consistently.",
  },
  {
    id: "mobility",
    name: "Mobility practice",
    category: "Mobility",
    target: 60,
    unit: "sec",
    desc: "Record time and the movements you practised.",
    setup: "Manual logging. Describe your mobility practice in the notes.",
  },
];
export const findExercise = (id) => EXERCISES.find((e) => e.id === id);
export function angle(a, b, c) {
  const u = [a.x - b.x, a.y - b.y],
    v = [c.x - b.x, c.y - b.y];
  const d = Math.hypot(...u) * Math.hypot(...v);
  return d < 1e-8
    ? null
    : (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / d))) *
        180) /
        Math.PI;
}
export function measurePose(points, exercise, width = 960, height = 540) {
  if (!points?.length) return { valid: false, cue: "Step into the frame" };
  const choices = [
    [11, 13, 15, 23, 25, 27],
    [12, 14, 16, 24, 26, 28],
  ];
  let best = null;
  for (const ids of choices) {
    const required =
      exercise === "squat" ? [ids[0], ids[3], ids[4], ids[5]] : ids;
    const confidence = Math.min(
      ...required.map((i) => points[i]?.visibility ?? 0),
    );
    if (
      required.some(
        (i) =>
          !points[i] ||
          points[i].x < 0.02 ||
          points[i].x > 0.98 ||
          points[i].y < 0.02 ||
          points[i].y > 0.98,
      )
    )
      continue;
    const p = ids.map((i) => ({
      x: points[i].x * width,
      y: points[i].y * height,
    }));
    const [s, e, w, h, k, a] = p;
    const value = exercise === "squat" ? angle(h, k, a) : angle(s, e, w);
    const line = angle(s, h, a);
    const horizontal =
      Math.abs(s.y - a.y) / Math.max(1, Math.hypot(s.x - a.x, s.y - a.y));
    const both =
      exercise === "squat"
        ? [points[11], points[12]]
        : [points[23], points[24]];
    const torso = Math.hypot(s.x - h.x, s.y - h.y);
    const cross = Math.abs(both[0].x - both[1].x) * width;
    const sideView = cross / Math.max(1, torso) < 0.65;
    const setup = exercise !== "squat" || (horizontal > 0.55 && s.y < a.y);
    const candidate = {
      valid:
        confidence >= 0.65 &&
        value !== null &&
        line !== null &&
        sideView &&
        setup,
      setup,
      confidence,
      value,
      line,
      horizontal,
      sideView,
      ids,
    };
    if (!best || confidence > best.confidence) best = candidate;
  }
  if (!best)
    return {
      valid: false,
      cue: "Move back so all required joints are in frame",
    };
  if (!best.valid)
    best.cue =
      best.confidence < 0.65
        ? "Tracking unclear · reposition the camera"
        : !best.sideView
          ? "Turn sideways to the camera"
          : !best.setup
            ? "Stand upright for a squat"
            : "Tracking unclear";
  return best;
}
export class RepCounter {
  constructor(exercise) {
    this.exercise = exercise;
    this.reps = 0;
    this.hold = 0;
    this.phase = "ready";
    this.last = null;
    this.lastRep = null;
    this.start = null;
    this.min = 180;
    this.tempos = [];
    this.range = [];
    this.candidate = null;
    this.since = 0;
  }
  update(m, now) {
    const dt =
      this.last === null
        ? 0
        : Math.max(0, Math.min(0.2, (now - this.last) / 1000));
    this.last = now;
    if (!m.valid) {
      this.phase = "ready";
      this.start = null;
      this.candidate = null;
      return { cue: m.cue || "Tracking unclear", phase: "Not tracking" };
    }
    if (this.exercise === "plank") {
      const stable =
        m.line > 160 && m.horizontal < 0.4 && m.value > 55 && m.value < 125;
      if (stable) this.hold += dt;
      this.phase = stable ? "hold" : "ready";
      return {
        cue: stable
          ? "Hold steady and breathe"
          : m.horizontal >= 0.4
            ? "Set up in a horizontal forearm plank"
            : m.line <= 160
              ? "Check your shoulder–hip–ankle line"
              : "Set your forearms under your shoulders",
        phase: stable ? "Holding" : "Adjust position",
      };
    }
    if (this.exercise === "pushup" && m.horizontal > 0.55) {
      this.phase = "ready";
      this.start = null;
      return { cue: "Set up sideways in a push-up position", phase: "Set up" };
    }
    const top = m.value > 155,
      bottom = m.value < (this.exercise === "squat" ? 105 : 100);
    const zone = top ? "top" : bottom ? "bottom" : "middle";
    if (this.candidate !== zone) {
      this.candidate = zone;
      this.since = now;
    }
    const settled = now - this.since >= 140;
    if (this.phase === "ready" && top && settled) this.phase = "top";
    if (this.phase === "top" && !top) {
      this.phase = "lowering";
      this.start = now;
      this.min = m.value;
    }
    if (this.phase === "lowering" || this.phase === "bottom")
      this.min = Math.min(this.min, m.value);
    if (this.phase === "lowering" && bottom && settled) this.phase = "bottom";
    if (this.phase === "lowering" && top && settled) {
      this.phase = "top";
      this.start = null;
    }
    if (this.phase === "bottom" && top && settled) {
      const elapsed = (now - this.start) / 1000;
      if (elapsed >= 0.6 && elapsed < 30) {
        this.reps++;
        this.tempos.push(elapsed);
        this.range.push(this.min);
        this.lastRep = now;
      }
      this.phase = "top";
      this.start = null;
    }
    let cue =
      this.phase === "ready"
        ? "Begin with your arms or legs extended"
        : this.phase === "top"
          ? "Ready for your next repetition"
          : this.phase === "bottom"
            ? "Return with control"
            : "Lower with control";
    if (this.exercise === "pushup" && m.line < 155)
      cue = "Check your shoulder–hip–ankle line";
    return {
      cue,
      phase: {
        ready: "Get ready",
        top: "Extended",
        lowering: "Lowering",
        bottom: "Return",
      }[this.phase],
    };
  }
}
export function validateLog(raw) {
  const ex = findExercise(raw.exercise);
  if (!ex) throw Error("Choose an exercise.");
  const amount = Number(raw.amount),
    load = Number(raw.load),
    effort = Number(raw.effort);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 10000 ||
    (ex.unit === "reps" && !Number.isInteger(amount))
  )
    throw Error("Enter a positive, valid repetition count or duration.");
  if (!Number.isFinite(load) || load < 0 || load > 1000)
    throw Error("Enter a load from 0 to 1000 kg.");
  if (!Number.isFinite(effort) || effort < 1 || effort > 10)
    throw Error("Effort must be between 1 and 10.");
  return {
    ...raw,
    amount,
    load,
    effort,
    notes: String(raw.notes || "").slice(0, 1000),
  };
}
export function nextLoad(
  base,
  logs,
  exercise,
  readiness = "normal",
  increment = 2.5,
) {
  const recent = logs
    .filter((l) => l.exercise === exercise && l.source !== "demo")
    .slice(-3);
  if (!Number.isFinite(base) || !(base > 0))
    return {
      load: 0,
      reason: "Enter a comfortable working weight to create a starting draft.",
    };
  if (readiness === "pain")
    return {
      load: null,
      reason:
        "You reported pain. No load suggestion is generated; review the session with a qualified professional.",
    };
  increment = [1, 2.5, 5].includes(increment) ? increment : 2.5;
  let factor = 1,
    reason =
      "Keep your entered working weight. More consistent logged sets are needed before suggesting a change.";
  if (readiness === "low") {
    factor = 0.9;
    reason =
      "You selected low readiness. This draft reduces the entered load by approximately 10%, rounded to your increment.";
  } else if (recent.some((l) => l.effort >= 9)) {
    factor = 0.95;
    reason =
      "A recent set was rated 9–10 effort. This draft reduces the entered load by approximately 5%, rounded to your increment.";
  } else if (
    increment / base <= 0.1 &&
    recent.length === 3 &&
    recent.every((l) => l.effort <= 7 && l.amount >= 5 && l.load >= base)
  )
    return {
      load: Math.round((base + increment) / increment) * increment,
      reason:
        "Your last three logged sets reached at least 5 reps at this load or higher, with effort at 7 or below. Try one increment only if appropriate.",
    };
  return {
    load:
      factor === 1
        ? base
        : Math.min(
            base,
            Math.max(
              increment,
              Math.round((base * factor) / increment) * increment,
            ),
          ),
    reason,
  };
}
export function estimatedMax(log) {
  return log.load > 0 &&
    log.amount >= 1 &&
    log.amount <= 10 &&
    findExercise(log.exercise)?.unit === "reps"
    ? log.load * (1 + log.amount / 30)
    : null;
}

export function mergeBackup(existing, backup) {
  if (backup?.version !== 1 || !Array.isArray(backup.logs))
    throw Error("This is not a Formlab history backup.");
  const incoming = backup.logs.map((raw) => {
    if (
      typeof raw?.id !== "string" ||
      raw.id.length > 100 ||
      !Number.isFinite(Date.parse(raw.date))
    )
      throw Error("Backup contains an invalid set.");
    const clean = validateLog(raw);
    const list = (value) =>
      Array.isArray(value)
        ? value.filter((v) => Number.isFinite(v) && v >= 0).slice(0, 10000)
        : [];
    const metrics =
      raw.source === "camera" && raw.metrics
        ? {
            repSeconds: list(raw.metrics.repSeconds),
            minAngles: list(raw.metrics.minAngles),
            view: "side",
            assessmentVersion: 1,
          }
        : null;
    return {
      id: raw.id,
      date: new Date(raw.date).toISOString(),
      exercise: clean.exercise,
      amount: clean.amount,
      load: clean.load,
      effort: clean.effort,
      notes: clean.notes,
      source: raw.source === "camera" ? "camera" : "manual",
      metrics,
    };
  });
  const ids = new Set(existing.map((l) => l.id));
  const added = [];
  for (const log of incoming)
    if (!ids.has(log.id)) {
      added.push(log);
      ids.add(log.id);
    }
  return {
    logs: [...existing, ...added].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    ),
    added: added.length,
  };
}
