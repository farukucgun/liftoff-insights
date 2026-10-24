window.LI = window.LI || {};
LI.views = LI.views || {};

const GYM_LEVEL = { busier: ["under", "Busier than usual"], quieter: ["ok", "Quieter than usual"], usual: ["info", "About usual"] };

// Pieces of the "now" status: level pill, 30-minute trend, and how old the reading is.
LI.gymNowParts = (now) => {
  const [cls, label] = now.vs ? GYM_LEVEL[now.vs.level] : [];
  const trend = now.trend == null || now.stale ? "" : now.trend > 4 ? ` · ↑ ${now.trend} in 30 min` : now.trend < -4 ? ` · ↓ ${-now.trend} in 30 min` : " · steady";
  const age = now.ageMin < 1 ? "just now" : now.ageMin < 90 ? `${now.ageMin} min ago` : `${Math.round(now.ageMin / 60)} h ago`;
  return { cls, label, trend, age };
};

// Two numbers: people actually in the gym (adjusted, see LI.gymAdjust) and the gym's own
// checked-in count. Once this weekday and half hour has been seen before, how it compares too.
LI.gymCountRow = (now) => {
  const { cls, label } = LI.gymNowParts(now);
  return `<div class="gym-row">
    <span class="gym-stat"><span class="num">${now.adj}</span><span class="muted">in the gym</span></span>
    <span class="gym-stat raw" title="The gym's own count. It includes people who left without checking out, until they're cleared at night."><span class="num">${now.count}</span><span class="muted">checked in</span></span>
    ${now.vs ? `<span class="pill ${cls}">${label}</span><span class="muted small">usually ~${now.vs.typical}</span>` : ""}
  </div>`;
};

