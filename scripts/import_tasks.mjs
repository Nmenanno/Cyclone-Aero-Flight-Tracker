import fs from "node:fs";
import { validate } from "../src/lib/engine.mjs";
const tasks = JSON.parse(
  fs.readFileSync(new URL("../data/first_flight_tasks.json", import.meta.url)),
);
validate(tasks);
const q = (x) =>
  x === null ? "null" : "'" + String(x).replaceAll("'", "''") + "'";
const teams = [
  ["program", "Program / Project Management", "PM"],
  ["aerodynamics", "Aerodynamics", "AERO"],
  ["structures", "Structures", "STR"],
  ["electrical", "Electrical / Propulsion", "ELEC"],
  ["programming", "Programming / Autopilot", "PRG"],
  ["manufacturing", "Manufacturing", "MFG"],
  ["flight-test", "Flight Test", "FT"],
];
let sql = "-- Insert-only seed. Never overwrite live progress.\nbegin;\n";
for (const team of teams)
  sql += `insert into public.teams values(${team.map(q)}) on conflict do nothing;\n`;
for (const t of tasks) {
  const {
    id,
    primary_team,
    status,
    version,
    dependencies,
    owner_id,
    completed_at,
    ...data
  } = t;
  sql += `insert into public.tasks(id,primary_team,status,data) values(${q(id)},${q(primary_team)},${q(status)},${q(JSON.stringify(data))}::jsonb) on conflict do nothing;\n`;
}
// Insert dependencies only on the first import, tracked atomically with a seed marker.
sql +=
  "do $$begin if not exists(select 1 from public.task_history where action='source_seed') then\n";
for (const t of tasks)
  for (const dep of t.dependencies)
    sql += `insert into public.task_dependencies values(${q(t.id)},${q(dep)}) on conflict do nothing;\n`;
sql +=
  "insert into public.task_history(action,detail) values('source_seed','{\"source\":\"62-task updated PDF\"}');end if;end$$;\n";
for (const [team, , prefix] of teams) {
  const n =
    Math.max(
      ...tasks
        .filter((t) => t.id.startsWith(prefix + "-"))
        .map((t) => Number(t.id.split("-")[1])),
    ) + 1;
  sql += `insert into public.task_counters values(${q(team)},${n}) on conflict do nothing;\n`;
}
const gates = [
  [
    "organization",
    "Program organization and ownership",
    "09-25",
    "09-25",
    ["PM-001", "PM-002", "PM-003", "PM-004", "PM-005"],
    "DONE",
  ],
  [
    "configuration",
    "Aircraft configuration freeze",
    "09-29",
    "09-29",
    ["AERO-001", "STR-001", "PM-006"],
    "DONE",
  ],
  [
    "interfaces",
    "Interface freeze / long-lead release",
    "10-06",
    "10-06",
    ["PM-007", "MFG-005"],
    "DONE",
  ],
  [
    "design",
    "Structural design freeze / electrical readiness",
    "10-13",
    "10-13",
    ["STR-007", "ELEC-008", "ELEC-009"],
    "ACTIVE",
  ],
  [
    "validation",
    "Controls and propulsion validation",
    "10-20",
    "10-20",
    ["ELEC-006", "ELEC-007", "ELEC-010", "PRG-005"],
    null,
  ],
  [
    "manufacturing",
    "Major manufacturing / dry-fit",
    "11-08",
    "11-08",
    ["MFG-012", "MFG-013", "MFG-014", "MFG-015"],
    null,
  ],
  [
    "integration",
    "Aircraft assembly and integration",
    "11-10",
    "11-10",
    ["ELEC-012", "PRG-007", "MFG-016"],
    null,
  ],
  [
    "ground",
    "Ground-test closure / FRR",
    "11-18",
    "11-20",
    ["FT-007", "FT-008"],
    null,
  ],
  ["flight", "Planned first flight", "11-21", "11-22", ["FT-009"], null],
  ["recovery", "Recovery window", "11-24", "11-25", ["FT-009"], null],
  ["fallback", "Absolute fallback", "12-03", "12-03", ["FT-009"], null],
];
for (const [id, title, start, end, req, status] of gates)
  sql += `insert into public.milestones(id,title,target_date,end_date,requirements,source_status) values(${q(id)},${q(title)},${q("2026-" + start)},${q("2026-" + end)},array[${req.map(q)}],${q(status)}) on conflict do nothing;\n`;
