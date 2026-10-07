import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blockers,
  downstream,
  validate,
  ranked,
  agenda,
  days,
} from "../src/lib/engine.mjs";
import fs from "node:fs";
const tasks = JSON.parse(
  fs.readFileSync(new URL("../data/first_flight_tasks.json", import.meta.url)),
);
test("all 62 PDF tasks retain checked statuses and corrected dependency network", () => {
  assert.equal(tasks.length, 62);
  validate(tasks);
  assert.deepEqual(
    tasks.filter((t) => t.status === "complete").map((t) => t.id),
    ["PM-001", "PM-002"],
  );
  assert.deepEqual(tasks.find((t) => t.id === "FT-005").dependencies, [
    "FT-003",
    "FT-004",
    "ELEC-010",
    "ELEC-012",
  ]);
  assert.equal(tasks.find((t) => t.id === "PRG-005").absolute_date, null);
  assert.equal(tasks.find((t) => t.id === "STR-006").primary_team, "program");
});
test("two predecessors must both be complete, deferred never satisfies dependency", () => {
  const ts = [
    { id: "a", status: "complete", dependencies: [] },
    { id: "b", status: "deferred", dependencies: [] },
    { id: "c", dependencies: ["a", "b"] },
  ];
  assert.deepEqual(blockers(ts[2], ts), ["b"]);
  ts[1].status = "complete";
  assert.deepEqual(blockers(ts[2], ts), []);
});
test("graph rejects duplicate IDs, missing references, self and multi-node cycles", () => {
  for (const ts of [
    [{ id: "a", dependencies: ["x"] }],
    [{ id: "a", dependencies: ["a"] }],
    [
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["a"] },
    ],
    [
      { id: "a", dependencies: [] },
      { id: "a", dependencies: [] },
    ],
  ])
    assert.throws(() => validate(ts));
});
test("downstream impact is transitive and distinct", () => {
  assert(downstream("STR-007", tasks).includes("FT-010"));
  assert.equal(
    new Set(downstream("STR-007", tasks)).size,
    downstream("STR-007", tasks).length,
  );
});
test("priorities exclude completed work and elevate overdue flight-critical work", () => {
  const r = ranked(tasks, "2026-10-07");
  assert(r.every((t) => t.status !== "complete"));
  assert(r[0].critical);
  assert(r[0].target_date < "2026-10-07");
});
test("October 13 agenda reflects completion and explicitly carried items", () => {
  const a = agenda(tasks, "2026-10-13", "2026-10-27", [], [], "2026-10-07");
  assert(a.some((t) => t.id === "STR-007"));
  assert(!a.some((t) => t.id === "PM-001"));
  assert(
    !agenda(
      tasks.map((t) => (t.id === "STR-007" ? { ...t, status: "complete" } : t)),
      "2026-10-13",
      "2026-10-27",
      [],
      [],
      "2026-10-07",
    ).some((t) => t.id === "STR-007"),
  );
  assert(
    agenda(
      tasks,
      "2026-10-13",
      "2026-10-27",
      [],
      [{ task_id: "FT-010" }],
      "2026-10-07",
    ).some((t) => t.id === "FT-010"),
  );
});
test("date calculations use date-only calendar days across DST", () => {
  assert.equal(days("2026-11-02", "2026-10-31"), 2);
  assert.equal(days(null, "2026-10-07"), null);
});
