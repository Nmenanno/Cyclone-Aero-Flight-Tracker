export function validateBackend(url, key) {
  if (!url && !key) return false;
  if (!url || !key)
    throw new Error("Provide both the Supabase URL and publishable key.");
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(parsed.hostname)
  )
    throw new Error("Use an HTTPS Supabase project URL.");
  if (key.startsWith("sb_publishable_")) return true;
  try {
    const payload = JSON.parse(
      atob(key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
    );
    if (payload.role === "anon") return true;
  } catch {
    /* A malformed or privileged key must never reach a frontend bundle. */
  }
  throw new Error(
    "Frontend configuration requires a publishable or legacy anon key. Secret and service-role keys are prohibited.",
  );
}
