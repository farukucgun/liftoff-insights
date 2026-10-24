window.LI = window.LI || {};
LI.views = LI.views || {};

// Stalled = the best of the last 3 sessions doesn't beat the best before them.
LI.plateau = (ex) => {
  const metric = ex.kind === "weighted" || ex.kind === "bodyweight" ? (s) => s.bestE1rm || 0 : (s) => s.maxReps;
  const ss = ex.sessions;
  if (ss.length < 4) return null;
  const before = Math.max(...ss.slice(0, -3).map(metric));
  const recent = Math.max(...ss.slice(-3).map(metric));
  return recent <= before + 1e-6 ? { since: ss[ss.length - 3].date, best: before } : null;
};

// "60 kg", "BW", "BW +10 kg" for a set, depending on the exercise type.
LI.weightLabel = (s, withUnit = true) => {
  if (s.bwShare > 0) return s.kg > 0 ? `BW +${LI.fmtW(s.kg)}${withUnit ? ` ${LI.state.displayUnit}` : ""}` : "BW";
  return s.kg > 0 ? (withUnit ? LI.fmtWU(s.kg) : LI.fmtW(s.kg)) : "–";
};

LI.views.progress = (el, model) => {
  const st = LI.state;
  st.progressMode = st.progressMode || "exercise";
  const exList = [...model.exercises.values()].sort((a, b) => b.setCount - a.setCount);
  if (!st.progressExercise || !model.exercises.has(st.progressExercise)) st.progressExercise = exList[0].name;
  st.progressMuscle = st.progressMuscle || "Chest";
  const range = LI.periodRange(model, st.periods.progress);

  el.innerHTML = `
    <div class="toolbar">
      <select id="p-mode">
        <option value="exercise" ${st.progressMode === "exercise" ? "selected" : ""}>By exercise</option>
        <option value="muscle" ${st.progressMode === "muscle" ? "selected" : ""}>By muscle</option>
      </select>
      <select id="p-pick"></select>
      ${LI.periodSelect("p-period", range.key)}
      <span class="muted small">${LI.fmtShort(range.from)} – ${LI.fmtShort(range.to)}</span>
    </div>
    ${st.progressBackTo === "program" ? `<p style="margin:-8px 0 12px"><a href="#program" id="p-back-program">← Back to Program</a></p>` : ""}
    <div id="p-body"></div>`;

  const backProgram = el.querySelector("#p-back-program");
  if (backProgram) backProgram.onclick = () => Object.assign(st, { progressBackTo: null });
  const pick = el.querySelector("#p-pick");
  const body = el.querySelector("#p-body");
  el.querySelector("#p-mode").onchange = (e) => { Object.assign(st, { progressMode: e.target.value, progressFromMuscle: null, progressFromWorkout: null, progressBackTo: null }); LI.render(); };
  el.querySelector("#p-period").onchange = (e) => LI.setPeriod("progress", e.target.value);

  if (st.progressMode === "exercise") {
    // Grouped by main muscle, in the body order the muscle list uses (so chest sits near
    // shoulders, back near biceps...), A–Z inside a group. New exercises land in their group
    // from their mapping (or name guess); unmapped ones go last.
    const groups = new Map([...LI.MUSCLES, "Other"].map((m) => [m, []]));
    for (const x of exList) groups.get(x.info.primary.find((m) => groups.has(m)) || "Other").push(x);
    pick.innerHTML = [...groups].filter(([, xs]) => xs.length).map(([m, xs]) => `<optgroup label="${m}">${xs
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((x) => `<option ${x.name === st.progressExercise ? "selected" : ""}>${LI.esc(x.name)}</option>`).join("")}</optgroup>`).join("");
    pick.onchange = (e) => { Object.assign(st, { progressExercise: e.target.value, progressFromMuscle: null, progressFromWorkout: null, progressBackTo: null }); LI.render(); };
    renderExercise(body, model, model.exercises.get(st.progressExercise), range);
    const back = body.querySelector("#p-back");
    if (back) back.onclick = (e) => {
      e.preventDefault();
      const backTo = st.progressBackTo;
      Object.assign(st, { progressFromMuscle: null, progressFromWorkout: null, progressBackTo: null });
      if (backTo === "workouts") return (location.hash = "workouts"); // workoutId is still set there
      if (backTo === "muscles") return (location.hash = "muscles"); // selectedMuscle is still set there
      Object.assign(st, { progressMode: "muscle", progressMuscle: back.dataset.muscleBack });
      LI.render();
    };
  } else {
    pick.innerHTML = LI.MUSCLES.map((m) => `<option ${m === st.progressMuscle ? "selected" : ""}>${m}</option>`).join("");
    pick.onchange = (e) => { Object.assign(st, { progressMuscle: e.target.value, progressBackTo: null }); LI.render(); };
    renderMuscle(body, model, st.progressMuscle, range);
  }
};

