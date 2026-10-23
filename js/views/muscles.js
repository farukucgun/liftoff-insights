window.LI = window.LI || {};
LI.views = LI.views || {};


LI.TARGET_MAX = 21; // slider range, sets/week

// Weekly-average weighted sets per muscle over a window ending today.
LI.muscleWindow = (model, windowKey) => {
  const today = new Date();
  const days = windowKey === "all" ? Math.max(7, LI.daysBetween(model.first, today) + 1) : +windowKey;
  const from = LI.startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1));
  const sets = model.sets.filter((s) => s.workout.date >= from);
  const totals = LI.muscleSets(sets);
  const perWeek = Object.fromEntries(Object.entries(totals).map(([m, v]) => [m, (v / days) * 7]));
  return { days, from, totals, perWeek, sets };
};

// A muscle's own weekly target if it has one, else the default for all muscles.
LI.targetFor = (m) => LI.state.muscleTargets[m] || LI.state.target;

LI.muscleStatus = (m, perWeek) => {
  const { lo, hi } = LI.targetFor(m);
  return perWeek < lo / 2 ? ["neglected", "Neglected"] : perWeek < lo ? ["under", "Low"] : perWeek <= hi ? ["ok", "On target"] : ["high", "High"];
};

const rangeSlider = (id, { lo, hi }, what) => `
  <div class="range2" id="${id}">
    <div class="track"></div><div class="fill"></div>
    <input type="range" min="0" max="${LI.TARGET_MAX}" step="1" value="${lo}" data-end="lo" aria-label="${what} minimum sets per week">
    <input type="range" min="0" max="${LI.TARGET_MAX}" step="1" value="${hi}" data-end="hi" aria-label="${what} maximum sets per week">
  </div>`;

const paintSlider = (slider, { lo, hi }) => {
  const fill = slider.querySelector(".fill");
  fill.style.left = `${(lo / LI.TARGET_MAX) * 100}%`;
  fill.style.width = `${((hi - lo) / LI.TARGET_MAX) * 100}%`;
};

// Wires a dual slider to a { lo, hi } object; onInput runs while dragging, onCommit on release.
const bindSlider = (slider, get, onInput, onCommit) => {
  slider.querySelectorAll("input").forEach((input) => {
    input.oninput = () => {
      const t = get(), v = +input.value;
      if (input.dataset.end === "lo") t.lo = Math.min(v, t.hi - 1);
      else t.hi = Math.max(v, t.lo + 1);
      input.value = t[input.dataset.end];
      onInput(t);
    };
    input.onchange = onCommit;
  });
};

LI.STATUS_FILL = { neglected: "--critical", under: "--serious", ok: "--good", high: "--over" };

LI.lastTrained = (model) => {
  const last = {};
  for (const s of model.sets) for (const m of LI.exerciseInfo(s.exercise).primary) {
    if (!last[m] || s.workout.date > last[m]) last[m] = s.workout.date;
  }
  return last;
};

LI.balanceRatios = (totals) => {
  const sum = (ms) => ms.reduce((a, m) => a + (totals[m] || 0), 0);
  const upper = LI.MUSCLES.filter((m) => !LI.MUSCLE_GROUPS.legs.includes(m) && m !== "Abs" && m !== "Lower Back");
  // aM / bM: the muscles on each side, used to suggest exercises.
  return [
    { name: "Push : Pull", aM: LI.MUSCLE_GROUPS.push, bM: LI.MUSCLE_GROUPS.pull, lo: 0.8, hi: 1.25, hint: "Aim for roughly equal. Too much push is linked to rounded shoulders." },
    { name: "Chest : Back", aM: ["Chest"], bM: ["Lats", "Upper Back"], lo: 0.5, hi: 1.0, hint: "Back usually gets as much or more work than chest." },
    { name: "Front : Rear delts", aM: ["Front Delts"], bM: ["Rear Delts"], lo: 0.5, hi: 1.5, hint: "Front delts also get hit by all pressing." },
    { name: "Quads : Hams + Glutes", aM: ["Quads"], bM: ["Hamstrings", "Glutes"], lo: 0.6, hi: 1.5, hint: "Keep the back of the legs from falling behind." },
    { name: "Upper : Lower body", aM: upper, bM: LI.MUSCLE_GROUPS.legs, lo: 1, hi: 2.5, hint: "Upper body has more muscles, so 1.5–2× is normal." },
  ].map((r) => ({ ...r, a: sum(r.aM), b: sum(r.bM) }));
};

