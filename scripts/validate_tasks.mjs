import fs from "node:fs";
import assert from "node:assert/strict";
import { validate } from "../src/lib/engine.mjs";
const tasks = JSON.parse(
  fs.readFileSync(new URL("../data/first_flight_tasks.json", import.meta.url)),
);
assert.equal(tasks.length, 62);
assert.equal(tasks[0].id, "PM-001");
assert.equal(tasks.at(-1).id, "FT-010");
validate(tasks);
assert.deepEqual(
  tasks.filter((t) => t.status === "complete").map((t) => t.id),
  ["PM-001", "PM-002"],
);
for (const t of tasks) {
  assert(t.title);
  assert(t.source_responsible_team);
  for (const key of ["target_date", "recovery_date", "absolute_date"])
    if (t[key])
      assert.equal(new Date(t[key]).toISOString().slice(0, 10), t[key]);
}
console.log(
  "PASS: 62 tasks, unique IDs, resolved acyclic dependencies, valid normalized dates, preserved source statuses.",
);