function renderExercise(el, model, ex, range) {
  const u = LI.state.displayUnit;
  const all = range.key === "all";
  const ss = ex.sessions.filter((s) => LI.inRange(s.date, range));
  const prevSS = all ? [] : ex.sessions.filter((s) => s.date >= range.prevFrom && s.date < range.from);
  const isBW = (ex.info.bw || 0) > 0;
  const strength = ex.kind === "weighted" || ex.kind === "bodyweight";
  const plateau = LI.plateau(ex);
  const unconfirmed = model.unconfirmed.includes(ex.name);
  const info = ex.info;
  const lastDone = ex.sessions[ex.sessions.length - 1].date;

  const from = LI.state.progressFromMuscle, backTo = LI.state.progressBackTo;
  const fromWorkout = backTo === "workouts" && model.workouts.find((w) => w.id === LI.state.progressFromWorkout);
  const header = `
    ${fromWorkout ? `<p style="margin:-8px 0 12px"><a href="#workouts" id="p-back">← Back to workout (${LI.fmtDate(fromWorkout.date, { weekday: "short", day: "numeric", month: "short" })})</a></p>`
      : from ? `<p style="margin:-8px 0 12px"><a href="#${backTo === "muscles" ? "muscles" : "progress"}" id="p-back" data-muscle-back="${from}">← Back to ${backTo === "muscles" ? `Muscles (${from})` : from}</a></p>` : ""}
    <p class="muted" style="margin-top:-8px">
      ${info.primary.length ? `Primary: ${info.primary.join(", ")}` : "No muscles mapped"}${info.secondary.length ? ` · Secondary: ${info.secondary.join(", ")}` : ""}
      ${unconfirmed ? ` · <span class="pill high">unit not confirmed</span>` : ""}
      ${plateau ? ` · <span class="pill under">stalled since ${LI.fmtShort(plateau.since)}</span>` : ""}
    </p>
    ${isBW ? `<div class="banner" style="margin:0 0 16px">
      Loads for ${LI.esc(ex.name)} include your bodyweight (from workout names). <strong>Liftoff's export leaves out added weight on bodyweight exercises</strong>,
      so if you used a belt or vest, add it on the <a href="#workouts">Workouts</a> tab with ✎ next to the set.
    </div>` : ""}`;

  if (!ss.length) {
    el.innerHTML = `${header}<div class="card"><p class="muted">No ${LI.esc(ex.name)} sessions in the ${range.label.toLowerCase()}. Last done ${LI.fmtDate(lastDone)}.</p>
      <button class="btn small" id="p-all">Show all time</button></div>`;
    el.querySelector("#p-all").onclick = () => LI.setPeriod("progress", "all");
    return;
  }

  const first = ss[0], last = ss[ss.length - 1];
  const vol = ss.reduce((t, s) => t + s.volume, 0);
  const prevVol = prevSS.reduce((t, s) => t + s.volume, 0);
  // Between the first and last sessions with an e1RM: sessions without weight have none.
  const withE1 = ss.filter((s) => s.bestE1rm), e1First = withE1[0], e1Last = withE1[withE1.length - 1];
  const change = strength && withE1.length > 1 ? (e1Last.bestE1rm / e1First.bestE1rm - 1) * 100 : null;

  // The per-workout chart, like Liftoff's: one metric at a time. Weight-based metrics leave out
  // sessions with no weight (e.g. added weight the export dropped) instead of plotting zero.
  const metrics = exerciseMetrics(ex, strength, isBW);
  const metric = metrics.find((m) => m.id === LI.state.progressMetric?.[strength ? "loaded" : "reps"]) || metrics[0];
  const skipped = metric.weight ? ss.filter((s) => !metric.get(s)) : [];

  const tile = (label, value, sub) => `<div class="card tile"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub || "&nbsp;"}</div></div>`;
  const buckets = LI.buckets(range);
  const per = buckets.size === "day" ? "Daily" : "Weekly";

  el.innerHTML = `${header}
    <div class="tiles">
      ${tile("Sessions", ss.length, prevSS.length ? `${prevSS.length} in the ${range.short} before` : `${LI.fmtShort(first.date)} – ${LI.fmtShort(last.date)}`)}
      ${tile(`Volume (${u})`, LI.fmtVol(vol), prevSS.length ? LI.fmtChange(vol, prevVol, `previous ${range.short}`) : `${LI.fmtVol(vol / ss.length)} per session`)}
      ${change != null ? tile("e1RM change", `${change >= 0 ? "+" : ""}${LI.fmtNum(change, 0)}%`, `${LI.fmtShort(e1First.date)} → ${LI.fmtShort(e1Last.date)}`) : ""}
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2>${ex.kind === "cardio" ? "Distance" : metric.title}</h2><span class="muted small">${ex.kind === "cardio" ? "per session" : metric.sub}</span></div>
        ${metrics.length > 1 ? `<div class="metric-chips" role="group" aria-label="Chart">${metrics.map((m) => `<button class="btn small ${m === metric ? "on" : ""}" data-metric="${m.id}" aria-pressed="${m === metric}">${m.label}</button>`).join("")}</div>` : ""}
        <div class="chart-box tall"><canvas id="c-main"></canvas></div>
        ${skipped.length ? `<p class="muted small" style="margin:6px 0 0">${skipped.length} session${skipped.length === 1 ? "" : "s"} without weight ${skipped.length === 1 ? "isn't" : "aren't"} shown. <a href="#workouts" id="p-skipped">Add it on Workouts</a></p>` : ""}
      </div>
      <div class="card"><div class="card-head"><h2>${ex.kind === "cardio" ? "Time" : `${per} ${strength ? "volume" : "reps"}`}</h2><span class="muted small">${ex.kind === "cardio" ? "minutes per session" : strength ? `${u} × reps` : "total reps"}</span></div><div class="chart-box tall"><canvas id="c-vol"></canvas></div></div>
    </div>
    ${ex.kind === "cardio" ? "" : recordsCard(ex, range, strength, isBW)}
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h2>Rep records</h2><p class="muted small">All time: most reps you've done at each weight.</p><div class="table-wrap">${repRecords(ex)}</div></div>
      <div class="card"><h2>History</h2><p class="muted small">${range.label}</p><div class="table-wrap">${historyTable(ss)}</div></div>
    </div>`;

  const xRange = { xMin: range.from, xMax: range.to };
  bindCapped(el);
  const main = el.querySelector("#c-main"), volC = el.querySelector("#c-vol");
  const fmtU = (v) => `${LI.fmtNum(v)} ${u}`;
  if (ex.kind === "cardio") {
    LI.lineChart(main, [{ label: "Distance", points: ss.map((s) => ({ x: s.date, y: s.distance })) }], xRange);
  } else {
    LI.lineChart(main, [{ label: metric.label, points: ss.filter((s) => metric.get(s)).map((s) => ({ x: s.date, y: metric.weight ? LI.toDisplay(metric.get(s)) : metric.get(s) })) }],
      { ...xRange, fmt: metric.weight ? fmtU : (v) => LI.fmtNum(v, 0) });
  }
  el.querySelectorAll("[data-metric]").forEach((b) => (b.onclick = () => {
    LI.state.progressMetric = { ...LI.state.progressMetric, [strength ? "loaded" : "reps"]: b.dataset.metric };
    LI.render();
  }));
  const skippedLink = el.querySelector("#p-skipped");
  if (skippedLink) skippedLink.onclick = () => { LI.state.workoutId = skipped[skipped.length - 1].workout.id; };

  const exSets = ex.sessions.flatMap((s) => s.sets);
  if (ex.kind === "cardio") {
    LI.lineChart(volC, [{ label: "Time", points: ss.map((s) => ({ x: s.date, y: s.seconds / 60 })) }], { ...xRange, fmt: (v) => `${LI.fmtNum(v)} min` });
  } else if (strength) {
    LI.barChart(volC, LI.bucketStyle(buckets).labels, [{ label: "Volume", values: LI.bucketSum(buckets, exSets, range, (s) => LI.toDisplay(s.volume)).map(Math.round), color: LI.bucketStyle(buckets).color }], { fmt: (v) => `${LI.fmtNum(v, 0)} ${u}` });
  } else {
    LI.barChart(volC, LI.bucketStyle(buckets).labels, [{ label: "Reps", values: LI.bucketSum(buckets, exSets, range, (s) => s.reps), color: LI.bucketStyle(buckets).color }]);
  }
}

