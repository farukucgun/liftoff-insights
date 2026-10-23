window.LI = window.LI || {};
LI.views = LI.views || {};

const unitEntry = (name) => {
  const e = LI.unitConfig()[name];
  if (!e) return { default: "unknown", sessions: {} };
  if (typeof e === "string") return { default: e, sessions: {} };
  return { default: e.default || "unknown", sessions: { ...(e.sessions || {}) } };
};

const saveEntry = (name, entry) => {
  const sessions = Object.fromEntries(Object.entries(entry.sessions).filter(([, u]) => u && u !== entry.default));
  LI.state.unitOverrides[name] = Object.keys(sessions).length ? { default: entry.default, sessions } : entry.default;
  LI.store.set("li.unitOverrides", LI.state.unitOverrides);
};

// Sessions whose weights changed in a later export since their unit was set: edited in Liftoff,
// or converted there (changing a session's unit in Liftoff converts its numbers).
function unitIssuesCard(model) {
  if (!model.unitIssues.length) return "";
  const list = (w) => w.split(",").join(", ");
  const conv = (w, f) => w.split(",").map((x) => LI.fmtNum(+x * f, 1)).join(", ");
  const rows = model.unitIssues.map((i) => {
    const btn = (attr, label, primary) => `<button class="btn small ${primary ? "primary" : ""}" ${attr}="${LI.esc(i.key)}">${label}</button>`;
    let what, actions;
    if (i.unit === "lb" && i.kind !== "kg→lb") {
      what = i.kind === "lb→kg" ? "Liftoff converted this session from lb to kg." : `Changed in Liftoff. If the new numbers are kg, switch it; ${conv(i.was, LI.LB)} would be the old ones in kg.`;
      actions = [btn("data-unit-kg", "It's kg now", i.kind === "lb→kg"), btn("data-unit-keep", "Still lb")];
    } else if (i.unit === "kg" && i.kind === "lb→kg") {
      what = "Liftoff converted this from lb to kg, but you set it as kg, so the old numbers were already kg. Restore them here, or retype them in Liftoff.";
      actions = [btn("data-unit-restore", "Restore old weights", true), btn("data-unit-keep", "New ones are right")];
    } else if (i.kind === "kg→lb") {
      what = "Liftoff converted this session from kg to lb.";
      actions = [btn("data-unit-lb", "It's lb now", true), btn("data-unit-keep", "Still kg")];
    } else {
      what = `Changed in Liftoff. Still ${i.unit}?`;
      actions = [btn("data-unit-keep", `Still ${i.unit}`), btn(i.unit === "kg" ? "data-unit-lb" : "data-unit-kg", `It's ${i.unit === "kg" ? "lb" : "kg"} now`)];
    }
    return `<tr>
      <td>${LI.esc(i.exercise)} · ${LI.fmtDate(new Date(`${i.day}T12:00`))} <span class="muted small">set as ${i.unit}</span></td>
      <td class="num">${list(i.was)}</td>
      <td class="num">${list(i.now)}</td>
      <td class="small wide">${what}</td>
      <td class="r wide" style="white-space:nowrap">${actions.join(" ")}</td>
    </tr>`;
  }).join("");
  return `<div class="card" style="margin-bottom:16px">
    <div class="card-head"><h2>${model.unitIssues.length} session${model.unitIssues.length === 1 ? "" : "s"} to check</h2><span class="muted small">the weights changed in Liftoff since the unit was set</span></div>
    <div class="table-wrap"><table class="stack">
      <thead><tr><th>Session</th><th>Weights before</th><th>Weights now</th><th>What happened</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="muted small" style="margin:6px 0 0">Until you choose, the new numbers are read in the unit set here.</p>
  </div>`;
}