// Up to three program exercises whose primary muscles are on one side of a ratio.
const exercisesFor = (muscles) => {
  const names = LI.PROGRAM.days.flatMap((d) => d.items.filter((s) => s.primary.some((m) => muscles.includes(m))).map((s) => s.ex));
  return [...new Set(names)].slice(0, 3);
};

// What to change to bring a ratio into range: add sets to the side that's behind.
// Adding rather than cutting, since most muscles are below target anyway.
LI.balanceAdvice = (r, weeks) => {
  const [left, right] = r.name.split(" : ");
  const add = (side, muscles, sets) => {
    const perWeek = Math.max(1, Math.ceil(sets / weeks));
    const ex = exercisesFor(muscles);
    return `Add ~${perWeek} set${perWeek === 1 ? "" : "s"}/week for ${side.toLowerCase()}${ex.length ? `: ${ex.join(", ")}` : ""}.`;
  };
  if (!r.a && !r.b) return "Nothing logged on either side yet.";
  if (!r.b) return add(right, r.bM, r.a / r.hi);
  const ratio = r.a / r.b;
  if (ratio < r.lo) return add(left, r.aM, r.lo * r.b - r.a);
  if (ratio > r.hi) return add(right, r.bM, r.a / r.hi - r.b);
  return "Keep the current split.";
};