function exerciseMetrics(ex, strength, isBW) {
  const u = LI.state.displayUnit, bw = isBW ? " (incl. bodyweight)" : "";
  const all = [
    { id: "e1rm", label: "Estimated 1RM", title: "Estimated 1RM", sub: `${u}, best set per workout${bw}`, weight: true, get: (s) => s.bestE1rm },
    { id: "weight", label: "Best set weight", title: "Best set weight", sub: `${u}, heaviest set per workout${bw}`, weight: true, get: (s) => s.topLoad },
    { id: "reps", label: "Best set reps", title: "Best set reps", sub: "most reps in one set per workout", get: (s) => s.maxReps },
    { id: "volume", label: "Volume per workout", title: "Volume per workout", sub: `${u} × reps${bw}`, weight: true, get: (s) => s.volume },
    { id: "totalReps", label: "Reps per workout", title: "Reps per workout", sub: "all sets added up", get: (s) => s.totalReps },
  ];
  return strength ? all : all.filter((m) => !m.weight);
}

// All-time records, as Liftoff lists them, plus e1RM and heaviest set for loaded exercises.
// ★ marks a record set inside the selected period.
function recordsCard(ex, range, strength, isBW) {
  const sets = ex.sessions.flatMap((s) => s.sets.filter((x) => x.reps > 0));
  const best = (list, f) => list.reduce((b, x) => (f(x) > 0 && (!b || f(x) > f(b)) ? x : b), null);
  const set = (x) => x && x.workout.date, sess = (x) => x && x.date;
  const load = (x) => LI.weightLabel(x);
  const rows = [
    strength && ["Best e1RM", best(sets, (x) => x.e1rm || 0), (x) => LI.fmtWU(x.e1rm), (x) => `${load(x)} × ${x.reps}`, set],
    strength && ["Heaviest set", best(sets, (x) => x.load * 1000 + x.reps), (x) => (isBW ? LI.fmtWU(x.load) : LI.fmtWU(x.kg)), (x) => `${load(x)} × ${x.reps}`, set],
    ["Max set reps", best(sets, (x) => x.reps * 1e6 + x.load), (x) => x.reps, (x) => (x.load > 0 ? `at ${load(x)}` : ""), set],
    ["Max workout reps", best(ex.sessions, (s) => s.totalReps), (s) => s.totalReps, (s) => `${s.sets.length} sets`, sess],
    strength && ["Max set volume", best(sets, (x) => x.volume), (x) => `${LI.fmtVol(x.volume)} ${LI.state.displayUnit}`, (x) => `${load(x)} × ${x.reps}`, set],
    strength && ["Max workout volume", best(ex.sessions, (s) => s.volume), (s) => `${LI.fmtVol(s.volume)} ${LI.state.displayUnit}`, (s) => `${s.sets.length} sets`, sess],
  ].filter((r) => r && r[1]);
  return `<div class="card" style="margin-top:16px">
    <div class="card-head"><h2>Personal records</h2><span class="muted small">all time${range.key === "all" ? "" : ` · ★ = set in the ${range.label.toLowerCase()}`}</span></div>
    <div class="records">${rows.map(([label, x, value, detail, when]) => `<div class="record">
      <div class="label">${label}${LI.inRange(when(x), range) && range.key !== "all" ? ` <span class="pr">★</span>` : ""}</div>
      <div class="value">${value(x)}</div>
      <div class="sub">${[detail(x), LI.fmtShort(when(x))].filter(Boolean).join(" · ")}</div>
    </div>`).join("")}</div>
    ${isBW ? `<p class="muted small" style="margin:8px 0 0">Volume and e1RM include your bodyweight.</p>` : ""}
  </div>`;
}

