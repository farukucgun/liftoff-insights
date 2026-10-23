// App shell: loading data, tabs, global settings.
window.LI = window.LI || {};

LI.DEFAULT_TARGET = { lo: 9, hi: 15 }; // weekly sets per muscle

LI.state = {
  target: LI.store.get("li.target", { ...LI.DEFAULT_TARGET }),
  muscleTargets: LI.store.get("li.muscleTargets", {}), // muscle -> { lo, hi }; others use target
  // id: which program (js/program.js); start: "YYYY-MM-DD" for it; starts: start dates of the others
  program: { id: "p14", start: null, starts: {}, ...LI.store.get("li.program", {}) },
  tab: "overview",
  displayUnit: LI.store.get("li.displayUnit", "kg"),
  unitOverrides: LI.store.get("li.unitOverrides", {}),
  muscleOverrides: LI.store.get("li.muscleOverrides", {}),
  corrections: LI.store.get("li.corrections", {}),
  unitSeen: LI.store.get("li.unitSeen", {}), // "Exercise|YYYY-MM-DD" -> weights when first seen with a unit set
  periods: { overview: "all", progress: "all", muscles: "28", ...LI.store.get("li.periods", {}) },
  rows: null,
  model: null,
};

const TABS = ["overview", "program", "progress", "muscles", "workouts", "gym", "insights", "export", "units"];
const MORE_TABS = ["gym", "insights", "export", "units"]; // in the More menu on phones

