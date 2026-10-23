// Exercise -> muscle mapping. Primary muscles get 1 set credit, secondary 0.5.
// bw: share of bodyweight moved when the set is logged with no weight
// (1 for pull-ups/dips, 0 for ab work where bodyweight isn't a meaningful load).
window.LI = window.LI || {};

LI.MUSCLES = [
  "Chest", "Front Delts", "Side Delts", "Rear Delts", "Lats", "Upper Back",
  "Biceps", "Triceps", "Forearms", "Abs", "Lower Back",
  "Quads", "Hamstrings", "Glutes", "Calves",
];

LI.MUSCLE_GROUPS = {
  push: ["Chest", "Front Delts", "Side Delts", "Triceps"],
  pull: ["Lats", "Upper Back", "Rear Delts", "Biceps"],
  legs: ["Quads", "Hamstrings", "Glutes", "Calves"],
};

LI.EXERCISE_MAP = {
  "Bench Press":                     { primary: ["Chest"], secondary: ["Front Delts", "Triceps"] },
  "Machine Chest Fly":               { primary: ["Chest"], secondary: ["Front Delts"] },
  "Dips":                            { primary: ["Chest", "Triceps"], secondary: ["Front Delts"], bw: 1 },
  "Machine Shoulder Press":          { primary: ["Front Delts"], secondary: ["Side Delts", "Triceps"] },
  "Cable Lateral Raise":             { primary: ["Side Delts"], secondary: [] },
  "Dumbbell Lateral Raise":          { primary: ["Side Delts"], secondary: [] },
  "Machine Reverse Fly":             { primary: ["Rear Delts"], secondary: ["Upper Back"] },
  "Pull Ups":                        { primary: ["Lats"], secondary: ["Biceps", "Upper Back", "Forearms"], bw: 1 },
  "Lat Pulldown":                    { primary: ["Lats"], secondary: ["Biceps", "Upper Back"] },
  "Iso-Lateral High Row":            { primary: ["Lats", "Upper Back"], secondary: ["Biceps", "Rear Delts"] },
  "Iso-Lateral Low Row":             { primary: ["Upper Back", "Lats"], secondary: ["Biceps", "Rear Delts"] },
  "Machine Row":                     { primary: ["Upper Back"], secondary: ["Lats", "Rear Delts", "Biceps"] },
  "Bent Over Row":                   { primary: ["Upper Back", "Lats"], secondary: ["Biceps", "Rear Delts", "Lower Back"] },
  "Machine Bicep Curl":              { primary: ["Biceps"], secondary: [] },
  "Cable Bicep Curl":                { primary: ["Biceps"], secondary: ["Forearms"] },
  "Preacher Curl":                   { primary: ["Biceps"], secondary: ["Forearms"] },
  "Cable Overhead Tricep Extension": { primary: ["Triceps"], secondary: [] },
  "Cable Crunch":                    { primary: ["Abs"], secondary: [] },
  "Machine Seated Crunch":           { primary: ["Abs"], secondary: [] },
  "Decline Crunch":                  { primary: ["Abs"], secondary: [], bw: 0 },
  "Captain's Chair Knee Raise":      { primary: ["Abs"], secondary: [], bw: 0 },
  "Captain's Chair Leg Raise":       { primary: ["Abs"], secondary: [], bw: 0 },
  "Back Extension":                  { primary: ["Lower Back"], secondary: ["Glutes", "Hamstrings"], bw: 0 },
  "Squat":                           { primary: ["Quads", "Glutes"], secondary: ["Hamstrings", "Lower Back"] },
  "Leg Extension":                   { primary: ["Quads"], secondary: [] },
  "Machine Calf Raise":              { primary: ["Calves"], secondary: [] },
};

// Weighted variants of bodyweight exercises are merged into the base exercise,
// so a "Weighted Pull Ups" set is a Pull Ups set with added weight (Weight = added load).
LI.EXERCISE_ALIASES = [
  [/^weighted\s+pull[\s-]?ups?$/i, "Pull Ups"],
  [/^weighted\s+dips?$/i, "Dips"],
  [/^pull[\s-]?ups?\s*\((weighted|added weight)\)$/i, "Pull Ups"],
  [/^dips?\s*\((weighted|added weight)\)$/i, "Dips"],
];

LI.canonicalExercise = (name) => {
  const hit = LI.EXERCISE_ALIASES.find(([re]) => re.test(name));
  return hit ? hit[1] : name;
};

// Fallback guesses for exercises added later, by keyword. Shown as "guessed"
// on the Muscles tab so they can be corrected.
LI.EXERCISE_GUESSES = [
  [/calf/i,                      { primary: ["Calves"], secondary: [] }],
  [/reverse pec|reverse (cable )?fly|face ?pull|rear delt/i, { primary: ["Rear Delts"], secondary: ["Upper Back"] }],
  [/pec deck/i,                  { primary: ["Chest"], secondary: ["Front Delts"] }],
  [/pull.?over|pull.?in/i,       { primary: ["Lats"], secondary: [] }],
  [/kickback|pressdown|push.?down|skull/i, { primary: ["Triceps"], secondary: [] }],
  [/glute.?ham|nordic/i,         { primary: ["Hamstrings"], secondary: ["Glutes"] }],
  [/hammer curl/i,               { primary: ["Biceps"], secondary: ["Forearms"] }],
  [/lateral raise/i,             { primary: ["Side Delts"], secondary: [] }],
  [/reverse fly|face pull|rear delt/i, { primary: ["Rear Delts"], secondary: ["Upper Back"] }],
  [/bench|chest press|push.?up|fly/i, { primary: ["Chest"], secondary: ["Front Delts", "Triceps"] }],
  [/shoulder press|overhead press|military/i, { primary: ["Front Delts"], secondary: ["Side Delts", "Triceps"] }],
  [/pull.?up|chin.?up|pulldown/i, { primary: ["Lats"], secondary: ["Biceps", "Upper Back"] }],
  [/row/i,                       { primary: ["Upper Back", "Lats"], secondary: ["Biceps", "Rear Delts"] }],
  [/shrug/i,                     { primary: ["Upper Back"], secondary: [] }],
  [/curl/i,                      { primary: ["Biceps"], secondary: ["Forearms"] }],
  [/tricep|pushdown|skull/i,     { primary: ["Triceps"], secondary: [] }],
  [/deadlift|rdl|good morning/i, { primary: ["Hamstrings", "Glutes"], secondary: ["Lower Back"] }],
  [/leg curl|hamstring/i,        { primary: ["Hamstrings"], secondary: [] }],
  [/squat|leg press|lunge|split/i, { primary: ["Quads", "Glutes"], secondary: ["Hamstrings"] }],
  [/hip thrust|glute/i,          { primary: ["Glutes"], secondary: ["Hamstrings"] }],
  [/leg extension/i,             { primary: ["Quads"], secondary: [] }],
  [/calf/i,                      { primary: ["Calves"], secondary: [] }],
  [/crunch|plank|leg raise|knee raise|sit.?up|ab /i, { primary: ["Abs"], secondary: [], bw: 0 }],
];
