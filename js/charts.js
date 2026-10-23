// Thin wrapper around Chart.js that applies the shared look (tokens from CSS).
window.LI = window.LI || {};

LI.css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
LI.seriesColor = (i) => LI.css(`--series-${(i % 4) + 1}`);

const registry = new Map();

LI.destroyCharts = () => {
  for (const c of registry.values()) c.destroy();
  registry.clear();
};

function baseOptions({ yTitle, xTime, stacked, legend, yMin, suggestedMax, xMin, xMax }) {
  const muted = LI.css("--muted"), grid = LI.css("--grid"), text2 = LI.css("--text-2");
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: xTime ? "nearest" : "index", intersect: false, axis: "x" },
    plugins: {
      legend: legend ? { display: true, position: "top", align: "start", labels: { color: text2, boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 } } : { display: false },
      tooltip: {
        backgroundColor: LI.css("--surface"),
        titleColor: LI.css("--text"),
        bodyColor: text2,
        borderColor: LI.css("--axis"),
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
      },
    },
    scales: {
      x: {
        type: xTime ? "linear" : "category",
        stacked,
        min: xMin != null ? +xMin : undefined,
        max: xMax != null ? +xMax : undefined,
        grid: { display: false },
        border: { color: LI.css("--axis") },
        ticks: {
          color: muted,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
          ...(xTime ? { callback: (v) => LI.fmtShort(new Date(v)) } : {}),
        },
      },
      y: {
        stacked,
        beginAtZero: yMin == null,
        min: yMin ?? undefined,
        suggestedMax,
        grid: { color: grid },
        border: { display: false },
        ticks: { color: muted, maxTicksLimit: 6 },
        title: yTitle ? { display: true, text: yTitle, color: muted } : { display: false },
      },
    },
  };
}

// series: [{ label, points: [{x: Date, y}], color? }]
LI.lineChart = (canvas, series, opts = {}) => {
  const o = baseOptions({ ...opts, xTime: true, legend: series.length > 1 });
  // xFmt: x values that aren't dates (e.g. minutes of the day), shown with this formatter.
  if (opts.xFmt) o.scales.x.ticks.callback = (v) => opts.xFmt(v);
  if (opts.xStep) o.scales.x.ticks.stepSize = opts.xStep;
  o.plugins.tooltip.filter = (item) => !item.dataset.noTooltip;
  o.plugins.tooltip.callbacks = {
    title: (items) => (opts.xFmt ? opts.xFmt(items[0].parsed.x) : LI.fmtDate(new Date(items[0].parsed.x))),
    label: (item) => ` ${item.dataset.label}: ${opts.fmt ? opts.fmt(item.parsed.y) : LI.fmtNum(item.parsed.y)}`,
  };
  return mount(canvas, {
    type: "line",
    data: {
      datasets: series.map((s, i) => {
        const color = s.color || LI.seriesColor(i);
        return {
          label: s.label,
          data: s.points.map((p) => ({ x: +p.x, y: p.y })),
          borderColor: color,
          backgroundColor: color,
          borderWidth: s.width ?? 2,
          pointRadius: s.pointRadius ?? 4,
          pointHoverRadius: s.pointRadius === 0 ? 0 : 6,
          pointBorderColor: LI.css("--surface"),
          pointBorderWidth: 2,
          tension: s.tension ?? 0.25,
          borderDash: s.dashed ? [5, 4] : undefined,
          // A shaded range: fill down to another series ("-1" = the previous one).
          fill: s.fill ?? false,
          ...(s.fill ? { backgroundColor: s.fillColor } : {}),
          noTooltip: s.noTooltip,
        };
      }),
    },
    options: o,
    plugins: opts.plugins || [],
  });
};

// labels: string[]; series: [{ label, values: number[] }]
// Labels and bar colors for time buckets. The last bucket is often still in progress: label it
// "(so far)" and draw it lighter, so it doesn't read as a drop.
LI.bucketStyle = (buckets) => {
  const partial = buckets.length && buckets[buckets.length - 1].end > new Date();
  const last = buckets.length - 1;
  return {
    labels: buckets.map((b, i) => (partial && i === last ? `${b.label} (so far)` : b.label)),
    color: buckets.map((b, i) => `${LI.seriesColor(0)}${partial && i === last ? "66" : ""}`), // hex + alpha
  };
};

LI.barChart = (canvas, labels, series, opts = {}) => {
  const o = baseOptions({ ...opts, legend: series.length > 1, stacked: !!opts.stacked });
  if (opts.horizontal) {
    o.indexAxis = "y";
    [o.scales.x, o.scales.y] = [o.scales.y, o.scales.x];
    o.scales.x.type = "linear";
    o.scales.y.type = "category";
    o.interaction.axis = "y";
  }
  o.plugins.tooltip.callbacks = {
    label: (item) => ` ${item.dataset.label}: ${opts.fmt ? opts.fmt(item.raw) : LI.fmtNum(item.raw)}`,
  };
  return mount(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.values,
        backgroundColor: s.color || LI.seriesColor(i),
        borderColor: LI.css("--surface"),
        borderWidth: opts.stacked ? { top: 2 } : 0,
        borderRadius: 4,
        borderSkipped: "start",
        maxBarThickness: 28,
      })),
    },
    options: o,
    plugins: opts.plugins || [],
  });
};

// Shades a recommended range behind the data, e.g. the weekly sets target.
LI.bandPlugin = (lo, hi) => ({
  id: "band",
  beforeDatasetsDraw(c) {
    const y = c.scales.y, { left, right } = c.chartArea, ctx = c.ctx;
    if (y.max < lo) return;
    ctx.save();
    ctx.fillStyle = LI.css("--good") + "22";
    const top = y.getPixelForValue(Math.min(hi, y.max)), bottom = y.getPixelForValue(lo);
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.restore();
  },
});

function mount(canvas, config) {
  if (registry.has(canvas)) registry.get(canvas).destroy();
  const chart = new Chart(canvas, config);
  registry.set(canvas, chart);
  return chart;
}

// Sequential color for magnitude 0..1 (0 = empty).
LI.seqColor = (t) => {
  if (!t || t <= 0) return LI.css("--seq-0");
  const step = Math.min(5, 1 + Math.floor(t * 4.999));
  return LI.css(`--seq-${step}`);
};

// Continuous version for the body map: blends between ramp steps so small
// differences in sets/week still show. Uses CSS vars, so it follows the theme.
LI.seqColorSmooth = (t) => {
  if (!t || t <= 0) return "var(--seq-0)";
  const pos = Math.min(1, t) * 4, i = Math.min(3, Math.floor(pos)), f = pos - i;
  return `color-mix(in oklab, var(--seq-${i + 2}) ${Math.round(f * 100)}%, var(--seq-${i + 1}))`;
};
