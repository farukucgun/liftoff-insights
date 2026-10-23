// The training programs, and how logged workouts compare with the one being followed.
window.LI = window.LI || {};

// Exercises the programs use. Muscles follow the credit rule used everywhere else
// (primary 1 set, secondary ½) and drive each program's planned weekly sets per muscle.
// also lists exercises from the Liftoff log close enough to count for the exercise;
// inc is the weight step (kg) when the rep range is beaten.
const EX = {
  "Bench Press": { m: [["Chest"], ["Front Delts", "Triceps"]] },
  "Flat Dumbbell Press": { m: [["Chest"], ["Front Delts", "Triceps"]] },
  "Incline Dumbbell Press": { m: [["Chest"], ["Front Delts", "Triceps"]] },
  "Pec Deck": { m: [["Chest"], ["Front Delts"]], also: ["Machine Chest Fly"] },
  "Cable Fly": { m: [["Chest"], ["Front Delts"]], also: ["Machine Chest Fly"] },
  "Overhead Barbell Press": { m: [["Front Delts"], ["Side Delts", "Triceps"]], also: ["Machine Shoulder Press"] },
  "Dumbbell Lateral Raise": { m: [["Side Delts"]], inc: 1 },
  "Cable Lateral Raise": { m: [["Side Delts"]], inc: 1 },
  "Reverse Pec Deck": { m: [["Rear Delts"], ["Upper Back"]], also: ["Machine Reverse Fly"] },
  "Barbell Row": { m: [["Upper Back", "Lats"], ["Biceps", "Rear Delts", "Lower Back"]], also: ["Bent Over Row"] },
  "Dumbbell Row": { m: [["Upper Back", "Lats"], ["Biceps", "Rear Delts"]], also: ["Machine Row", "Iso-Lateral Low Row", "Bent Over Row"] },
  "Chest-Supported T-Bar Row": { m: [["Upper Back", "Lats"], ["Biceps", "Rear Delts"]], also: ["Machine Row", "Iso-Lateral Low Row"] },
  "Pull-Up": { m: [["Lats"], ["Biceps", "Upper Back", "Forearms"]] },
  "Lat Pulldown": { m: [["Lats"], ["Biceps", "Upper Back"]] },
  "Cable Lat Pull-In": { m: [["Lats"]], also: ["Iso-Lateral High Row"] },
  "Barbell Shrug": { m: [["Upper Back"]], inc: 5 },
  "Preacher Curl": { m: [["Biceps"], ["Forearms"]] },
  "Hammer Curl": { m: [["Biceps"], ["Forearms"]], inc: 1 },
  "Bayesian Cable Curl": { m: [["Biceps"]], also: ["Cable Bicep Curl", "Machine Bicep Curl"], inc: 1 },
  "EZ-Bar Skullcrusher": { m: [["Triceps"]], also: ["Cable Overhead Tricep Extension"] },
  "Overhead Triceps Extension": { m: [["Triceps"]], also: ["Cable Overhead Tricep Extension"] },
  "Triceps Kickback (Cable)": { m: [["Triceps"]], inc: 1 },
  "Triceps Pressdown": { m: [["Triceps"]], inc: 1 },
  "Deadlift": { m: [["Glutes", "Hamstrings"], ["Lower Back", "Quads", "Forearms"]], inc: 5 },
  "Barbell Back Squat": { m: [["Quads", "Glutes"], ["Hamstrings", "Lower Back"]], also: ["Squat"], inc: 5 },
  "Leg Press": { m: [["Quads"], ["Glutes"]], inc: 5 },
  "Leg Extension": { m: [["Quads"]] },
  "Glute Ham Raise": { m: [["Hamstrings"], ["Glutes"]], also: ["Back Extension"] },
  "Seated Leg Curl": { m: [["Hamstrings"]] },
  "45° Back Extension": { m: [["Lower Back"], ["Glutes", "Hamstrings"]], also: ["Back Extension"] },
  "Seated Calf Raise": { m: [["Calves"]], also: ["Machine Calf Raise"] },
  "Standing Calf Raise": { m: [["Calves"]], also: ["Machine Calf Raise"] },
  "Cable Crunch": { m: [["Abs"]], also: ["Decline Crunch", "Captain's Chair Leg Raise", "Machine Seated Crunch"] },
  "Plate-Weighted Decline Sit-Up": { m: [["Abs"]], also: ["Decline Crunch", "Machine Seated Crunch", "Captain's Chair Leg Raise"] },
  "Roman Chair Leg Raise": { m: [["Abs"]], also: ["Captain's Chair Leg Raise", "Captain's Chair Knee Raise"] },
};

