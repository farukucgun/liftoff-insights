window.LI = window.LI || {};
LI.views = LI.views || {};

// Backup: every li.* key this browser keeps, restored as-is. Used here and on the start screen.
LI.backupKeys = () => ["li.csv", "li.displayUnit", "li.periods", ...Object.values(LI.SETTINGS_KEYS)];

LI.restoreBackupInput = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (backup?.app !== "liftoff-insights" || typeof backup.data !== "object") throw new Error("This isn't a Liftoff Insights backup.");
    if (LI.state.model && !confirm(`Replace the data in this browser with the backup from ${file.name}?`)) return;
    for (const k of LI.backupKeys()) {
      if (k in backup.data) localStorage.setItem(k, JSON.stringify(backup.data[k]));
      else localStorage.removeItem(k);
    }
    location.reload();
  } catch (err) {
    LI.toast(`<span class="pill neglected">Couldn't restore</span> ${LI.esc(err.message)}`, 8000);
  }
};

LI.views.export = (el, model) => {
  const st = LI.state;
  const ws = [...model.workouts].reverse();
  const today = LI.dayKey(new Date());
  st.exportFrom = st.exportFrom || LI.dayKey(model.first);
  st.exportTo = st.exportTo || today;

  el.innerHTML = `
    <div class="grid cols-2">
      <div class="card">
        <h2>Workout history</h2>
        <p class="muted">Every workout in the date range. Weights are in <strong>${st.displayUnit}</strong> (switch at the top right).</p>
        <div class="toolbar">
          <label>From <input type="date" id="x-from" value="${st.exportFrom}"></label>
          <label>To <input type="date" id="x-to" value="${st.exportTo}"></label>
          <span class="muted small" id="x-count"></span>
        </div>
        <div class="toolbar" id="x-all">${LI.exportButtons()}</div>
      </div>
      <div class="card">
        <h2>Single workout</h2>
        <p class="muted">You can also export from any workout on the Workouts tab.</p>
        <div class="toolbar">
          <select id="x-one">${ws.map((w) => `<option value="${LI.esc(w.id)}">${LI.fmtDate(w.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${w.sets.length} sets</option>`).join("")}</select>
        </div>
        <div class="toolbar" id="x-single">${LI.exportButtons()}</div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>What's in each format</h3>
      <ul class="muted">
        <li><strong>CSV / Excel</strong>: one row per set with cleaned weights, bodyweight, load, volume and estimated 1RM, plus the raw value and unit from Liftoff. Excel adds a summary sheet and one sheet per workout.</li>
        <li><strong>JSON</strong>: nested workouts → exercises → sets, including muscle mapping. Good for other tools.</li>
        <li><strong>Markdown</strong>: a readable log for notes apps.</li>
        <li><strong>PDF</strong>: opens the print dialog with a clean layout. Choose “Save as PDF”.</li>
      </ul>
    </div>
    ${LI.settingsMode === "file" ? "" : `
    <div class="card" style="margin-top:16px">
      <h2>Backup</h2>
      <p class="muted">Your export and everything you set here (units, set fixes, muscle mapping, targets, program) are kept in this browser only. A backup file keeps them safe and moves them to a new phone.</p>
      <div class="toolbar">
        <button class="btn" id="x-backup">Download backup</button>
        <label class="btn ghost file-btn">Restore backup<input type="file" id="x-restore" accept=".json,application/json" hidden></label>
      </div>
    </div>`}`;

  const inRange = () => {
    const from = new Date(st.exportFrom + "T00:00"), to = new Date(st.exportTo + "T23:59:59");
    return model.workouts.filter((w) => w.date >= from && w.date <= to);
  };
  const updateCount = () => {
    const n = inRange().length;
    el.querySelector("#x-count").textContent = `${n} workout${n === 1 ? "" : "s"}`;
  };
  el.querySelector("#x-from").onchange = (e) => { st.exportFrom = e.target.value; updateCount(); };
  el.querySelector("#x-to").onchange = (e) => { st.exportTo = e.target.value; updateCount(); };
  updateCount();

  el.querySelectorAll("#x-all [data-export]").forEach((b) => (b.onclick = () => {
    const list = inRange();
    if (list.length) LI.exportAs(b.dataset.export, list, `liftoff-history-${st.exportFrom}_${st.exportTo}`);
  }));
  // Only shown when this browser is the only store (no settings.json on a server).
  const backupBtn = el.querySelector("#x-backup");
  if (backupBtn) {
    backupBtn.onclick = () => {
      const data = Object.fromEntries(LI.backupKeys().map((k) => [k, LI.store.get(k, null)]).filter(([, v]) => v != null));
      LI.download(JSON.stringify({ app: "liftoff-insights", version: 1, data }), `liftoff-insights-backup-${today}.json`, "application/json");
    };
    el.querySelector("#x-restore").onchange = LI.restoreBackupInput;
  }

  el.querySelectorAll("#x-single [data-export]").forEach((b) => (b.onclick = () => {
    const w = model.workouts.find((x) => x.id === el.querySelector("#x-one").value);
    LI.exportAs(b.dataset.export, [w], `liftoff-workout-${w.day}`);
  }));
};