LI.views.muscles = (el, model) => {
  const st = LI.state;
  st.mapColor = st.mapColor || "volume";
  st.muscleSort = st.muscleSort || "sets";
  const win = LI.muscleWindow(model, st.periods.muscles);
  const last = LI.lastTrained(model);
  const flagged = [...model.exercises.values()].filter((e) => e.info.source === "guess" || e.info.source === "none");
  if (st.selectedMuscle === undefined) st.selectedMuscle = [...LI.MUSCLES].sort((a, b) => win.perWeek[a] - win.perWeek[b])[0];

  el.innerHTML = `<div class="m-root">
    <div class="toolbar">
      ${LI.periodSelect("m-window", st.periods.muscles)}
      <div class="target-ctl">
        <span title="Used by every muscle that doesn't have its own target">Default target</span>
        ${rangeSlider("m-target", st.target, "Default target")}
        <strong class="num" id="m-target-label"></strong>
        <button class="btn small ghost" id="m-target-reset" title="Reset the default to ${LI.DEFAULT_TARGET.lo}–${LI.DEFAULT_TARGET.hi}">Reset</button>
        <span class="muted small" id="m-target-own"></span>
      </div>
      <span class="muted small">${win.sets.length} sets in window · weekly average · primary = 1 set, secondary = ½ · pick a muscle to set its own target</span>
    </div>
    ${flagged.length ? `<div class="banner" style="margin:0 0 16px">Muscles for ${flagged.map((e) => `<strong>${LI.esc(e.name)}</strong>${e.info.source === "guess" ? " (guessed)" : " (unmapped)"}`).join(", ")}: check them in “Edit exercise mapping” below.</div>` : ""}

    <div class="card">
      <div class="card-head">
        <h2>Body map</h2>
        <div class="seg-btns" role="group" aria-label="Color by">
          <button class="btn small ${st.mapColor === "volume" ? "on" : ""}" data-color="volume">Sets per week</button>
          <button class="btn small ${st.mapColor === "status" ? "on" : ""}" data-color="status">Vs target</button>
        </div>
      </div>
      <div class="map-layout">
        <div id="m-map"></div>
        <div id="m-detail"></div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head">
        <h2>Sets per week by muscle</h2>
        <div class="seg-btns" role="group" aria-label="Sort muscles">
          ${[["sets", "Most sets"], ["gap", "Furthest below target"], ["last", "Longest since trained"]].map(([k, l]) => `<button class="btn small ${st.muscleSort === k ? "on" : ""}" data-msort="${k}">${l}</button>`).join("")}
        </div>
      </div>
      <div class="mbar-row mbar-head muted small"><div>Muscle</div><div id="m-bars-note"></div><div>Status</div><div class="r">Last trained</div></div>
      <div id="m-bars"></div>
    </div>

    <div class="card" style="margin-top:16px">
        <h2>Balance</h2>
        ${(() => {
          const rows = LI.balanceRatios(win.totals).map((r) => {
            const ratio = r.b ? r.a / r.b : null;
            const [cls, label] = ratio == null ? (r.a ? ["high", "Only one side"] : ["info", "No data"]) : ratio < r.lo ? ["under", "Low"] : ratio > r.hi ? ["high", "High"] : ["ok", "Balanced"];
            return { r, ratio, cls, label, advice: LI.balanceAdvice(r, win.days / 7) };
          });
          return `<div class="table-wrap desk-only"><table><thead><tr><th>Ratio</th><th class="r">Sets</th><th class="r">Ratio</th><th class="r">Aim</th><th></th><th>What to do</th></tr></thead><tbody>
          ${rows.map(({ r, ratio, cls, label, advice }) => `<tr><td>${r.name}<div class="muted small">${r.hint}</div></td><td class="r" style="white-space:nowrap">${LI.fmtNum(r.a)} : ${LI.fmtNum(r.b)}</td><td class="r">${ratio == null ? "–" : LI.fmtNum(ratio, 2)}</td>
            <td class="r muted" style="white-space:nowrap">${r.lo}–${r.hi}</td><td><span class="pill ${cls}">${label}</span></td><td class="small">${advice}</td></tr>`).join("")}
          </tbody></table></div>
          <div class="bal-cards mob-only">${rows.map(({ r, ratio, cls, label, advice }) => `<div class="bc">
            <div class="bc-head"><strong>${r.name}</strong><span class="pill ${cls}">${label}</span></div>
            <div class="bc-nums"><span class="num">${LI.fmtNum(r.a)} : ${LI.fmtNum(r.b)}</span> sets · ratio <strong class="num">${ratio == null ? "–" : LI.fmtNum(ratio, 2)}</strong> <span class="muted">(aim ${r.lo}–${r.hi})</span></div>
            <div class="muted small">${r.hint}</div>
            ${cls === "ok" ? "" : `<div class="bc-todo">${advice}</div>`}
          </div>`).join("")}</div>`;
        })()}
    </div>

    <details class="card" style="margin-top:16px" id="map-editor">
      <summary><strong>Edit exercise mapping</strong> <span class="muted small">— change which muscles an exercise counts for</span></summary>
      <div id="map-editor-body" style="margin-top:12px"></div>
    </details></div>`;
  const root = el.firstElementChild; // listeners live on this, so they go away with the next render

  // Everything that depends on the targets or selection is painted here, so a
  // slider can update live without re-rendering (and losing) itself. While the
  // muscle's own slider is dragged, the detail panel only updates in place.
  const paint = ({ keepDetail = false } = {}) => {
    const { lo, hi } = st.target;
    const max = Math.max(...LI.MUSCLES.map((m) => LI.targetFor(m).hi * 1.15), ...Object.values(win.perWeek));
    el.querySelector("#m-target-label").textContent = `${lo}–${hi} sets/wk`;
    paintSlider(el.querySelector("#m-target"), st.target);
    const own = Object.keys(st.muscleTargets).length;
    el.querySelector("#m-target-own").innerHTML = own ? `${own} muscle${own === 1 ? " has its" : "s have their"} own · <button class="link-btn" id="m-target-clear">use default for all</button>` : "";
    el.querySelector("#m-bars-note").innerHTML = `Sets/week (bar) against the target range (shaded, min–max) · <span class="own-dot">●</span> = muscle's own target`;

    const days = (m) => (last[m] ? LI.daysBetween(last[m], new Date()) : Infinity);
    const gap = (m) => win.perWeek[m] - LI.targetFor(m).lo;
    const order = {
      sets: (a, b) => win.perWeek[b] - win.perWeek[a],
      gap: (a, b) => gap(a) - gap(b),
      last: (a, b) => days(b) - days(a),
    }[st.muscleSort];
    const pct = (x) => `${Math.min(100, (x / max) * 100)}%`;
    el.querySelector("#m-bars").innerHTML = [...LI.MUSCLES].sort(order).map((m) => {
      const v = win.perWeek[m];
      const [cls, label] = LI.muscleStatus(m, v);
      const { lo, hi } = LI.targetFor(m);
      const own = st.muscleTargets[m];
      const d = last[m] ? LI.daysBetween(last[m], new Date()) : null;
      const dCls = d == null || d > 14 ? "neglected" : d > 7 ? "under" : "ok";
      return `<div class="mbar-row ${m === st.selectedMuscle ? "sel" : ""}" data-muscle="${m}" title="${m}: ${LI.fmtNum(v)} sets/week, target ${lo}–${hi}${own ? " (its own)" : " (default)"}">
        <div>${m}${own ? ` <span class="own-dot" aria-label="own target">●</span>` : ""}</div>
        <div class="mbar-cell">
          <div class="mbar-track">
            <div class="mbar-band" style="left:${pct(lo)};width:calc(${pct(hi)} - ${pct(lo)})"></div>
            <div class="mbar-fill" style="width:${pct(v)}"></div>
            <span class="mbar-v num" style="left:${pct(v)}">${LI.fmtNum(v)}</span>
            <span class="mbar-tick num" style="left:${pct(lo)}">${lo}</span>
            <span class="mbar-tick num" style="left:${pct(hi)}">${hi}</span>
          </div>
        </div>
        <div><span class="pill ${cls}">${label}</span></div>
        <div class="r small"><span class="pill ${dCls}" title="Last trained as a primary muscle">${d == null ? (v > 0 ? "not directly" : "never") : d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"}`}</span></div>
      </div>`;
    }).join("");

    el.querySelector("#m-map").innerHTML = LI.bodyMap(win.perWeek, st.mapColor, st.selectedMuscle);
    if (keepDetail) return paintDetailTarget();
    if (!st.selectedMuscle) {
      el.querySelector("#m-detail").innerHTML = noMuscleDetail(win);
      return;
    }
    el.querySelector("#m-detail").innerHTML = muscleDetail(model, win, last, st.selectedMuscle);
    paintDetailTarget();
    bindDetailTarget();
    const link = el.querySelector("#m-to-progress");
    if (link) link.onclick = (e) => {
      e.preventDefault();
      st.progressMode = "muscle";
      st.progressMuscle = st.selectedMuscle;
      location.hash = "progress";
    };
  };

  // The selected muscle's own target, in the detail panel.
  const paintDetailTarget = () => {
    const m = st.selectedMuscle, v = win.perWeek[m];
    const t = LI.targetFor(m), own = !!st.muscleTargets[m];
    const [cls, label] = LI.muscleStatus(m, v);
    const q = (sel) => el.querySelector(`#m-detail ${sel}`);
    q(".md-status").className = `md-status pill ${cls}`;
    q(".md-status").textContent = label;
    q(".md-gap").textContent = v < t.lo ? `${LI.fmtNum(t.lo - v)} more sets/week to reach the target.` : v > t.hi ? `${LI.fmtNum(v - t.hi)} sets/week above the target.` : "Within the target.";
    q(".md-target-label").textContent = `${t.lo}–${t.hi} sets/wk`;
    q(".md-target-src").textContent = own ? "own target" : "using the default";
    q(".md-target-reset").hidden = !own;
    paintSlider(q("#md-target"), t);
  };
  const bindDetailTarget = () => {
    const m = st.selectedMuscle;
    bindSlider(el.querySelector("#md-target"),
      // The first drag copies the default into a target of the muscle's own.
      () => (st.muscleTargets[m] = st.muscleTargets[m] || { ...st.target }),
      () => paint({ keepDetail: true }),
      () => LI.store.set("li.muscleTargets", st.muscleTargets));
    el.querySelector("#m-detail .md-target-reset").onclick = () => {
      delete st.muscleTargets[m];
      LI.store.set("li.muscleTargets", st.muscleTargets);
      paint();
    };
  };

  paint();

  // Hover links a muscle across the map, bars and table; click selects it.
  const highlight = (m) => el.querySelectorAll("[data-muscle]").forEach((n) => n.classList.toggle("hl", n.dataset.muscle === m));
  root.addEventListener("mouseover", (e) => highlight(e.target.closest("[data-muscle]")?.dataset.muscle));
  root.addEventListener("mouseleave", () => highlight(null));
  // Exercise rows in the detail panel open that exercise on Progress, same period.
  const openExercise = (row) => {
    Object.assign(st, { progressMode: "exercise", progressExercise: row.dataset.ex, progressFromMuscle: st.selectedMuscle, progressBackTo: "muscles" });
    st.periods.progress = st.periods.muscles;
    LI.store.set("li.periods", st.periods);
    location.hash = "progress";
  };
  root.addEventListener("keydown", (e) => {
    const row = e.target.closest("tr.row-link");
    if (row && e.key === "Enter") openExercise(row);
  });
  root.addEventListener("click", (e) => {
    const row = e.target.closest("tr.row-link");
    if (row) { e.preventDefault(); return openExercise(row); }
    const m = e.target.closest("[data-muscle]")?.dataset.muscle;
    // Clicking a muscle selects it (again: deselects); clicking empty space deselects.
    if (m) {
      select(m === st.selectedMuscle ? null : m);
      // Stacked layout (phones): the details are below the body map, so bring them into view.
      if (st.selectedMuscle && matchMedia("(max-width: 900px)").matches && !e.target.closest("#m-detail")) {
        el.querySelector("#m-detail").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else if (!e.target.closest("#m-detail, #map-editor, .toolbar, button, input, select, a, summary, label")) select(null);
  });
  const select = (m) => {
    if (m === st.selectedMuscle) return;
    st.selectedMuscle = m;
    paint();
    highlight(m);
  };
  root.tabIndex = -1; // lets Esc work without focusing a control first
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !e.target.closest("input, select")) select(null);
  });

  bindSlider(el.querySelector("#m-target"), () => st.target, () => paint(), () => LI.store.set("li.target", st.target));
  el.querySelector("#m-target-reset").onclick = () => {
    st.target = { ...LI.DEFAULT_TARGET };
    LI.store.set("li.target", st.target);
    LI.render();
  };
  root.addEventListener("click", (e) => {
    if (!e.target.closest("#m-target-clear")) return;
    st.muscleTargets = {};
    LI.store.set("li.muscleTargets", st.muscleTargets);
    paint();
  });

  el.querySelectorAll("[data-msort]").forEach((b) => (b.onclick = () => { st.muscleSort = b.dataset.msort; LI.render(); }));
  el.querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => { st.mapColor = b.dataset.color; LI.render(); }));
  el.querySelector("#m-window").onchange = (e) => LI.setPeriod("muscles", e.target.value);
  renderMapEditor(el.querySelector("#map-editor-body"), model, flagged[0]?.name);
  if (flagged.length || st.mapEditorOpen) el.querySelector("#map-editor").open = true;
};