let lastTab = null;
LI.render = () => {
  const st = LI.state;
  const view = document.getElementById("view");
  document.querySelectorAll("#tabs button, #bottom-nav [data-tab], #more-sheet [data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === st.tab));
  document.getElementById("nav-more").classList.toggle("active", MORE_TABS.includes(st.tab));
  document.getElementById("brand-tab").textContent = document.querySelector(`#tabs [data-tab="${st.tab}"]`)?.firstChild.textContent.trim() || "";
  document.getElementById("dropzone").hidden = !!st.model;
  if (!st.model) { view.innerHTML = ""; return; }

  const unconfirmed = st.model.unconfirmed.length;
  for (const id of ["units-dot", "units-dot-2", "more-dot"]) document.getElementById(id).hidden = !unconfirmed;
  const banner = document.getElementById("unit-warning");
  banner.hidden = !unconfirmed || st.tab === "units";
  banner.innerHTML = `<strong>${unconfirmed} exercise${unconfirmed === 1 ? "" : "s"}</strong> still need a kg/lb unit confirmed. Until then they're treated as kg. <a href="#units">Set units →</a>`;
  // Settings that may no longer fit the data after a session was edited in Liftoff.
  const fixes = st.model.fixIssues.length, units = st.model.unitIssues.length;
  const checks = [
    fixes && st.tab !== "workouts" && `<strong>${fixes} of your set fix${fixes === 1 ? "" : "es"}</strong> may no longer be on the right set. <a href="#workouts">Check →</a>`,
    units && st.tab !== "units" && `<strong>${units} session${units === 1 ? "" : "s"}</strong> had their weights changed in Liftoff, so the unit set for ${units === 1 ? "it" : "them"} may be wrong. <a href="#units">Check →</a>`,
  ].filter(Boolean);
  const fixBanner = document.getElementById("fix-warning");
  fixBanner.hidden = !checks.length;
  fixBanner.innerHTML = checks.join("<br>");

  // Re-rendering the same tab keeps the scroll position; a different tab starts at the top.
  const scrollY = st.tab === lastTab ? window.scrollY : 0;
  lastTab = st.tab;
  LI.destroyCharts();
  try {
    LI.views[st.tab](view, st.model);
    labelStackedTables(view);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card"><h2>Something went wrong</h2><pre class="muted">${LI.esc(err.stack || err)}</pre></div>`;
  }
  window.scrollTo(0, scrollY);
};

// On phones, tables marked .stack show each row as a card; each cell needs its column name.
function labelStackedTables(root) {
  root.querySelectorAll("table.stack").forEach((t) => {
    const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
    t.querySelectorAll("tbody tr").forEach((tr) => {
      let col = 0;
      for (const td of tr.children) {
        if (heads[col]) td.dataset.label = heads[col];
        col += td.colSpan || 1;
      }
    });
  });
}

LI.setPeriod = (page, key) => {
  LI.state.periods[page] = key;
  LI.store.set("li.periods", LI.state.periods);
  LI.render();
};

// ---------- settings.json (via serve.py) ----------
// Things worth keeping (unit choices, set corrections, muscle mapping, targets, program start) are
// mirrored to settings.json when the page is served by serve.py. localStorage stays
// as a cache and as the only store when opened another way.

LI.SETTINGS_KEYS = { units: "li.unitOverrides", corrections: "li.corrections", muscleOverrides: "li.muscleOverrides", target: "li.target", muscleTargets: "li.muscleTargets", program: "li.program", unitSeen: "li.unitSeen" };
const STATE_FOR = { units: "unitOverrides", corrections: "corrections", muscleOverrides: "muscleOverrides", target: "target", muscleTargets: "muscleTargets", program: "program", unitSeen: "unitSeen" };
LI.settingsMode = "browser"; // "file" once serve.py answers

const setSaveStatus = (text, cls = "muted", title = "") => {
  const el = document.getElementById("save-status");
  el.textContent = text;
  el.dataset.short = text.includes("Offline") ? "⚠ Offline" : text.includes("⚠") ? "⚠" : text.includes("…") ? "…" : text.includes("✓") ? "✓" : ""; // phones show only this
  el.className = `small ${cls}`;
  el.title = title;
};

const settingsPayload = () =>
  Object.fromEntries(Object.entries(STATE_FOR).map(([k, stateKey]) => [k, LI.state[stateKey]]));

let saveTimer;
LI.saveSettings = () => {
  if (LI.settingsMode !== "file") return;
  clearTimeout(saveTimer);
  setSaveStatus("Saving…");
  saveTimer = setTimeout(async () => {
    try {
      const res = await fetch("api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settingsPayload()) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      setSaveStatus("Saved ✓", "up", "Saved to settings.json on the server, shared by all your devices");
    } catch (err) {
      setSaveStatus("⚠ Not saved to file", "down", String(err.message || err));
      LI.toast(`<span class="pill neglected">Couldn't save settings.json</span> ${LI.esc(err.message || err)}. Your change is kept in this browser.`, 8000);
    }
  }, 300);
};

LI.loadSettings = async () => {
  if (LI.GUEST) {
    // The public copy has no server storage: this browser is the only store.
    setSaveStatus("Saved on this phone", "muted", "Your data and settings are kept in this browser only. Use Export → Backup to keep a copy.");
    return;
  }
  let data;
  try {
    const res = await fetch("api/settings", { cache: "no-store" });
    if (!res.ok || !(res.headers.get("Content-Type") || "").includes("json")) throw new Error("no settings API");
    data = await res.json();
  } catch (e) {
    if (location.protocol === "file:") setSaveStatus("Browser storage only", "muted", "Start the page with `python3 serve.py` to save settings to settings.json");
    else setSaveStatus("⚠ Offline", "down", "Can't reach the server. Showing the last data on this device; changes won't be saved.");
    LI.settingsMode = "browser";
    return;
  }
  LI.settingsMode = "file";
  // The file is the truth, shared by every device: it replaces this browser's copy, so a
  // change or removal made elsewhere isn't undone by a stale cache here. Only a setting the
  // file doesn't have at all (made in this browser before there was a file) is kept and saved.
  let browserOnly = false;
  for (const [k, stateKey] of Object.entries(STATE_FOR)) {
    const fromFile = data[k];
    const valid = k === "target" ? fromFile && fromFile.lo != null : fromFile && typeof fromFile === "object";
    if (valid) LI.state[stateKey] = k === "program" ? { id: "p14", start: null, starts: {}, ...fromFile } : fromFile;
    else if (LI.state[stateKey] && Object.keys(LI.state[stateKey]).length) browserOnly = true;
    try { localStorage.setItem(LI.SETTINGS_KEYS[k], JSON.stringify(LI.state[stateKey])); } catch (e) { /* cache only */ }
  }
  if (browserOnly) LI.saveSettings();
  else setSaveStatus("Settings loaded ✓", "muted", "From settings.json on the server, shared by all your devices");
};

// Coming back to the app (or a tab left open): pick up what other devices changed, so this one
// neither shows stale data nor saves its old copy over theirs.
LI.refreshFromServer = async () => {
  if (location.protocol === "file:" || !LI.state.model) return;
  if (LI.GUEST) return;
  await LI.loadSettings();
  if (LI.settingsMode !== "file") return LI.rebuild(); // still offline
  const text = await fetch("liftoff_workout_data.csv", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
  await LI.loadGym();
  if (text && text !== LI.store.get("li.csv", null)) LI.loadText(text);
  else LI.rebuild();
};

// Re-derive the model (after unit or mapping changes) and re-render.
LI.rebuild = () => {
  if (LI.state.rows) LI.state.model = LI.buildModel(LI.state.rows);
  LI.render();
};

let toastTimer;
LI.toast = (html, ms = 4000) => {
  const t = document.getElementById("toast");
  t.innerHTML = html;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
};

// Returns true on success. Errors are shown on the drop screen (no data yet) or as a toast.
LI.loadText = (text, { persist = true, source } = {}) => {
  const msg = document.getElementById("dz-msg");
  try {
    if (typeof Papa === "undefined" || typeof Chart === "undefined") {
      throw new Error("Couldn't load the chart/CSV libraries. Check your internet connection and reload.");
    }
    const rows = LI.parseCsv(text);
    if (!rows.length) throw new Error("No workouts found in this file.");
    LI.state.rows = rows;
    LI.state.model = LI.buildModel(rows);
    if (persist) LI.store.set("li.csv", text);
    msg.innerHTML = "";
    LI.render();
    if (source) {
      const m = LI.state.model;
      LI.toast(`<span class="pill ok">Loaded</span> ${LI.esc(source)}: ${m.workouts.length} workouts, ${m.sets.length} sets`);
    }
    return true;
  } catch (err) {
    console.error(err);
    const html = `<span class="pill neglected">Couldn't load${source ? ` ${LI.esc(source)}` : ""}</span> ${LI.esc(err.message)}`;
    if (LI.state.model) {
      LI.toast(html, 8000);
    } else {
      msg.innerHTML = html;
      document.getElementById("dropzone").hidden = false;
    }
    return false;
  }
};

function setTab(tab) {
  LI.state.tab = TABS.includes(tab) ? tab : "overview";
  // A "← Back to …" link only makes sense right after following a link into Progress.
  if (LI.state.tab !== "progress") Object.assign(LI.state, { progressFromMuscle: null, progressBackTo: null });
  LI.render();
}

async function init() {
  const moreSheet = document.getElementById("more-sheet"), moreBtn = document.getElementById("nav-more");
  const showMore = (open) => { moreSheet.hidden = !open; moreBtn.setAttribute("aria-expanded", open); };
  document.querySelectorAll("#tabs button, #bottom-nav [data-tab], #more-sheet [data-tab]").forEach((b) => (b.onclick = () => {
    showMore(false);
    if (location.hash.slice(1) === b.dataset.tab) window.scrollTo({ top: 0, behavior: "smooth" }); // tapping the current page scrolls up
    location.hash = b.dataset.tab;
  }));
  moreBtn.onclick = () => showMore(moreSheet.hidden);
  document.addEventListener("click", (e) => { if (!moreSheet.hidden && !e.target.closest("#more-sheet, #nav-more")) showMore(false); });
  window.addEventListener("hashchange", () => setTab(location.hash.slice(1)));

  const unitSel = document.getElementById("display-unit");
  unitSel.value = LI.state.displayUnit;
  unitSel.onchange = () => {
    LI.state.displayUnit = unitSel.value;
    LI.store.set("li.displayUnit", unitSel.value);
    LI.render();
  };

  const dz = document.getElementById("dropzone");
  const hideDropzone = () => { dz.classList.remove("over"); dz.hidden = !!LI.state.model; };
  const readFile = (file) => {
    if (!file) return;
    file.text()
      .then((t) => (LI.settingsMode === "file" ? uploadCsv(t, file.name) : LI.loadText(t, { source: file.name })))
      .catch((err) => LI.toast(`<span class="pill neglected">Couldn't read ${LI.esc(file.name)}</span> ${LI.esc(err.message)}`, 8000));
  };
  document.querySelectorAll(".file-input").forEach((input) => (input.onchange = () => {
    readFile(input.files[0]);
    input.value = ""; // allow re-picking the same file
  }));

  // dragenter/dragleave fire for every child element, so count them.
  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  window.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    dragDepth++;
    dz.hidden = false;
    dz.classList.add("over");
  });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("dragleave", (e) => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; hideDropzone(); } });
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    hideDropzone();
    readFile(e.dataTransfer.files[0]);
  });

  enableSwipeTabs();

  // Gym occupancy: load in the background, then check for a new reading every minute while
  // the page is visible. Only pages that show it are redrawn.
  const gymRedraw = (changed) => { if (changed && LI.state.model && ["overview", "gym", "workouts"].includes(LI.state.tab)) LI.render(); };
  if (!LI.GUEST) LI.loadGym().then(gymRedraw);
  if (!LI.GUEST) setInterval(() => { if (document.visibilityState === "visible" && !document.querySelector(".edit-row")) LI.loadGym().then(gymRedraw); }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !document.querySelector(".edit-row")) LI.refreshFromServer();
  });

  // Re-render charts when the OS theme flips so canvas colors follow.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => LI.render());

  LI.state.tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";

  await LI.loadSettings();
  if (LI.GUEST) {
    document.getElementById("dz-where").textContent = "It stays on this phone. Nothing is uploaded.";
    document.getElementById("dz-steps").hidden = false;
    document.getElementById("dz-restore").hidden = false;
    document.getElementById("dz-restore-input").onchange = LI.restoreBackupInput;
    // The gym readings are only on your own server.
    for (const list of [TABS, MORE_TABS]) list.splice(list.indexOf("gym"), 1);
    document.querySelectorAll('[data-tab="gym"]').forEach((b) => (b.hidden = true));
    // Ask Chrome not to clear this site's storage when space runs low: it's the only copy.
    navigator.storage?.persist?.().catch(() => {});
  }
  if ("serviceWorker" in navigator && window.isSecureContext && location.protocol !== "file:") navigator.serviceWorker.register(LI.GUEST ? "sw.js?guest" : "sw.js").catch(() => {});
  // Chrome fires this only when the site can be installed as a real app (app drawer + share menu).
  // The start screen covers the top bar, so it has its own Install button.
  const installBtns = [document.getElementById("install-btn"), document.getElementById("dz-install")];
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; installBtns.forEach((b) => (b.hidden = false)); });
  window.addEventListener("appinstalled", () => { installBtns.forEach((b) => (b.hidden = true)); installPrompt = null; });
  installBtns.forEach((b) => (b.onclick = () => installPrompt && installPrompt.prompt()));
  const sharedLocal = await takeLocalShare();
  const shared = sharedLocal ? null : sharedImportMessage();

  // With serve.py running, its liftoff_workout_data.csv is the source of truth (it may have been
  // updated from another device); the copy in this browser is only a fallback.
  const cached = LI.store.get("li.csv", null);
  if (sharedLocal && importLocal(sharedLocal, cached)) return;
  if (LI.settingsMode === "file") {
    const text = await fetch("liftoff_workout_data.csv", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
    if (text && text !== cached) {
      LI.loadText(text, cached || shared ? {} : { source: "liftoff_workout_data.csv" });
      if (shared) LI.toast(shared, 8000);
      return;
    }
  }
  if (shared) LI.toast(shared, 8000);
  if (cached) return LI.loadText(cached, { persist: false });

  // Plain static server (python3 -m http.server): pick up the export next to index.html.
  if (location.protocol.startsWith("http") && LI.settingsMode !== "file" && !LI.GUEST) {
    fetch("liftoff_workout_data.csv")
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => LI.loadText(t, { source: "liftoff_workout_data.csv" }))
      .catch(() => LI.render());
  } else {
    LI.render();
  }
}

