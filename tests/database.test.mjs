import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
test("real PostgreSQL migrations and authorization workflows", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(
    fs.readFileSync(
      new URL(
        "../supabase/migrations/202610070001_tracker.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      new URL("../supabase/seed/first_flight.sql", import.meta.url),
      "utf8",
    ),
  );
  // Model the Storage tables in PostgreSQL to exercise the exact bucket policies.
  // The hosted upload/download service still requires its own deployment smoke test.
  await db.exec(
    `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;grant execute on function storage.foldername(text) to anon,authenticated;`,
  );
  await db.exec(
    fs.readFileSync(
      new URL(
        "../supabase/migrations/202610070002_storage.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const admin = randomUUID(),
    lead = randomUUID(),
    other = randomUUID(),
    sub = randomUUID(),
    viewer = randomUUID();
  for (const id of [admin, lead, other, sub, viewer])
    await db.query("insert into auth.users values($1);", [id]);
  for (const id of [admin, lead, other, sub, viewer])
    await db.query("insert into public.profiles(id,is_admin) values($1,$2)", [
      id,
      id === admin,
    ]);
  await db.query(
    "insert into public.team_memberships values($1,'structures','lead'),($2,'electrical','lead'),($3,'structures','sublead')",
    [lead, other, sub],
  );
  async function as(id) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id ?? "",
    ]);
    await db.exec(id ? "set role authenticated" : "set role anon");
  }
  async function cmd(action, payload = {}, request = randomUUID()) {
    return (
      await db.query("select public.command($1,$2::jsonb,$3::uuid) as result", [
        action,
        JSON.stringify(payload),
        request,
      ])
    ).rows[0].result;
  }
  const row = async (id) =>
    (await db.query("select * from public.tasks where id=$1", [id])).rows[0];
  let a, b, c;
  await t.test(
    "anonymous reads source tasks but cannot mutate or read private records",
    async () => {
      await as(null);
      assert.equal(
        (await db.query("select * from public.tasks")).rows.length,
        62,
      );
      await assert.rejects(
        async () => cmd("start", { task_id: "STR-001", version: 1 }),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          db.query(
            "update public.tasks set status='complete' where id='STR-001'",
          ),
        /permission denied/,
      );
      await assert.rejects(
        () => db.query("select * from public.deliverables"),
        /permission denied/,
      );
      await assert.rejects(
        () => db.query("select * from public.profiles"),
        /permission denied/,
      );
    },
  );
  await t.test("unapproved signed-in accounts cannot write", async () => {
    await as(viewer);
    await assert.rejects(
      async () => cmd("start", { task_id: "STR-001", version: 1 }),
      /authorize/,
    );
  });
  await t.test("team ownership enforced via direct RPC calls", async () => {
    await as(other);
    await assert.rejects(
      async () => cmd("start", { task_id: "STR-001", version: 1 }),
      /permission/,
    );
    await as(sub);
    await assert.rejects(
      async () => cmd("start", { task_id: "STR-001", version: 1 }),
      /permission/,
    );
  });
  await t.test(
    "lead creates unique routine tasks with safe dependency references",
    async () => {
      await as(lead);
      const make = (title, deps = []) =>
        cmd("create_task", {
          primary_team: "structures",
          data: {
            title,
            definition_of_done: "Verified result",
            target_date: "2026-10-10",
            dependencies: deps,
          },
        });
      a = (await make("Predecessor A")).task_id;
      b = (await make("Predecessor B")).task_id;
      c = (await make("Dependent C", [a, b])).task_id;
      assert.equal(a, "STR-008");
      assert.notEqual(a, b);
      await assert.rejects(
        () => make("Missing", ["NO-999"]),
        /Invalid dependency/,
      );
    },
  );
  await t.test(
    "completion persists, advances version and requires all predecessors",
    async () => {
      await as(lead);
      await cmd("complete", { task_id: a, version: 1, note: "Verified" });
      assert.equal((await row(a)).status, "complete");
      await assert.rejects(
        async () =>
          cmd("complete", { task_id: c, version: 1, note: "Premature" }),
        /Unresolved/,
      );
      await cmd("complete", { task_id: b, version: 1, note: "Verified" });
      await cmd("complete", {
        task_id: c,
        version: 1,
        note: "All criteria met",
      });
      assert.equal((await row(c)).status, "complete");
      assert((await row(c)).completed_at);
      assert.equal((await row(c)).completed_by, lead);
    },
  );
  await t.test(
    "optimistic concurrency and duplicate request protection",
    async () => {
      await as(lead);
      const req = randomUUID();
      const payload = { task_id: "STR-001", version: 1, note: "Starting" };
      await cmd("start", payload, req);
      await cmd("start", payload, req);
      assert.equal((await row("STR-001")).version, 2);
      await assert.rejects(
        async () => cmd("start", payload),
        /Another lead changed/,
      );
    },
  );
  await t.test(
    "leads cannot modify protected fields or bypass graph endpoint",
    async () => {
      await as(lead);
      await assert.rejects(
        async () =>
          cmd("edit_task", {
            task_id: "STR-001",
            version: 2,
            data: { target_date: "2026-12-01" },
          }),
        /Director/,
      );
      await assert.rejects(
        () => db.query("select public.check_dependencies('STR-001','[]')"),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          db.query("update public.profiles set is_admin=true where id=$1", [
            lead,
          ]),
        /permission denied/,
      );
    },
  );
  await t.test(
    "evidence then submission then director evidence approval then task approval",
    async () => {
      await as(lead);
      await assert.rejects(
        async () =>
          cmd("complete", { task_id: "STR-001", version: 2, note: "Done" }),
        /evidence/,
      );
      const req = randomUUID();
      await cmd(
        "deliverable",
        {
          task_id: "STR-001",
          description: "Signed structural release",
          reference: "https://example.org/report",
        },
        req,
      );
      await cmd("complete", {
        task_id: "STR-001",
        version: 2,
        note: "Release verified",
      });
      assert.equal((await row("STR-001")).status, "submitted");
      await assert.rejects(
        async () =>
          cmd("approve_task", {
            task_id: "STR-001",
            version: 3,
            note: "Approve",
          }),
        /Director/,
      );
      await as(admin);
      await assert.rejects(
        async () =>
          cmd("approve_task", {
            task_id: "STR-001",
            version: 3,
            note: "Approve",
          }),
        /Review and approve/,
      );
      await cmd("review_deliverable", {
        id: req,
        status: "approved",
        note: "Acceptance criteria verified",
      });
      await cmd("approve_task", {
        task_id: "STR-001",
        version: 3,
        note: "Approved release",
      });
      assert.equal((await row("STR-001")).status, "complete");
    },
  );
  await t.test(
    "private evidence restricted to authorized task users",
    async () => {
      await as(other);
      assert.equal(
        (
          await db.query(
            "select * from public.deliverables where task_id='STR-001'",
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "private storage blocks anonymous and cross-team access and forged upload paths",
    async () => {
      await as(lead);
      await db.query("insert into storage.objects values($1,$2,$3,$4)", [
        randomUUID(),
        "deliverables",
        "STR-001/" + lead + "/report.pdf",
        lead,
      ]);
      await assert.rejects(
        () =>
          db.query("insert into storage.objects values($1,$2,$3,$4)", [
            randomUUID(),
            "deliverables",
            "ELEC-001/" + lead + "/report.pdf",
            lead,
          ]),
        /row-level security/,
      );
      await as(other);
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
      await as(null);
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
      await assert.rejects(
        () =>
          db.query("insert into storage.objects values($1,$2,$3,$4)", [
            randomUUID(),
            "deliverables",
            "STR-001/" + lead + "/forged.pdf",
            lead,
          ]),
        /row-level security/,
      );
      await as(admin);
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        1,
      );
    },
  );
  await t.test(
    "extension request leaves target unchanged; only admin approval changes active date",
    async () => {
      await as(lead);
      const req = randomUUID();
      await cmd(
        "request_extension",
        {
          task_id: a,
          requested_date: "2026-10-15",
          reason: "Material delay",
          progress: "Almost done",
          recovery_action: "Parallel fixture prep",
        },
        req,
      );
      assert.equal((await row(a)).data.target_date, "2026-10-10");
      await assert.rejects(
        async () =>
          cmd("review_extension", {
            id: req,
            status: "approved",
            note: "Accept",
          }),
        /Director/,
      );
      await as(admin);
      await cmd("review_extension", {
        id: req,
        status: "approved",
        note: "Recovery accepted",
      });
      assert.equal((await row(a)).data.target_date, "2026-10-15");
      assert.equal((await row(a)).data.baseline_target_date, "2026-10-10");
      assert.equal((await row(c)).data.target_date, "2026-10-10");
    },
  );
  await t.test(
    "self and transitive dependency cycles rejected in database",
    async () => {
      await as(admin);
      await assert.rejects(
        async () =>
          cmd("edit_task", {
            task_id: a,
            version: (await row(a)).version,
            data: { dependencies: [a] },
          }),
        /Invalid dependency/,
      );
      await assert.rejects(
        async () =>
          cmd("edit_task", {
            task_id: a,
            version: (await row(a)).version,
            data: { dependencies: [c] },
          }),
        /Circular/,
      );
    },
  );
  await t.test(
    "meeting snapshot remains unchanged after later task changes and refuses later notes",
    async () => {
      await as(admin);
      const meeting_id = "00000000-0000-4000-8000-000000000001";
      await cmd("meeting_note", {
        meeting_id,
        kind: "decision",
        note: "Review source uncertainties",
      });
      await cmd("finalize_meeting", { meeting_id });
      const snap = (
        await db.query("select snapshot from public.meetings where id=$1", [
          meeting_id,
        ])
      ).rows[0].snapshot;
      await cmd("reopen", {
        task_id: a,
        version: (await row(a)).version,
        note: "Additional inspection",
      });
      assert.deepEqual(
        (
          await db.query("select snapshot from public.meetings where id=$1", [
            meeting_id,
          ])
        ).rows[0].snapshot,
        snap,
      );
      await assert.rejects(
        async () =>
          cmd("meeting_note", {
            meeting_id,
            kind: "update",
            note: "Rewrite past",
          }),
        /immutable/,
      );
    },
  );
  await t.test(
    "readiness cannot be automatically or prematurely approved",
    async () => {
      await as(admin);
      await assert.rejects(
        async () =>
          cmd("readiness_decision", { status: "approved", note: "Go" }),
        /All readiness/,
      );
      await assert.rejects(
        async () =>
          cmd("readiness_item", {
            id: "R-02",
            version: (await db.query("select version from public.flight_readiness_items where id = 'R-02'")).rows[0].version,
            status: "approved",
            note: "Inspected",
          }),
        /Linked tasks/,
      );
      await as(lead);
      await assert.rejects(
        async () =>
          cmd("readiness_item", {
            id: "R-02",
            version: (await db.query("select version from public.flight_readiness_items where id = 'R-02'")).rows[0].version,
            status: "approved",
            note: "Inspected",
          }),
        /Director/,
      );
    },
  );
  await t.test(
    "seed is safe to rerun without resetting live progress or dependencies",
    async () => {
      await db.exec("reset role");
      await db.exec(
        fs.readFileSync(
          new URL("../supabase/seed/first_flight.sql", import.meta.url),
          "utf8",
        ),
      );
      assert.equal((await row("STR-001")).status, "complete");
      assert.equal((await row(a)).data.target_date, "2026-10-15");
    },
  );
  await db.close();
});

