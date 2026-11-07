import {
  EXERCISES,
  findExercise,
  measurePose,
  RepCounter,
  validateLog,
  nextLoad,
  estimatedMax,
  mergeBackup,
} from "./core.mjs";
const $ = (s) => document.querySelector(s);
const escapeHTML = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let storageError = false;
function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    storageError = true;
    return fallback;
  }
}
let profile = read("formlab.profile", {}),
  logs = read("formlab.logs", []),
  program = read("formlab.program", {
    squat: 0,
    bench: 0,
    deadlift: 0,
    days: "3",
    readiness: "normal",
    increment: 2.5,
  });
if (!Array.isArray(logs)) logs = [];
logs = logs.filter((l) => {
  try {
    validateLog(l);
    return typeof l.id === "string" && Number.isFinite(Date.parse(l.date));
  } catch {
    return false;
  }
});
if (!profile || typeof profile !== "object" || Array.isArray(profile))
  profile = {};
if (!program || typeof program !== "object" || Array.isArray(program))
  program = {};
let trash = read("formlab.trash", []);
if (!Array.isArray(trash)) trash = [];
let page = "home",
  category = "All",
  selected = "squat",
  progressExercise = "back-squat",
  pendingLog = null;
let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4000);
}
function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    toast(
      "Could not save. Browser storage may be full or disabled. Export your history.",
    );
    return false;
  }
}
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA");
const thisWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
function heading(title, subtitle, extra = "") {
  return `<div class="page-heading"><div><p class="eyebrow">YOUR PACE. YOUR PROGRESS.</p><h1>${title}</h1><p class="muted">${subtitle}</p></div>${extra}</div>`;
}
function art(kind = "squat", hero = false) {
  const shapes =
    kind === "pushup" || kind === "plank"
      ? '<circle cx="104" cy="53" r="11"/><path d="M111 68L163 88L229 97M127 74L114 108L143 115M163 88L196 116L247 116"/>'
      : kind === "deadlift" || kind === "back-squat"
        ? '<circle cx="176" cy="30" r="11"/><path d="M174 46L151 87L172 110L163 134M151 87L126 107L124 135M164 58L140 88L157 96"/><path d="M103 98H215M106 88V109M213 88V109"/>'
        : '<circle cx="171" cy="30" r="11"/><path d="M166 46L145 79L174 101L157 134M145 79L120 103L122 134M163 55L190 68L221 66M158 57L182 77L210 75"/>';
  return `<svg viewBox="0 0 340 155" fill="none" aria-hidden="true"><defs><pattern id="grid-${kind}-${hero}" width="23" height="23" patternUnits="userSpaceOnUse"><path d="M23 0H0V23" stroke="${hero ? "#51745b" : "#91a27b"}" opacity=".14"/></pattern></defs><rect width="340" height="155" fill="url(#grid-${kind}-${hero})"/><ellipse cx="170" cy="140" rx="87" ry="6" fill="${hero ? "#08291b" : "#c5cfb8"}" opacity=".35"/><g stroke="${hero ? "#a1c477" : "#99ac83"}" stroke-width="19" stroke-linecap="round" stroke-linejoin="round" transform="translate(-16 0)" opacity=".24">${shapes}</g><g stroke="${hero ? "#d9f7a4" : "#3e654a"}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${shapes}</g><g fill="${hero ? "#edffca" : "#fffef8"}" stroke="${hero ? "#97bc65" : "#567648"}" stroke-width="2"><circle cx="145" cy="79" r="4"/><circle cx="174" cy="101" r="4"/></g></svg>`;
}
function exerciseCard(ex, index = 0) {
  return `<article class="exercise-card"><div class="exercise-art ${["", "peach", "blue"][index % 3]}">${art(ex.id)}<span class="badge">${ex.category.toUpperCase()}</span></div><div class="card-body"><span class="eyebrow">${ex.tracking ? "CAMERA COACH" : "WORKOUT LOG"}</span><h3>${ex.name}</h3><p>${ex.desc}</p><div class="card-footer"><span>${ex.tracking ? ex.view : "Manual tracking"}</span><button class="arrow-button" data-exercise="${ex.id}" aria-label="Open ${ex.name}">↗</button></div></div></article>`;
}
function stats() {
  const weekLogs = logs.filter((l) => new Date(l.date) >= thisWeek());
  const sessions = new Set(weekLogs.map((l) => dayKey(l.date))).size;
  const reps = logs
    .filter((l) => findExercise(l.exercise)?.unit === "reps")
    .reduce((n, l) => n + l.amount, 0);
  const volume = logs
    .filter((l) => findExercise(l.exercise)?.unit === "reps")
    .reduce((n, l) => n + l.load * l.amount, 0);
  return `<div class="stats">${[
    ["Training days", sessions, "this week", "◷"],
    ["Sets logged", logs.length, "every effort counts", "≋"],
    ["Total repetitions", reps, "across your training", "↗"],
    [
      "Volume lifted",
      Math.round(volume).toLocaleString(),
      "kg × repetitions",
      "▥",
    ],
  ]
    .map(
      ([label, value, foot, icon]) =>
        `<div class="stat"><div class="stat-label">${label}<span>${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`,
    )
    .join("")}</div>`;
}
function renderHome() {
  const name = profile.name ? `, ${escapeHTML(profile.name)}` : "";
  const week = thisWeek();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week);
    d.setDate(d.getDate() + i);
    const done = logs.some((l) => dayKey(l.date) === dayKey(d));
    return `<div class="day ${done ? "done" : ""}">${d.toLocaleDateString("en", { weekday: "short" }).toUpperCase()}<span>${done ? "✓" : d.getDate()}</span></div>`;
  }).join("");
  return `${heading(`A little stronger, every day${name}.`, "Move with intention. Build strength that stays.", `<span class="date-tag">${new Date().toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}</span>`)}<section class="hero"><div class="hero-copy"><p class="eyebrow">MEET YOUR MOVEMENT STUDIO</p><h2>Find your form.<br>Feel the difference.</h2><p>See your movement, practise with a shadow, and make every repetition more intentional.</p><a class="button lime" href="#coach">Start moving <span>↗</span></a></div><div class="hero-art">${art("squat", true)}</div><span class="hero-label">OBSERVE → PRACTISE → PROGRESS</span></section>${stats()}<div class="section-heading"><h2>Make room for movement</h2><a class="text-link" href="#library">Explore the library ↗</a></div><div class="card-grid">${EXERCISES.slice(0, 3).map(exerciseCard).join("")}</div><div class="bottom-grid"><section class="panel"><h3>Your week, one session at a time</h3><p class="muted">A training day appears when you save your first set.</p><div class="week">${days}</div></section><section class="panel note-panel"><p class="eyebrow">BUILD YOUR BASE</p><h3>Strength starts with a starting point.</h3><p>Bring your working weights and session feedback. Build a powerlifting draft you can understand.</p><a href="#strength" class="text-link">Open powerlifting ↗</a></section></div>`;
}
function renderLibrary() {
  return `${heading("A movement for every chapter.", "Gym, calisthenics and mobility. Start with what feels achievable.")}<div class="filters">${["All", "Gym", "Calisthenics", "Powerlifting", "Mobility"].map((c) => `<button class="chip ${c === category ? "active" : ""}" data-category="${c}">${c}</button>`).join("")}</div><div class="card-grid">${EXERCISES.filter(
    (e) => category === "All" || e.category === category,
  )
    .map(exerciseCard)
    .join(
      "",
    )}</div><p class="notice" style="margin-top:22px">Camera checks are available for bodyweight squats, push-ups and forearm planks. All other movements support manual logging. Each camera check is a limited estimate, not a complete technique assessment.</p>`;
}
function renderCoach() {
  const ex = findExercise(selected);
  return `${heading("Your movement studio.", "A little awareness can change the way you move.")}<div class="studio-grid"><section><div class="stage"><video id="camera" autoplay playsinline muted></video><canvas id="overlay"></canvas><div class="stage-top"><span class="stage-tag" id="live-status">CAMERA OFF</span><span class="stage-tag">${ex.view}</span></div><div class="stage-placeholder" id="stage-placeholder">${art(ex.id, true)}<strong>Your space to practise</strong><p>Start your camera or explore a clearly labelled demonstration.</p></div></div><div class="studio-controls"><button class="button primary" id="start-camera">◎ Start camera</button><button class="button secondary" id="demo">▷ Try demo</button><button class="button secondary" id="stop" disabled>Stop</button><button class="button secondary" id="reset-set">Reset set</button></div><div class="studio-settings"><label>Movement<select id="coach-exercise">${EXERCISES.filter(
    (e) => e.tracking,
  )
    .map(
      (e) =>
        `<option value="${e.id}" ${e.id === selected ? "selected" : ""}>${e.name}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Shadow mode<select id="shadow-mode"><option value="follow">Follow · guided tempo</option><option value="compare">Compare · follow my phase</option><option value="off">Hide reference</option></select></label></div><div class="legend"><span><i style="background:#8dcccf"></i>Your tracked movement</span><span><i style="background:#b8ce82"></i>Illustrative reference</span></div><label class="toggle"><input type="checkbox" id="voice">Speak occasional movement cues</label><p class="small-note">The shadow is a schematic practice guide, not a coach-validated ideal pose. Compare mode scales a separate guide to your visible body; it does not grade how closely you match it.</p><div class="notice"><b>Camera setup</b><br>${ex.setup}</div></section><aside class="studio-aside"><div class="panel"><p class="eyebrow">THIS SET</p><h3>${ex.name}</h3><div id="demo-notice" class="demo-warning" hidden>DEMO · Simulated movement. Demonstration sets cannot be saved to your progress.</div><div class="metric-row"><div class="metric"><span>${ex.unit === "sec" ? "Hold time" : "Repetitions"}</span><strong id="rep-value">0${ex.unit === "sec" ? "s" : ""}</strong></div><div class="metric"><span>Set time</span><strong id="elapsed">0:00</strong></div></div><div class="metric-row"><div class="metric"><span>${selected === "squat" ? "Knee angle" : "Elbow angle"}</span><strong id="angle">—</strong></div><div class="metric"><span>Phase</span><strong id="phase" style="font-size:14px">Ready</strong></div></div><div class="cue-box" aria-live="polite"><span class="eyebrow">MOVEMENT CUE</span><br><strong id="cue">Set up your camera</strong><p id="tracking-note">Tracking has not started.</p></div><button class="button primary full" id="save-camera" style="margin-top:20px" disabled>Finish & save set</button></div><div class="panel" style="margin-top:16px"><p class="eyebrow">WHAT THIS CHECKS</p><p class="small-note">${ex.checks}</p><p class="small-note">Use an unobstructed side view. Stop if a movement hurts. No video is recorded or uploaded.</p></div></aside></div>`;
}
function renderStrength() {
  return `${heading("Build strength with a plan.", "Squat. Bench. Deadlift. A transparent starting draft, shaped by your logs.")}<div class="strength-grid"><form id="program-form" class="panel"><p class="eyebrow">YOUR WORKING BASELINE</p><h3>Set your starting point</h3><p class="muted">Enter comfortable working weights for sets of 5, not one-rep maximums. Bodyweight alone is not used to prescribe a load.</p>${[
    ["squat", "Barbell squat"],
    ["bench", "Bench press"],
    ["deadlift", "Deadlift"],
  ]
    .map(
      ([key, label]) =>
        `<label>${label} · kg<input name="${key}" type="number" min="0" max="1000" step="0.25" value="${Number(program[key]) || 0}" required></label>`,
    )
    .join(
      "",
    )}<div class="form-grid"><label>Days per week<select name="days">${[2, 3].map((n) => `<option ${Number(program.days) === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Load increment<select name="increment">${[1, 2.5, 5].map((n) => `<option value="${n}" ${Number(program.increment) === n ? "selected" : ""}>${n} kg</option>`).join("")}</select></label></div><label>Today's readiness<select name="readiness"><option value="normal" ${program.readiness === "normal" ? "selected" : ""}>Normal — ready to train</option><option value="low" ${program.readiness === "low" ? "selected" : ""}>Low — tired or under-recovered</option><option value="pain" ${program.readiness === "pain" ? "selected" : ""}>Pain — pause load suggestions</option></select></label><button class="button primary full">Update my draft</button></form><section><div class="notice" style="margin-bottom:20px">This is a conservative, rule-based planning preview. It uses your entered loads and recent reported effort; it does not infer your physiology or replace individual coaching. Review the draft before using it.</div><div id="program-results">${programResults()}</div></section></div>`;
}
function programResults() {
  const days = Number(program.days) || 3;
  const sets = profile.experience === "experienced" ? 3 : 2;
  const cards = [
    ["squat", "back-squat", "Barbell squat"],
    ["bench", "bench", "Bench press"],
    ["deadlift", "deadlift", "Deadlift"],
  ]
    .map(([key, id, name]) => {
      const suggestion = nextLoad(
        Number(program[key]) || 0,
        logs,
        id,
        program.readiness,
        Number(program.increment) || 2.5,
      );
      return `<article class="program-card"><div class="program-top"><h3>${name}</h3><span class="program-weight">${suggestion.load === null ? "Paused" : suggestion.load ? `${suggestion.load}<small class="muted"> kg</small>` : "—"}</span></div><div class="program-meta"><span>${id === "deadlift" ? 2 : sets} sets × 5 reps</span><span>Leave repetitions in reserve</span></div><p>${suggestion.reason}</p><button class="button secondary small" data-log="${id}" data-load="${suggestion.load || 0}">Log working set ＋</button></article>`;
    })
    .join("");
  return `<div class="section-heading" style="margin-top:0"><h2>Your training draft</h2><span class="badge">${days} DAYS / WEEK</span></div>${cards}<div class="panel"><h3>A simple weekly rhythm</h3><p class="muted">${days === 2 ? "Day A: squat + bench. Day B: deadlift + bench." : "Day A: squat + bench. Day B: deadlift + bench. Day C: squat + bench."} Space sessions with recovery days. The numbers above apply to each listed lift session.</p><p class="small-note">${profile.experience === "experienced" ? "Experienced profile: three working sets for squat and bench." : "Starting/regular profile: two working sets per lift."} Warm-ups are not included. With limited history, the app keeps your entered baseline rather than claiming to have learned your response.</p><a class="text-link" href="https://acsm.org/resistance-training-guidelines-update-2026/" target="_blank" rel="noopener noreferrer">Read ACSM’s general resistance-training guidance ↗</a><p class="small-note">The app’s effort thresholds and percentage adjustments are prototype rules, not an ACSM-validated powerlifting program.</p></div>`;
}
function chartMarkup() {
  const data = logs.filter((l) => l.exercise === progressExercise).slice(-16);
  if (!data.length)
    return '<div class="empty"><strong>Your trend starts here.</strong>Log a set of this exercise to see your progress.</div>';
  const ex = findExercise(progressExercise);
  const values = data.map((l) => estimatedMax(l) ?? l.amount);
  const usesMax = data.every((l) => estimatedMax(l) !== null);
  const plotted = usesMax ? values : data.map((l) => l.amount);
  const max = Math.max(...plotted) * 1.15 || 1,
    min = 0,
    w = 700,
    h = 175;
  const coords = plotted.map((v, i) => [
    50 + (i * (w - 80)) / Math.max(1, plotted.length - 1),
    h - 20 - (v / max) * (h - 40),
  ]);
  return `<svg viewBox="0 0 700 205" role="img" aria-label="${escapeHTML(ex.name)} trend: ${plotted.map((v) => Math.round(v)).join(", ")} ${usesMax ? "estimated maximum kg" : ex.unit}">${[0, 0.5, 1].map((n) => `<line x1="45" y1="${h - 20 - n * (h - 40)}" x2="690" y2="${h - 20 - n * (h - 40)}" stroke="#e5e9dd"/><text x="3" y="${h - 16 - n * (h - 40)}" font-size="10" fill="#8b977d">${Math.round(n * max)}</text>`).join("")}<polyline points="${coords.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#476843" stroke-width="3"/>${coords.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="5" fill="#b8d87c" stroke="#3b603e"><title>${new Date(data[i].date).toLocaleDateString()}: ${plotted[i].toFixed(1)}</title></circle>`).join("")}<text x="50" y="190" font-size="10" fill="#8b977d">${new Date(data[0].date).toLocaleDateString()}</text><text x="690" y="190" text-anchor="end" font-size="10" fill="#8b977d">${usesMax ? "Estimated 1RM · kg (Epley, sets of 1–10)" : "Logged " + ex.unit + " per set"}</text></svg>`;
}
function movementSummary() {
  const tracked = logs.filter(
    (l) => l.exercise === progressExercise && l.source === "camera",
  );
  const tempos = tracked
    .flatMap((l) => l.metrics?.repSeconds || [])
    .filter(Number.isFinite);
  const ranges = tracked
    .flatMap((l) => l.metrics?.minAngles || [])
    .filter(Number.isFinite);
  if (!tracked.length) return "";
  return `<div class="metric-row"><div class="metric"><span>Camera sets</span><strong>${tracked.length}</strong></div><div class="metric"><span>${progressExercise === "plank" ? "Tracked hold total" : "Average rep duration"}</span><strong>${progressExercise === "plank" ? tracked.reduce((n, l) => n + l.amount, 0) + "s" : tempos.length ? (tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(1) + "s" : "—"}</strong></div></div><p class="small-note">${ranges.length ? "Average lowest observed joint angle: " + Math.round(ranges.reduce((a, b) => a + b, 0) / ranges.length) + "°. " : ""}Compare only the same variation and camera view. A lower angle is not automatically better technique.</p>`;
}
function historyMarkup() {
  if (!logs.length)
    return '<div class="empty"><strong>Nothing logged. Plenty ahead.</strong>Your saved sets will appear here.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>DATE</th><th>MOVEMENT</th><th>SET</th><th>LOAD</th><th>EFFORT</th><th>SOURCE</th><th>NOTES</th><th></th></tr></thead><tbody>${[
    ...logs,
  ]
    .reverse()
    .map(
      (l) =>
        `<tr><td>${new Date(l.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td><td>${findExercise(l.exercise).name}</td><td>${l.amount} ${findExercise(l.exercise).unit}</td><td>${l.load} kg</td><td>${l.effort}/10</td><td><span class="badge">${l.source === "camera" ? "CAMERA" : "MANUAL"}</span></td><td style="max-width:230px;white-space:normal">${escapeHTML(l.notes) || "—"}</td><td><button class="icon-button" data-delete="${escapeHTML(l.id)}" aria-label="Delete ${findExercise(l.exercise).name} set">×</button></td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}
function renderProgress() {
  return `${heading("See how far you’ve come.", "Your consistency, strength and practice in one place.", `<div class="history-actions"><button class="button secondary" id="import">↑ Import</button><button class="button secondary" id="export">↓ Export history</button><input type="file" id="import-file" accept="application/json,.json" hidden></div>`)}${stats()}<section class="panel"><div class="progress-toolbar"><div><h3>Your training trend</h3><p class="muted" style="margin:0">Last 16 sets · strength estimates are not tested maximums</p></div><label class="sr-only" for="progress-exercise">Exercise trend</label><select id="progress-exercise">${EXERCISES.map((e) => `<option value="${e.id}" ${e.id === progressExercise ? "selected" : ""}>${e.name}</option>`).join("")}</select></div><div class="chart">${chartMarkup()}</div>${movementSummary()}</section><div class="section-heading"><h2>Every set is part of the story</h2>${trash.length ? '<button class="button secondary small" id="restore">↶ Restore last deleted set</button>' : ""}<button class="button secondary small" id="progress-log">＋ Log a set</button></div><section class="panel" style="padding:10px 18px">${historyMarkup()}</section><p class="small-note">History is saved in this browser on this address. Clearing browser data removes it. Export a JSON backup before switching devices or browsers.</p>`;
}
function updateProfile() {
  const label = profile.name || "Your profile";
  $("#sidebar-name").textContent = label;
  $(".avatar").textContent = label[0].toUpperCase();
}
function render() {
  page = location.hash.slice(1) || "home";
  if (!["home", "coach", "library", "strength", "progress"].includes(page))
    page = "home";
  stopCamera();
  $("#main").innerHTML = {
    home: renderHome,
    coach: renderCoach,
    library: renderLibrary,
    strength: renderStrength,
    progress: renderProgress,
  }[page]();
  document.querySelectorAll("nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === page);
    if (a.dataset.page === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#breadcrumb").textContent =
    "Your training / " +
    {
      home: "Overview",
      coach: "Movement studio",
      library: "Exercise library",
      strength: "Powerlifting",
      progress: "Your progress",
    }[page];
  bindPage();
  updateProfile();
}
function openLog(id = "squat", load = 0, cameraData = null) {
  pendingLog = cameraData;
  const form = $("#log-form");
  form.reset();
  $("#log-exercise").innerHTML = EXERCISES.map(
    (e) => `<option value="${e.id}">${e.name}</option>`,
  ).join("");
  form.elements.exercise.value = id;
  form.elements.exercise.disabled = !!cameraData;
  form.elements.load.value = load;
  form.elements.amount.value = cameraData?.amount || findExercise(id).target;
  $("#amount-label").textContent =
    findExercise(id).unit === "sec" ? "Duration · seconds" : "Repetitions";
  $("#log-origin").textContent = cameraData
    ? "Camera set. You can correct the count before saving."
    : "Manual entry · one set";
  $("#log-error").textContent = "";
  $("#log-dialog").showModal();
}
$("#log-exercise").addEventListener("change", (e) => {
  $("#amount-label").textContent =
    findExercise(e.target.value).unit === "sec"
      ? "Duration · seconds"
      : "Repetitions";
  $("#log-form").elements.amount.value = findExercise(e.target.value).target;
});
$("#log-form").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    const f = e.target;
    const log = validateLog({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      exercise: f.elements.exercise.value,
      amount: f.elements.amount.value,
      load: f.elements.load.value,
      effort: f.elements.effort.value,
      notes: f.elements.notes.value,
      source: pendingLog ? "camera" : "manual",
      metrics: pendingLog?.metrics || null,
    });
    const next = [...logs, log];
    if (!persist("formlab.logs", next)) return;
    logs = next;
    $("#log-dialog").close();
    if (pendingLog) {
      resetCounter();
      pendingLog = null;
    }
    toast("Set saved. Another step forward.");
    if (page !== "coach") render();
  } catch (error) {
    $("#log-error").textContent = error.message;
  }
});
$("#quick-log").onclick = () => openLog();
$("#edit-profile").onclick = () => {
  const f = $("#profile-form");
  f.elements.name.value = profile.name || "";
  f.elements.bodyweight.value = profile.bodyweight || "";
  f.elements.experience.value = profile.experience || "new";
  f.elements.goal.value = profile.goal || "Move better";
  $("#profile-dialog").showModal();
};
$("#top-profile").onclick = () => $("#edit-profile").click();
$("#profile-form").onsubmit = (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  if (!persist("formlab.profile", data)) return;
  profile = data;
  $("#profile-dialog").close();
  render();
  toast("Profile saved.");
};
document
  .querySelectorAll(".close-dialog")
  .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
function bindPage() {
  document.querySelectorAll("[data-exercise]").forEach(
    (b) =>
      (b.onclick = () => {
        const ex = findExercise(b.dataset.exercise);
        if (ex.tracking) {
          selected = ex.id;
          location.hash = "coach";
        } else openLog(ex.id);
      }),
  );
  document.querySelectorAll("[data-category]").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.category;
        render();
      }),
  );
  document
    .querySelectorAll("[data-log]")
    .forEach(
      (b) => (b.onclick = () => openLog(b.dataset.log, Number(b.dataset.load))),
    );
  if (page === "coach") {
    resetCounter();
    $("#start-camera").onclick = startCamera;
    $("#demo").onclick = startDemo;
    $("#stop").onclick = () => stopCamera();
    $("#reset-set").onclick = resetCounter;
    $("#coach-exercise").onchange = (e) => {
      selected = e.target.value;
      render();
    };
    $("#save-camera").onclick = () => {
      const amount =
        selected === "plank" ? Math.floor(counter.hold) : counter.reps;
      stopCamera();
      if (amount > 0)
        openLog(selected, 0, {
          amount,
          metrics: {
            minAngles: [...counter.range],
            repSeconds: [...counter.tempos],
            view: "side",
            assessmentVersion: 1,
          },
        });
    };
  }
  if (page === "strength")
    $("#program-form").onsubmit = (e) => {
      e.preventDefault();
      const next = Object.fromEntries(new FormData(e.target));
      if (!persist("formlab.program", next)) return;
      program = next;
      render();
      toast("Training draft updated.");
    };
  if (page === "progress") {
    if ($("#restore"))
      $("#restore").onclick = () => {
        const item = trash[trash.length - 1];
        try {
          validateLog(item);
        } catch {
          toast("Deleted set could not be restored.");
          return;
        }
        const next = logs.some((l) => l.id === item.id)
          ? logs
          : [...logs, item].sort((a, b) => new Date(a.date) - new Date(b.date));
        if (!persist("formlab.logs", next)) return;
        logs = next;
        trash = trash.slice(0, -1);
        persist("formlab.trash", trash);
        render();
        toast("Set restored.");
      };
    $("#import").onclick = () => $("#import-file").click();
    $("#import-file").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        if (file.size > 5000000)
          throw Error("Choose a backup smaller than 5 MB.");
        const backup = JSON.parse(await file.text());
        const merged = mergeBackup(logs, backup);
        if (!persist("formlab.logs", merged.logs)) return;
        logs = merged.logs;
        render();
        toast(merged.added + " sets imported. Existing sets kept.");
      } catch (error) {
        toast(error.message);
      }
    };
    $("#progress-exercise").onchange = (e) => {
      progressExercise = e.target.value;
      render();
    };
    $("#progress-log").onclick = () => openLog(progressExercise);
    $("#export").onclick = () => {
      const backup = JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          profile,
          program,
          logs,
        },
        null,
        2,
      );
      $("#backup-text").value = backup;
      const a = $("#download-backup");
      if (a.href.startsWith("blob:")) URL.revokeObjectURL(a.href);
      a.href = URL.createObjectURL(
        new Blob([backup], { type: "application/json" }),
      );
      a.download = "formlab-history-" + dayKey(new Date()) + ".json";
      $("#export-dialog").showModal();
    };
    document.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = () => {
          const item = logs.find((l) => l.id === b.dataset.delete);
          const next = logs.filter((l) => l.id !== b.dataset.delete);
          if (!persist("formlab.trash", [...trash, item])) return;
          if (!persist("formlab.logs", next)) return;
          trash.push(item);
          logs = next;
          render();
          toast("Set removed. Restore it from your progress page.");
        }),
    );
  }
}
// Local camera inference and movement guide.
let detector = null,
  stream = null,
  raf = 0,
  mode = "off",
  counter = new RepCounter("squat"),
  setStart = 0,
  lastVideo = -1,
  lastInference = 0,
  generation = 0,
  lastSpeech = 0,
  lastCue = "",
  lastMeasure = null;