// Phones: swipe left or right on the page to go to the next or previous tab.
function enableSwipeTabs() {
  const narrow = matchMedia("(max-width: 640px)");
  const view = document.getElementById("view");
  let start = null;
  // Leave alone gestures that belong to something else: form controls, sliders, and
  // anything that scrolls sideways itself (wide tables, the calendar).
  const ownsSwipe = (el) => {
    for (; el && el !== view; el = el.parentElement) {
      if (el.matches("input, select, textarea, .range2")) return true;
      if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
    }
    return false;
  };
  view.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    // Skip the screen edges, where Android's back gesture starts.
    start = narrow.matches && e.touches.length === 1 && t.clientX > 24 && t.clientX < innerWidth - 24 && !ownsSwipe(e.target)
      ? { x: t.clientX, y: t.clientY, time: Date.now() } : null;
  }, { passive: true });
  view.addEventListener("touchend", (e) => {
    if (!start || !LI.state.model) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    const quick = Date.now() - start.time < 600;
    start = null;
    if (!quick || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
    const i = TABS.indexOf(LI.state.tab) + (dx < 0 ? 1 : -1);
    if (i < 0 || i >= TABS.length) return;
    view.dataset.enter = dx < 0 ? "right" : "left";
    location.hash = TABS[i];
    setTimeout(() => delete view.dataset.enter, 250);
  }, { passive: true });
}

