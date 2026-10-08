import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Link, useLocation } from "react-router-dom";
import { Plane, Check, ArrowRight, Search, X } from "lucide-react";
import seed from "../data/first_flight_tasks.json";
import planning from "../data/planning.json";
import { blockers, ranked, days } from "./lib/engine.mjs";

type Task = Record<string, any>;
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;
const date = (v: string) =>
  v
    ? new Date(v + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Chicago",
      })
    : "Date TBD";
const status = (v: string) =>
  ({
    not_started: "Not started",
    in_progress: "In progress",
    complete: "Done",
    submitted: "In progress",
    needs_changes: "In progress",
    deferred: "Deferred",
  })[v] ?? v;
export default function SimpleTracker() {
  const [tasks, setTasks] = useState<Task[]>([]),
    [teams, setTeams] = useState<Task[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  const [teamCode, setTeamCode] = useState(""),
    [codeInput, setCodeInput] = useState(""),
    [codeError, setCodeError] = useState(""),
    [unlocking, setUnlocking] = useState(false);
  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setUnlocking(true);
    setCodeError("");
    try {
      const r = await db.rpc("verify_team_code", { p_code: codeInput });
      if (r.error) throw r.error;
      if (!r.data)
        throw Error("That code was not accepted. Check with your team lead.");
      setTeamCode(codeInput);
      setCodeInput("");
    } catch (e: any) {
      setCodeError(e.message);
    } finally {
      setUnlocking(false);
    }
  };
  const [target, setTarget] = useState("2026-11-21");
  const generation = useRef(0);
  const loc = useLocation();
  const selected = loc.pathname.startsWith("/team/")
    ? decodeURIComponent(loc.pathname.slice(6))
    : "";
  const taskId = loc.pathname.startsWith("/task/")
    ? decodeURIComponent(loc.pathname.slice(6))
    : "";
  const reload = useCallback(async () => {
    const current = ++generation.current;
    try {
      if (!db) {
        setTasks(seed);
        setTeams(planning.teams);
        setLoaded(true);
        return;
      }
      const results = await Promise.all(
        ["tasks", "task_dependencies", "teams", "project_settings"].map((t) =>
          db.from(t).select("*"),
        ),
      );
      for (const r of results) if (r.error) throw r.error;
      if (current !== generation.current) return;
      setTasks(
        results[0].data!.map((r) => ({
          ...r.data,
          ...r,
          dependencies: results[1]
            .data!.filter((d) => d.task_id === r.id)
            .map((d) => d.predecessor_id),
        })),
      );
      setTeams(results[2].data!);
      setTarget(results[3].data![0]?.flight_target ?? "2026-11-21");
      setError("");
      setLoaded(true);
    } catch (e: any) {
      if (current === generation.current) {
        setError(e.message);
        setLoaded(true);
      }
    }
  }, []);
  useEffect(() => {
    void reload();
    const timer = setInterval(reload, 15000);
    const focus = () => void reload();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [reload]);
  useEffect(() => {
    setSearch("");
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  const change = async (t: Task, next: string) => {
    if (!db || busy || !teamCode) return;
    setBusy(t.id);
    setError("");
    try {
      const r = await db.rpc("set_task_progress", {
        p_code: teamCode,
        p_task: t.id,
        p_status: next,
        p_version: t.version,
        p_request: crypto.randomUUID(),
      });
      if (r.error) throw r.error;
      await reload();
      setNotice(
        t.id +
          (next === "complete"
            ? " marked done."
            : next === "in_progress"
              ? " started."
              : " reopened."),
      );
    } catch (e: any) {
      setNotice(e.message);
      if (e.message.includes("team code")) setTeamCode("");
      void reload();
    } finally {
      setBusy("");
    }
  };
  const matches = (t: Task) =>
    (t.id + " " + t.title).toLowerCase().includes(search.toLowerCase());
  const order: Task[] = ranked(tasks);
  function renderCard({
    task: t,
    expanded = false,
  }: {
    task: Task;
    expanded?: boolean;
  }) {
    const waiting = blockers(t, tasks),
      done = t.status === "complete";
    const diff = days(t.target_date);
    return (
      <article key={t.id} className={"simple-task " + (done ? "is-done" : "")}>
        <div className="simple-meta">
          <Link to={"/task/" + t.id}>{t.id}</Link>
          <span className={diff !== null && diff < 0 && !done ? "late" : ""}>
            {date(t.target_date)}
          </span>
        </div>
        <Link className="simple-title" to={"/task/" + t.id}>
          {t.title}
        </Link>
        <div className="simple-state">
          {done ? <Check size={14} /> : null}
          {status(t.status)}
          {!done && waiting.length > 0
            ? " · Waiting on " + waiting.join(", ")
            : ""}
        </div>
        <details open={expanded || undefined}>
          <summary>Task details</summary>
          <p>
            <strong>Done when:</strong>{" "}
            {t.definition_of_done || "Definition of Done needs confirmation."}
          </p>
          {t.description && <p>{t.description}</p>}
          <p>
            Primary team:{" "}
            {t.primary_team_label ||
              teams.find((x) => x.id === t.primary_team)?.name}
          </p>
          {t.secondary_teams?.length > 0 && (
            <p>
              Also involved:{" "}
              {(t.secondary_team_labels || t.secondary_teams).join(", ")}
            </p>
          )}
          <p>
            Original target: {date(t.baseline_target_date || t.target_date)} ·
            Recovery: {date(t.recovery_date)} · Fallback:{" "}
            {date(t.absolute_date)}
          </p>
          {waiting.length > 0 && (
            <div>
              Waiting on:{" "}
              {waiting.map((id: string) => (
                <Link className="dependency-link" key={id} to={"/task/" + id}>
                  {id} — {tasks.find((x) => x.id === id)?.title}
                </Link>
              ))}
            </div>
          )}
          {t.data_issues?.length > 0 && (
            <p>Source details need confirmation: {t.data_issues.join("; ")}</p>
          )}
        </details>
        <div className="simple-actions">
          {done ? (
            <button
              disabled={!!busy || !db || !teamCode}
              onClick={() => change(t, "not_started")}
            >
              Reopen
            </button>
          ) : (
            <>
              {t.status !== "in_progress" && (
                <button
                  disabled={!!busy || !db || !teamCode}
                  onClick={() => change(t, "in_progress")}
                >
                  Start task
                </button>
              )}
              <button
                className="done-button"
                disabled={!!busy || !db || !teamCode || waiting.length > 0}
                onClick={() => change(t, "complete")}
              >
                <Check size={16} />
                {busy === t.id ? "Saving…" : "Mark done"}
              </button>
            </>
          )}
        </div>
      </article>
    );
  }
  const current = tasks.find((t) => t.id === taskId);
  return (
    <div className="simple-app">
      <header className="simple-header">
        <Link to="/" className="simple-brand">
          <Plane />
          <span>
            CYCLONE AERO<small>FIRST FLIGHT · {date(target)}, 2026</small>
          </span>
        </Link>
        <Link to="/">All teams</Link>
      </header>
      <main className="simple-main">
        <div className="simple-heading">
          <div>
            <p className="eyebrow">TEAM TASK TRACKER</p>
            <h1>
              {taskId
                ? "Task details"
                : selected
                  ? teams.find((t) => t.id === selected)?.name || "Team"
                  : "What’s next for each team"}
            </h1>
            <p>Pick a task, finish the work, mark it done.</p>
          </div>
          <div className="simple-count">
            <strong>
              {tasks.filter((t) => t.status === "complete").length}/
              {tasks.length}
            </strong>
            <span>tasks done</span>
          </div>
        </div>
        <section className="team-unlock" aria-label="Task editing">
          {teamCode ? (
            <>
              <span>
                <Check size={16} />
                Task updates unlocked
              </span>
              <button onClick={() => setTeamCode("")}>Lock updates</button>
            </>
          ) : (
            <form onSubmit={unlock}>
              <label htmlFor="team-code">Want to update tasks?</label>
              <input
                id="team-code"
                type="password"
                autoComplete="off"
                placeholder="Shared team code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                required
                maxLength={256}
              />
              <button className="button" disabled={unlocking || !db}>
                {unlocking ? "Checking…" : "Unlock updates"}
              </button>
            </form>
          )}
          {codeError && <p role="alert">{codeError}</p>}
        </section>
        {!db && (
          <div className="notice">
            Read-only preview. Shared updates are unavailable.
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button onClick={reload}>Refresh</button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}
        {!taskId && (
          <>
            <nav className="simple-filters" aria-label="Teams">
              <Link className={!selected ? "selected" : ""} to="/">
                All teams
              </Link>
              {teams.map((t) => (
                <Link
                  className={selected === t.id ? "selected" : ""}
                  key={t.id}
                  to={"/team/" + t.id}
                >
                  {t.name.split(" / ")[0]}
                </Link>
              ))}
            </nav>
            <label className="simple-search">
              <Search size={18} />
              <input
                aria-label="Find a task"
                placeholder="Find a task by name or ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </>
        )}
        {!loaded ? (
          <p>Loading tasks…</p>
        ) : taskId ? (
          current ? (
            <>
              <Link className="back-link" to={"/team/" + current.primary_team}>
                ← Back to team
              </Link>
              {renderCard({ task: current, expanded: true })}
            </>
          ) : (
            <p>
              Task not found. <Link to="/">All teams</Link>
            </p>
          )
        ) : (
          <div className="simple-teams">
            {teams
              .filter((team) => !selected || team.id === selected)
              .map((team) => {
                const all = tasks.filter(
                  (t) => t.primary_team === team.id && matches(t),
                );
                const ready = order.filter(
                  (t) =>
                    t.primary_team === team.id &&
                    matches(t) &&
                    !blockers(t, tasks).length,
                );
                const next = ready.length
                  ? ready.slice(0, 3)
                  : order
                      .filter(
                        (t: Task) => t.primary_team === team.id && matches(t),
                      )
                      .slice(0, 3);
                const rest = all.filter(
                  (t) => !next.some((x) => x.id === t.id),
                );
                return (
                  <section className="simple-team" key={team.id}>
                    <div className="simple-team-title">
                      <h2>{team.name.split(" / ")[0]}</h2>
                      <span>
                        {
                          tasks.filter(
                            (t) =>
                              t.primary_team === team.id &&
                              t.status === "complete",
                          ).length
                        }
                        /
                        {tasks.filter((t) => t.primary_team === team.id).length}{" "}
                        done
                      </span>
                    </div>
                    {next.length > 0 ? (
                      <>
                        <p className="simple-caption">
                          {ready.length
                            ? "NEXT TASKS"
                            : "UP NEXT · WAITING ON OTHER TASKS"}
                        </p>
                        {next.map((t) => renderCard({ task: t }))}
                      </>
                    ) : (
                      <p className="simple-empty">
                        {search
                          ? "No ready tasks match your search."
                          : all.every((t) => t.status === "complete")
                            ? "All tasks done."
                            : "Waiting on other tasks. Open the list below to see what’s blocking progress."}
                      </p>
                    )}
                    {rest.length > 0 && (
                      <details className="other-tasks">
                        <summary>Other tasks ({rest.length})</summary>
                        {rest
                          .sort(
                            (a, b) =>
                              Number(a.status === "complete") -
                                Number(b.status === "complete") ||
                              a.id.localeCompare(b.id),
                          )
                          .map((t) => renderCard({ task: t }))}
                      </details>
                    )}
                    <Link className="team-link" to={"/team/" + team.id}>
                      View team <ArrowRight size={15} />
                    </Link>
                  </section>
                );
              })}
          </div>
        )}
        <footer className="simple-footer">
          Shared task progress · Updates refresh automatically. Task completion
          does not authorize flight.
        </footer>
      </main>
    </div>
  );
}
