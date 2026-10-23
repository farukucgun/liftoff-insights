window.LI = window.LI || {};
LI.views = LI.views || {};

LI.views.overview = (el, model) => {
  const u = LI.state.displayUnit;
  const range = LI.periodRange(model, LI.state.periods.overview);
  const all = range.key === "all";
  const prevRange = { from: range.prevFrom, to: new Date(+range.from - 1) };
  const ws = model.workouts.filter((w) => LI.inRange(w.date, range));
  const prev = all ? [] : model.workouts.filter((w) => LI.inRange(w.date, prevRange));
  const vs = `previous ${range.short}`;

  const sum = (list, f) => list.reduce((t, w) => t + f(w), 0);
  const avgDur = (list) => {
    const d = list.map((w) => w.durationMin).filter((x) => x != null);
    return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
  };
  // Per-week rates only count days since you started logging.
  const weeks = Math.min(range.days, LI.daysBetween(model.first, new Date()) + 1) / 7;
  const change = (cur, before) => (all || !prev.length ? "" : LI.fmtChange(cur, before, vs));

  // Week streak: consecutive weeks (ending this week or last) with at least one workout. Always all-time.
  const allWeeks = LI.buckets(LI.periodRange(model, "all")).map((b) => model.workouts.some((w) => w.date >= b.start && w.date < b.end));
  let streak = 0;
  for (let i = allWeeks[allWeeks.length - 1] ? allWeeks.length - 1 : allWeeks.length - 2; i >= 0 && allWeeks[i]; i--) streak++;

  let longestGap = 0;
  for (let i = 1; i < ws.length; i++) longestGap = Math.max(longestGap, LI.daysBetween(ws[i - 1].date, ws[i].date));
  const sinceLast = LI.daysBetween(model.last, new Date());

  const bws = model.bodyweights.filter((b) => LI.inRange(b.date, range));
  const lastBw = bws[bws.length - 1], firstBw = bws[0];
  const vol = sum(ws, (w) => w.volume), sets = sum(ws, (w) => w.sets.length);
  const dur = avgDur(ws);

  const next = LI.nextProgramDay(model);
  const tile = (label, value, sub) =>
    `<div class="card tile"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub || "&nbsp;"}</div></div>`;

  const gymNow = LI.gymNow();
  el.innerHTML = `
    <div class="ov-top ${gymNow ? "with-gym" : ""}">
    ${gymNow ? `<a class="card gym-card" href="#gym" aria-label="Gym: ${gymNow.count} people now. Open the Gym page">
      <div class="card-head"><h2>Gym now</h2><span class="muted small">More →</span></div>
      ${gymCardBody(gymNow)}
    </a>` : ""}
    <div class="card">
      <div class="card-head"><h2>Training calendar</h2><span class="muted small">${sinceLast === 0 ? "Trained today" : `Last workout ${sinceLast} day${sinceLast === 1 ? "" : "s"} ago`} · ${streak} week streak</span></div>
      <div id="cal"></div>
    </div>
    </div>

    <div class="toolbar" style="margin:16px 0 12px">
      ${LI.periodSelect("o-period", range.key)}
      <span class="muted small">${LI.fmtShort(range.from)} – ${LI.fmtShort(range.to)}${all ? "" : ` · changes compared with the ${range.short} before`}</span>
    </div>

    ${ws.length ? `
    <div class="tiles">
      ${tile("Workouts", ws.length, change(ws.length, prev.length) ? `${change(ws.length, prev.length)} · ${LI.fmtNum(ws.length / weeks, 1)}/week` : `${LI.fmtNum(ws.length / weeks, 1)} per week`)}
      ${tile("Next up", `<a href="#program">${next.day.name}</a>`, next.after ? `after ${next.after.match.day.name} on ${LI.fmtShort(next.after.workout.date)}` : `${next.day.items.length} exercises · ${next.day.time}`)}
      ${tile("Sets", sets, change(sets, sum(prev, (w) => w.sets.length)) || `${LI.fmtNum(sets / ws.length, 0)} per workout`)}
      ${tile(`Volume (${u})`, LI.fmtVol(vol), change(vol, sum(prev, (w) => w.volume)) || `${LI.fmtVol(vol / ws.length)} per workout`)}
      ${tile("Avg duration", dur ? `${Math.round(dur)} min` : "–", (prev.length && dur && avgDur(prev) ? LI.fmtChange(dur, avgDur(prev), vs) : "") || (ws.length > 1 ? `Longest gap ${longestGap} days` : ""))}
      ${tile("Bodyweight", lastBw ? LI.fmtWU(lastBw.kg) : "–",
        lastBw && firstBw && lastBw !== firstBw ? (Math.abs(lastBw.kg - firstBw.kg) < 0.05 ? `no change since ${LI.fmtShort(firstBw.date)}` : `${lastBw.kg > firstBw.kg ? "+" : "−"}${LI.fmtW(Math.abs(lastBw.kg - firstBw.kg))} since ${LI.fmtShort(firstBw.date)}`) : lastBw ? `on ${LI.fmtShort(lastBw.date)}` : "None logged in this period")}
    </div>

    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2 id="h-vol"></h2><span class="muted small">${u} × reps</span></div><div class="chart-box"><canvas id="c-vol"></canvas></div></div>
      <div class="card"><div class="card-head"><h2 id="h-sets"></h2><span class="muted small">working sets logged</span></div><div class="chart-box"><canvas id="c-sets"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>Bodyweight</h2><span class="muted small">from workout names</span></div><div class="chart-box"><canvas id="c-bw"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>Workout duration</h2><span class="muted small">minutes</span></div><div class="chart-box"><canvas id="c-dur"></canvas></div></div>
    </div>` : `<div class="card"><p class="muted">No workouts in this period. Last workout was ${LI.fmtDate(model.last)}.</p></div>`}`;

  renderCalendar(el.querySelector("#cal"), model);
  if (gymNow) {
    const c = LI.gymDayChart(el.querySelector("#o-gym"), gymNow);
    c.options.scales.y.ticks.maxTicksLimit = 3;
    c.options.scales.x.ticks.maxTicksLimit = 5;
    c.update();
  }
  el.querySelector("#o-period").onchange = (e) => LI.setPeriod("overview", e.target.value);
  if (!ws.length) return;

  const buckets = LI.buckets(range);
  const per = buckets.size === "day" ? "Daily" : "Weekly";
  el.querySelector("#h-vol").textContent = `${per} volume`;
  el.querySelector("#h-sets").textContent = `${per} sets`;
  const { labels, color } = LI.bucketStyle(buckets);
  LI.barChart(el.querySelector("#c-vol"), labels, [{ label: "Volume", values: LI.bucketSum(buckets, model.sets, range, (s) => LI.toDisplay(s.volume)).map(Math.round), color }], { fmt: (v) => `${LI.fmtNum(v, 0)} ${u}` });
  LI.barChart(el.querySelector("#c-sets"), labels, [{ label: "Sets", values: LI.bucketSum(buckets, model.sets, range, () => 1), color }]);

  const xRange = { xMin: range.from, xMax: range.to };
  const bwCanvas = el.querySelector("#c-bw");
  if (bws.length) {
    const vals = bws.map((b) => LI.toDisplay(b.kg));
    LI.lineChart(bwCanvas, [{ label: "Bodyweight", points: bws.map((b) => ({ x: b.date, y: LI.toDisplay(b.kg) })) }],
      { ...xRange, yMin: Math.floor(Math.min(...vals) - 2), fmt: (v) => `${LI.fmtNum(v)} ${u}` });
  } else {
    bwCanvas.parentElement.innerHTML = `<p class="muted">No bodyweight logged in this period. Type it as the workout name in Liftoff (e.g. <code>71.5</code>).</p>`;
  }

  LI.lineChart(el.querySelector("#c-dur"), [{ label: "Duration", points: ws.filter((w) => w.durationMin != null).map((w) => ({ x: w.date, y: Math.round(w.durationMin) })) }],
    { ...xRange, fmt: (v) => `${v} min` });
};