function noMuscleDetail(win) {
  const behind = [...LI.MUSCLES]
    .map((m) => ({ m, gap: win.perWeek[m] - LI.targetFor(m).lo }))
    .filter((x) => x.gap < 0)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 3);
  return `
    <h2>No muscle selected</h2>
    <p class="muted">Click a muscle on the map or in the list below to see its sets, target and exercises.</p>
    ${behind.length ? `<h3>Furthest below target</h3>
      <table><tbody>${behind.map(({ m, gap }) => `<tr class="pick-row" data-muscle="${m}"><td><a href="#muscles">${m}</a></td><td class="r num down">−${LI.fmtNum(-gap)}/wk</td></tr>`).join("")}</tbody></table>` : ""}`;
}

function muscleDetail(model, win, last, m) {
  const v = win.perWeek[m];
  const d = last[m] ? LI.daysBetween(last[m], new Date()) : null;
  const byEx = new Map();
  for (const s of win.sets) {
    if (s.reps <= 0) continue;
    const info = LI.exerciseInfo(s.exercise);
    const role = info.primary.includes(m) ? "Primary" : info.secondary.includes(m) ? "Secondary" : null;
    if (!role) continue;
    const cur = byEx.get(s.exercise) || { role, sets: 0 };
    cur.sets++;
    byEx.set(s.exercise, cur);
  }
  const rows = [...byEx.entries()].sort((a, b) => b[1].sets * (b[1].role === "Primary" ? 1 : 0.5) - a[1].sets * (a[1].role === "Primary" ? 1 : 0.5));
  // Status, gap and target values are filled in by paintDetailTarget.
  return `
    <h2>${m}</h2>
    <div class="detail-big"><span class="num">${LI.fmtNum(v)}</span> <span class="muted">sets/week</span> <span class="md-status pill"></span></div>
    <div class="target-ctl md-target">
      <span>Target</span>
      ${rangeSlider("md-target", LI.targetFor(m), `${m} target`)}
      <strong class="num md-target-label"></strong>
    </div>
    <p class="muted small md-target-line"><span class="md-target-src"></span> <button class="link-btn md-target-reset" hidden>use default (${LI.state.target.lo}–${LI.state.target.hi})</button></p>
    <p class="muted"><span class="md-gap"></span><br>Last trained directly: ${d == null ? "never" : d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"} ago`}.</p>
    <h3>Exercises in this window</h3>
    ${rows.length ? `<table><thead><tr><th>Exercise</th><th>Role</th><th class="r">Sets</th></tr></thead><tbody>
      ${rows.map(([name, r]) => `<tr class="row-link" data-ex="${LI.esc(name)}" tabindex="0" title="Open ${LI.esc(name)} on Progress"><td><a href="#progress">${LI.esc(name)}</a></td><td>${r.role}</td><td class="r">${r.sets}</td></tr>`).join("")}
    </tbody></table>` : `<p class="muted">None.</p>`}
    <p><a href="#progress" id="m-to-progress">See ${m} over time →</a></p>`;
}

function renderMapEditor(el, model, preselect) {
  const st = LI.state;
  const names = [...model.exercises.keys()].sort();
  const current = st.mapEditorExercise && names.includes(st.mapEditorExercise) ? st.mapEditorExercise : preselect || names[0];
  const info = LI.exerciseInfo(current);
  const roleOf = (m) => (info.primary.includes(m) ? "primary" : info.secondary.includes(m) ? "secondary" : "");

  el.innerHTML = `
    <div class="toolbar">
      <select id="me-ex">${names.map((n) => `<option ${n === current ? "selected" : ""}>${LI.esc(n)}</option>`).join("")}</select>
      <span class="muted small">Source: ${{ map: "built-in", custom: "your edit", guess: "guessed from name", none: "unmapped" }[info.source]}</span>
      ${info.source === "custom" ? `<button class="btn small" id="me-reset">Reset to built-in</button>` : ""}
    </div>
    <div class="table-wrap"><table><thead><tr><th>Muscle</th><th>Primary</th><th>Secondary</th><th>Not used</th></tr></thead><tbody>
      ${LI.MUSCLES.map((m) => `<tr><td>${m}</td>${["primary", "secondary", ""].map((r) => `<td><input type="radio" name="me-${m}" value="${r}" ${roleOf(m) === r ? "checked" : ""}></td>`).join("")}</tr>`).join("")}
    </tbody></table></div>
    <div class="toolbar" style="margin-top:12px"><button class="btn primary" id="me-save">Save mapping</button></div>`;

  el.querySelector("#me-ex").onchange = (e) => { st.mapEditorExercise = e.target.value; st.mapEditorOpen = true; LI.render(); };
  el.querySelector("#me-save").onclick = () => {
    const primary = [], secondary = [];
    for (const m of LI.MUSCLES) {
      const v = el.querySelector(`input[name="me-${m}"]:checked`)?.value;
      if (v === "primary") primary.push(m);
      if (v === "secondary") secondary.push(m);
    }
    st.muscleOverrides[current] = { primary, secondary, bw: info.bw };
    LI.store.set("li.muscleOverrides", st.muscleOverrides);
    st.mapEditorExercise = current;
    st.mapEditorOpen = true;
    LI.rebuild();
  };
  const reset = el.querySelector("#me-reset");
  if (reset) reset.onclick = () => {
    delete st.muscleOverrides[current];
    LI.store.set("li.muscleOverrides", st.muscleOverrides);
    st.mapEditorOpen = true;
    LI.rebuild();
  };
}

// ---------- body map ----------
// Shapes are drawn for the viewer's left half of the figure (x < 130) and mirrored.
// The figure sits in x 50..210; labels go in the margins on either side.

const LEFT = {
  front: {
    "Side Delts":  "M88,84 Q68,86 62,110 Q66,116 72,112 Q74,96 90,90 Z",
    "Front Delts": "M93,88 Q79,94 74,113 Q83,120 92,112 Q98,99 97,89 Z",
    Chest:         "M99,90 Q114,84 128,88 L128,126 Q112,134 99,124 Q93,108 99,90 Z",
    Biceps:        "M73,118 Q64,140 65,162 Q71,168 77,160 Q85,140 84,120 Z",
    Forearms:      "M63,172 Q56,204 54,232 Q60,238 65,233 Q72,204 77,174 Z",
    Quads:         "M100,236 Q95,280 107,314 Q116,321 124,312 Q130,276 128,240 Z",
    Calves:        "M110,330 Q105,360 112,388 L120,388 Q125,360 122,330 Z",
  },
  back: {
    Lats:          "M96,104 Q89,142 104,190 Q117,184 124,160 L126,142 L112,140 Q100,124 96,104 Z",
    "Rear Delts":  "M93,86 Q76,90 72,108 Q82,117 94,106 Q99,95 97,88 Z",
    "Side Delts":  "M88,84 Q68,86 62,110 Q66,116 72,112 Q74,96 90,90 Z",
    Triceps:       "M73,116 Q64,140 65,164 Q72,169 78,161 Q86,140 85,118 Z",
    Forearms:      "M63,172 Q56,204 54,232 Q60,238 65,233 Q72,204 77,174 Z",
    Glutes:        "M100,214 Q93,240 104,258 Q120,265 129,252 L129,216 Z",
    Hamstrings:    "M102,262 Q97,292 108,318 Q116,322 124,316 Q130,288 128,262 Z",
    Calves:        "M106,326 Q98,350 108,374 Q116,378 124,370 Q128,346 122,326 Z",
  },
};

const CENTER = {
  front: { Abs: "M112,140 Q112,132 120,132 L140,132 Q148,132 148,140 L148,200 Q148,210 138,210 L122,210 Q112,210 112,200 Z" },
  back: {
    "Upper Back": "M114,62 L146,62 L168,86 Q160,116 148,140 L112,140 Q100,116 92,86 Z",
    "Lower Back": "M114,160 L146,160 Q150,190 152,214 L108,214 Q110,190 114,160 Z",
  },
};

// [muscle, side, label y, target x, target y]
const LABELS = {
  front: [
    ["Side Delts", "l", 84, 66, 100], ["Front Delts", "l", 108, 84, 104], ["Biceps", "l", 140, 75, 140],
    ["Forearms", "l", 204, 65, 204], ["Quads", "l", 276, 112, 276], ["Calves", "l", 358, 116, 358],
    ["Chest", "r", 106, 146, 108], ["Abs", "r", 170, 140, 170],
  ],
  back: [
    ["Rear Delts", "l", 100, 84, 100], ["Triceps", "l", 140, 75, 140], ["Forearms", "l", 204, 65, 204],
    ["Glutes", "l", 238, 112, 238], ["Hamstrings", "l", 290, 114, 290], ["Calves", "l", 350, 114, 350],
    ["Upper Back", "r", 74, 150, 82], ["Side Delts", "r", 104, 194, 100], ["Lats", "r", 150, 154, 150],
    ["Lower Back", "r", 192, 140, 192],
  ],
};

const SILHOUETTE_LEFT = `
  <path d="M90,84 Q70,84 64,104 L60,168 L52,236 Q50,262 58,266 Q66,266 66,240 L76,172 L84,128 Q86,100 92,90 Z"/>
  <path d="M96,226 L130,232 L127,320 L124,398 Q118,410 106,406 L108,320 Q92,280 96,226 Z"/>
  <ellipse cx="107" cy="40" rx="3.5" ry="7"/>`;

LI.bodyMap = (perWeek, colorMode, selected) => {
  // The colour scale tops out at the busiest muscle (at least 5 sets) so the
  // gradient spans the data instead of everything sitting in the darkest shade.
  const hi = Math.max(5, Math.ceil(Math.max(...Object.values(perWeek))));
  const fillFor = (m) => {
    const v = perWeek[m] || 0;
    if (colorMode === "status") return `var(${LI.STATUS_FILL[LI.muscleStatus(m, v)[0]]})`;
    return LI.seqColorSmooth(v / hi);
  };
  const muscle = (m, d) =>
    `<path class="m${m === selected ? " sel" : ""}" data-muscle="${m}" d="${d}" style="fill:${fillFor(m)}"><title>${m}: ${LI.fmtNum(perWeek[m] || 0)} sets/week</title></path>`;

  const figure = (view) => {
    const left = Object.entries(LEFT[view]).map(([m, d]) => muscle(m, d)).join("");
    const center = Object.entries(CENTER[view]).map(([m, d]) => muscle(m, d)).join("");
    const head = view === "front"
      ? `<path class="hair" d="M108,32 Q108,10 130,10 Q152,10 152,32 Q142,20 130,22 Q118,20 108,32 Z"/>
         <circle class="face" cx="121" cy="38" r="2.2"/><circle class="face" cx="139" cy="38" r="2.2"/>
         <path class="face-line" d="M130,42 L128,50 L132,50"/><path class="face-line" d="M124,56 Q130,59 136,56"/>`
      : `<path class="hair" d="M108,40 Q107,10 130,10 Q153,10 152,40 Q150,56 130,58 Q110,56 108,40 Z"/>`;
    const decor = view === "front"
      ? `<path class="decor" d="M130,134 L130,208 M113,156 L147,156 M113,180 L147,180"/>
         <path class="decor" d="M130,90 L130,126"/>`
      : `<path class="decor" d="M130,66 L130,212"/>`;
    const labels = LABELS[view].map(([m, side, y, tx, ty]) => {
      const lx = side === "l" ? 34 : 226;
      return `<g class="lbl${m === selected ? " sel" : ""}" data-muscle="${m}">
        <path class="leader" d="M${side === "l" ? lx + 4 : lx - 4},${y} L${tx},${ty}"/><circle class="leader-dot" cx="${tx}" cy="${ty}" r="2"/>
        <text x="${lx}" y="${y + 4}" text-anchor="${side === "l" ? "end" : "start"}">${m} <tspan class="v">${LI.fmtNum(perWeek[m] || 0)}</tspan></text>
      </g>`;
    }).join("");
    const [sideL, sideR] = view === "front" ? ["R", "L"] : ["L", "R"];
    return `<figure class="body-fig">
      <svg viewBox="-70 0 400 428" role="img" aria-label="${view} view">
        <g class="base">
          <ellipse cx="130" cy="38" rx="22" ry="27"/>
          <rect x="119" y="58" width="22" height="28"/>
          <path d="M92,82 Q130,72 168,82 L172,100 Q166,160 160,206 L164,230 L96,230 L100,206 Q94,160 88,100 Z"/>
          ${SILHOUETTE_LEFT}<g transform="translate(260,0) scale(-1,1)">${SILHOUETTE_LEFT}</g>
          <ellipse cx="114" cy="${view === "front" ? 410 : 405}" rx="${view === "front" ? 11 : 7}" ry="5"/>
          <ellipse cx="146" cy="${view === "front" ? 410 : 405}" rx="${view === "front" ? 11 : 7}" ry="5"/>
        </g>
        ${head}
        ${left}<g transform="translate(260,0) scale(-1,1)">${left}</g>
        ${center}
        ${decor}
        <text class="side" x="40" y="260" text-anchor="middle">${sideL}</text>
        <text class="side" x="220" y="260" text-anchor="middle">${sideR}</text>
        ${labels}
      </svg>
      <figcaption><strong>${view === "front" ? "Front" : "Back"}</strong> <span class="muted">${view === "front" ? "· facing you" : "· seen from behind"}</span></figcaption>
    </figure>`;
  };

  const legend = colorMode === "status"
    ? `<div class="map-legend">${[["neglected", "Neglected"], ["under", "Low"], ["ok", "On target"], ["high", "High"]].map(([c, l]) => `<span class="pill ${c}">${l}</span>`).join(" ")}</div>`
    : `<div class="map-legend" title="Absolute sets/week; the lightest shade is your busiest muscle (${hi}/week). Hover a muscle for its number.">Fewer sets ${[0.01, 0.2, 0.4, 0.6, 0.8, 1].map((t) => `<span class="swatch" style="background:${LI.seqColorSmooth(t)}"></span>`).join("")} More sets</div>`;
  return `<div class="body-map">${figure("front")}${figure("back")}</div>${legend}`;
};