// After a file is shared from Android's share menu, /share redirects here with the outcome.
function sharedImportMessage() {
  const q = new URLSearchParams(location.search);
  if (!q.has("import")) return null;
  history.replaceState(null, "", location.pathname + location.hash);
  if (q.get("import") !== "ok") return `<span class="pill neglected">Not imported</span> ${LI.esc(q.get("error") || "Unknown error")}.${q.has("before") ? " If you meant to replace it, use Load CSV." : ""}`;
  const added = +q.get("rows") - +q.get("before");
  if (q.has("unchanged")) return `<span class="pill info">No changes</span> That export matches what's already saved.`;
  return `<span class="pill ok">Imported</span> ${added > 0 ? `${added} new set${added === 1 ? "" : "s"}` : "Export saved"}, now on every device.`;
}

// Guest copy: a file shared from Android's share menu was put in the cache by sw.js, which then
// opened /?import=local. Returns its text, or null.
async function takeLocalShare() {
  const q = new URLSearchParams(location.search);
  if (q.get("import") !== "local") return null;
  history.replaceState(null, "", location.pathname + location.hash);
  try {
    const cache = await caches.open("liftoff-shared");
    const res = await cache.match("__shared.csv");
    await cache.delete("__shared.csv");
    if (res) return res.text();
  } catch (e) { /* no cache storage */ }
  LI.toast(`<span class="pill neglected">Not imported</span> The shared file didn't arrive. Try Load CSV instead.`, 8000);
  return null;
}

