window.LI = window.LI || {};
LI.views = LI.views || {};

LI.views.program = (el, model) => {
  const st = LI.state;
  const P = LI.PROGRAM;
  const start = LI.programStart();
  const sessions = LI.programSessions(model);
  const next = LI.nextProgramDay(model);
  if (!st.programDay || !LI.programDay(st.programDay)) st.programDay = next.day.id;
  const day = LI.programDay(st.programDay);

  // This week (Monday first): which program days are already done.
  const weekFrom = LI.weekStart(new Date());
  const doneThisWeek = new Set(sessions.filter((s) => s.match && s.workout.date >= weekFrom).map((s) => s.match.day.id));
  const weekCount = sessions.filter((s) => s.workout.date >= weekFrom).length;

  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <!-- The title is the program picker. -->
          <select id="p-choose" class="p-title" aria-label="Program">${LI.PROGRAMS.map((p) => `<option value="${p.id}" ${p === P ? "selected" : ""}>${LI.esc(p.name)}</option>`).join("")}</select>
          <div class="muted small">${LI.esc(P.meta)}</div>
        </div>
        <label class="small p-start">Started on <input type="date" id="p-start" value="${st.program.start || ""}"></label>
      </div>
      <div class="p-week" role="group" aria-label="Weekly schedule: pick a day to see its exercises">
        ${P.schedule.map((id, i) => {
          const d = LI.programDay(id);
          const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i];
          if (!d) return `<div class="p-wd rest"><span class="small">${wd}</span><strong>Rest</strong><span class="small"></span></div>`;
          const isNext = d === next.day, done = doneThisWeek.has(id);
          return `<button class="p-wd ${d === day ? "sel" : ""} ${isNext ? "next" : ""} ${done ? "done" : ""}" data-day="${d.id}" aria-pressed="${d === day}">
            <span class="small">${wd}</span>
            <strong>${d.short}</strong>
            <span class="small p-wd-tag">${done ? "✓ done" : isNext ? "next" : ""}</span>
          </button>`;
        }).join("")}
      </div>
      <p class="muted small" style="margin:8px 0 0">
        ${start
          ? `${weekCount} of ${LI.programDaysPerWeek()} sessions this week. ${next.after ? `Last program session: ${next.after.match.day.name} on ${LI.fmtShort(next.after.workout.date)}, so next is <strong>${next.day.name}</strong>.` : `No program sessions logged yet, so start with <strong>${next.day.name}</strong>.`} The days don't have to fall on these weekdays; just keep the order.`
          : `Set the date you started so sessions can be checked against the plan. Until then, “last time” uses your whole history.`}
      </p>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head">
        <h2>${day.name}${day === next.day ? ` <span class="pill info">next</span>` : ""}</h2>
        <span class="muted small">${day.focus ? `${day.focus} focus · ` : ""}${day.time} · ${LI.esc(P.warmup)}</span>
      </div>
      <div class="p-cards mob-only">${day.items.map((s) => slotCard(model, s, day)).join("")}</div>
      <div class="table-wrap desk-only"><table class="p-plan">
        <thead><tr><th>Exercise</th><th class="r">Sets × reps</th><th>RPE</th><th>Rest</th><th>Last time</th><th>This time</th></tr></thead>
        <tbody>${day.items.map((s) => slotRow(model, s, day)).join("")}</tbody>
      </table></div>
      <p class="muted small">RPE is early sets → last set (10 = no reps left). Warm-up sets aren't counted. “Last time” prefers your last ${day.name}; otherwise it uses any matching exercise and says so.</p>
    </div>

    ${start ? recentCard(sessions) : ""}

    ${musclesCard(model)}`;

  el.querySelector("#p-choose").onchange = (e) => {
    // Each program keeps its own start date, so switching back and forth loses nothing.
    const { id, start, starts = {} } = st.program;
    const next = { ...starts, [id]: start };
    st.program = { id: e.target.value, start: next[e.target.value] || null, starts: next };
    LI.store.set("li.program", st.program);
    st.programDay = null;
    st.programMuscleFilter = "all";
    LI.render();
  };
  el.querySelector("#p-start").onchange = (e) => {
    st.program.start = e.target.value || null;
    LI.store.set("li.program", st.program);
    st.programDay = null;
    LI.render();
  };
  el.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { st.programDay = b.dataset.day; LI.render(); }));
  el.querySelectorAll("[data-mfilter]").forEach((b) => (b.onclick = () => { st.programMuscleFilter = b.dataset.mfilter; LI.render(); }));
  el.querySelector("#p-apply").onclick = () => {
    st.muscleTargets = LI.programTargets();
    LI.store.set("li.muscleTargets", st.muscleTargets);
    LI.toast(`<span class="pill ok">Targets set</span> Each muscle now has the program's range. Change any of them on the Muscles tab.`);
    LI.render();
  };
};