function repRecords(ex) {
  const byW = new Map();
  for (const s of ex.sessions) for (const set of s.sets) {
    if (set.reps <= 0) continue;
    const key = Math.round(LI.toDisplay(set.kg) * 10) / 10;
    const cur = byW.get(key);
    if (!cur || set.reps > cur.set.reps) byW.set(key, { set, date: s.date });
  }
  const rows = [...byW.entries()].sort((a, b) => b[0] - a[0]);
  return capped("records", `<th class="r">Weight</th><th class="r">Best reps</th><th class="r">e1RM</th><th>Date</th>`,
    rows.map(([w, r]) => `<td class="r">${r.set.bwShare > 0 ? LI.weightLabel(r.set) : w > 0 ? `${LI.fmtNum(w)} ${LI.state.displayUnit}` : "–"}</td><td class="r">${r.set.reps}</td><td class="r">${LI.fmtW(r.set.e1rm)}</td><td>${LI.fmtShort(r.date)}</td>`));
}

// A table showing the first few rows, with a button for the rest. Open/closed is
// remembered per table while the page is open.
const CAP = 5;
function capped(id, head, rows) {
  const open = LI.state.progressShowAll?.[id];
  return `<table class="capped ${open ? "open" : ""}" data-cap="${id}"><thead><tr>${head}</tr></thead><tbody>
    ${rows.map((r, i) => `<tr${i >= CAP ? ' class="more-row"' : ""}>${r}</tr>`).join("")}
  </tbody></table>
  ${rows.length > CAP ? `<button class="btn small ghost cap-btn" data-cap-btn="${id}">${open ? "Show fewer" : `Show all ${rows.length}`}</button>` : ""}`;
}

