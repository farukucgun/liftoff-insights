// Export a list of workouts as CSV, JSON, Markdown, Excel or a printable PDF.
window.LI = window.LI || {};

const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

LI.exportRows = (workouts) => {
  const unit = LI.state.displayUnit;
  return workouts.flatMap((w) =>
    w.exercises.flatMap((e) =>
      e.sets.map((s, i) => ({
        Date: w.id,
        Workout: w.name,
        [`Bodyweight (${unit})`]: r2(LI.toDisplay(w.bodyweight)),
        "Duration (min)": w.durationMin == null ? null : Math.round(w.durationMin),
        Exercise: e.name,
        Set: i + 1,
        [`Weight (${unit})`]: r2(LI.toDisplay(s.kg)),
        Reps: s.reps,
        Distance: s.distance,
        Seconds: s.seconds,
        RPE: s.rpe,
        Notes: s.notes,
        [`Load incl. bodyweight (${unit})`]: r2(LI.toDisplay(s.load)),
        [`Volume (${unit})`]: r2(LI.toDisplay(s.volume)),
        [`e1RM (${unit})`]: r2(LI.toDisplay(s.e1rm)),
        "Raw weight": s.rawWeight,
        "Raw unit": s.rawUnit,
        Edited: s.edited ? "yes" : "",
      }))
    )
  );
};

LI.toCSV = (workouts) => Papa.unparse(LI.exportRows(workouts));

LI.toJSON = (workouts) => {
  const unit = LI.state.displayUnit;
  const conv = (kg) => r2(LI.toDisplay(kg));
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      unit,
      workouts: workouts.map((w) => ({
        date: w.id,
        name: w.name || null,
        bodyweight: conv(w.bodyweight),
        durationMin: w.durationMin == null ? null : Math.round(w.durationMin),
        volume: conv(w.volume),
        exercises: w.exercises.map((e) => ({
          name: e.name,
          muscles: { primary: LI.exerciseInfo(e.name).primary, secondary: LI.exerciseInfo(e.name).secondary },
          sets: e.sets.map((s) => ({
            weight: conv(s.kg),
            reps: s.reps,
            distance: s.distance,
            seconds: s.seconds,
            rpe: s.rpe,
            notes: s.notes || null,
            e1rm: conv(s.e1rm),
            rawWeight: s.rawWeight,
            rawUnit: s.rawUnit,
            edited: s.edited,
          })),
        })),
      })),
    },
    null,
    2
  );
};

LI.setText = (s) => {
  const parts = [];
  if (s.kg > 0) parts.push(`${LI.fmtWU(s.kg)} × ${s.reps}`);
  else if (s.reps > 0) parts.push(`${s.reps} reps${s.load > 0 ? ` (BW ${LI.fmtWU(s.load)})` : ""}`);
  if (s.distance > 0) parts.push(`${LI.fmtNum(s.distance, 2)} dist`);
  if (s.seconds > 0) parts.push(LI.fmtSeconds(s.seconds));
  if (s.rpe != null) parts.push(`RPE ${s.rpe}`);
  if (s.notes) parts.push(`“${s.notes}”`);
  return parts.join(" · ") || "–";
};

LI.fmtSeconds = (sec) => {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
};

LI.workoutMeta = (w) =>
  [
    w.name,
    w.bodyweight != null ? `Bodyweight ${LI.fmtWU(w.bodyweight)}` : "",
    w.durationMin != null ? `${Math.round(w.durationMin)} min` : "",
    `${w.sets.length} sets`,
    `Volume ${LI.fmtVol(w.volume)} ${LI.state.displayUnit}`,
  ].filter(Boolean).join(" · ");

LI.toMarkdown = (workouts) => {
  const out = [`# Workout log`, ``, `_Exported ${LI.fmtDate(new Date())} · weights in ${LI.state.displayUnit}_`, ``];
  for (const w of [...workouts].reverse()) {
    out.push(`## ${LI.fmtDate(w.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`);
    out.push(``, LI.workoutMeta(w), ``);
    for (const e of w.exercises) {
      out.push(`### ${e.name}`);
      e.sets.forEach((s, i) => out.push(`${i + 1}. ${LI.setText(s)}`));
      out.push(``);
    }
  }
  return out.join("\n");
};

LI.toXlsx = (workouts) => {
  const wb = XLSX.utils.book_new();
  const unit = LI.state.displayUnit;
  const summary = workouts.map((w) => ({
    Date: w.id,
    Workout: w.name,
    [`Bodyweight (${unit})`]: r2(LI.toDisplay(w.bodyweight)),
    "Duration (min)": w.durationMin == null ? null : Math.round(w.durationMin),
    Exercises: w.exercises.length,
    Sets: w.sets.length,
    Reps: w.totalReps,
    [`Volume (${unit})`]: r2(LI.toDisplay(w.volume)),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(LI.exportRows(workouts)), "All sets");
  const used = new Set(["Summary", "All sets"]);
  for (const w of workouts) {
    let name = w.id.slice(0, 16).replace(/:/g, ".");
    while (used.has(name)) name += "_";
    used.add(name);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(LI.exportRows([w])), name.slice(0, 31));
  }
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
};

LI.printWorkouts = (workouts, title) => {
  const area = document.getElementById("print-area");
  area.innerHTML =
    `<h1>${LI.esc(title)}</h1><p>Weights in ${LI.state.displayUnit} · printed ${LI.fmtDate(new Date())}</p>` +
    [...workouts].reverse().map((w) => `
      <section class="print-workout">
        <h2>${LI.fmtDate(w.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
        <p>${LI.esc(LI.workoutMeta(w))}</p>
        <table>
          <thead><tr><th>Exercise</th><th>Set</th><th>Weight</th><th>Reps</th><th>Other</th></tr></thead>
          <tbody>${w.exercises.map((e) => e.sets.map((s, i) => `
            <tr><td>${i === 0 ? LI.esc(e.name) : ""}</td><td>${i + 1}</td>
            <td>${s.kg > 0 ? LI.fmtW(s.kg) : s.load > 0 ? "BW" : "–"}</td><td>${s.reps || "–"}</td>
            <td>${[s.distance > 0 ? `dist ${s.distance}` : "", s.seconds > 0 ? LI.fmtSeconds(s.seconds) : "", s.rpe != null ? `RPE ${s.rpe}` : "", LI.esc(s.notes)].filter(Boolean).join(" · ")}</td></tr>`).join("")).join("")}
          </tbody>
        </table>
      </section>`).join("");
  window.print();
};

LI.download = (data, filename, type) => {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

LI.exportAs = (format, workouts, baseName) => {
  switch (format) {
    case "csv": return LI.download(LI.toCSV(workouts), `${baseName}.csv`, "text/csv;charset=utf-8");
    case "json": return LI.download(LI.toJSON(workouts), `${baseName}.json`, "application/json");
    case "md": return LI.download(LI.toMarkdown(workouts), `${baseName}.md`, "text/markdown;charset=utf-8");
    case "xlsx": return LI.download(new Blob([LI.toXlsx(workouts)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${baseName}.xlsx`);
    case "pdf": return LI.printWorkouts(workouts, baseName.startsWith("liftoff-history") ? "Workout history" : "Workout");
  }
};

LI.EXPORT_FORMATS = [
  ["csv", "CSV"],
  ["xlsx", "Excel"],
  ["json", "JSON"],
  ["md", "Markdown"],
  ["pdf", "PDF (print)"],
];

LI.exportButtons = () =>
  LI.EXPORT_FORMATS.map(([f, label]) => `<button class="btn small" data-export="${f}">${label}</button>`).join(" ");