// Overview gym card: count and how it compares up top, the last 24 hours filling the middle,
// and a key plus the reading's age along the bottom.
function gymCardBody(now) {
  return `${LI.gymCountRow(now)}
    <div class="gym-spark"><canvas id="o-gym"></canvas></div>
    <div class="gym-foot muted small">${LI.gymKey()}<span class="gym-upd">${LI.gymUpdated(now)}</span></div>`;
}

// Four weeks as a normal calendar: a row per week (newest at the bottom), Monday to Sunday
// across. Each day shows its date; the month labels the first row and any week a new month
// starts in, and the 1st says its month. Today is outlined. The arrows page back and forth by
// four weeks (LI.state.calPage: 0 = ending this week, 1 = the four before, ...).
function renderCalendar(el, model) {
  const byDay = new Map();
  for (const w of model.workouts) byDay.set(w.day, (byDay.get(w.day) || 0) + w.volume);
  const max = Math.max(...byDay.values());
  const today = LI.startOfDay(new Date());
  const thisWeek = LI.weekStart(today);
  const day = (wk, i) => new Date(wk.getFullYear(), wk.getMonth(), wk.getDate() + i);
  const lastPage = Math.floor((thisWeek - LI.weekStart(model.first)) / (7 * 86400000) / 4 + 1e-6);
  const page = Math.min(Math.max(0, LI.state.calPage || 0), lastPage);
  const weeks = [3, 2, 1, 0].map((n) => day(thisWeek, -7 * (n + 4 * page)));
  const fmt = (d) => LI.fmtDate(d, { day: "numeric", month: "short" });
  const month = (d) => LI.fmtDate(d, { month: "short" });
  let html = `<span></span>${LI.WEEKDAYS.map((d) => `<span class="cal-d">${d}</span>`).join("")}`;
  weeks.forEach((wk, r) => {
    const first = [...Array(7)].map((_, i) => day(wk, i)).find((d) => d.getDate() === 1);
    html += `<span class="cal-m">${first ? month(first) : r === 0 ? month(wk) : ""}</span>`;
    for (let i = 0; i < 7; i++) {
      const d = day(wk, i);
      if (d > today) { html += `<div class="cal-cell empty"></div>`; continue; }
      const v = byDay.get(LI.dayKey(d)) || 0;
      const t = v / max, strong = t > 0 && Math.min(5, 1 + Math.floor(t * 4.999)) >= 4;
      const title = `${LI.fmtDate(d, { weekday: "short", day: "numeric", month: "short" })}${v ? ` · ${LI.fmtVol(v)} ${LI.state.displayUnit}` : " · rest"}`;
      html += `<div class="cal-cell ${v ? "on" : ""} ${strong ? "strong" : ""} ${+d === +today ? "today" : ""}" style="background:${LI.seqColor(t)}" title="${title}">${d.getDate() === 1 ? `${d.getDate()} ${month(d)}` : d.getDate()}</div>`;
    }
  });
  el.innerHTML = `<div class="cal-nav">
      <button class="btn ghost small" data-cal="1" aria-label="Earlier four weeks" ${page >= lastPage ? "disabled" : ""}>‹</button>
      <span class="small">${fmt(weeks[0])} – ${fmt(day(weeks[3], 6))}</span>
      <button class="btn ghost small" data-cal="-1" aria-label="Later four weeks" ${page === 0 ? "disabled" : ""}>›</button>
      ${page ? `<button class="btn ghost small" data-cal="0">This week</button>` : ""}
    </div>
    <div class="cal">${html}</div>
    <div class="cal-legend">Rest ${[0, 0.2, 0.45, 0.7, 1].map((t) => `<span class="cal-cell" style="display:inline-block;background:${LI.seqColor(t)}"></span>`).join("")} More volume</div>`;
  el.querySelectorAll("[data-cal]").forEach((b) => (b.onclick = (e) => {
    e.preventDefault();
    const step = +b.dataset.cal;
    LI.state.calPage = step ? page + step : 0;
    renderCalendar(el, model);
  }));
}