function bindCapped(el) {
  el.querySelectorAll("[data-cap-btn]").forEach((b) => (b.onclick = () => {
    const id = b.dataset.capBtn;
    const table = el.querySelector(`[data-cap="${id}"]`);
    const open = table.classList.toggle("open");
    LI.state.progressShowAll = { ...LI.state.progressShowAll, [id]: open };
    b.textContent = open ? "Show fewer" : `Show all ${table.tBodies[0].rows.length}`;
  }));
}

function historyTable(ss) {
  return capped("history", `<th>Date</th><th>Sets</th><th class="r">e1RM</th><th class="r">Volume</th>`,
    [...ss].reverse().map((s) => `
      <td>${LI.fmtShort(s.date)}${s.prs.length ? `<br><span class="pr">★ PR ${s.prs.join(", ")}</span>` : ""}</td>
      <td class="num">${s.sets.map((x) => `${x.bwShare > 0 ? (x.kg > 0 ? `+${LI.fmtW(x.kg)}×` : "") : x.kg > 0 ? `${LI.fmtW(x.kg)}×` : ""}${x.reps}${x.edited ? "<sup title=\"edited\">✎</sup>" : ""}`).join(", ")}</td>
      <td class="r">${LI.fmtW(s.bestE1rm)}</td>
      <td class="r">${LI.fmtVol(s.volume)}</td>`));
}