// One exercise in a program day: warm-up sets, working sets, rep range, RPE (early → last set),
// rest, and the program's two substitutes. extra can add a technique or override the library.
const slot = (ex, warmup, sets, reps, rpe, rest, subs, extra = {}) => {
  const e = EX[ex];
  return { ex, warmup, sets, reps, rpe, rest, primary: e.m[0], secondary: e.m[1] || [], subs, also: e.also || [], tech: "", inc: e.inc || 2.5, ...extra };
};
const LP = "Lengthened partials (extended set)";
const GROWTH = "Intermediate/advanced · Build muscle and gain strength";
const WARMUP = "General warm-up: 5 min light cardio & dynamic stretching";

// Week 1 of each program, repeated. Schedules start on Monday; rest days are suggestions.
LI.PROGRAMS = [
  {
    id: "p14", name: "Upper/Lower/Push/Pull/Legs",
    meta: `5×/week · ${GROWTH} · 60–90 min`, warmup: WARMUP,
    schedule: ["upper", "lower", "rest", "push", "pull", "legs", "rest"],
    days: [
      { id: "upper", name: "Upper #1", short: "Upper", focus: "Strength", time: "60–80 min", items: [
        slot("Bench Press", "2–3", 3, [3, 5], ["~7–8", "~9"], "3–4 min", ["Machine Chest Press", "Flat Dumbbell Press"]),
        slot("Barbell Row", "2–3", 3, [6, 8], ["~7–8", "~9"], "2–3 min", ["Pendlay Row", "Dumbbell Row"]),
        slot("Dumbbell Lateral Raise", "0–1", 2, [8, 10], ["~9", "10"], "1–2 min", ["Cable Lateral Raise", "Machine Lateral Raise"], { tech: LP }),
        slot("Pull-Up", "1–2", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Lat Pulldown", "Chin-Up"]),
        slot("Pec Deck", "0–1", 2, [8, 10], ["~9", "10"], "1–2 min", ["Dumbbell Fly", "Push-Up"], { tech: "Dropset" }),
        slot("Preacher Curl", "0–1", 3, [8, 10], ["~9", "10"], "30 sec", ["EZ-Bar Biceps Curl", "Dumbbell Biceps Curl"], { tech: "Superset with skullcrusher" }),
        slot("EZ-Bar Skullcrusher", "0–1", 3, [8, 10], ["~9", "10"], "30 sec", ["Dumbbell Skullcrusher", "Overhead Triceps Extension"], { tech: "Superset with preacher curl" }),
      ] },
      { id: "lower", name: "Lower #1", short: "Lower", focus: "Strength", time: "55–80 min", items: [
        slot("Deadlift", "2–3", 3, [3, 5], ["~6", "~7"], "3–5 min", ["Romanian Deadlift", "Hip Thrust"]),
        slot("Leg Press", "2–3", 3, [6, 8], ["~7", "~8"], "3–4 min", ["Barbell Front Squat", "Dumbbell Lunge"]),
        slot("Glute Ham Raise", "1–2", 3, [8, 10], ["~7", "~8"], "2–3 min", ["45° Back Extension", "Lying Leg Curl"]),
        slot("Seated Calf Raise", "0–1", 3, [8, 10], ["~9", "10"], "1–2 min", ["Standing Calf Raise", "Leg Press Calf Press"]),
        slot("Cable Crunch", "0–1", 3, [10, 12], ["~9", "10"], "1–2 min", ["Plate-Weighted Decline Sit-Up", "Hanging Leg Raise"]),
      ] },
      { id: "push", name: "Push #1", short: "Push", focus: "Hypertrophy", time: "50–80 min", items: [
        slot("Overhead Barbell Press", "2–3", 3, [8, 10], ["~7–8", "~9"], "3–4 min", ["Dumbbell Shoulder Press (Standing)", "Dumbbell Shoulder Press (Seated)"]),
        slot("Flat Dumbbell Press", "1–2", 3, [10, 12], ["~7–8", "~9"], "2–3 min", ["Dip", "Bench Press"]),
        slot("Cable Lateral Raise", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["Machine Lateral Raise", "Dumbbell Lateral Raise"]),
        slot("Cable Fly", "0–1", 2, [12, 15], ["~9", "10"], "1–2 min", ["Dumbbell Fly", "Pec Deck"], { tech: "Myo-reps" }),
        slot("Triceps Kickback (Cable)", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["EZ-Bar Skullcrusher", "Triceps Pressdown"]),
        slot("Overhead Triceps Extension", "0–1", 3, [15, 20], ["~9", "10"], "1–2 min", ["EZ-Bar Skullcrusher", "Dumbbell Skullcrusher"]),
      ] },
      { id: "pull", name: "Pull #1", short: "Pull", focus: "Hypertrophy", time: "45–80 min", items: [
        slot("Lat Pulldown", "1–2", 3, [10, 12], ["~7–8", "~9"], "2–3 min", ["Pull-Up", "Chin-Up"]),
        slot("Dumbbell Row", "1–2", 3, [10, 12], ["~7–8", "~9"], "2–3 min", ["Chest-Supported T-Bar Row", "Barbell Row"]),
        slot("Cable Lat Pull-In", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["Cable Lat Pullover", "Dumbbell Lat Pullover"]),
        slot("Reverse Pec Deck", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["Rope Facepull", "Reverse Cable Fly"]),
        slot("Barbell Shrug", "0–1", 2, [12, 15], ["~9", "10"], "1–2 min", ["Dumbbell Shrug", "Trap Bar Shrug"], { tech: "Cheat reps" }),
        slot("Hammer Curl", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["Dumbbell Biceps Curl", "EZ-Bar Biceps Curl"]),
        slot("Bayesian Cable Curl", "0–1", 3, [15, 20], ["~9", "10"], "1–2 min", ["Incline Dumbbell Curl", "Preacher Curl"]),
      ] },
      { id: "legs", name: "Legs #1", short: "Legs", focus: "Hypertrophy", time: "60–90 min", items: [
        slot("Barbell Back Squat", "2–3", 3, [3, 5], ["~7", "~8"], "3–4 min", ["Leg Press", "Dumbbell Lunge"]),
        slot("45° Back Extension", "1–2", 3, [10, 12], ["~7–8", "~9"], "2–3 min", ["Good Morning", "Glute Ham Raise"]),
        slot("Leg Extension", "1–2", 2, [12, 15], ["~9", "10"], "2–3 min", ["Goblet Squat", "Dumbbell Lunge"], { tech: LP }),
        slot("Seated Leg Curl", "1–2", 2, [12, 15], ["~9", "10"], "2–3 min", ["Lying Leg Curl", "Nordic Ham Curl"], { tech: LP }),
        slot("Standing Calf Raise", "0–1", 3, [15, 20], ["~9", "10"], "1–2 min", ["Seated Calf Raise", "Leg Press Calf Press"]),
        slot("Roman Chair Leg Raise", "0–1", 3, [10, 20], ["~9", "10"], "30 sec", ["Hanging Leg Raise", "Bent-Knee Leg Raise"]),
      ] },
    ],
  },
  {
    id: "p7", name: "Upper/Lower",
    meta: `4×/week · ${GROWTH} · 60–90 min`, warmup: WARMUP,
    schedule: ["upper1", "lower1", "rest", "upper2", "lower2", "rest", "rest"],
    days: [
      { id: "upper1", name: "Upper #1", short: "Upper 1", time: "60–80 min", items: [
        slot("Bench Press", "2–3", 3, [3, 5], ["~7–8", "~9"], "3–4 min", ["Machine Chest Press", "Flat Dumbbell Press"]),
        slot("Barbell Row", "2–3", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Pendlay Row", "Dumbbell Row"]),
        slot("Dumbbell Lateral Raise", "0–1", 2, [12, 15], ["~9", "10"], "1–2 min", ["Cable Lateral Raise", "Machine Lateral Raise"], { tech: LP }),
        slot("Pull-Up", "1–2", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Lat Pulldown", "Chin-Up"]),
        slot("Pec Deck", "0–1", 2, [15, 20], ["~9", "10"], "1–2 min", ["Dumbbell Fly", "Push-Up"], { tech: "Dropset" }),
        slot("Preacher Curl", "0–1", 3, [12, 15], ["~9", "10"], "30 sec", ["EZ-Bar Biceps Curl", "Dumbbell Biceps Curl"], { tech: "Superset with skullcrusher" }),
        slot("EZ-Bar Skullcrusher", "0–1", 3, [12, 15], ["~9", "10"], "30 sec", ["Dumbbell Skullcrusher", "Overhead Triceps Extension"], { tech: "Superset with preacher curl" }),
      ] },
      { id: "lower1", name: "Lower #1", short: "Lower 1", time: "55–80 min", items: [
        slot("Deadlift", "2–3", 3, [3, 5], ["~6", "~7"], "3–5 min", ["Romanian Deadlift", "Hip Thrust"]),
        slot("Leg Press", "2–3", 3, [6, 8], ["~7", "~8"], "3–4 min", ["Barbell Front Squat", "Dumbbell Lunge"]),
        slot("Glute Ham Raise", "1–2", 3, [8, 10], ["~7", "~8"], "2–3 min", ["45° Back Extension", "Lying Leg Curl"]),
        slot("Seated Calf Raise", "0–1", 3, [10, 12], ["~9", "10"], "1–2 min", ["Standing Calf Raise", "Leg Press Calf Press"]),
        slot("Cable Crunch", "0–1", 3, [10, 12], ["~9", "10"], "1–2 min", ["Plate-Weighted Decline Sit-Up", "Hanging Leg Raise"]),
      ] },
      { id: "upper2", name: "Upper #2", short: "Upper 2", time: "60–90 min", items: [
        slot("Lat Pulldown", "1–2", 3, [10, 12], ["~7–8", "~9"], "2–3 min", ["Pull-Up", "Chin-Up"]),
        slot("Overhead Barbell Press", "2–3", 3, [6, 8], ["~7–8", "~9"], "3–4 min", ["Dumbbell Shoulder Press (Standing)", "Dumbbell Shoulder Press (Seated)"]),
        slot("Dumbbell Row", "1–2", 3, [10, 12], ["~7–8", "~9"], "2–3 min", ["Chest-Supported T-Bar Row", "Barbell Row"]),
        slot("Flat Dumbbell Press", "1–2", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Dip", "Bench Press"]),
        slot("Reverse Pec Deck", "0–1", 3, [10, 12], ["~9", "10"], "1–2 min", ["Rope Facepull", "Reverse Cable Fly"]),
        slot("Triceps Pressdown", "0–1", 3, [10, 12], ["~9", "10"], "30 sec", ["Triceps Kickback (Cable)", "EZ-Bar Skullcrusher"], { tech: "Superset with Bayesian curl" }),
        slot("Bayesian Cable Curl", "0–1", 3, [10, 12], ["~9", "10"], "30 sec", ["Incline Dumbbell Curl", "Preacher Curl"], { tech: "Superset with pressdown" }),
      ] },
      { id: "lower2", name: "Lower #2", short: "Lower 2", time: "60–90 min", items: [
        slot("Barbell Back Squat", "2–3", 3, [3, 5], ["~7", "~8"], "3–4 min", ["Leg Press", "Dumbbell Lunge"]),
        slot("45° Back Extension", "1–2", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Good Morning", "Glute Ham Raise"]),
        slot("Leg Extension", "1–2", 2, [10, 12], ["~9", "10"], "2–3 min", ["Goblet Squat", "Dumbbell Lunge"], { tech: LP }),
        slot("Seated Leg Curl", "1–2", 2, [10, 12], ["~9", "10"], "2–3 min", ["Lying Leg Curl", "Nordic Ham Curl"], { tech: LP }),
        slot("Standing Calf Raise", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["Seated Calf Raise", "Leg Press Calf Press"]),
        slot("Roman Chair Leg Raise", "0–1", 3, [10, 20], ["~9", "10"], "1–2 min", ["Hanging Leg Raise", "Bent-Knee Leg Raise"]),
      ] },
    ],
  },
  {
    id: "p4", name: "Full Body · 3 days",
    meta: `3×/week · ${GROWTH} · 60–90 min`, warmup: WARMUP,
    schedule: ["full1", "rest", "full2", "rest", "full3", "rest", "rest"],
    days: [
      { id: "full1", name: "Full Body #1", short: "Full 1", time: "60–90 min", items: [
        slot("Barbell Back Squat", "2–3", 3, [3, 5], ["~7", "~8"], "3–4 min", ["Leg Press", "Dumbbell Lunge"]),
        slot("Chest-Supported T-Bar Row", "2–3", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Dumbbell Row", "Cable Row"]),
        slot("Glute Ham Raise", "1–2", 3, [8, 10], ["~7", "~8"], "2–3 min", ["45° Back Extension", "Lying Leg Curl"]),
        slot("Dumbbell Lateral Raise", "0–1", 2, [12, 15], ["~9", "10"], "1–2 min", ["Cable Lateral Raise", "Machine Lateral Raise"], { tech: LP }),
        slot("Pec Deck", "0–1", 2, [15, 20], ["~9", "10"], "1–2 min", ["Dumbbell Fly", "Push-Up"], { tech: "Dropset" }),
        slot("Preacher Curl", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["EZ-Bar Biceps Curl", "Dumbbell Biceps Curl"]),
      ] },
      { id: "full2", name: "Full Body #2", short: "Full 2", time: "60–90 min", items: [
        slot("Bench Press", "2–3", 3, [3, 5], ["~7–8", "~9"], "3–4 min", ["Machine Chest Press", "Flat Dumbbell Press"]),
        slot("Leg Press", "2–3", 3, [6, 8], ["~7", "~8"], "3–4 min", ["Barbell Front Squat", "Dumbbell Lunge"]),
        slot("Pull-Up", "1–2", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Lat Pulldown", "Chin-Up"]),
        slot("EZ-Bar Skullcrusher", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["Dumbbell Skullcrusher", "Overhead Triceps Extension"]),
        slot("Reverse Pec Deck", "0–1", 3, [15, 20], ["~9", "10"], "1–2 min", ["Rope Facepull", "Reverse Cable Fly"]),
        slot("Seated Calf Raise", "0–1", 3, [10, 12], ["~9", "10"], "1–2 min", ["Standing Calf Raise", "Leg Press Calf Press"]),
      ] },
      { id: "full3", name: "Full Body #3", short: "Full 3", time: "55–85 min", items: [
        slot("Deadlift", "2–3", 3, [3, 5], ["~6", "~7"], "3–5 min", ["Romanian Deadlift", "Hip Thrust"]),
        slot("Incline Dumbbell Press", "2–3", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Incline Machine Chest Press", "Incline Barbell Bench Press"]),
        slot("Seated Leg Curl", "1–2", 2, [10, 12], ["~9", "10"], "1–2 min", ["Lying Leg Curl", "Nordic Ham Curl"], { tech: LP }),
        slot("Lat Pulldown", "1–2", 3, [10, 12], ["~7–8", "~9"], "2–3 min", ["Pull-Up", "Chin-Up"]),
        slot("Leg Extension", "1–2", 2, [10, 12], ["~9", "10"], "1–2 min", ["Goblet Squat", "Dumbbell Lunge"], { tech: LP }),
        slot("Plate-Weighted Decline Sit-Up", "0–1", 3, [8, 10], ["~9", "10"], "1–2 min", ["Cable Crunch", "Plank"]),
      ] },
    ],
  },
  {
    id: "p10", name: "Full Body · 4 days",
    meta: `4×/week · ${GROWTH} · 60–90 min`, warmup: WARMUP,
    schedule: ["full1", "full2", "rest", "full3", "full4", "rest", "rest"],
    days: [
      { id: "full1", name: "Full Body #1", short: "Full 1", time: "60–85 min", items: [
        slot("Bench Press", "2–3", 3, [3, 5], ["~7–8", "~9"], "3–4 min", ["Machine Chest Press", "Flat Dumbbell Press"]),
        slot("Leg Press", "2–3", 3, [6, 8], ["~7", "~8"], "3–4 min", ["Barbell Front Squat", "Dumbbell Lunge"]),
        slot("Barbell Row", "2–3", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Pendlay Row", "Dumbbell Row"]),
        slot("Dumbbell Lateral Raise", "0–1", 2, [12, 15], ["~9", "10"], "1–2 min", ["Cable Lateral Raise", "Machine Lateral Raise"], { tech: LP }),
        slot("Preacher Curl", "0–1", 3, [12, 15], ["~9", "10"], "30 sec", ["EZ-Bar Biceps Curl", "Dumbbell Biceps Curl"], { tech: "Superset with seated calf raise" }),
        slot("Seated Calf Raise", "0–1", 3, [10, 12], ["~9", "10"], "30 sec", ["Standing Calf Raise", "Leg Press Calf Press"], { tech: "Superset with preacher curl" }),
      ] },
      { id: "full2", name: "Full Body #2", short: "Full 2", time: "55–85 min", items: [
        slot("Deadlift", "2–3", 3, [3, 5], ["~6", "~7"], "3–5 min", ["Romanian Deadlift", "Hip Thrust"]),
        slot("Pull-Up", "1–2", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Lat Pulldown", "Chin-Up"]),
        slot("Glute Ham Raise", "1–2", 3, [8, 10], ["~7", "~8"], "2–3 min", ["45° Back Extension", "Lying Leg Curl"]),
        slot("Pec Deck", "0–1", 2, [15, 20], ["~9", "10"], "1–2 min", ["Dumbbell Fly", "Push-Up"], { tech: "Dropset" }),
        slot("EZ-Bar Skullcrusher", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["Dumbbell Skullcrusher", "Overhead Triceps Extension"]),
        slot("Cable Crunch", "0–1", 3, [10, 12], ["~9", "10"], "1–2 min", ["Plate-Weighted Decline Sit-Up", "Hanging Leg Raise"]),
      ] },
      { id: "full3", name: "Full Body #3", short: "Full 3", time: "55–85 min", items: [
        slot("Overhead Barbell Press", "2–3", 3, [6, 8], ["~7–8", "~9"], "3–4 min", ["Dumbbell Shoulder Press (Standing)", "Dumbbell Shoulder Press (Seated)"]),
        slot("45° Back Extension", "1–2", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Good Morning", "Glute Ham Raise"]),
        slot("Dumbbell Row", "1–2", 3, [10, 12], ["~7–8", "~9"], "2–3 min", ["Chest-Supported T-Bar Row", "Barbell Row"]),
        slot("Leg Extension", "1–2", 2, [15, 20], ["~9", "10"], "1–2 min", ["Goblet Squat", "Dumbbell Lunge"], { tech: LP }),
        slot("Triceps Pressdown", "0–1", 3, [10, 12], ["~9", "10"], "30 sec", ["EZ-Bar Skullcrusher", "Triceps Kickback (Cable)"], { tech: "Superset with Bayesian curl" }),
        slot("Bayesian Cable Curl", "0–1", 3, [10, 12], ["~9", "10"], "30 sec", ["Incline Dumbbell Curl", "Preacher Curl"], { tech: "Superset with pressdown" }),
        slot("Standing Calf Raise", "0–1", 3, [12, 15], ["~9", "10"], "1–2 min", ["Seated Calf Raise", "Leg Press Calf Press"]),
      ] },
      { id: "full4", name: "Full Body #4", short: "Full 4", time: "55–85 min", items: [
        slot("Barbell Back Squat", "2–3", 3, [3, 5], ["~7", "~8"], "3–4 min", ["Leg Press", "Dumbbell Lunge"]),
        slot("Flat Dumbbell Press", "1–2", 3, [8, 10], ["~7–8", "~9"], "2–3 min", ["Dip", "Bench Press"]),
        slot("Lat Pulldown", "1–2", 3, [10, 12], ["~7–8", "~9"], "2–3 min", ["Pull-Up", "Chin-Up"]),
        slot("Seated Leg Curl", "1–2", 2, [10, 12], ["~9", "10"], "1–2 min", ["Lying Leg Curl", "Nordic Ham Curl"], { tech: LP }),
        slot("Reverse Pec Deck", "0–1", 3, [10, 12], ["~9", "10"], "1–2 min", ["Rope Facepull", "Reverse Cable Fly"]),
        slot("Roman Chair Leg Raise", "0–1", 3, [10, 20], ["~9", "10"], "30 sec", ["Hanging Leg Raise", "Bent-Knee Leg Raise"]),
      ] },
    ],
  },
];

// The program being followed (chosen on the Program tab).
Object.defineProperty(LI, "PROGRAM", { get: () => LI.PROGRAMS.find((p) => p.id === LI.state.program.id) || LI.PROGRAMS[0] });

LI.programDaysPerWeek = () => LI.PROGRAM.schedule.filter((d) => d !== "rest").length;

LI.programDay = (id) => LI.PROGRAM.days.find((d) => d.id === id);

// "Pull-Up (Optional Assistance)" and "Pull Ups" both become "pull up".
LI.normExercise = (name) => name.toLowerCase()
  .replace(/\(.*?\)/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .split(" ")
  .map((w) => (w.length >= 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
  .join(" ");

// "main", "sub" or "also" if a logged exercise counts for this slot, else null.
LI.slotMatch = (s, exercise) => {
  const n = LI.normExercise(exercise);
  if (LI.normExercise(s.ex) === n) return "main";
  if (s.subs.some((x) => LI.normExercise(x) === n)) return "sub";
  if (s.also.some((x) => LI.normExercise(x) === n)) return "also";
  return null;
};

// Which program day a logged workout was, by how many of the day's slots it covers.
// Needs at least two slots and a third of the day, so a stray workout isn't forced
// onto the plan.
LI.classifyWorkout = (w) => {
  let best = null;
  for (const day of LI.PROGRAM.days) {
    let score = 0, hits = 0;
    for (const s of day.items) {
      const kinds = w.exercises.map((e) => LI.slotMatch(s, e.name)).filter(Boolean);
      if (!kinds.length) continue;
      hits++;
      score += kinds.includes("main") ? 1 : 0.75;
    }
    const share = hits / day.items.length;
    if (hits >= 2 && share >= 1 / 3 && (!best || score > best.score)) best = { day, score, hits, share };
  }
  return best;
};

LI.programStart = () => (LI.state.program.start ? LI.startOfDay(new Date(`${LI.state.program.start}T00:00`)) : null);

// Workouts since the start date, newest first, with the program day each one was.
LI.programSessions = (model) => {
  const start = LI.programStart();
  if (!start) return [];
  return model.workouts
    .filter((w) => w.date >= start)
    .map((w) => ({ workout: w, match: LI.classifyWorkout(w) }))
    .reverse();
};

// The day after the most recent program session, skipping rest days.
LI.nextProgramDay = (model) => {
  const order = LI.PROGRAM.schedule.filter((d) => d !== "rest");
  const last = LI.programSessions(model).find((s) => s.match);
  if (!last) return { day: LI.programDay(order[0]), after: null };
  return { day: LI.programDay(order[(order.indexOf(last.match.day.id) + 1) % order.length]), after: last };
};

// Working sets: reps logged and within 10% of the heaviest load, so warm-ups
// and drop sets don't count against the rep range.
LI.workingSets = (sets) => {
  const done = sets.filter((s) => s.reps > 0);
  const top = Math.max(0, ...done.map((s) => s.load));
  return top > 0 ? done.filter((s) => s.load >= top * 0.9) : done;
};

// The most recent time a slot was trained, preferring workouts that were the same
// program day (so a bench press done for 10 reps on Push isn't read as Upper's 3–5).
LI.lastForSlot = (model, s, day) => {
  let fallback = null;
  for (let i = model.workouts.length - 1; i >= 0; i--) {
    const w = model.workouts[i];
    const e = w.exercises.find((x) => LI.slotMatch(s, x.name));
    if (!e) continue;
    const hit = { workout: w, exercise: e.name, kind: LI.slotMatch(s, e.name), sets: e.sets };
    if (LI.classifyWorkout(w)?.day === day) return { ...hit, sameDay: true };
    fallback = fallback || hit;
  }
  return fallback && { ...fallback, sameDay: false };
};

// Rounds a load to a step that exists in the gym: 2.5 kg or 5 lb, or 1 kg / 2.5 lb
// for small dumbbell and cable steps.
const roundLoad = (kg, small = false) => {
  const step = LI.state.displayUnit === "lb" ? (small ? 2.5 : 5) * LI.LB : small ? 1 : 2.5;
  return Math.round(kg / step) * step;
};
const incFor = (s) => (LI.state.displayUnit === "lb" ? (s.inc >= 5 ? 10 : s.inc < 2.5 ? 2.5 : 5) * LI.LB : s.inc);

// Double progression: work up to the top of the rep range, then add weight.
// Returns { level, text } for the next session given the last one. When the last
// one was a substitute, the advice is for that exercise, since loads don't carry over.
LI.slotAdvice = (s, last) => {
  const a = slotAdvice(s, last);
  return last && last.kind !== "main" ? { ...a, text: `If you do ${last.exercise} again: ${a.text[0].toLowerCase()}${a.text.slice(1)}` } : a;
};

const slotAdvice = (s, last) => {
  const [lo, hi] = s.reps;
  if (!last) return { level: "info", text: `New exercise. Pick a weight you can do for about ${hi} reps, leaving 2–3 in the tank.` };
  const ws = LI.workingSets(last.sets);
  if (!ws.length) return { level: "info", text: `No reps logged last time. Aim for ${lo}–${hi}.` };
  const isBW = (LI.exerciseInfo(last.exercise).bw || 0) > 0;
  const minR = Math.min(...ws.map((x) => x.reps)), maxR = Math.max(...ws.map((x) => x.reps));
  const top = Math.max(...ws.map((x) => x.kg));

  if (isBW) {
    if (minR >= hi) return { level: "ok", text: `All sets at ${hi}+. Add weight${top > 0 ? ` (+${LI.fmtWU(incFor(s))})` : " with a belt or dumbbell"}, or slow down the lowering.` };
    if (maxR < lo) return { level: "under", text: `Below ${lo} reps. Use assistance (band or machine) to stay in ${lo}–${hi}.` };
    return { level: "info", text: `Same ${top > 0 ? `+${LI.fmtWU(top)}` : "bodyweight"}. Aim for ${Math.min(hi, Math.max(lo, minR + 1))}+ reps on every set.` };
  }

  // Way outside the range (often a different rep scheme before the program):
  // estimate a starting weight from e1RM, leaving about one rep in reserve.
  const best = Math.max(...ws.map((x) => x.e1rm || 0));
  const small = s.inc < 2.5;
  const fromE1 = best ? roundLoad(best / (1 + (hi + 1) / 30), small) : null;
  if (fromE1 && (minR >= hi + 2 || maxR <= lo - 2) && Math.abs(fromE1 - top) >= (small ? 1 : 2.5)) {
    return { level: "high", text: `Last time was ${minR === maxR ? minR : `${minR}–${maxR}`} reps, outside ${lo}–${hi}. Start around ${LI.fmtWU(fromE1)}.` };
  }
  if (minR >= hi) return { level: "ok", text: `Hit ${hi}+ on every set. Go up to ${LI.fmtWU(roundLoad(top + incFor(s), small))} and work back up from ${lo}.` };
  if (maxR < lo) return { level: "under", text: `Below ${lo} reps. Drop to about ${LI.fmtWU(roundLoad(top * 0.9, small))}.` };
  return { level: "info", text: `Stay at ${LI.fmtWU(top)}. Aim for ${Math.min(hi, Math.max(lo, minR + 1))}+ reps on every set.` };
};

// How a logged workout compares with its program day.
LI.compareToPlan = (w, day) => {
  const used = new Set();
  const items = day.items.map((s) => {
    const e = w.exercises.find((x) => !used.has(x.name) && LI.slotMatch(s, x.name));
    if (!e) return { slot: s, done: null };
    used.add(e.name);
    const ws = LI.workingSets(e.sets);
    const inRange = ws.filter((x) => x.reps >= s.reps[0] && x.reps <= s.reps[1]).length;
    return { slot: s, done: e, sets: ws.length, inRange, below: ws.filter((x) => x.reps < s.reps[0]).length, above: ws.filter((x) => x.reps > s.reps[1]).length };
  });
  const extras = w.exercises.filter((e) => !used.has(e.name)).map((e) => e.name);
  const done = items.filter((i) => i.done);
  return {
    items,
    extras,
    missed: items.filter((i) => !i.done).map((i) => i.slot.ex),
    plannedSets: day.items.reduce((t, s) => t + s.sets, 0),
    sets: done.reduce((t, i) => t + Math.min(i.sets, i.slot.sets), 0),
    workSets: done.reduce((t, i) => t + i.sets, 0),
    inRange: done.reduce((t, i) => t + i.inRange, 0),
  };
};

// Weekly weighted sets per muscle if the program is followed as written.
LI.programMuscleSets = () => {
  const out = Object.fromEntries(LI.MUSCLES.map((m) => [m, 0]));
  for (const day of LI.PROGRAM.days) for (const s of day.items) {
    for (const m of s.primary) out[m] += s.sets;
    for (const m of s.secondary) out[m] += s.sets * 0.5;
  }
  return out;
};

// A target range around the program's planned weekly sets.
LI.programTargets = () => Object.fromEntries(Object.entries(LI.programMuscleSets()).map(([m, v]) => {
  const lo = Math.round(v * 0.8);
  return [m, { lo, hi: Math.max(lo + 1, Math.round(v * 1.2)) }];
}));
