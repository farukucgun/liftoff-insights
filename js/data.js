// CSV parsing and the normalized workout model everything else reads from.
window.LI = window.LI || {};

LI.LB = 0.45359237;

LI.store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    if (LI.SETTINGS_KEYS && Object.values(LI.SETTINGS_KEYS).includes(key)) LI.saveSettings();
  },
};

// ---------- small helpers ----------

LI.dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

LI.weekStart = (d) => {
  const w = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); // Monday
  return w;
};

LI.daysBetween = (a, b) => Math.round((LI.startOfDay(b) - LI.startOfDay(a)) / 86400000);
LI.startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

LI.fmtDate = (d, opts) => d.toLocaleDateString(undefined, opts || { day: "numeric", month: "short", year: "numeric" });
LI.fmtShort = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

LI.e1rm = (load, reps) => (load > 0 && reps > 0 ? (reps === 1 ? load : load * (1 + reps / 30)) : null);

// Weight in kg -> number in the current display unit.
LI.toDisplay = (kg) => (kg == null ? null : LI.state.displayUnit === "lb" ? kg / LI.LB : kg);
LI.round = (n, step = 0.1) => Math.round(n / step) * step;
LI.fmtNum = (n, digits = 1) => {
  if (n == null || isNaN(n)) return "–";
  return Number(n.toFixed(digits)).toLocaleString(undefined, { maximumFractionDigits: digits });
};
LI.fmtW = (kg, digits = 1) => (kg == null ? "–" : LI.fmtNum(LI.toDisplay(kg), digits));
LI.fmtWU = (kg, digits = 1) => (kg == null ? "–" : `${LI.fmtW(kg, digits)} ${LI.state.displayUnit}`);
LI.fmtVol = (kg) => {
  const v = LI.toDisplay(kg);
  return v >= 10000 ? `${LI.fmtNum(v / 1000, 1)}k` : LI.fmtNum(v, 0);
};

LI.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- time periods ----------

LI.PERIODS = [
  ["7", "Last 7 days"],
  ["14", "Last 2 weeks"],
  ["28", "Last 4 weeks"],
  ["56", "Last 8 weeks"],
  ["84", "Last 12 weeks"],
  ["182", "Last 6 months"],
  ["all", "All time"],
];

// { from, to, days, prevFrom, label, short } for a period key, ending today.
LI.periodRange = (model, key) => {
  const today = new Date();
  const days = key === "all" ? Math.max(7, LI.daysBetween(model.first, today) + 1) : +key;
  const from = LI.startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1));
  const prevFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days);
  const label = (LI.PERIODS.find(([k]) => k === key) || [, ""])[1];
  return { key, from, to: today, days, prevFrom, label, short: label.replace(/^Last /, "") };
};

LI.inRange = (date, range) => date >= range.from && date <= range.to;

// Day buckets for short periods, week buckets otherwise.
LI.buckets = (range) => {
  const size = range.days <= 14 ? "day" : "week";
  const out = [];
  let d = size === "day" ? LI.startOfDay(range.from) : LI.weekStart(range.from);
  while (d <= range.to) {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (size === "day" ? 1 : 7));
    out.push({ start: d, end: next, label: size === "day" ? LI.fmtDate(d, { weekday: "short", day: "numeric" }) : LI.fmtShort(d) });
    d = next;
  }
  out.size = size;
  return out;
};

// Sum fn(set) per bucket over sets inside the range.
LI.bucketSum = (buckets, sets, range, fn) =>
  buckets.map((b) => sets.reduce((t, s) => {
    const d = s.workout.date;
    return d >= b.start && d < b.end && LI.inRange(d, range) ? t + fn(s) : t;
  }, 0));

LI.periodSelect = (id, value) =>
  `<select id="${id}" aria-label="Time period">${LI.PERIODS.map(([k, l]) => `<option value="${k}" ${k === value ? "selected" : ""}>${l}</option>`).join("")}</select>`;

