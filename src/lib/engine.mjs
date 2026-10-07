export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const days = (date, from = today()) =>
  date
    ? Math.round(
        (Date.parse(date + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) /
          86400000,
      )
    : null;
export const addDays = (date, n) =>
  new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const active = (t) => !["complete", "deferred"].includes(t.status);
export const blockers = (t, tasks) =>
  t.dependencies.filter(
    (id) => tasks.find((x) => x.id === id)?.status !== "complete",
  );
export const successors = (id, tasks) =>
  tasks.filter((t) => t.dependencies.includes(id));
export function downstream(id, tasks) {
  const seen = new Set();
  const visit = (x) =>
    successors(x, tasks).forEach((t) => {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        visit(t.id);
      }
    });
  visit(id);
  return [...seen];
}
export function validate(tasks) {
  const ids = new Set(tasks.map((t) => t.id));
  if (ids.size !== tasks.length) throw Error("Duplicate task IDs");
  const done = new Set(),
    visiting = new Set();
  function visit(t) {
    if (visiting.has(t.id)) throw Error("Circular dependency: " + t.id);
    if (done.has(t.id)) return;
    visiting.add(t.id);
    for (const id of t.dependencies) {
      if (!ids.has(id)) throw Error("Missing dependency: " + id);
      visit(tasks.find((x) => x.id === id));
    }
    visiting.delete(t.id);
    done.add(t.id);
  }
  tasks.forEach(visit);
  return true;
}
export function ranked(tasks, date = today(), requirements = []) {
  return tasks
    .filter(active)
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  function score(t) {
    const d = days(t.target_date, date),
      r = days(t.recovery_date, date);
    return (
      (t.critical && d !== null && d < 0 ? 100000 : 0) +
      downstream(t.id, tasks).filter((id) =>
        active(tasks.find((x) => x.id === id)),
      ).length *
        100 +
      (d !== null && d < 0 ? 2000 : 0) +
      (r !== null && r <= 7 ? 1500 : 0) +
      (d !== null && d <= 7 ? 1000 : 0) +
      (requirements.includes(t.id) ? 500 : 0) +
      (t.critical ? 200 : 0) +
      (t.priority_marked ? 100 : 0) -
      (d ?? 60)
    );
  }
}
export function agenda(
  tasks,
  meeting,
  next,
  extensions = [],
  items = [],
  date = today(),
) {
  return ranked(tasks, date).filter(
    (t) =>
      (t.target_date && t.target_date < date) ||
      (t.critical && t.target_date && t.target_date <= meeting) ||
      (t.target_date && t.target_date >= meeting && t.target_date < next) ||
      (t.recovery_date && t.recovery_date < next) ||
      successors(t.id, tasks).some(
        (s) => s.primary_team !== t.primary_team && active(s),
      ) ||
      extensions.some((e) => e.task_id === t.id && e.status === "pending") ||
      items.some((i) => i.task_id === t.id),
  );
}
