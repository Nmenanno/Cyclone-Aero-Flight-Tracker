import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBackend } from "../src/lib/config.mjs";
test("only public Supabase credentials can be bundled", () => {
  assert.equal(validateBackend("", ""), false);
  assert.equal(
    validateBackend("https://example.supabase.co", "sb_publishable_test"),
    true,
  );
  const jwt = (role) =>
    "header." + btoa(JSON.stringify({ role })) + ".signature";
  assert.equal(
    validateBackend("https://example.supabase.co", jwt("anon")),
    true,
  );
  for (const key of ["sb_secret_test", jwt("service_role"), "malformed"])
    assert.throws(
      () => validateBackend("https://example.supabase.co", key),
      /prohibited/,
    );
  assert.throws(
    () => validateBackend("https://example.supabase.co", ""),
    /both/,
  );
});
