window.LI = window.LI || {};
LI.views = LI.views || {};

LI.views.workouts = (el, model) => {
  const st = LI.state;
  const ws = [...model.workouts].reverse();
  if (!st.workoutId || !ws.some((w) => w.id === st.workoutId)) st.workoutId = ws[0].id;
  const w = ws.find((x) => x.id === st.workoutId);
  // Program day label, only for workouts since the program start.
  const start = LI.programStart();
  const dayOf = (x) => (start && x.date >= start ? LI.classifyWorkout(x)?.day.name : null);

  el.innerHTML = `
    ${fixIssuesCard(model)}
    <div class="wk-layout">
      <div class="wk-picker mob-only">
        <button class="btn" data-step="1" aria-label="Older workout" ${ws.indexOf(w) === ws.length - 1 ? "disabled" : ""}>‹</button>
        <select id="wk-select" aria-label="Workout">${ws.map((x) => `<option value="${LI.esc(x.id)}" ${x === w ? "selected" : ""}>${LI.fmtDate(x.date, { weekday: "short", day: "numeric", month: "short" })}${dayOf(x) ? ` · ${dayOf(x)}` : x.name ? ` · ${LI.esc(x.name)}` : ""} · ${x.sets.length} sets</option>`).join("")}</select>
        <button class="btn" data-step="-1" aria-label="Newer workout" ${ws.indexOf(w) === 0 ? "disabled" : ""}>›</button>
      </div>
      <div class="card wk-list">
        ${ws.map((x) => `
          <button class="wk-item ${x.id === w.id ? "active" : ""}" data-id="${LI.esc(x.id)}">
            <div><strong>${LI.fmtDate(x.date, { weekday: "short", day: "numeric", month: "short" })}</strong>${x.name ? ` · ${LI.esc(x.name)}` : ""}${dayOf(x) ? ` <span class="muted small">· ${dayOf(x)}</span>` : ""}</div>
            <div class="muted small">${x.exercises.length} exercises · ${x.sets.length} sets${x.bodyweight != null ? ` · ${LI.fmtWU(x.bodyweight)}` : ""}</div>
          </button>`).join("")}
      </div>
      <div class="card" id="wk-detail"></div>
    </div>`;

  el.querySelectorAll(".wk-item, [data-goto]").forEach((b) => (b.onclick = () => {
    st.workoutId = b.dataset.id || b.dataset.goto;
    LI.render();
    // Stacked layout: the details are below the list, so bring them into view.
    if (matchMedia("(max-width: 800px)").matches) document.getElementById("wk-detail")?.scrollIntoView({ behavior: "smooth" });
  }));
  el.querySelector("#wk-select").onchange = (e) => { st.workoutId = e.target.value; LI.render(); };
  el.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => {
    const next = ws[ws.indexOf(w) + +b.dataset.step]; // ws is newest first
    if (next) { st.workoutId = next.id; LI.render(); }
  }));
  el.querySelectorAll("[data-fix-remove]").forEach((b) => (b.onclick = () => { LI.setCorrection(b.dataset.fixRemove, null); LI.rebuild(); }));
  el.querySelectorAll("[data-fix-keep]").forEach((b) => (b.onclick = () => {
    // The fix is still right for this set: accept Liftoff's new values as the baseline.
    const issue = model.fixIssues.find((i) => i.key === b.dataset.fixKeep);
    LI.setCorrection(issue.key, { ...issue.fix, was: issue.now });
    LI.rebuild();
  }));
  renderDetail(el.querySelector("#wk-detail"), model, w);
};

// Fixes (✎) that may no longer be on the right set after a new export.
function fixIssuesCard(model) {
  if (!model.fixIssues.length) return "";
  const u = LI.state.displayUnit;
  const exists = new Set(model.workouts.map((w) => w.id));
  const fmtFix = (f) => `${LI.fmtW(f.kg)} ${u} × ${f.reps}`;
  const rows = model.fixIssues.map((i) => {
    const k = LI.parseSetKey(i.key);
    const when = LI.fmtDate(new Date(k.workoutId.replace(" ", "T")), { day: "numeric", month: "short", year: "numeric" });
    const what = i.kind === "missing"
      ? (exists.has(k.workoutId) ? "This set isn't in the export anymore." : "This workout isn't in the export anymore.")
      : `Liftoff now has ${i.now.weight}×${i.now.reps} here; it had ${i.fix.was.weight}×${i.fix.was.reps} when you made the fix.`;
    return `<tr>
      <td>${exists.has(k.workoutId) ? `<button class="link-btn" data-goto="${LI.esc(k.workoutId)}">${when}</button>` : when}</td>
      <td>${LI.esc(k.exercise)} · set ${k.set}</td>
      <td class="num">${fmtFix(i.fix)}</td>
      <td class="small wide">${what}</td>
      <td class="r wide" style="white-space:nowrap">${i.kind === "changed" ? `<button class="btn small" data-fix-keep="${LI.esc(i.key)}">Still right</button> ` : ""}<button class="btn small" data-fix-remove="${LI.esc(i.key)}">Remove fix</button></td>
    </tr>`;
  }).join("");
  return `<div class="card" style="margin-bottom:16px">
    <div class="card-head"><h2>${model.fixIssues.length} fix${model.fixIssues.length === 1 ? "" : "es"} to check</h2><span class="muted small">a set was edited or deleted in Liftoff since you fixed it</span></div>
    <div class="table-wrap"><table class="stack">
      <thead><tr><th>Workout</th><th>Set</th><th>Your fix</th><th>What changed</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="muted small" style="margin:6px 0 0">A changed set still uses your fix until you remove it. If the fix belongs on another set now, remove it here and add it again with ✎ on that set.</p>
  </div>`;
}