function resetCounter() {
  counter = new RepCounter(selected);
  setStart = performance.now();
  lastMeasure = null;
  if ($("#rep-value")) {
    $("#rep-value").textContent = selected === "plank" ? "0s" : "0";
    $("#elapsed").textContent = "0:00";
    $("#angle").textContent = "—";
    $("#phase").textContent = "Ready";
    $("#save-camera").disabled = true;
  }
}
function stopCamera() {
  generation++;
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  mode = "off";
  speechSynthesis.cancel();
  if ($("#camera")) $("#camera").srcObject = null;
  if ($("#live-status")) $("#live-status").textContent = "CAMERA OFF";
  if ($("#start-camera")) {
    $("#start-camera").disabled = false;
    $("#start-camera").textContent = "◎ Start camera";
    $("#demo").disabled = false;
    $("#stop").disabled = true;
  }
  if ($("#stage-placeholder")) $("#stage-placeholder").hidden = false;
  if ($("#overlay")) {
    const c = $("#overlay");
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
  }
  if ($("#save-camera")) $("#save-camera").disabled = true;
}
async function startCamera() {
  stopCamera();
  resetCounter();
  const token = generation;
  $("#start-camera").disabled = true;
  $("#demo").disabled = true;
  $("#stop").disabled = false;
  $("#start-camera").textContent = "Loading tracker…";
  $("#cue").textContent = "Preparing on-device tracking";
  try {
    if (!detector) {
      const { FilesetResolver, PoseLandmarker } = await import(
        "./vendor/vision_bundle.mjs"
      );
      const files = await FilesetResolver.forVisionTasks("./vendor/wasm");
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: "./vendor/pose_landmarker_lite.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
    }
    if (token !== generation) return;
    const capture = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 960 },
        height: { ideal: 540 },
        facingMode: "user",
      },
      audio: false,
    });
    if (token !== generation) {
      capture.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = capture;
    const v = $("#camera");
    v.srcObject = stream;
    await v.play();
    if (token !== generation) return;
    mode = "camera";
    setStart = performance.now();
    lastVideo = -1;
    lastInference = 0;
    frame.points = null;
    $("#stage-placeholder").hidden = true;
    $("#live-status").textContent = "● LIVE · LOCAL CAMERA";
    $("#demo-notice").hidden = true;
    $("#start-camera").textContent = "Camera running";
    raf = requestAnimationFrame(frame);
  } catch (err) {
    if (token !== generation) return;
    stopCamera();
    $("#cue").textContent = "Camera could not start";
    $("#tracking-note").textContent =
      err.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser, then try again."
        : err.name === "NotFoundError"
          ? "No camera found. Connect a camera or try the demo."
          : "Check camera availability and reload. " + err.message;
    toast("Camera unavailable. You can still try the demo or log sets.");
  }
}
function startDemo() {
  stopCamera();
  resetCounter();
  mode = "demo";
  $("#stage-placeholder").hidden = true;
  $("#demo-notice").hidden = false;
  $("#live-status").textContent = "DEMO · SIMULATED MOVEMENT";
  $("#start-camera").disabled = false;
  $("#demo").disabled = true;
  $("#stop").disabled = false;
  raf = requestAnimationFrame(frame);
}
const links = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];
function guidePose(ex, progress) {
  const p = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));
  let s, e, w, h, k, a, n;
  if (ex === "squat") {
    const b = progress;
    s = { x: 0.5 + b * 0.08, y: 0.26 + b * 0.17 };
    h = { x: 0.49 - b * 0.09, y: 0.51 + b * 0.16 };
    k = { x: 0.51 + b * 0.09, y: 0.7 };
    a = { x: 0.49, y: 0.9 };
    e = { x: s.x + 0.1, y: s.y + 0.09 };
    w = { x: s.x + 0.22, y: s.y + 0.06 };
    n = { x: s.x + 0.01, y: s.y - 0.09 };
  } else {
    const b = ex === "plank" ? 0.7 : progress;
    s = { x: 0.3, y: 0.44 + b * 0.16 };
    h = { x: 0.53, y: 0.52 + b * 0.075 };
    a = { x: 0.84, y: 0.66 };
    e = { x: 0.34 - b * 0.06, y: 0.58 + b * 0.05 };
    w = { x: 0.31, y: 0.75 };
    k = { x: 0.69, y: 0.6 };
    n = { x: s.x - 0.075, y: s.y - 0.03 };
  }
  p[0] = n;
  [
    [11, s],
    [13, e],
    [15, w],
    [23, h],
    [25, k],
    [27, a],
  ].forEach(([i, v]) => {
    p[i] = { ...v, visibility: 1 };
    p[i + 1] = { ...v, x: v.x - 0.025, visibility: 0.95 };
  });
  return p;
}
function drawBody(ctx, p, color, width, height, alpha = 1, thickness = 5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  for (const [a, b] of links) {
    if ((p[a]?.visibility ?? 0) < 0.5 || (p[b]?.visibility ?? 0) < 0.5)
      continue;
    ctx.beginPath();
    ctx.moveTo(p[a].x * width, p[a].y * height);
    ctx.lineTo(p[b].x * width, p[b].y * height);
    ctx.stroke();
  }
  for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if ((p[i]?.visibility ?? 0) < 0.5) continue;
    ctx.beginPath();
    ctx.arc(p[i].x * width, p[i].y * height, thickness * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p[0]) {
    ctx.beginPath();
    ctx.arc(p[0].x * width, p[0].y * height, height * 0.026, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
function fitGuide(guide, actual) {
  const ids = lastMeasure?.ids || [11, 13, 15, 23, 25, 27];
  const anchor = actual[ids[3]],
    g = guide[23];
  const span = Math.hypot(
    actual[ids[0]].x - anchor.x,
    actual[ids[0]].y - anchor.y,
  );
  const gspan = Math.hypot(guide[11].x - g.x, guide[11].y - g.y);
  const scale = Math.max(0.45, Math.min(1.6, span / gspan));
  const sign =
    (actual[ids[0]].x - actual[ids[5]].x) * (guide[11].x - guide[27].x) < 0
      ? -1
      : 1;
  return guide.map((v) => ({
    ...v,
    x: anchor.x + (v.x - g.x) * scale * sign,
    y: anchor.y + (v.y - g.y) * scale,
  }));
}
function frame(now) {
  if (mode === "off" || !$("#overlay")) return;
  const c = $("#overlay"),
    ctx = c.getContext("2d"),
    video = $("#camera");
  const w = mode === "camera" ? video.videoWidth || 960 : 960,
    h = mode === "camera" ? video.videoHeight || 540 : 600;
  c.width = w;
  c.height = h; // Keep the canvas and contained video on the same image rectangle.
  c.style.objectFit = "contain";
  let points = null,
    m = null,
    fresh = false;
  const t = (now - setStart) / 1000,
    cycle = (1 - Math.cos((t * Math.PI) / 2)) / 2;
  try {
    if (mode === "camera" && video.readyState >= 2) {
      if (video.currentTime !== lastVideo && now - lastInference >= 65) {
        lastVideo = video.currentTime;
        lastInference = now;
        const result = detector.detectForVideo(video, now);
        frame.points = result.landmarks?.[0] || null;
        fresh = true;
      }
      points = frame.points;
      m = measurePose(points, selected, w, h);
    } else if (mode === "demo") {
      fresh = true;
      points = guidePose(selected, cycle);
      m = {
        valid: true,
        value: selected === "plank" ? 90 : 175 - cycle * 90,
        line: 175,
        horizontal: 0.15,
        confidence: 1,
      };
    }
  } catch (error) {
    stopCamera();
    $("#cue").textContent = "Tracking stopped";
    $("#tracking-note").textContent =
      "The tracker encountered an error. Restart the camera to try again.";
    return;
  }
  ctx.clearRect(0, 0, w, h);
  if (mode === "demo") {
    ctx.strokeStyle = "#6d8b5325";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }
  const shadow = $("#shadow-mode").value;
  const compare = shadow === "compare";
  if (shadow !== "off" && (!compare || m?.valid)) {
    const progress =
      compare && m ? Math.max(0, Math.min(1, (175 - m.value) / 90)) : cycle;
    let ghost = guidePose(selected, progress);
    if (compare && points) ghost = fitGuide(ghost, points);
    else if (mode === "camera")
      ghost = ghost.map((p) => ({
        ...p,
        x: 0.06 + p.x * 0.36,
        y: 0.15 + p.y * 0.66,
      }));
    if (mode === "camera") {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    drawBody(ctx, ghost, "#d0e7a0", w, h, 0.38, 14);
    if (mode === "camera") ctx.restore();
  }
  if (points) {
    if (mode === "camera") {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    drawBody(ctx, points, "#8dd4db", w, h, 0.9, 4);
    if (mode === "camera") ctx.restore();
  }
  if (m && fresh) {
    lastMeasure = m;
    const state = counter.update(m, now);
    $("#rep-value").textContent =
      selected === "plank" ? Math.floor(counter.hold) + "s" : counter.reps;
    $("#angle").textContent = m.valid ? Math.round(m.value) + "°" : "—";
    $("#phase").textContent = state.phase;
    if ($("#cue").textContent !== state.cue) $("#cue").textContent = state.cue;
    $("#tracking-note").textContent =
      mode === "demo"
        ? "Simulated input · not a real assessment"
        : m.valid
          ? "Required joints visible · 2D estimate"
          : "Counting paused until tracking is clear.";
    $("#save-camera").disabled =
      mode !== "camera" ||
      (selected === "plank" ? counter.hold < 1 : counter.reps < 1);
    if (
      $("#voice").checked &&
      mode === "camera" &&
      now - lastSpeech > 6500 &&
      state.cue !== lastCue
    ) {
      lastSpeech = now;
      lastCue = state.cue;
      const utterance = new SpeechSynthesisUtterance(state.cue);
      utterance.rate = 0.95;
      speechSynthesis.speak(utterance);
    }
  }
  $("#elapsed").textContent =
    Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
  raf = requestAnimationFrame(frame);
}
window.addEventListener("hashchange", render);
window.addEventListener("pagehide", stopCamera);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode !== "off") {
    stopCamera();
    toast("Camera paused while the app is in the background.");
  }
});
render();
if (storageError)
  toast("Some saved data could not be read. New sets can still be logged.");