// Load a shared export into this browser, with the same "older export" check serve.py does.
// Returns true when it was loaded.
function importLocal(text, cached) {
  const sets = (t) => t.split(/\r?\n/).slice(1).filter((l) => l.trim()).length;
  if (cached === text) {
    LI.loadText(text, { persist: false });
    LI.toast(`<span class="pill info">No changes</span> That export matches what's already saved.`);
    return true;
  }
  const rows = sets(text), before = cached ? sets(cached) : 0;
  if (rows < before && !confirm(`The shared file has fewer sets (${rows}) than the saved data (${before}). It may be an older export. Replace anyway?`)) return false;
  if (!LI.loadText(text, { source: "shared export" })) return false;
  if (before && rows > before) LI.toast(`<span class="pill ok">Imported</span> ${rows - before} new set${rows - before === 1 ? "" : "s"}, saved on this phone.`);
  return true;
}

// Save a picked file on the server so every device sees it, then show it here.
async function uploadCsv(text, name, force = false) {
  const res = await fetch(`api/csv${force ? "?force=1" : ""}`, { method: "POST", headers: { "Content-Type": "text/csv" }, body: text });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409 && !force) {
    // An older export would drop workouts; only replace when asked.
    if (confirm(`${name} has fewer sets (${body.rows}) than the saved data (${body.before}). It may be an older export. Replace anyway?`)) return uploadCsv(text, name, true);
    return;
  }
  if (!res.ok) {
    LI.toast(`<span class="pill neglected">Couldn't save ${LI.esc(name)}</span> ${LI.esc(body.error || res.statusText)}`, 8000);
    return;
  }
  if (LI.loadText(text, { source: name })) {
    const added = body.rows - body.before;
    if (body.before && added > 0) LI.toast(`<span class="pill ok">Saved</span> ${added} new set${added === 1 ? "" : "s"} from ${LI.esc(name)}, now on every device.`);
  }
}

init();