LI.views.units = (el, model) => {
  const st = LI.state;
  st.unitsToggled = st.unitsToggled || {}; // exercise -> open, when the row was opened or closed by hand
  const exs = [...model.exercises.values()].sort((a, b) => a.name.localeCompare(b.name));
  const weighted = exs.filter((ex) => ex.sessions.some((s) => s.sets.some((x) => x.rawWeight > 0)));
  const unweighted = exs.filter((ex) => !weighted.includes(ex));
  const unitOptions = (value, withInherit, def) =>
    (withInherit ? [["", def && def !== "unknown" ? `default (${def})` : "same as default"]] : [["unknown", "not set"]]).concat([["kg", "kg"], ["lb", "lb"]])
      .map(([v, l]) => `<option value="${v}" ${v === value ? "selected" : ""}>${l}</option>`).join("");

  el.innerHTML = `
    ${unitIssuesCard(model)}
    <div class="card">
      <div class="card-head">
        <h2>Units per exercise</h2>
        <div class="toolbar" style="margin:0">
          <button class="btn small" id="u-apply">Fill blanks from hints</button>
          <button class="btn small" id="u-copy">Copy as config</button>
          <button class="btn small" id="u-clear">Clear my choices</button>
        </div>
      </div>
      <p class="muted">Liftoff's export doesn't say whether a weight was kg or lb. Check each exercise in the app and set it here.
        If the unit changed between sessions, expand the row and set it per session.
        <strong>Hint</strong>: Liftoff seems to store weights in lb internally, so numbers <em>typed in kg</em> come back with tiny rounding noise (marked <code>~</code>). Hints are a starting point, not a substitute for checking.</p>
      <p class="muted small">${model.unconfirmed.length ? `${model.unconfirmed.length} of ${weighted.length} still not set.` : "All set ✓"} ${LI.settingsMode === "file" ? "Choices are saved on the server and shared by all your devices." : LI.GUEST ? "Choices are saved on this phone. Export → Backup keeps a copy." : "Choices are saved in this browser only. Start the page with <code>python3 serve.py</code> to save them to <code>settings.json</code>."}</p>
      <div id="u-copy-out"></div>
      ${weighted.map((ex) => {
        const entry = unitEntry(ex.name);
        const hint = LI.suggestUnit(ex.sessions.flatMap((s) => s.sets));
        const mixed = new Set(ex.sessions.map((s) => LI.suggestUnit(s.sets)).filter(Boolean)).size > 1;
        const missing = LI.state.model.unconfirmed.includes(ex.name);
        // Sessions only need attention while the unit isn't set; after that they stay closed unless opened.
        const open = st.unitsToggled[ex.name] ?? (missing && mixed);
        const perSession = Object.values(entry.sessions).filter((u) => u && u !== entry.default);
        return `
        <details class="unit-row" data-ex="${LI.esc(ex.name)}" ${open ? "open" : ""}>
          <summary>
            <span class="name">${LI.esc(ex.name)}</span>
            ${missing ? `<span class="pill high">not set</span>` : `<span class="pill ok">set</span>`}
            ${perSession.length ? `<span class="muted small">${perSession.length} session${perSession.length === 1 ? "" : "s"} in ${entry.default === "kg" ? "lb" : "kg"}</span>` : ""}
            ${mixed && missing ? `<span class="pill under">hints differ by session</span>` : mixed ? `<span class="muted small">hints differ by session</span>` : hint ? `<span class="muted small">hint: ${hint}</span>` : ""}
            <select class="u-default" aria-label="Default unit">${unitOptions(entry.default)}</select>
          </summary>
          <div class="table-wrap unit-sessions"><table class="stack">
            <thead><tr><th>Session</th><th>Weights as exported</th><th>Hint</th><th>Unit</th><th class="r">In ${LI.state.displayUnit}</th></tr></thead>
            <tbody>${ex.sessions.map((s) => `
              <tr>
                <td>${LI.fmtDate(s.date)}</td>
                <td class="num wide">${s.sets.map((x) => `${x.rawWeight}${x.noisy ? "~" : ""}×${x.reps}`).join(", ")}</td>
                <td>${LI.suggestUnit(s.sets) || "–"}</td>
                <td><select class="u-session" data-day="${s.workout.day}">${unitOptions(entry.sessions[s.workout.day] || "", true, entry.default)}</select></td>
                <td class="r num">${s.sets.map((x) => LI.fmtW(x.kg)).join(", ")}</td>
              </tr>`).join("")}
            </tbody>
          </table></div>
        </details>`;
      }).join("")}
      ${unweighted.length ? `<p class="muted small" style="margin-top:12px">No weights logged (nothing to set): ${unweighted.map((e) => LI.esc(e.name)).join(", ")}.</p>` : ""}
    </div>`;

  el.querySelectorAll(".unit-row").forEach((row) => {
    const name = row.dataset.ex;
    row.ontoggle = () => { st.unitsToggled[name] = row.open; };
    row.querySelector(".u-default").onclick = (e) => e.stopPropagation();
    row.querySelector(".u-default").onchange = (e) => {
      const entry = unitEntry(name);
      entry.default = e.target.value;
      saveEntry(name, entry);
      LI.rebuild();
    };
    row.querySelectorAll(".u-session").forEach((sel) => (sel.onchange = () => {
      const entry = unitEntry(name);
      entry.sessions[sel.dataset.day] = sel.value;
      saveEntry(name, entry);
      st.unitsToggled[name] = true;
      LI.rebuild();
    }));
  });

  const issueFor = (b, attr) => model.unitIssues.find((i) => i.key === b.getAttribute(attr));
  const setSessionUnit = (attr, unit) => el.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => {
    const issue = issueFor(b, attr);
    const entry = unitEntry(issue.exercise);
    entry.sessions[issue.day] = unit;
    saveEntry(issue.exercise, entry);
    st.unitSeen[issue.key] = issue.now; // the new numbers are the reference from now on
    LI.store.set("li.unitSeen", st.unitSeen);
    LI.rebuild();
  }));
  setSessionUnit("data-unit-kg", "kg");
  setSessionUnit("data-unit-lb", "lb");
  el.querySelectorAll("[data-unit-keep]").forEach((b) => (b.onclick = () => {
    st.unitSeen[b.dataset.unitKeep] = issueFor(b, "data-unit-keep").now;
    LI.store.set("li.unitSeen", st.unitSeen);
    LI.rebuild();
  }));
  // Put the old numbers back as set fixes (✎), leaving sets that already have a fix alone.
  el.querySelectorAll("[data-unit-restore]").forEach((b) => (b.onclick = () => {
    const issue = issueFor(b, "data-unit-restore");
    const old = issue.was.split(",").map(Number);
    issue.raw.forEach((weight, i) => {
      const key = LI.setKey(issue.workoutId, issue.exercise, i);
      if (!st.corrections[key]) st.corrections[key] = { kg: old[i], reps: issue.reps[i], was: { weight, reps: issue.reps[i] } };
    });
    LI.store.set("li.corrections", st.corrections);
    st.unitSeen[issue.key] = issue.now;
    LI.store.set("li.unitSeen", st.unitSeen);
    LI.rebuild();
  }));

  el.querySelector("#u-apply").onclick = () => {
    for (const ex of weighted) {
      const entry = unitEntry(ex.name);
      const sessions = ex.sessions.map((s) => [s.workout.day, LI.suggestUnit(s.sets)]).filter(([, u]) => u);
      if (entry.default === "unknown") entry.default = LI.suggestUnit(ex.sessions.flatMap((s) => s.sets)) || "unknown";
      for (const [day, u] of sessions) if (!entry.sessions[day] && u !== entry.default) entry.sessions[day] = u;
      saveEntry(ex.name, entry);
    }
    LI.rebuild();
  };

  el.querySelector("#u-copy").onclick = () => {
    const cfg = { ...LI.UNITS_CONFIG, ...st.unitOverrides };
    const body = Object.keys(cfg).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(cfg[k]).replace(/"(default|sessions)":/g, "$1: ")},`).join("\n");
    const text = `LI.UNITS_CONFIG = {\n${body}\n};`;
    const out = el.querySelector("#u-copy-out");
    out.innerHTML = `<textarea readonly rows="8" style="width:100%;font-family:ui-monospace,monospace;font-size:12px;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px"></textarea>`;
    out.querySelector("textarea").value = text;
    out.querySelector("textarea").select();
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  el.querySelector("#u-clear").onclick = (e) => {
    if (!e.target.dataset.armed) {
      e.target.dataset.armed = "1";
      e.target.textContent = "Click again to clear all";
      return;
    }
    st.unitOverrides = {};
    LI.store.set("li.unitOverrides", {});
    LI.rebuild();
  };
};