function renderMuscle(el, model, muscle, range) {
  const u = LI.state.displayUnit;
  const buckets = LI.buckets(range);
  const per = buckets.size === "day" ? "Daily" : "Weekly";
  const credit = (s) => {
    const info = LI.exerciseInfo(s.exercise);
    return s.reps <= 0 ? 0 : info.primary.includes(muscle) ? 1 : info.secondary.includes(muscle) ? 0.5 : 0;
  };
  const setsPer = LI.bucketSum(buckets, model.sets, range, credit);
  const volPer = LI.bucketSum(buckets, model.sets, range, (s) => credit(s) * LI.toDisplay(s.volume)).map(Math.round);

  const inRange = [...model.exercises.values()]
    .map((ex) => {
      const role = ex.info.primary.includes(muscle) ? "Primary" : ex.info.secondary.includes(muscle) ? "Secondary" : null;
      const ss = ex.sessions.filter((s) => LI.inRange(s.date, range));
      const sets = ss.reduce((t, s) => t + s.sets.length, 0);
      return role && sets && { ex, ss, role, sets, credit: sets * (role === "Primary" ? 1 : 0.5), last: ss[ss.length - 1].date };
    })
    .filter(Boolean)
    .sort((a, b) => b.credit - a.credit);

  // Strength index: each primary exercise's e1RM relative to its first session in the period (= 100).
  const indexed = inRange
    .filter((c) => c.role === "Primary" && c.ss.filter((s) => s.bestE1rm).length >= 2)
    .slice(0, 4)
    .map((c) => {
      const ss = c.ss.filter((s) => s.bestE1rm);
      return { label: c.ex.name, points: ss.map((s) => ({ x: s.date, y: (s.bestE1rm / ss[0].bestE1rm) * 100 })) };
    });
  const { lo, hi } = LI.targetFor(muscle);

  el.innerHTML = `
    <div class="grid cols-2">
      <div class="card"><div class="card-head"><h2>${per} sets: ${muscle}</h2><span class="muted small">primary = 1, secondary = ½${buckets.size === "week" ? ` · green band = your ${lo}–${hi} target` : ""}</span></div><div class="chart-box"><canvas id="c-msets"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>${per} volume: ${muscle}</h2><span class="muted small">${u} × reps, same weighting</span></div><div class="chart-box"><canvas id="c-mvol"></canvas></div></div>
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2>Strength trend</h2><span class="muted small">e1RM indexed, first session in period = 100</span></div>
        <div class="chart-box">${indexed.length ? `<canvas id="c-midx"></canvas>` : `<p class="muted">Needs at least two sessions of a primary ${muscle} exercise in this period.</p>`}</div></div>
      <div class="card"><h2>Exercises hitting ${muscle}</h2><p class="muted small">${range.label}</p><div class="table-wrap">
        ${inRange.length ? `<table><thead><tr><th>Exercise</th><th>Role</th><th class="r">Sets</th><th class="r">Credit</th><th>Last done</th></tr></thead><tbody>
        ${inRange.map((c) => `<tr class="row-link" data-ex="${LI.esc(c.ex.name)}" tabindex="0" title="Open ${LI.esc(c.ex.name)}"><td><a href="#progress">${LI.esc(c.ex.name)}</a></td><td>${c.role}</td><td class="r">${c.sets}</td><td class="r">${LI.fmtNum(c.credit)}</td><td>${LI.fmtShort(c.last)}</td></tr>`).join("")}
        </tbody></table>` : `<p class="muted">Nothing in this period trains ${muscle}.</p>`}
      </div></div>
    </div>`;

  el.querySelectorAll(".row-link").forEach((row) => {
    const open = (e) => {
      e.preventDefault();
      Object.assign(LI.state, { progressMode: "exercise", progressExercise: row.dataset.ex, progressFromMuscle: muscle, progressBackTo: "progress" });
      LI.render();
    };
    row.onclick = open;
    row.onkeydown = (e) => { if (e.key === "Enter") open(e); };
  });

  const { labels, color } = LI.bucketStyle(buckets);
  LI.barChart(el.querySelector("#c-msets"), labels, [{ label: "Sets", values: setsPer, color }],
    buckets.size === "week" ? { plugins: [LI.bandPlugin(lo, hi)], suggestedMax: lo + 2 } : {});
  LI.barChart(el.querySelector("#c-mvol"), labels, [{ label: "Volume", values: volPer, color }], { fmt: (v) => `${LI.fmtNum(v, 0)} ${u}` });
  if (indexed.length) LI.lineChart(el.querySelector("#c-midx"), indexed, { xMin: range.from, xMax: range.to, yMin: 80, fmt: (v) => LI.fmtNum(v, 0) });
}