// Gym days ("YYYY-MM-DD") counted in calendar days, so a daylight-saving change in between
// doesn't shift them, and shown as e.g. "Fri, Oct 30".
LI.gymDayAfter = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
LI.fmtGymDay = (day) => LI.fmtDate(new Date(`${day}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

LI.gymUpdated = (now) => {
  const { trend, age } = LI.gymNowParts(now);
  return `${now.stale ? "⚠ " : ""}Updated ${LI.fmtClock(now.minute)} (${age})${trend}`;
};

// Key for the 24-hour chart, named as in its tooltips. "Usual" only once there is one; its
// shaded range only where there's room to explain it.
LI.gymKey = ({ usual = false, band = false } = {}) => `<span class="gym-key"><i class="k-line"></i>In the gym</span>
  <span class="gym-key"><i class="k-raw"></i>Checked in</span>
  ${usual ? `<span class="gym-key"><i class="k-usual"></i>Usual</span>` : ""}
  ${usual && band ? `<span class="gym-key" title="Half of past days at this weekday and time were inside the shaded range"><i class="k-band"></i>Usual range</span>` : ""}`;

// The heatmap covers the hours you'd be at the gym.
const openRange = () => LI.GYM_HOURS;

// The 24 hours up to the latest reading against usual days: shaded = middle half of past
// days at that weekday and time, dashed = their median. x is minutes from midnight (gym time)
// of the window's first day, so ticks land on whole hours and the window can cross midnight.
LI.gymDayChart = (canvas, now) => {
  const end = new Date(Math.ceil(+now.t / 3600000) * 3600000);
  const startT = new Date(end - 24 * 3600000);
  const start = LI.gymTime(startT), last = LI.gymTime(end);
  const dayNo = (day) => Date.parse(`${day}T00:00:00Z`) / 86400000;
  const x = (g) => (dayNo(g.day) - dayNo(start.day)) * 1440 + g.minute;
  const [from, to] = [x(start), x(last)];
  const typical = LI.gymTypical([start.day, now.day, last.day]);
  const slots = [];
  for (let m = Math.floor(from / 30) * 30; m < to; m += 30) {
    const t = typical.get((start.dow + Math.floor(m / 1440)) % 7, (m % 1440) / 30);
    if (t) slots.push({ x: m + 15, ...t });
  }
  const recent = LI.gym.readings.filter((r) => r.t > startT && r.t <= end);
  const band = LI.css("--series-1") + "26";
  const series = slots.length ? [
    { label: "Usual (25%)", points: slots.map((s) => ({ x: s.x, y: s.q1 })), color: "transparent", pointRadius: 0, width: 0, noTooltip: true },
    { label: "Usual range", points: slots.map((s) => ({ x: s.x, y: s.q3 })), color: "transparent", pointRadius: 0, width: 0, fill: "-1", fillColor: band, noTooltip: true },
    { label: "Usual", points: slots.map((s) => ({ x: s.x, y: Math.round(s.median) })), color: LI.css("--muted"), pointRadius: 0, width: 1.5, dashed: true },
  ] : [];
  series.push({ label: "Checked in", points: recent.map((r) => ({ x: x(r), y: r.count })), color: LI.css("--axis"), pointRadius: 0, width: 1.5, tension: 0.3 });
  series.push({ label: "In the gym", points: recent.map((r) => ({ x: x(r), y: r.adj })), color: LI.seriesColor(0), pointRadius: 0, width: 2.5, tension: 0.3 });
  const chart = LI.lineChart(canvas, series, { xMin: from, xMax: to, xStep: 120, xFmt: (v) => LI.fmtClock(Math.round(v)), fmt: (v) => `${Math.round(v)} people` });
  chart.options.plugins.legend.display = false;
  chart.update();
  chart.$usual = slots.length > 0; // for LI.gymKey
  return chart;
};

LI.views.gym = (el, model) => {
  const st = LI.state;
  const now = LI.gymNow();
  if (!now) {
    el.innerHTML = `<div class="card"><h2>Gym</h2><p class="muted">No gym readings yet. They come from your gym-occupancy collector and are copied to the server every few minutes.</p></div>`;
    return;
  }
  const cov = LI.gymCoverage();
  const [from, to] = openRange();
  // Under a week in, most weekdays haven't been seen: say when they will be, not half a table.
  const ready = LI.gymDayAfter(LI.gymTime(cov.from).day, 7);
  const warmup = LI.gymTime(new Date()).day < ready
    ? `<p class="muted" style="margin:0">Fills in once every weekday has been seen, from ${LI.fmtGymDay(ready)}.</p>` : "";

  // Hourly heatmap: median people per weekday and hour, all days.
  const cells = new Map();
  for (const r of LI.gym.readings) {
    const k = `${r.dow}|${Math.floor(r.minute / 60)}`;
    if (!cells.has(k)) cells.set(k, { counts: [], days: new Set() });
    cells.get(k).counts.push(r.adj);
    cells.get(k).days.add(r.day);
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
  const hours = [];
  for (let h = Math.floor(from / 60); h < Math.ceil(to / 60); h++) hours.push(h);
  const max = Math.max(1, ...[...cells.values()].map((c) => med(c.counts)));
  const nowHour = Math.floor(LI.gymTime(new Date()).minute / 60), nowDow = LI.gymTime(new Date()).dow;
  const heat = `<div class="gym-heat" style="--cols:${hours.length}">
    <span></span>${hours.map((h) => `<span class="gh-h">${h % 2 === 0 ? String(h).padStart(2, "0") : ""}</span>`).join("")}
    ${LI.WEEKDAYS.map((d, dow) => `<span class="gh-d">${d}</span>${hours.map((h) => {
      const c = cells.get(`${dow}|${h}`);
      const v = c ? med(c.counts) : null;
      const sel = st.gymCell === `${dow}|${h}`;
      return `<button class="gh-c ${dow === nowDow && h === nowHour ? "now" : ""} ${sel ? "sel" : ""}" data-cell="${dow}|${h}" style="background:${v == null ? "transparent" : LI.seqColor(v / max)}" title="${d} ${String(h).padStart(2, "0")}:00 · ${v == null ? "no data" : `~${v} people (${c.days.size} day${c.days.size === 1 ? "" : "s"})`}"></button>`;
    }).join("")}`).join("")}
  </div>`;
  const cellNote = (() => {
    if (!st.gymCell) return "Tap a cell for the number.";
    const [dow, h] = st.gymCell.split("|").map(Number);
    const c = cells.get(st.gymCell);
    return `<strong>${LI.WEEKDAYS[dow]} ${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00</strong>: ${c ? `about ${med(c.counts)} people, from ${c.days.size} day${c.days.size === 1 ? "" : "s"} of readings` : "no readings yet"}.`;
  })();

  el.innerHTML = `
    <div class="grid cols-2 gym-top">
      <div class="card">
        <div class="card-head"><h2>Right now</h2><span class="muted small">German time</span></div>
        ${LI.gymCountRow(now)}
        <p class="muted small" style="margin:10px 0 0">${LI.gymUpdated(now)}</p>
      </div>
      <div class="card">
        <div class="card-head"><h2>Best times for you</h2><span class="muted small">usual weekday, in your training hours</span></div>
        ${warmup || bestTimes(model)}
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>${now.ageMin < 120 ? "Last 24 hours" : `24 hours to ${LI.fmtDate(now.t, { weekday: "short", day: "numeric", month: "short", timeZone: LI.GYM_TZ })} ${LI.fmtClock(now.minute)}`}</h2></div>
      <div class="chart-box tall"><canvas id="g-day"></canvas></div>
      <div class="gym-foot muted small" id="g-key"></div>
      <p class="muted small" id="g-usual" hidden style="margin:6px 0 0">Usual: the middle value of past days at that weekday and time. Half of those days fall inside the shaded range.</p>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Usual week</h2><span class="muted small">median people per hour · outlined = now</span></div>
      ${warmup || `${heat}
      <div class="cal-legend">Empty ${[0.05, 0.25, 0.5, 0.75, 1].map((t) => `<span class="cal-cell" style="display:inline-block;background:${LI.seqColor(t)}"></span>`).join("")} Busy</div>
      <p class="small" id="g-cell" style="margin:8px 0 0">${cellNote}</p>`}
    </div>
    ${resetNote()}
    <p class="muted small" style="margin-top:12px">Usual week shows ${LI.fmtClock(from)}–${LI.fmtClock(to % 1440)}. Readings every 10 minutes from your gym-occupancy collector: ${cov.days} day${cov.days === 1 ? "" : "s"} so far (since ${LI.fmtShort(cov.from)}). “Usual” needs a few weeks of data to settle, so treat early numbers as rough.</p>`;

  const day = LI.gymDayChart(el.querySelector("#g-day"), now);
  el.querySelector("#g-key").innerHTML = LI.gymKey({ usual: day.$usual, band: true });
  if (day.$usual) el.querySelector("#g-usual").hidden = false;
  el.querySelectorAll("[data-cell]").forEach((b) => (b.onclick = () => {
    st.gymCell = st.gymCell === b.dataset.cell ? null : b.dataset.cell;
    LI.render();
  }));
};

// Explains the adjustment, with last night's numbers, so the two counts make sense.
function resetNote() {
  const resets = LI.gymResets();
  if (!resets.length) return "";
  const last = resets[0];
  const range = resets.length > 1 ? ` (${Math.min(...resets.map((r) => r.cleared))}–${Math.max(...resets.map((r) => r.cleared))} on the ${resets.length} nights so far)` : "";
  return `<div class="card" style="margin-top:16px">
    <div class="card-head"><h2>How the count is adjusted</h2></div>
    <p class="small" style="margin:0 0 8px">The gym counts everyone who checked in and hasn't checked out. People who leave without checking out stay counted until the system clears everyone at ${LI.fmtClock(last.minute - (last.minute % 10))} (midnight UTC): last night that was <strong>${last.cleared} people</strong>${range}.</p>
    <p class="small" style="margin:0">They pile up through the day, so the app takes off a share of that night's clear-out: as much of it as a usual day's visits are over by then. Early in the day that's almost nothing; by late evening it's nearly all of it. Today's clear-out isn't known until tonight, so it's estimated from the same weekday last week and recent nights. Charts and the usual week use the adjusted numbers. It's rough until there are a few weeks of nights to learn from.</p>
  </div>`;
}

// The quietest half hour per weekday inside the hours you usually start training,
// from your Liftoff start times (Liftoff's time is the start, in gym time). Late sessions run
// past midnight, so a start before 05:00 counts as that night (minute 1440+), not the morning.
function bestTimes(model) {
  const starts = model.workouts.slice(-40).map((w) => {
    const m = w.date.getHours() * 60 + w.date.getMinutes();
    return m < 5 * 60 ? m + 1440 : m;
  }).sort((a, b) => a - b);
  if (starts.length < 3) return `<p class="muted">Log a few more workouts to learn your usual training hours.</p>`;
  const pick = (q) => starts[Math.round((starts.length - 1) * q)];
  // Your usual starts, kept inside the hours shown (14:00–24:00).
  const lo = Math.max(LI.GYM_HOURS[0], Math.floor(pick(0.2) / 30) * 30);
  const hi = Math.min(LI.GYM_HOURS[1] - 30, Math.ceil(pick(0.8) / 30) * 30);
  const typical = LI.gymTypical(null);
  const rows = LI.WEEKDAYS.map((d, dow) => {
    let best = null;
    for (let s = lo / 30; s <= hi / 30; s++) {
      // Past midnight is the next calendar day, but still this weekday's session.
      const t = s >= 48 ? typical.get((dow + 1) % 7, s - 48) : typical.get(dow, s);
      if (t && (!best || t.median < best.median)) best = { slot: s % 48, ...t };
    }
    return best && { d, dow, ...best };
  }).filter(Boolean).sort((a, b) => a.median - b.median);
  if (!rows.length) return `<p class="muted">You usually start between ${LI.fmtClock(lo)} and ${LI.fmtClock(hi)}. There aren't readings for those hours yet.</p>`;
  const top = rows.slice(0, 4);
  return `<p class="muted small" style="margin:0 0 6px">You usually start between <strong>${LI.fmtClock(lo)}</strong> and <strong>${LI.fmtClock(hi)}</strong> (your last ${starts.length} workouts).</p>
    <table class="gym-best"><tbody>${top.map((r, i) => `<tr><td><strong>${r.d}</strong> ${LI.fmtClock(r.slot * 30)}</td><td class="r num">~${Math.round(r.median)} people</td><td class="muted small r">${r.days} day${r.days === 1 ? "" : "s"} of data</td>${i === 0 ? `<td><span class="pill ok">Quietest</span></td>` : "<td></td>"}</tr>`).join("")}</tbody></table>
    ${rows.length > top.length ? `<p class="muted small" style="margin:6px 0 0">Busiest in that window: ${rows[rows.length - 1].d} (~${Math.round(rows[rows.length - 1].median)} at its quietest).</p>` : ""}`;
}