const delta = (cur, prev, fmt) => {
  if (prev == null || cur == null) return "";
  const d = cur - prev;
  if (Math.abs(d) < 1e-6) return `<span class="muted">=</span>`;
  return `<span class="${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${fmt(Math.abs(d))}</span>`;
};

function renderDetail(el, model, w) {
  const u = LI.state.displayUnit;
  const prCount = w.exercises.reduce((n, e) => n + (sessionFor(model, e.name, w).cur.prs.length ? 1 : 0), 0);

  el.innerHTML = `
    <div class="card-head">
      <div>
        <h2 class="desk-only">${LI.fmtDate(w.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
        <div class="muted">${LI.programStart() && w.date >= LI.programStart() ? `${LI.classifyWorkout(w)?.day.name || "Off plan"} · ` : ""}${LI.esc(LI.workoutMeta(w))}${(() => { const g = LI.gymAt(LI.fromGymClock(w.date)); return g ? ` · ~${g.count} people at the gym` : ""; })()}${prCount ? ` · <span class="pr">★ ${prCount} PR${prCount > 1 ? "s" : ""}</span>` : ""}</div>
      </div>
      <div class="toolbar desk-only" style="margin:0">${LI.exportButtons()}</div>
      <details class="wk-export mob-only"><summary class="btn small">Export</summary><div class="toolbar" style="margin:8px 0 0">${LI.exportButtons()}</div></details>
    </div>
    ${w.exercises.map((e) => {
      const { cur, prev } = sessionFor(model, e.name, w);
      const isBW = (LI.exerciseInfo(e.name).bw || 0) > 0;
      const extra = ["distance", "seconds", "rpe", "notes"].filter((k) => e.sets.some((s) => (k === "rpe" ? s.rpe != null : k === "notes" ? s.notes : s[k] > 0)));
      return `
      <div class="wk-ex">
        <h3>${LI.esc(e.name)} ${cur.prs.length ? `<span class="pr">★ PR ${cur.prs.join(", ")}</span>` : ""}
          <span class="muted small" style="font-weight:400">${LI.exerciseInfo(e.name).primary.join(", ")}</span></h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Set</th><th class="r">${isBW ? `Added (${u})` : `Weight (${u})`}</th><th class="r">Reps</th>
            ${extra.map((k) => `<th${k === "notes" ? "" : ' class="r"'}>${{ distance: "Distance", seconds: "Time", rpe: "RPE", notes: "Notes" }[k]}</th>`).join("")}
            <th class="r">e1RM</th><th class="r">Volume</th><th></th></tr></thead>
          <tbody>${e.sets.map((s, i) => LI.state.editingSet === s.key ? editRow(s, i, extra.length, isBW) : `<tr>
            <td>${i + 1}</td>
            <td class="r">${isBW ? (s.kg > 0 ? `+${LI.fmtW(s.kg)}` : "BW") + (s.load > 0 ? ` <span class="muted">(${LI.fmtW(s.load)})</span>` : "") : s.kg > 0 ? LI.fmtW(s.kg) : "–"}</td>
            <td class="r">${s.reps || "–"}</td>
            ${extra.map((k) => k === "notes" ? `<td>${LI.esc(s.notes)}</td>` : `<td class="r">${k === "seconds" ? (s.seconds ? LI.fmtSeconds(s.seconds) : "–") : k === "rpe" ? (s.rpe ?? "–") : s[k] || "–"}</td>`).join("")}
            <td class="r">${LI.fmtW(s.e1rm)}</td>
            <td class="r">${LI.fmtVol(s.volume)}</td>
            <td class="r">${s.edited ? `<span class="edited" title="Edited. Liftoff had ${s.rawWeight} × ${s.rawReps}">edited</span> ` : ""}${s.fromNote ? `<span class="edited" title="Added weight read from the set note">from note</span> ` : ""}${s.loggedAs !== s.exercise ? `<span class="muted small" title="Logged in Liftoff as ${LI.esc(s.loggedAs)}">${LI.esc(s.loggedAs)}</span> ` : ""}<button class="btn small ghost" data-edit="${LI.esc(s.key)}" title="Correct this set">✎</button></td></tr>`).join("")}
          </tbody>
        </table></div>
        <div class="small muted" style="margin-top:4px">
          ${prev && !cur.topLoad && !prev.topLoad ? `vs ${LI.fmtShort(prev.date)}: best set ${prev.maxReps} → ${cur.maxReps} reps · total reps ${delta(cur.totalReps, prev.totalReps, (d) => d)}`
          : prev ? `vs ${LI.fmtShort(prev.date)}: top set ${prev.topSet ? `${LI.fmtW(prev.topSet.load)}×${prev.topSet.reps}` : "–"} → ${cur.topSet ? `${LI.fmtW(cur.topSet.load)}×${cur.topSet.reps}` : "–"}
            · e1RM ${delta(cur.bestE1rm, prev.bestE1rm, (d) => `${LI.fmtW(d)} ${u}`)}
            · volume ${delta(cur.volume, prev.volume, (d) => `${LI.fmtVol(d)} ${u}`)}
            · reps ${delta(cur.totalReps, prev.totalReps, (d) => d)}`
          : "First time logging this exercise."}
        </div>
      </div>`;
    }).join("")}`;

  el.querySelectorAll("[data-export]").forEach((b) => (b.onclick = () => LI.exportAs(b.dataset.export, [w], `liftoff-workout-${w.day}`)));

  const st = LI.state;
  el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => { st.editingSet = b.dataset.edit; LI.render(); }));
  const form = el.querySelector(".edit-row");
  if (!form) return;
  const weightIn = form.querySelector("[name=weight]"), repsIn = form.querySelector("[name=reps]");
  weightIn.focus();
  weightIn.select();
  const save = () => {
    const shown = parseFloat(weightIn.value.replace(",", "."));
    const reps = parseInt(repsIn.value, 10);
    if (isNaN(shown) || shown < 0 || isNaN(reps) || reps < 0) { form.querySelector(".edit-err").textContent = "Enter a weight and reps (0 or more)."; return; }
    const kg = st.displayUnit === "lb" ? shown * LI.LB : shown;
    const set = model.sets.find((x) => x.key === st.editingSet);
    LI.setCorrection(st.editingSet, { kg, reps, was: set ? { weight: set.rawWeight, reps: set.rawReps } : undefined });
    st.editingSet = null;
    LI.rebuild();
  };
  const cancel = () => { st.editingSet = null; LI.render(); };
  form.querySelector("[data-act=save]").onclick = save;
  form.querySelector("[data-act=cancel]").onclick = cancel;
  const revert = form.querySelector("[data-act=revert]");
  if (revert) revert.onclick = () => { LI.setCorrection(st.editingSet, null); st.editingSet = null; LI.rebuild(); };
  form.querySelectorAll("input").forEach((i) => (i.onkeydown = (e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }));
}

