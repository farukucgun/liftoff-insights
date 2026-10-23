window.LI = window.LI || {};
LI.views = LI.views || {};

LI.buildInsights = (model) => {
  const out = []; // { level: neglected|under|ok|high|info, title, text }
  const today = new Date();
  const win = LI.muscleWindow(model, "28");
  const last = LI.lastTrained(model);

  if (model.unconfirmed.length) {
    out.push({ level: "high", pinned: true, title: "Units not confirmed", text: `${model.unconfirmed.length} exercises still have an unconfirmed kg/lb unit, so their numbers may be off. Set them on the Units tab.` });
  }

  // Program.
  const next = LI.nextProgramDay(model);
  if (!LI.programStart()) {
    out.push({ level: "info", pinned: true, title: `Next up: ${next.day.name}`, text: "Set your program start date on the Program tab to check sessions against the plan." });
  } else {
    const sessions = LI.programSessions(model);
    out.push({ level: "info", pinned: true, title: `Next up: ${next.day.name}`, text: `${next.day.items.map((s) => s.ex).join(", ")}. The Program tab has the weights to use.` });
    const lastSession = sessions.find((s) => s.match);
    if (lastSession) {
      const { workout: w, match } = lastSession;
      const c = LI.compareToPlan(w, match.day);
      if (c.missed.length) {
        out.push({ level: "under", title: `${match.day.name} on ${LI.fmtShort(w.date)}: ${c.missed.length} exercise${c.missed.length === 1 ? "" : "s"} skipped`, text: `${c.missed.join(", ")}. If time is short, cut sets from the last exercises instead of dropping whole ones.` });
      }
      const off = c.items.filter((i) => i.done && i.sets && (i.below || i.above) * 2 >= i.sets);
      for (const i of off) {
        out.push({ level: "high", title: `${i.slot.ex}: reps ${i.above ? "above" : "below"} ${i.slot.reps[0]}–${i.slot.reps[1]}`, text: i.above ? "Add weight so the reps land in the program's range." : "The weight is too heavy for this range. Lower it a little." });
      }
    }
    const week = model.workouts.filter((w) => LI.daysBetween(w.date, today) < 7 && w.date >= LI.programStart()).length;
    if (LI.daysBetween(LI.programStart(), today) >= 6) {
      const perWeek = LI.programDaysPerWeek();
      out.push({ level: week >= perWeek ? "ok" : week >= perWeek - 1 ? "high" : "under", title: `${week} of ${perWeek} sessions in the last 7 days`, text: week >= perWeek ? "On schedule." : "Pick up where you left off rather than skipping a day; the order matters more than the weekday." });
    }
  }

  // Muscle volume. Badly neglected muscles get their own line; the rest are grouped.
  const below = [];
  for (const m of LI.MUSCLES) {
    const v = win.perWeek[m];
    const { lo, hi } = LI.targetFor(m);
    const direct = LI.muscleSets(win.sets.filter((s) => LI.exerciseInfo(s.exercise).primary.includes(m)))[m];
    if (v < lo / 2) {
      out.push({ level: "neglected", title: `${m}: barely trained`, text: `${LI.fmtNum(v)} sets/week over the last 4 weeks${direct ? "" : ", none of it direct"}. ${suggestFor(m)}` });
    } else if (v < lo) {
      below.push(`${m} ${LI.fmtNum(v)} (target ${lo}–${hi})`);
    } else if (v > hi) {
      out.push({ level: "high", title: `${m}: volume is high`, text: `${LI.fmtNum(v)} sets/week, above your ${lo}–${hi} target. If recovery or joints suffer, this is the first place to trim.` });
    }
  }
  if (below.length) {
    out.push({ level: "under", title: "Below target", text: `${below.join(", ")}, in sets/week. Fine for maintenance; add 2–4 sets a week to the ones you care most about.` });
  }

  // Balance.
  for (const r of LI.balanceRatios(win.totals)) {
    if (!r.a && !r.b) continue;
    const ratio = r.b ? r.a / r.b : Infinity;
    if (ratio < r.lo || ratio > r.hi) {
      const [left, right] = r.name.split(" : ");
      out.push({ level: "under", title: `${r.name}: too much ${ratio > r.hi ? left : right}`, text: `${LI.fmtNum(r.a)} vs ${LI.fmtNum(r.b)} weighted sets in 4 weeks (ratio ${ratio === Infinity ? "∞" : LI.fmtNum(ratio, 2)}, aim ${r.lo}–${r.hi}). ${LI.balanceAdvice(r, win.days / 7)}` });
    }
  }

  // Strength progress.
  const gains = [...model.exercises.values()]
    .filter((ex) => ex.kind === "weighted" && ex.sessions.filter((s) => s.bestE1rm).length >= 3)
    .map((ex) => {
      const ss = ex.sessions.filter((s) => s.bestE1rm);
      const firstBest = Math.max(...ss.slice(0, 2).map((s) => s.bestE1rm));
      const lastBest = Math.max(...ss.slice(-2).map((s) => s.bestE1rm));
      return { ex, pct: (lastBest / firstBest - 1) * 100, from: ss[0].date };
    })
    .sort((a, b) => b.pct - a.pct);
  for (const g of gains.slice(0, 3)) if (g.pct > 2) {
    out.push({ level: "ok", title: `${g.ex.name}: up ${LI.fmtNum(g.pct, 0)}%`, text: `Estimated 1RM, comparing your first two sessions with your last two (since ${LI.fmtShort(g.from)}).` });
  }

  // Plateaus.
  for (const ex of model.exercises.values()) {
    const p = LI.plateau(ex);
    if (p && LI.daysBetween(ex.sessions[ex.sessions.length - 1].date, today) < 21) {
      out.push({ level: "under", title: `${ex.name}: stalled`, text: `No new best in the last 3 sessions (since ${LI.fmtShort(p.since)}). Try adding a rep per set before adding weight, or swap in a variation for a few weeks.` });
    }
  }

  // Dropped exercises.
  // Once the program has started, only exercises that are part of it count as dropped.
  const inProgram = (name) => LI.PROGRAM.days.some((d) => d.items.some((s) => LI.slotMatch(s, name)));
  const dropped = [...model.exercises.values()].filter((ex) => ex.sessions.length >= 2 && LI.daysBetween(ex.sessions[ex.sessions.length - 1].date, today) > 21 && (!LI.programStart() || inProgram(ex.name)));
  if (dropped.length) {
    out.push({ level: "info", title: "Exercises you've stopped doing", text: dropped.map((ex) => `${ex.name} (${LI.daysBetween(ex.sessions[ex.sessions.length - 1].date, today)}d ago)`).join(", ") + "." });
  }

  // Overdue muscles.
  const overdue = LI.MUSCLES.filter((m) => last[m] && LI.daysBetween(last[m], today) > 10);
  if (overdue.length) {
    out.push({ level: "under", title: "Not trained directly in 10+ days", text: overdue.map((m) => `${m} (${LI.daysBetween(last[m], today)}d)`).join(", ") + "." });
  }

  // Frequency trend.
  const count = (from, to) => model.workouts.filter((w) => w.date >= from && w.date < to).length;
  const d = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  const recent = count(d(27), today), before = count(d(55), d(27));
  if (before) {
    out.push({ level: recent >= before ? "ok" : "under", title: `${recent} workouts in the last 4 weeks`, text: `vs ${before} in the 4 weeks before.` });
  }

  // Bodyweight.
  const bw = model.bodyweights;
  if (bw.length >= 2) {
    const a = bw[0], b = bw[bw.length - 1];
    const weeks = Math.max(1, LI.daysBetween(a.date, b.date) / 7);
    const diff = b.kg - a.kg;
    out.push({ level: "info", title: `Bodyweight ${diff >= 0 ? "+" : "−"}${LI.fmtWU(Math.abs(diff))}`, text: `${LI.fmtWU(a.kg)} → ${LI.fmtWU(b.kg)} since ${LI.fmtShort(a.date)} (${diff >= 0 ? "+" : "−"}${LI.fmtW(Math.abs(diff) / weeks, 2)} ${LI.state.displayUnit}/week).` });
  }

  const order = { neglected: 0, under: 1, high: 2, ok: 3, info: 4 };
  return out.sort((x, y) => (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0) || order[x.level] - order[y.level]);
};