const fmtSet = (x) => {
  const isBW = (LI.exerciseInfo(x.exercise).bw || 0) > 0;
  return `${isBW ? (x.kg > 0 ? `+${LI.fmtW(x.kg)}` : "BW") : LI.fmtW(x.kg)}×${x.reps}`;
};

const ADVICE_LABEL = { ok: "Add weight", under: "Lighten", high: "Re-set", info: "Build reps" };

function slotData(model, s, day) {
  const last = LI.lastForSlot(model, s, day);
  return {
    last,
    advice: LI.slotAdvice(s, last),
    ws: last ? LI.workingSets(last.sets) : [],
    alts: [...s.subs, ...s.also.map((a) => `${a} (from your log)`)],
    lastNote: last ? `${LI.fmtShort(last.workout.date)}${last.kind === "main" ? "" : ` · ${LI.esc(last.exercise)}`}${last.sameDay ? "" : " · not on this day"}` : "",
  };
}

// Phone layout: one tile per exercise, what to do this time most prominent.
function slotCard(model, s, day) {
  const { last, advice, ws, alts, lastNote } = slotData(model, s, day);
  return `<div class="pc">
    <div class="pc-head">
      <div><div class="pc-name">${LI.esc(s.ex)}</div>${s.tech ? `<div class="small p-tech">${LI.esc(s.tech)}</div>` : ""}</div>
      <div class="pc-target num">${s.sets} × ${s.reps[0]}–${s.reps[1]}</div>
    </div>
    <div class="pc-meta">RPE ${s.rpe[0]} → ${s.rpe[1]} · Rest ${s.rest} · ${s.warmup} warm-up</div>
    <div class="pc-last"><span class="pc-label">Last time</span>${last
      ? `<span class="num pc-sets">${ws.map(fmtSet).join(", ") || "–"}</span><span class="muted small">${lastNote}</span>`
      : `<span class="muted">Never</span>`}</div>
    <div class="pc-next lvl-${advice.level}"><span class="pill ${advice.level}">${ADVICE_LABEL[advice.level] || ""}</span> ${LI.esc(advice.text)}</div>
    <div class="pc-alt">Or: ${alts.map(LI.esc).join(", ")}</div>
  </div>`;
}

function slotRow(model, s, day) {
  const { last, advice, ws, alts, lastNote } = slotData(model, s, day);
  return `<tr>
    <td><strong>${LI.esc(s.ex)}</strong>${s.tech ? `<div class="small p-tech">${LI.esc(s.tech)}</div>` : ""}
      <div class="muted small">Or: ${alts.map(LI.esc).join(", ")}</div></td>
    <td class="r num">${s.sets} × ${s.reps[0]}–${s.reps[1]}<div class="muted small">${s.warmup} warm-up</div></td>
    <td class="num">${s.rpe[0]} → ${s.rpe[1]}</td>
    <td>${s.rest}</td>
    <td class="wide">${last
      ? `<span class="num">${ws.map(fmtSet).join(", ") || "–"}</span><div class="muted small">${lastNote}</div>`
      : `<span class="muted">Never</span>`}</td>
    <td class="wide"><span class="pill ${advice.level}">${ADVICE_LABEL[advice.level] || ""}</span><div class="small">${LI.esc(advice.text)}</div></td>
  </tr>`;
}

function recentCard(sessions) {
  const rows = sessions.slice(0, 8);
  return `<div class="card" style="margin-top:16px">
    <div class="card-head"><h2>Sessions vs plan</h2><span class="muted small">Since ${LI.fmtShort(LI.programStart())}</span></div>
    ${rows.length ? `<div class="table-wrap"><table class="stack">
      <thead><tr><th>Date</th><th>Day</th><th class="r">Exercises</th><th class="r">Sets</th><th class="r">Reps in range</th><th>Notes</th></tr></thead>
      <tbody>${rows.map(({ workout: w, match }) => {
        if (!match) return `<tr><td>${LI.fmtDate(w.date, { weekday: "short", day: "numeric", month: "short" })}</td><td colspan="4"><span class="pill info">Off plan</span></td><td class="muted small wide">${w.exercises.map((e) => LI.esc(e.name)).join(", ")}</td></tr>`;
        const c = LI.compareToPlan(w, match.day);
        const done = c.items.filter((i) => i.done).length;
        const pct = c.workSets ? Math.round((c.inRange / c.workSets) * 100) : null;
        const notes = [
          c.missed.length && `Skipped ${c.missed.join(", ")}`,
          ...c.items.filter((i) => i.done && i.sets && (i.below || i.above) * 2 >= i.sets).map((i) => `${i.slot.ex}: ${i.above ? "above" : "below"} ${i.slot.reps[0]}–${i.slot.reps[1]}`),
          c.extras.length && `Extra: ${c.extras.join(", ")}`,
        ].filter(Boolean);
        return `<tr><td>${LI.fmtDate(w.date, { weekday: "short", day: "numeric", month: "short" })}</td><td>${match.day.name}</td>
          <td class="r"><span class="pill ${done === c.items.length ? "ok" : done >= c.items.length - 1 ? "high" : "under"}">${done}/${c.items.length}</span></td>
          <td class="r num">${c.sets}/${c.plannedSets}</td>
          <td class="r num">${pct == null ? "–" : `${pct}%`}</td>
          <td class="small wide">${notes.map(LI.esc).join(" · ") || `<span class="muted">As planned</span>`}</td></tr>`;
      }).join("")}</tbody></table></div>`
    : `<p class="muted">No workouts logged since then yet.</p>`}
  </div>`;
}