function editRow(s, i, extraCols, isBW) {
  const u = LI.state.displayUnit;
  const shown = s.kg > 0 ? Math.round(LI.toDisplay(s.kg) * 100) / 100 : 0;
  return `<tr class="edit-row"><td>${i + 1}</td>
    <td class="r"><input name="weight" type="text" inputmode="decimal" value="${shown}" size="5" aria-label="${isBW ? "Added weight" : "Weight"} in ${u}"></td>
    <td class="r"><input name="reps" type="text" inputmode="numeric" value="${s.reps}" size="3" aria-label="Reps"></td>
    <td colspan="${extraCols + 3}">
      <button class="btn small primary" data-act="save">Save</button>
      <button class="btn small" data-act="cancel">Cancel</button>
      ${s.edited ? `<button class="btn small ghost" data-act="revert" title="Liftoff had ${s.rawWeight} × ${s.rawReps}">Use Liftoff's value</button>` : ""}
      <span class="muted small">${isBW ? `Weight added on top of bodyweight, in ${u}.` : `In ${u}.`} Liftoff had ${s.rawWeight} × ${s.rawReps}.</span>
      <span class="edit-err down small"></span>
    </td></tr>`;
}

function sessionFor(model, name, w) {
  const ss = model.exercises.get(name).sessions;
  const i = ss.findIndex((s) => s.workout === w);
  return { cur: ss[i], prev: i > 0 ? ss[i - 1] : null };
}