const SUGGESTIONS = {
  Chest: "Bench press, chest fly or dips.",
  "Front Delts": "Usually covered by pressing; add a shoulder press if needed.",
  "Side Delts": "Lateral raises (cable or dumbbell).",
  "Rear Delts": "Reverse fly or face pulls.",
  Lats: "Pull-ups, lat pulldown or high rows.",
  "Upper Back": "Rows (machine, cable or bent over).",
  Biceps: "Any curl variation.",
  Triceps: "Overhead extensions, pushdowns or dips.",
  Forearms: "Hammer curls, wrist curls or farmer's carries.",
  Abs: "Cable crunches or hanging leg raises.",
  "Lower Back": "Back extensions or Romanian deadlifts.",
  Quads: "Squats, leg press or leg extensions.",
  Hamstrings: "Lying/seated leg curls or Romanian deadlifts.",
  Glutes: "Hip thrusts, Romanian deadlifts or squats.",
  Calves: "Standing or seated calf raises.",
};
// The program's own exercises for a muscle when it has any, else a generic suggestion.
const suggestFor = (m) => {
  const inProgram = LI.PROGRAM.days.flatMap((d) => d.items.filter((s) => s.primary.includes(m)).map((s) => `${s.ex} (${d.name})`));
  if (inProgram.length) return `The program trains it with ${inProgram.join(", ")}; make sure those get done.`;
  return SUGGESTIONS[m] ? `Try: ${SUGGESTIONS[m]}` : "";
};

LI.views.insights = (el, model) => {
  const items = LI.buildInsights(model);
  const labels = { neglected: "Gap", under: "Watch", high: "Check", ok: "Good", info: "Info" };
  el.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Insights</h2><span class="muted small">Muscle numbers use the last 4 weeks</span></div>
      ${items.map((i) => `
        <div class="insight">
          <span class="pill ${i.level}">${labels[i.level]}</span>
          <div><strong>${LI.esc(i.title)}</strong><div class="muted">${LI.esc(i.text)}</div></div>
        </div>`).join("") || `<p class="muted">Nothing to flag.</p>`}
    </div>`;
};