for (const [i, date] of [
  "2026-10-13",
  "2026-10-27",
  "2026-11-10",
  "2026-11-24",
].entries())
  sql += `insert into public.meetings(id,date,focus) values('00000000-0000-4000-8000-00000000000${i + 1}',${q(date)},${q(["Flight-critical structural freeze and electrical readiness", "Manufacturing and cross-team blockers", "Assembly, integration and ground-test preparation", "First-flight results or recovery coordination"][i])}) on conflict do nothing;\n`;
const readiness = [
  ["Configuration approved", ["PM-006", "PM-007"]],
  ["Primary airframe structurally inspected", ["FT-003"]],
  ["Landing gear and fasteners inspected", ["FT-003"]],
  ["Flight controls move correctly", ["FT-002"]],
  ["Servo / linkage travel acceptable", ["ELEC-007", "FT-002"]],
  ["Radio range verified", ["FT-004"]],
  ["Failsafe behavior verified", ["FT-004"]],
  ["Installed electrical system checked", ["ELEC-012", "FT-004"]],
  ["Propulsion endurance completed", ["ELEC-010"]],
  ["Installed full-power test completed", ["FT-005"]],
  ["Final aircraft weight measured", ["FT-001"]],
  ["Final CG within approved range", ["FT-001"]],
  ["Taxi / ground handling completed", ["FT-006"]],
  ["Autopilot validated or formally deferred safely", ["PRG-007"]],
  ["Flight-test card approved", ["PM-009"]],
  ["Pilot / crew assigned", ["PM-009", "FT-008"]],
  ["Test location confirmed", ["FT-008"]],
  ["Weather limits established", ["PM-009", "FT-008"]],
  ["Abort criteria established", ["PM-009"]],
  ["Flight-critical discrepancies resolved", ["FT-007"]],
  ["Flight Readiness Review approved", ["FT-008"]],
];
for (const [i, [title, ids]] of readiness.entries())
  sql += `insert into public.flight_readiness_items(id,title,task_ids) values('R-${String(i + 1).padStart(2, "0")}',${q(title)},array[${ids.map(q)}]) on conflict do nothing;\n`;
sql += "commit;\n";
fs.writeFileSync(
  new URL("../supabase/seed/first_flight.sql", import.meta.url),
  sql,
);
console.log(
  "Validated insert-only seed generated: supabase/seed/first_flight.sql",
);
fs.writeFileSync(
  new URL("../data/planning.json", import.meta.url),
  JSON.stringify(
    {
      teams: teams.map(([id, name, prefix]) => ({ id, name, prefix })),
      milestones: gates.map(
        ([id, title, start, end, requirements, source_status]) => ({
          id,
          title,
          target_date: "2026-" + start,
          end_date: "2026-" + end,
          requirements,
          source_status,
          reviewed: false,
        }),
      ),
      meetings: ["2026-10-13", "2026-10-27", "2026-11-10", "2026-11-24"].map(
        (date, i) => ({
          id: `00000000-0000-4000-8000-00000000000${i + 1}`,
          date,
          focus: [
            "Flight-critical structural freeze and electrical readiness",
            "Manufacturing and cross-team blockers",
            "Assembly, integration and ground-test preparation",
            "First-flight results or recovery coordination",
          ][i],
          version: 1,
        }),
      ),
      readiness: readiness.map(([title, task_ids], i) => ({
        id: "R-" + String(i + 1).padStart(2, "0"),
        title,
        task_ids,
        status: "not_ready",
        version: 1,
      })),
    },
    null,
    2,
  ),
);