LI.pctChange = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null);
LI.fmtChange = (cur, prev, what) => {
  const p = LI.pctChange(cur, prev);
  if (p == null) return "";
  const cls = Math.abs(p) < 0.5 ? "muted" : p > 0 ? "up" : "down";
  return `<span class="${cls}">${p > 0 ? "▲" : p < 0 ? "▼" : ""} ${LI.fmtNum(Math.abs(p), 0)}%</span> vs ${what}`;
};

// ---------- parsing ----------

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s || "");
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

function parseDuration(s) {
  if (!s) return null;
  const h = /(\d+)\s*hour/.exec(s), m = /(\d+)\s*min/.exec(s), sec = /(\d+)\s*sec/.exec(s);
  if (!h && !m && !sec) return null;
  return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) + (sec ? +sec[1] / 60 : 0);
}

// "71.8", "71.2kg", "158 lb" -> kg. Anything else is a real workout name.
LI.parseBodyweight = (name) => {
  const m = /^\s*(\d{2,3}(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)?\s*$/i.exec(name || "");
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  return m[2] && m[2].toLowerCase().startsWith("lb") ? v * LI.LB : v;
};

const num = (s) => { const v = parseFloat(s); return isNaN(v) ? 0 : v; };

LI.parseCsv = (text) => {
  const res = Papa.parse(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^﻿/, "").trim(),
  });
  const required = ["Date", "Exercise Name", "Weight", "Reps"];
  const missing = required.filter((c) => !res.meta.fields.includes(c));
  if (missing.length) throw new Error(`This doesn't look like a Liftoff export (missing ${missing.join(", ")}).`);

  return res.data
    .map((r) => {
      const weightStr = (r["Weight"] || "0").trim();
      return {
        ts: (r["Date"] || "").trim(),
        date: parseDate(r["Date"]),
        durationMin: parseDuration(r["Duration"]),
        workoutName: (r["Workout Name"] || "").trim(),
        exercise: LI.canonicalExercise((r["Exercise Name"] || "").trim()),
        loggedAs: (r["Exercise Name"] || "").trim(),
        order: num(r["Set Order"]),
        rawWeight: Math.round(num(weightStr) * 100) / 100,
        // Liftoff converts internally; values typed in one unit come back with float noise.
        noisy: /\.\d{6,}/.test(weightStr),
        reps: num(r["Reps"]),
        distance: num(r["Distance"]),
        seconds: num(r["Seconds"]),
        rpe: r["RPE"] === "" || r["RPE"] == null ? null : num(r["RPE"]),
        notes: (r["Notes"] || "").trim(),
      };
    })
    .filter((r) => r.date && r.exercise);
};

// Added weight written in a set's note on a bodyweight exercise: "+10", "+10kg", "+20 lb", "10kg".
LI.noteAddedWeight = (note) => {
  const m = /^\s*\+?\s*(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)?\b/i.exec(note || "");
  if (!m || (!/^\s*\+/.test(note) && !m[2])) return null; // need a "+" or a unit to avoid reading "10 reps"
  const v = parseFloat(m[1].replace(",", "."));
  return m[2] && m[2].toLowerCase().startsWith("lb") ? v * LI.LB : v;
};

// ---------- configuration lookups ----------

// Identifies one set across re-imports: workout timestamp + exercise + position.
LI.setKey = (workoutId, exercise, index) => `${workoutId}|${exercise}|${index}`;

// "2026-09-10 22:25:13|Dips|0" → its parts, with a 1-based set number.
LI.parseSetKey = (key) => {
  const [workoutId, exercise, index] = key.split("|");
  return { workoutId, exercise, set: +index + 1 };
};

LI.setCorrection = (key, fix) => {
  if (fix) LI.state.corrections[key] = fix;
  else delete LI.state.corrections[key];
  LI.store.set("li.corrections", LI.state.corrections);
};

LI.unitConfig = () => ({ ...LI.UNITS_CONFIG, ...LI.state.unitOverrides });

LI.resolveUnit = (exercise, day) => {
  const entry = LI.unitConfig()[exercise];
  if (!entry) return "unknown";
  if (typeof entry === "string") return entry;
  return (entry.sessions && entry.sessions[day]) || entry.default || "unknown";
};

