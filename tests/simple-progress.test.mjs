import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("shared checklist allows only versioned progress updates and preserves private records", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;grant usage on schema public,auth to anon,authenticated;`,
    );
    for (const file of [
      "migrations/202610070001_tracker.sql",
      "seed/first_flight.sql",
      "migrations/202610080001_simple_progress.sql",
    ])
      await db.exec(
        fs.readFileSync(
          new URL("../supabase/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      "insert into public.team_access values(true,'test-salt',sha256(convert_to('test-saltfixture-only-code','UTF8')))",
    );
    await db.exec("set role anon");
    for (const code of ["", null, "wrong-code"])
      assert.equal(
        (await db.query("select public.verify_team_code($1) as ok", [code]))
          .rows[0].ok,
        false,
      );
    await assert.rejects(
      () =>
        db.query("select public.set_task_progress($1,$2,$3,$4,$5)", [
          "AERO-001",
          "complete",
          1,
          randomUUID(),
          "wrong-code",
        ]),
      /shared team code/,
    );
    const change = async (id, status, version, request = randomUUID()) =>
      (
        await db.query(
          "select public.set_task_progress($1,$2,$3,$4,$5) as result",
          [id, status, version, request, "fixture-only-code"],
        )
      ).rows[0].result;
    const request = randomUUID();
    const done = await change("AERO-001", "complete", 1, request);
    assert.equal(done.status, "complete");
    assert.equal(done.version, 2);
    assert.deepEqual(await change("AERO-001", "complete", 1, request), done);
    await assert.rejects(
      () => change("STR-001", "complete", 1, request),
      /already used/,
    );
    await assert.rejects(
      () => change("AERO-001", "not_started", 1),
      /another device/,
    );
    await assert.rejects(() => change("STR-002", "complete", 1), /Waiting on/);
    await assert.rejects(
      () => change("AERO-001", "approved", 2),
      /Unsupported/,
    );
    await assert.rejects(
      () =>
        db.query(
          "update public.tasks set status='complete' where id='STR-002'",
        ),
      /permission denied/,
    );
    for (const table of [
      "team_access",
      "profiles",
      "deliverables",
      "task_history",
      "progress_receipts",
    ])
      await assert.rejects(
        () => db.query("select * from public." + table),
        /permission denied/,
      );
    await change("STR-001", "complete", 1);
    await change("STR-002", "complete", 1);
    await change("AERO-001", "not_started", 2);
    await db.exec("reset role");
    await db.exec(
      "update public.team_access set code_hash=sha256(convert_to('test-saltrotated-code','UTF8'))",
    );
    await db.exec("set role anon");
    await assert.rejects(
      () => change("AERO-001", "complete", 1, request),
      /shared team code/,
    );
    await db.exec("reset role");
    const t = (await db.query("select * from public.tasks where id='AERO-001'"))
      .rows[0];
    assert.equal(t.status, "not_started");
    assert.equal(t.completed_at, null);
    assert.equal(t.completed_by, null);
    assert.equal(t.data.baseline_target_date, "2026-09-29");
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.task_history where action='shared_progress' and actor is null",
        )
      ).rows[0].n,
      4,
    );
    assert.equal(
      (await db.query("select readiness_status from public.project_settings"))
        .rows[0].readiness_status,
      "not_ready",
    );
  } finally {
    await db.close();
  }
});