const STATUSES = [["neglected", "Neglected"], ["under", "Low"], ["ok", "On target"], ["high", "High"]];

function musclesCard(model) {
  const planned = LI.programMuscleSets();
  const targets = LI.programTargets();
  const win = LI.muscleWindow(model, "28");
  // Status against the target in use, same words as the Muscles tab.
  const rows = LI.MUSCLES.map((m) => {
    const v = win.perWeek[m], cur = LI.targetFor(m);
    const [cls, label] = LI.muscleStatus(m, v);
    return { m, v, cur, cls, label, gap: v < cur.lo ? v - cur.lo : v > cur.hi ? v - cur.hi : 0 };
  });
  const filter = LI.state.programMuscleFilter || "all";
  const shown = rows
    .filter((r) => filter === "all" || r.cls === filter)
    // Filtered: biggest shortfall first. All: by the program's planned sets.
    .sort((a, b) => (filter === "all" ? planned[b.m] - planned[a.m] : Math.abs(b.gap) - Math.abs(a.gap)));
  const count = (c) => rows.filter((r) => r.cls === c).length;
  const same = LI.MUSCLES.every((m) => {
    const t = LI.state.muscleTargets[m];
    return t && t.lo === targets[m].lo && t.hi === targets[m].hi;
  });
  return `<div class="card" style="margin-top:16px">
    <div class="card-head">
      <h2>Weekly sets per muscle</h2>
      <span class="muted small">primary = 1 set, secondary = ½, same as the Muscles tab</span>
    </div>
    <div class="seg-btns p-days p-filter" role="group" aria-label="Show muscles" style="margin-bottom:8px">
      ${[["all", "All", rows.length], ...STATUSES.map(([c, l]) => [c, l, count(c)])].map(([c, l, n]) =>
        `<button class="btn small ${filter === c ? "on" : ""}" data-mfilter="${c}" ${n || c === "all" ? "" : "disabled"}>${l}<span class="count">${n}</span></button>`).join("")}
    </div>
    <div class="pm-list mob-only">${shown.map(({ m, v, cur, cls, label, gap }) => `<div class="pm">
      <div class="pm-top"><strong>${m}</strong><span class="num">${LI.fmtNum(v)}<span class="muted"> of ${cur.lo}–${cur.hi}</span></span>
        <span class="num pm-gap ${gap < 0 ? "down" : ""}">${gap ? `${gap > 0 ? "+" : "−"}${LI.fmtNum(Math.abs(gap))}` : "✓"}</span><span class="pill ${cls}">${label}</span></div>
      <div class="muted small">Program ${LI.fmtNum(planned[m])} sets/week · suggested ${targets[m].lo}–${targets[m].hi}${LI.state.muscleTargets[m] ? "" : " · you use the default"}</div>
    </div>`).join("") || `<p class="muted">No muscles in this group.</p>`}</div>
    <div class="table-wrap desk-only"><table>
      <thead><tr><th>Muscle</th><th class="r">Program</th><th class="r">Suggested target</th><th class="r">Your current target</th><th class="r">Last 4 weeks</th><th class="r">To target</th></tr></thead>
      <tbody>${shown.map(({ m, v, cur, cls, label, gap }) => `<tr><td>${m}</td><td class="r num">${LI.fmtNum(planned[m])}</td><td class="r num">${targets[m].lo}–${targets[m].hi}</td>
          <td class="r num">${cur.lo}–${cur.hi}${LI.state.muscleTargets[m] ? "" : ` <span class="muted small">default</span>`}</td>
          <td class="r num">${LI.fmtNum(v)} <span class="pill ${cls}">${label}</span></td>
          <td class="r num ${gap < 0 ? "down" : ""}">${gap ? `${gap > 0 ? "+" : "−"}${LI.fmtNum(Math.abs(gap))}` : "✓"}</td></tr>`).join("")
        || `<tr><td colspan="6" class="muted">No muscles in this group.</td></tr>`}</tbody>
    </table></div>
    <p class="muted small" style="margin:6px 0 0">The − / + number (“To target”) is sets/week short of the bottom of your target or over the top of it.</p>
    <div class="toolbar" style="margin:12px 0 0">
      <button class="btn ${same ? "" : "primary"}" id="p-apply" ${same ? "disabled" : ""}>${same ? "Program targets in use" : "Use these as my muscle targets"}</button>
      <span class="muted small">The suggested target is the program's sets ±20%. It replaces the per-muscle targets on the Muscles tab; you can still adjust each one there.</span>
    </div>
  </div>`;
}