LI.exerciseInfo = (name) => {
  const override = LI.state.muscleOverrides[name];
  if (override) return { ...override, source: "custom" };
  if (LI.EXERCISE_MAP[name]) return { ...LI.EXERCISE_MAP[name], source: "map" };
  const guess = LI.EXERCISE_GUESSES.find(([re]) => re.test(name));
  if (guess) return { ...guess[1], source: "guess" };
  return { primary: [], secondary: [], source: "none" };
};

// ---------- model ----------

LI.buildModel = (rows) => {
  // Group rows into workouts by timestamp.
  const byTs = new Map();
  for (const r of rows) {
    if (!byTs.has(r.ts)) byTs.set(r.ts, []);
    byTs.get(r.ts).push(r);
  }

  const workouts = [...byTs.entries()]
    .map(([ts, rs]) => {
      const date = rs[0].date;
      const name = rs[0].workoutName;
      const bw = LI.parseBodyweight(name);
      return {
        id: ts,
        date,
        day: LI.dayKey(date),
        durationMin: rs[0].durationMin,
        name: bw == null ? name : "",
        bodyweight: bw,
        rows: rs,
      };
    })
    .sort((a, b) => a.date - b.date);

  const bodyweights = workouts.filter((w) => w.bodyweight != null).map((w) => ({ date: w.date, kg: w.bodyweight }));
  const bodyweightAt = (date) => {
    if (!bodyweights.length) return null;
    let best = bodyweights[0];
    for (const b of bodyweights) if (Math.abs(b.date - date) < Math.abs(best.date - date)) best = b;
    return best.kg;
  };

  const exercises = new Map();
  const allSets = [];
  const unconfirmed = new Set();
  const fixSeen = new Set(), fixChanged = [], fixBackfill = [];
  const unitSessions = new Map(); // "Exercise|day" -> { unit, workoutId, weights, reps }, sessions with a unit set

  for (const w of workouts) {
    const bw = bodyweightAt(w.date);
    const exOrder = [];
    const exSets = new Map();
    // Liftoff can list an edited workout's sets out of order, so number them by Set Order.
    // Exercises keep the order they first appear in.
    const byExercise = new Map();
    for (const r of w.rows) byExercise.set(r.exercise, [...(byExercise.get(r.exercise) || []), r]);
    const rows = [...byExercise.values()].flatMap((rs) => rs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    for (const r of rows) {
      if (!exSets.has(r.exercise)) { exSets.set(r.exercise, []); exOrder.push(r.exercise); }
      const info = LI.exerciseInfo(r.exercise);
      const index = exSets.get(r.exercise).length;
      const key = LI.setKey(w.id, r.exercise, index);
      const fix = LI.state.corrections[key];
      if (fix) {
        fixSeen.add(key);
        // `was` is what Liftoff had for this set when the fix was made. If that changed, the
        // set was probably edited in Liftoff and the fix may now sit on a different set.
        if (!fix.was) fixBackfill.push([key, { weight: r.rawWeight, reps: r.reps }]);
        else if (fix.was.weight !== r.rawWeight || fix.was.reps !== r.reps) fixChanged.push({ key, kind: "changed", fix, now: { weight: r.rawWeight, reps: r.reps } });
      }
      const rawUnit = LI.resolveUnit(r.exercise, w.day);
      if (rawUnit === "lb" || rawUnit === "kg") {
        const k = `${r.exercise}|${w.day}`;
        if (!unitSessions.has(k)) unitSessions.set(k, { unit: rawUnit, workoutId: w.id, weights: [], raw: [], reps: [] });
        const u = unitSessions.get(k);
        u.weights.push(Math.round(r.rawWeight * 10) / 10); // compared across exports, so noise-free
        u.raw.push(r.rawWeight);
        u.reps.push(r.reps);
      }
      if (rawUnit === "unknown" && r.rawWeight > 0 && !(fix && fix.kg != null)) unconfirmed.add(r.exercise);
      const bwShare = info.bw ?? 0;
      const noteKg = !fix && bwShare > 0 && r.rawWeight === 0 ? LI.noteAddedWeight(r.notes) : null;
      const kg = fix && fix.kg != null ? fix.kg : noteKg != null ? noteKg : rawUnit === "lb" ? r.rawWeight * LI.LB : r.rawWeight;
      const reps = fix && fix.reps != null ? fix.reps : r.reps;
      const load = kg + (bwShare > 0 && bw != null ? bw * bwShare : 0);
      const isCardio = (r.distance > 0 || r.seconds > 0) && reps === 0;
      const set = {
        workout: w,
        exercise: r.exercise,
        key,
        order: r.order,
        rawWeight: r.rawWeight,
        rawReps: r.reps,
        rawUnit,
        noisy: r.noisy,
        edited: !!fix,
        fromNote: noteKg != null,
        loggedAs: r.loggedAs,
        kg,
        load,
        bwShare,
        reps,
        distance: r.distance,
        seconds: r.seconds,
        rpe: r.rpe,
        notes: r.notes,
        cardio: isCardio,
        volume: load * reps,
        e1rm: LI.e1rm(load, reps),
      };
      exSets.get(r.exercise).push(set);
      allSets.push(set);
    }

    w.exercises = exOrder.map((name) => ({ name, sets: exSets.get(name) }));
    w.sets = w.exercises.flatMap((e) => e.sets);
    w.volume = w.sets.reduce((s, x) => s + x.volume, 0);
    w.totalReps = w.sets.reduce((s, x) => s + x.reps, 0);
    delete w.rows;

    for (const e of w.exercises) {
      if (!exercises.has(e.name)) exercises.set(e.name, { name: e.name, sessions: [] });
      exercises.get(e.name).sessions.push(LI.sessionStats(w, e.sets));
    }
  }

  for (const ex of exercises.values()) {
    ex.info = LI.exerciseInfo(ex.name);
    ex.setCount = ex.sessions.reduce((s, x) => s + x.sets.length, 0);
    const anyWeight = ex.sessions.some((s) => s.sets.some((x) => x.kg > 0));
    const anyLoad = ex.sessions.some((s) => s.sets.some((x) => x.load > 0));
    const anyCardio = ex.sessions.some((s) => s.sets.some((x) => x.cardio));
    ex.kind = anyCardio ? "cardio" : anyWeight ? "weighted" : anyLoad ? "bodyweight" : "reps";
    // Running bests to mark PRs.
    let bestE1 = 0, bestW = 0, bestVol = 0, bestReps = 0;
    for (const s of ex.sessions) {
      s.prs = [];
      if (s.bestE1rm && s.bestE1rm > bestE1 + 1e-6) { if (bestE1) s.prs.push("e1RM"); bestE1 = s.bestE1rm; }
      if (s.topLoad > bestW + 1e-6) { if (bestW) s.prs.push("Weight"); bestW = s.topLoad; }
      if (s.volume > bestVol + 1e-6) { if (bestVol) s.prs.push("Volume"); bestVol = s.volume; }
      if (s.maxReps > bestReps) { if (bestReps && ex.kind !== "weighted") s.prs.push("Reps"); bestReps = s.maxReps; }
    }
  }

  // Remove empty workouts (Liftoff exports a placeholder row for unfinished ones).
  const real = workouts.filter((w) => w.sets.length);

  // Fixes made before `was` existed: record the current values once.
  if (fixBackfill.length) {
    for (const [key, was] of fixBackfill) LI.state.corrections[key] = { ...LI.state.corrections[key], was };
    LI.store.set("li.corrections", LI.state.corrections);
  }
  // A session with a unit set whose weights changed in a later export was probably edited or
  // converted in Liftoff (changing a session's unit there converts the numbers), so the unit set
  // here may no longer fit. Keep the weights first seen for each session; record new ones now.
  const unitIssues = [], seen = {};
  for (const [k, s] of unitSessions) {
    const now = s.weights.join(","), was = LI.state.unitSeen[k];
    seen[k] = was || now;
    if (was && was !== now) {
      const [exercise, day] = k.split("|");
      unitIssues.push({ key: k, exercise, day, ...s, was, now, kind: conversionKind(was.split(",").map(Number), s.weights) });
    }
  }
  const old = LI.state.unitSeen || {};
  if (Object.keys(seen).length !== Object.keys(old).length || Object.entries(seen).some(([k, v]) => old[k] !== v)) {
    LI.state.unitSeen = seen;
    LI.store.set("li.unitSeen", seen);
  }
  // Sessions read as lb (the exercise's default) whose weights all have kg float noise: typically
  // the unit was switched to kg in Liftoff for that exercise. Only this direction: clean numbers
  // also come from exercises really logged in kg. A per-session choice or "it's lb" silences it.
  const unitHints = [];
  for (const ex of exercises.values()) {
    const entry = LI.unitConfig()[ex.name];
    if (!entry) continue;
    for (const s of ex.sessions) {
      const day = s.workout.day, k = `${ex.name}|${day}`;
      if ((typeof entry === "object" && entry.sessions && entry.sessions[day]) || LI.state.unitHintOk[k]) continue;
      const sets = s.sets.filter((x) => x.rawWeight > 0 && !x.edited);
      if (sets.length && sets[0].rawUnit === "lb" && sets.every((x) => x.noisy)) unitHints.push({ key: k, exercise: ex.name, day, sets });
    }
  }

  const fixMissing = Object.keys(LI.state.corrections).filter((k) => !fixSeen.has(k)).map((key) => ({ key, kind: "missing", fix: LI.state.corrections[key] }));

  return {
    workouts: real,
    sets: allSets,
    exercises,
    bodyweights,
    unconfirmed: [...unconfirmed],
    fixIssues: [...fixMissing, ...fixChanged],
    unitIssues,
    unitHints,
    first: real[0]?.date,
    last: real[real.length - 1]?.date,
  };
};

// How a session's weights changed: Liftoff's lb→kg or kg→lb conversion (it rounds the result),
// or some other edit.
function conversionKind(before, after) {
  if (before.length !== after.length || !before.some((x) => x > 0)) return "edited";
  const close = (f, tol) => before.every((x, i) => Math.abs(x * f - after[i]) <= tol);
  if (close(LI.LB, 0.6)) return "lb→kg";
  if (close(1 / LI.LB, 1.2)) return "kg→lb";
  return "edited";
}

LI.sessionStats = (workout, sets) => {
  const work = sets.filter((s) => s.reps > 0 || s.cardio);
  const top = work.reduce((b, s) => (!b || s.load > b.load || (s.load === b.load && s.reps > b.reps) ? s : b), null);
  const e1s = work.map((s) => s.e1rm).filter((x) => x != null);
  return {
    workout,
    date: workout.date,
    sets,
    topSet: top,
    topLoad: top ? top.load : 0,
    bestE1rm: e1s.length ? Math.max(...e1s) : null,
    volume: work.reduce((s, x) => s + x.volume, 0),
    totalReps: work.reduce((s, x) => s + x.reps, 0),
    maxReps: work.reduce((m, x) => Math.max(m, x.reps), 0),
    distance: work.reduce((s, x) => s + x.distance, 0),
    seconds: work.reduce((s, x) => s + x.seconds, 0),
  };
};

// Weighted set credit per muscle for a list of sets.
LI.muscleSets = (sets) => {
  const out = Object.fromEntries(LI.MUSCLES.map((m) => [m, 0]));
  for (const s of sets) {
    if (s.reps <= 0 && !s.cardio) continue;
    const info = LI.exerciseInfo(s.exercise);
    for (const m of info.primary) out[m] = (out[m] || 0) + 1;
    for (const m of info.secondary) out[m] = (out[m] || 0) + 0.5;
  }
  return out;
};

// Unit suggestion from float noise: clean numbers were typed in lb, noisy ones in kg
// (Liftoff appears to store lb internally). Only a hint; the user confirms.
LI.suggestUnit = (sets) => {
  let noisy = 0, clean = 0;
  for (const s of sets) if (s.rawWeight > 0) s.noisy ? noisy++ : clean++;
  if (!noisy && !clean) return null;
  return noisy >= clean ? "kg" : "lb";
};
