import test from "node:test";
import assert from "node:assert/strict";
import {
  angle,
  RepCounter,
  measurePose,
  nextLoad,
  validateLog,
  estimatedMax,
} from "../core.mjs";
const m = (value, extra = {}) => ({
  valid: true,
  value,
  line: 175,
  horizontal: 0.1,
  ...extra,
});
function cycle(c, t = 0) {
  [
    [175, 0],
    [175, 200],
    [135, 400],
    [95, 800],
    [95, 1000],
    [130, 1500],
    [175, 2000],
    [175, 2200],
  ].forEach(([v, dt]) => c.update(m(v), t + dt));
}
test("angle preserves right and straight angles and rejects coincident joints", () => {
  assert.equal(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }), 90);
  assert.equal(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }), 180);
  assert.equal(angle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }), null);
});
test("full squat cycles count exactly once and record real cycle duration", () => {
  const c = new RepCounter("squat");
  cycle(c);
  cycle(c, 3000);
  assert.equal(c.reps, 2);
  assert.equal(c.tempos.length, 2);
  assert.equal(c.range[0], 95);
  assert.ok(c.tempos[0] >= 1);
});
test("partial repetitions and threshold noise do not count", () => {
  const c = new RepCounter("squat");
  [
    [175, 0],
    [175, 200],
    [125, 400],
    [175, 700],
    [175, 900],
    [100, 1000],
    [120, 1050],
    [175, 1200],
    [175, 1400],
  ].forEach(([v, t]) => c.update(m(v), t));
  assert.equal(c.reps, 0);
});
test("tracking loss discards partial rep and requires a new top position", () => {
  const c = new RepCounter("squat");
  [
    [175, 0],
    [175, 200],
    [90, 500],
    [90, 700],
  ].forEach(([v, t]) => c.update(m(v), t));
  c.update({ valid: false }, 800);
  c.update(m(175), 1000);
  c.update(m(175), 1200);
  assert.equal(c.reps, 0);
  cycle(c, 2000);
  assert.equal(c.reps, 1);
});
test("standing elbow bending is not counted as a push-up", () => {
  const c = new RepCounter("pushup");
  for (let i = 0; i < 30; i++)
    c.update(m(i % 2 ? 90 : 175, { horizontal: 0.9 }), i * 200);
  assert.equal(c.reps, 0);
});
test("plank only accumulates valid horizontal bent-elbow time and caps gaps", () => {
  const c = new RepCounter("plank");
  c.update(m(90), 0);
  c.update(m(90), 100);
  assert.equal(c.hold, 0.1);
  c.update(m(90, { horizontal: 0.9 }), 200);
  c.update(m(90, { line: 130 }), 300);
  c.update({ valid: false }, 500);
  assert.equal(c.hold, 0.1);
  c.update(m(90), 10000);
  assert.ok(c.hold <= 0.31);
});
test("missing landmarks and low visibility are rejected", () => {
  assert.equal(measurePose(null, "squat").valid, false);
  assert.equal(
    measurePose(
      Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 })),
      "squat",
    ).valid,
    false,
  );
});
test("log validation rejects invalid values and noninteger repetitions", () => {
  assert.throws(() =>
    validateLog({ exercise: "squat", amount: -1, load: 0, effort: 7 }),
  );
  assert.throws(() =>
    validateLog({ exercise: "squat", amount: 2.5, load: 0, effort: 7 }),
  );
  assert.throws(() =>
    validateLog({ exercise: "bench", amount: 5, load: NaN, effort: 7 }),
  );
  assert.throws(() =>
    validateLog({ exercise: "bench", amount: 5, load: 20, effort: 11 }),
  );
  assert.equal(
    validateLog({ exercise: "plank", amount: 20, load: 0, effort: 6 }).amount,
    20,
  );
});
test("planner abstains with pain and no baseline, explains cautious changes", () => {
  assert.equal(nextLoad(0, [], "bench").load, 0);
  assert.equal(nextLoad(50, [], "bench", "pain").load, null);
  assert.equal(nextLoad(50, [], "bench").load, 50);
  assert.equal(nextLoad(50, [], "bench", "low").load, 45);
  assert.equal(
    nextLoad(
      100,
      [{ exercise: "bench", effort: 9, amount: 5, load: 100 }],
      "bench",
    ).load,
    95,
  );
});
test("planner needs three relevant easy sets at the baseline to increase", () => {
  const logs = Array.from({ length: 3 }, () => ({
    exercise: "bench",
    effort: 7,
    amount: 5,
    load: 50,
  }));
  assert.equal(nextLoad(50, logs, "bench").load, 52.5);
  assert.equal(nextLoad(50, logs.slice(0, 2), "bench").load, 50);
  assert.equal(
    nextLoad(
      50,
      logs.map((l) => ({ ...l, load: 20 })),
      "bench",
    ).load,
    50,
  );
  assert.equal(
    nextLoad(
      50,
      logs.map((l) => ({ ...l, source: "demo" })),
      "bench",
    ).load,
    50,
  );
});
test("estimated max is limited to loaded repetitions up to ten", () => {
  assert.equal(estimatedMax({ exercise: "bench", amount: 5, load: 60 }), 70);
  assert.equal(estimatedMax({ exercise: "plank", amount: 5, load: 60 }), null);
  assert.equal(estimatedMax({ exercise: "bench", amount: 11, load: 60 }), null);
});
import { mergeBackup } from "../core.mjs";
test("backup merge preserves measurements and deduplicates identifiers", () => {
  const entry = {
    id: "test",
    date: "2026-10-04T00:00:00Z",
    exercise: "squat",
    amount: 5,
    load: 0,
    effort: 7,
    source: "camera",
    metrics: { repSeconds: [2, 3], minAngles: [90, 100] },
  };
  const result = mergeBackup([], { version: 1, logs: [entry, entry] });
  assert.equal(result.added, 1);
  assert.deepEqual(result.logs[0].metrics.repSeconds, [2, 3]);
  assert.equal(
    mergeBackup(result.logs, { version: 1, logs: [entry] }).added,
    0,
  );
  assert.throws(() =>
    mergeBackup([], { version: 1, logs: [{ ...entry, amount: -5 }] }),
  );
});
test("planner never rounds a maintenance or reduced low baseline upward", () => {
  assert.equal(nextLoad(1, [], "bench").load, 1);
  assert.equal(nextLoad(1, [], "bench", "low").load, 1);
});
