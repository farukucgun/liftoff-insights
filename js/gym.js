// How busy the gym is: readings every 10 minutes from the gym-occupancy collector
// (github.com/farukucgun/gym-occupancy), copied next to the app by gym_sync.sh.
// Readings are in UTC; everything here is in the gym's own time (Europe/Berlin), whatever
// time zone the device viewing it is in. Daylight saving is handled by Intl.
window.LI = window.LI || {};

LI.GYM_TZ = "Europe/Berlin";
// The hours worth looking at: from the earliest you'd go (14:00) to midnight, in gym time.
LI.GYM_HOURS = [14 * 60, 24 * 60];
LI.gym = { readings: [], text: null, loadedAt: null };

const berlin = new Intl.DateTimeFormat("en-GB", {
  timeZone: LI.GYM_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A moment in gym time: day "YYYY-MM-DD", dow 0 = Monday, minute of the day, 30-minute slot.
LI.gymTime = (date) => {
  const p = Object.fromEntries(berlin.formatToParts(date).map((x) => [x.type, x.value]));
  const minute = +p.hour * 60 + +p.minute;
  return { day: `${p.year}-${p.month}-${p.day}`, dow: WEEKDAYS.indexOf(p.weekday), minute, slot: Math.floor(minute / 30) };
};
LI.fmtClock = (minute) => `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
LI.WEEKDAYS = WEEKDAYS;

// Fetches the readings; returns true when they changed. A missing file just means no data.
LI.loadGym = async () => {
  const text = await fetch("gym_occupancy.csv", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
  LI.gym.loadedAt = new Date();
  if (text == null || text === LI.gym.text) return false;
  LI.gym.text = text;
  LI.gym.readings = text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [ts, count] = line.split(",");
    const t = new Date(ts);
    return Number.isNaN(+t) || count === "" ? null : { t, count: +count, ...LI.gymTime(t) };
  }).filter(Boolean);
  return true;
};

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q, lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (i - lo);
};

// Typical count per weekday and 30-minute slot, leaving out the day(s) being compared.
// { median, q1, q3, days } or undefined where there's no history yet.
LI.gymTypical = (exclude = LI.gymTime(new Date()).day) => {
  const skip = new Set([].concat(exclude));
  const cells = new Map();
  for (const r of LI.gym.readings) {
    if (skip.has(r.day)) continue;
    const k = r.dow * 48 + r.slot;
    if (!cells.has(k)) cells.set(k, { counts: [], days: new Set() });
    cells.get(k).counts.push(r.count);
    cells.get(k).days.add(r.day);
  }
  const out = new Map();
  for (const [k, c] of cells) {
    const s = c.counts.sort((a, b) => a - b);
    out.set(k, { median: quantile(s, 0.5), q1: quantile(s, 0.25), q3: quantile(s, 0.75), days: c.days.size });
  }
  return { get: (dow, slot) => out.get(dow * 48 + slot) };
};

// The latest reading, how old it is, and how it compares with a usual day at that time.
LI.gymNow = () => {
  const rs = LI.gym.readings;
  if (!rs.length) return null;
  const last = rs[rs.length - 1];
  const ageMin = Math.round((Date.now() - last.t) / 60000);
  const typ = LI.gymTypical(last.day).get(last.dow, last.slot);
  const before = rs.slice().reverse().find((r) => last.t - r.t >= 25 * 60000 && last.t - r.t <= 45 * 60000);
  let vs = null;
  if (typ && typ.median != null) {
    const diff = last.count - typ.median;
    const big = Math.max(10, typ.median * 0.2); // within ±20% (or ±10 people) counts as usual
    vs = { typical: Math.round(typ.median), days: typ.days, level: diff > big ? "busier" : diff < -big ? "quieter" : "usual" };
  }
  return { ...last, ageMin, stale: ageMin > 40, vs, trend: before ? last.count - before.count : null };
};

// Readings from one gym day, for charts.
LI.gymDay = (day) => LI.gym.readings.filter((r) => r.day === day);

// Days of data and the date range, for "based on …" notes.
LI.gymCoverage = () => {
  const days = new Set(LI.gym.readings.map((r) => r.day));
  const rs = LI.gym.readings;
  return { days: days.size, from: rs[0]?.t, to: rs[rs.length - 1]?.t };
};

// Liftoff's times are the gym's wall clock with no zone. Turn one (parsed as if local to this
// device) into the real moment, so it lines up with readings on a device in any time zone.
LI.fromGymClock = (d) => {
  const guess = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  const p = Object.fromEntries(berlin.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (shown - guess));
};

// The gym's system clears everyone still checked in once a day, at midnight UTC (02:00 German
// summer time): the count drops to ~0 within 10 minutes. Those cleared are people who left
// without checking out, so late-evening counts include them. Returns each clear-out, newest first.
LI.gymResets = () => {
  const rs = LI.gym.readings, out = [];
  for (let i = 1; i < rs.length; i++) {
    const a = rs[i - 1], b = rs[i];
    const crossed = a.t.getUTCDate() !== b.t.getUTCDate() && b.t - a.t <= 30 * 60000;
    if (crossed && a.count - b.count >= 3 && b.count <= 3) out.push({ t: b.t, cleared: a.count - b.count, minute: b.minute });
  }
  return out.reverse();
};

// The reading closest to a moment, if one is within 15 minutes (for "how busy was it").
LI.gymAt = (date) => {
  let best = null;
  for (const r of LI.gym.readings) if (!best || Math.abs(r.t - date) < Math.abs(best.t - date)) best = r;
  return best && Math.abs(best.t - date) <= 15 * 60000 ? best : null;
};
