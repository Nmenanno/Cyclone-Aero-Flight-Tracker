import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import {
  NavLink,
  Link,
  Routes,
  Route,
  useParams,
  useLocation,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Plane,
  LayoutDashboard,
  Users,
  CalendarDays,
  Flag,
  ShieldCheck,
  Search,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  Printer,
  X,
  GitBranch,
  LogIn,
  Bell,
} from "lucide-react";
import { useStore, db, hydrate, type Row } from "./lib/store";
import {
  active,
  blockers,
  downstream,
  successors,
  ranked,
  agenda,
  days,
  today,
  addDays,
} from "./lib/engine.mjs";
type Store = ReturnType<typeof useStore>;
type Field = {
  name: string;
  label: string;
  type?: string;
  value?: any;
  required?: boolean;
  options?: { value: string; label: string }[];
};
type Dialog = {
  title: string;
  intro?: string;
  fields: Field[];
  submit: (v: Row) => Promise<any>;
  button?: string;
};
const label = (s: string) =>
  ({
    not_started: "Not started",
    in_progress: "In progress",
    submitted: "Awaiting review",
    needs_changes: "Needs changes",
    complete: "Complete",
    deferred: "Deferred",
    not_ready: "Not ready",
    pending_review: "Pending review",
    approved: "Approved",
  })[s] ?? s;
const fmt = (s: string | null) =>
  s
    ? new Date(s + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Chicago",
      })
    : "TBD";
const taskUrl = (id: string) => "/task/" + id;
function download(name: string, value: any) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export default function App() {
  const s = useStore(),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState("");
  const locationState=useLocation();
  useEffect(()=>{setSearch('');window.scrollTo(0,0)},[locationState.pathname]);
  const open = (d: Dialog) => setDialog(d),
    message = (m: string) => {
      setToast(m);
      setTimeout(() => setToast(""), 6000);
    };
  const signIn = () =>
    open({
      title: "Sign in to your team",
      intro:
        "Use your email to receive a secure sign-in link. A director must authorize your account before you can change project records.",
      fields: [
        {
          name: "email",
          label: "Email address",
          type: "email",
          required: true,
        },
      ],
      submit: async (v) => {
        if (!db) throw Error("Supabase has not been configured yet.");
        const { error } = await db.auth.signInWithOtp({
          email: v.email,
          options: {
            emailRedirectTo: location.origin + import.meta.env.BASE_URL,
          },
        });
        if (error) throw error;
        message("Check your email for your sign-in link.");
      },
    });
  const props = { s, open, message };
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Plane size={26} />
          </span>
          <span>
            CYCLONE AERO<small>IOWA STATE UNIVERSITY</small>
          </span>
        </Link>
        <div className="project-label">2026 FIRST-FLIGHT PROGRAM</div>
        <nav>
          {[
            ["/", "Dashboard", LayoutDashboard],
            ["/teams", "Teams", Users],
            ["/meetings", "Meetings", CalendarDays],
            ["/timeline", "Timeline", Flag],
            ["/readiness", "Flight Readiness", ShieldCheck],
          ].map(([path, name, Icon]: any) => (
            <NavLink key={path} to={path} end={path === "/"}>
              <Icon size={19} />
              {name}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-teams">
          <span className="eyebrow">WORKSTREAMS</span>
          {s.teams.map((t: Row) => (
            <Link key={t.id} to={"/team/" + t.id}>
              <span className="dot" />
              {t.name.split(" / ")[0]}
              <ChevronRight size={13} />
            </Link>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="flight-mini">
            <Plane size={18} />
            <div>
              First flight target
              <strong>{fmt(s.settings.flight_target)}, 2026</strong>
            </div>
          </div>
          <p>Built for the next action.</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Search tasks"
              placeholder="Find a task by name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")}>
                <X size={16} />
              </button>
            )}
          </div>
          <div className="header-actions">
            {s.admin && <NavLink to="/admin">Administration</NavLink>}
            {s.member && (
              <button className="button" onClick={() => addTask(s, open)}>
                <Plus size={16} />
                Add Task
              </button>
            )}
            {s.user ? (
              <button
                className="button subtle"
                onClick={async () => {
                  await db?.auth.signOut();
                  await s.reload();
                }}
              >
                Sign out
              </button>
            ) : (
              <button className="button subtle" onClick={signIn}>
                <LogIn size={16} />
                Sign in
              </button>
            )}
          </div>
        </header>
        <main onClick={event=>{if(search&&(event.target as Element).closest('a[href^="#/"]'))setSearch('')}}>
          {s.preview && (
            <div className="notice">
              <AlertTriangle size={18} />
              <span>
                <strong>Source-plan preview · Read only.</strong> Supabase is
                not connected. These are the 62 imported source tasks, not live
                team progress.
              </span>
            </div>
          )}
          {s.error && (
            <div className="notice error" role="alert">
              Shared data could not refresh: {s.error}
              <button onClick={s.reload}>Retry</button>
            </div>
          )}
          {s.user && !s.member && (
            <div className="notice">
              Your account is signed in and waiting for a director to assign a
              team role. Account ID: {s.user.id}
            </div>
          )}
          {s.loading ? (
            <div className="empty">Loading shared project records…</div>
          ) : search ? (
            <>
              <PageHead
                eyebrow="PROJECT SEARCH"
                title={"Results for “" + search + "”"}
              />
              <TaskList
                tasks={s.tasks.filter((t: Row) =>
                  (t.id + " " + t.title)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )}
                s={s}
                all
              />
            </>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard {...props} />} />
              <Route path="/teams" element={<Teams {...props} />} />
              <Route path="/team/:team" element={<Team {...props} />} />
              <Route path="/task/:id" element={<TaskDetail {...props} />} />
              <Route path="/meetings" element={<Meetings {...props} />} />
              <Route path="/timeline" element={<Timeline {...props} />} />
              <Route path="/readiness" element={<Readiness {...props} />} />
              <Route path="/admin" element={<Admin {...props} />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    Page not found. <Link to="/">Return to dashboard</Link>
                  </div>
                }
              />
            </Routes>
          )}
          <footer>
            Cyclone Aero Design{" "}
            <span>
              Thanksgiving 2026 First Flight · Dates in America/Chicago
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {dialog && (
        <FormDialog
          dialog={dialog}
          close={() => setDialog(null)}
          message={message}
        />
      )}
    </div>
  );
}
function PageHead({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return <span className={"badge " + status}>{label(status)}</span>;
}
function Due({ task: t, asOf }: { task: Row; asOf?: string }) {
  const d = days(t.target_date, asOf);
  return (
    <div className={"due " + (d !== null && d < 0 && active(t) ? "late" : "")}>
      <strong>{fmt(t.target_date)}</strong>
      <span>
        {t.status === "complete"
          ? "Completed"
          : d === null
            ? "Date needs confirmation"
            : d < 0
              ? `${Math.abs(d)} days overdue`
              : d === 0
                ? "Due today"
                : `${d} days remaining`}
      </span>
    </div>
  );
}
function TaskCard({
  task: t,
  s,
  featured = false,
}: {
  task: Row;
  s: Store;
  featured?: boolean;
}) {
  const waits = blockers(t, s.tasks),
    impact = downstream(t.id, s.tasks).filter((id) =>
      active(s.tasks.find((x: Row) => x.id === id)),
    ).length;
  return (
    <Link
      className={"task-card " + (featured ? "featured" : "")}
      to={taskUrl(t.id)}
    >
      <div className="task-meta">
        <span className="task-id">{t.id}</span>
        {t.critical && <span className="critical">Flight-critical</span>}
        {t.priority_marked && !t.critical && (
          <span className="priority">Priority</span>
        )}
        <ArrowUpRight size={17} />
      </div>
      <h3>{t.title}</h3>
      <p className="team-label">
        {t.primary_team_label ??
          s.teams.find((x: Row) => x.id === t.primary_team)?.name}
        {t.owner_id && (
          <>
            {" "}
            ·{" "}
            {s.profiles.find((p: Row) => p.id === t.owner_id)?.display_name ??
              "Assigned"}
          </>
        )}
      </p>
      <div className="card-bottom">
        <div className="badges">
          <Badge status={t.status} />
          {waits.length > 0 && active(t) && (
            <span className="badge blocked">Blocked · {waits.length}</span>
          )}
        </div>
        <Due task={t} />
      </div>
      {impact > 0 && active(t) && (
        <div className="impact">
          <GitBranch size={14} />
          {impact} downstream tasks affected
        </div>
      )}
    </Link>
  );
}
function TaskList({
  tasks,
  s,
  all = false,
}: {
  tasks: Row[];
  s: Store;
  all?: boolean;
}) {
  return tasks.length ? (
    <>
      <div className="task-grid">
        {tasks.slice(0, all ? tasks.length : 6).map((t: Row) => (
          <TaskCard key={t.id} task={t} s={s} />
        ))}
      </div>
      {!all && tasks.length > 6 && (
        <details>
          <summary>Show {tasks.length - 6} more tasks</summary>
          <div className="task-grid">
            {tasks.slice(6).map((t: Row) => (
              <TaskCard key={t.id} task={t} s={s} />
            ))}
          </div>
        </details>
      )}
    </>
  ) : (
    <div className="empty">No tasks in this section.</div>
  );
}
function Section({
  title,
  caption,
  children,
  extra,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {caption && <p>{caption}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
function Dashboard({ s }: Props) {
  const [team, setTeam] = useState("all");
  const live = s.tasks.filter(active),
    complete = s.tasks.filter((t: Row) => t.status === "complete"),
    critical = s.tasks.filter((t: Row) => t.critical),
    requirements = s.milestones
      .filter(
        (m: Row) => days(m.target_date) !== null && days(m.target_date)! <= 14,
      )
      .flatMap((m: Row) => m.requirements);
  const priorities = ranked(s.tasks, today(), requirements).slice(0, 6),
    next = s.meetings
      .filter((m: Row) => !m.cancelled && m.date >= today())
      .sort((a: Row, b: Row) => a.date.localeCompare(b.date))[0];
  const filtered = live.filter(
    (t: Row) => team === "all" || t.primary_team === team,
  );
  return (
    <>
      <PageHead
        eyebrow="CYCLONE AERO — FIRST FLIGHT"
        title="Make the next action clear."
        subtitle="One aircraft. Seven workstreams. A shared path to first flight."
      >
        <div className="countdown">
          <Plane size={25} />
          <div>
            <strong>
              {Math.max(0, days(s.settings.flight_target) ?? 0)}
              <span> DAYS TO FIRST FLIGHT</span>
            </strong>
            <p>{fmt(s.settings.flight_target).toUpperCase()}, 2026</p>
          </div>
        </div>
      </PageHead>
      <div className="stats">
        {[
          [
            Math.round((complete.length / (s.tasks.length || 1)) * 100) + "%",
            "Overall complete",
            `${complete.length} of ${s.tasks.length} tasks`,
          ],
          [
            `${critical.filter((t: Row) => t.status === "complete").length}/${critical.length}`,
            "Flight-critical complete",
            "Source critical markings",
          ],
          [
            live.filter((t: Row) => t.target_date && t.target_date < today())
              .length,
            "Overdue",
            "Needs a recovery plan",
          ],
          [
            live.filter((t: Row) => blockers(t, s.tasks).length).length,
            "Blocked",
            "Waiting on dependencies",
          ],
          [
            live.filter(
              (t: Row) =>
                days(t.target_date) !== null &&
                days(t.target_date)! >= 0 &&
                days(t.target_date)! <= 7,
            ).length,
            "Due in 7 days",
            "Target deadlines",
          ],
          [
            live.filter(
              (t: Row) =>
                days(t.target_date) !== null &&
                days(t.target_date)! >= 0 &&
                days(t.target_date)! <= 14,
            ).length,
            "Due in 14 days",
            "Target deadlines",
          ],
          [
            s.member
              ? s.extensions.filter((e: Row) => e.status === "pending").length
              : "—",
            "Extension requests",
            s.member ? "Pending in your access" : "Sign in to view",
          ],
        ].map(([value, title, sub], i) => (
          <div className={"stat stat-" + i} key={String(title)}>
            <strong>{value}</strong>
            <span>{title}</span>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="meeting-banner">
        <div>
          <CalendarDays size={22} />
          <div>
            <strong>
              {next
                ? `Next leads / subleads meeting · ${fmt(next.date)}`
                : "Meeting schedule"}
            </strong>
            <p>{next?.focus ?? "View meetings and preserved agendas"}</p>
          </div>
        </div>
        <Link to="/meetings">
          Open agenda <ArrowRight size={17} />
        </Link>
      </div>
      {s.admin && s.extensions.some((e: Row) => e.status === "pending") && (
        <div className="notice">
          <Link to="/admin">
            {s.extensions.filter((e: Row) => e.status === "pending").length}{" "}
            extension requests need your decision →
          </Link>
        </div>
      )}
      <Section
        title="What needs to happen now"
        caption="Highest-impact active work, ranked by critical deadlines and downstream dependencies."
        extra={<span className="eyebrow">IMMEDIATE PRIORITIES</span>}
      >
        <TaskList tasks={priorities} s={s} />
      </Section>
      <div className="two-columns">
        <Section
          title="Next 7 days"
          caption="Due today through the next seven days."
          extra={
            <select
              aria-label="Filter upcoming work by team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            >
              <option value="all">All teams</option>
              {s.teams.map((t: Row) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          }
        >
          {s.teams
            .filter((t: Row) => team === "all" || team === t.id)
            .map((tm: Row) => {
              const ts = filtered.filter(
                (t: Row) =>
                  t.primary_team === tm.id &&
                  days(t.target_date) !== null &&
                  days(t.target_date)! >= 0 &&
                  days(t.target_date)! <= 7,
              );
              return ts.length ? (
                <div key={tm.id} className="compact-group">
                  <h4>{tm.name}</h4>
                  {ts.map((t: Row) => (
                    <Compact key={t.id} t={t} />
                  ))}
                </div>
              ) : null;
            })}
          {!filtered.some(
            (t: Row) =>
              days(t.target_date) !== null &&
              days(t.target_date)! >= 0 &&
              days(t.target_date)! <= 7,
          ) && <div className="empty">No upcoming target dates.</div>}
        </Section>
        <Section
          title="Days 8–14"
          caption="Get ahead of the next wave of work."
        >
          {filtered
            .filter(
              (t: Row) =>
                days(t.target_date)! >= 8 && days(t.target_date)! <= 14,
            )
            .map((t: Row) => (
              <Compact key={t.id} t={t} />
            ))}
        </Section>
      </div>
      <Section
        title="Blockers requiring coordination"
        caption="Unfinished predecessors and the work they hold up."
      >
        <div className="blocker-list">
          {ranked(s.tasks)
            .filter((t: Row) => successors(t.id, s.tasks).some(active))
            .slice(0, 5)
            .map((t: Row) => (
              <div className="blocker-row" key={t.id}>
                <Link to={taskUrl(t.id)}>
                  <span className="task-id">{t.id}</span>
                  <strong>{t.title}</strong>
                  <small>
                    {downstream(t.id, s.tasks).length} direct + indirect
                    successors
                  </small>
                </Link>
                <ArrowRight size={20} />
                <div>
                  {successors(t.id, s.tasks)
                    .filter(active)
                    .map((d: Row) => (
                      <Link key={d.id} to={taskUrl(d.id)}>
                        {d.id} · {d.title}
                      </Link>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </Section>
      {s.member && (
        <Section
          title="Your notifications"
          caption="Recent updates plus upcoming work."
        >
          {s.notifications
            .slice(-8)
            .reverse()
            .map((n: Row) => (
              <Link className="compact" key={n.id} to={taskUrl(n.task_id)}>
                <Bell size={16} />
                {n.message}
                <small>{new Date(n.created_at).toLocaleString()}</small>
              </Link>
            ))}
        </Section>
      )}
    </>
  );
}
function Compact({ t, asOf }: { t: Row; asOf?: string }) {
  return (
    <Link to={taskUrl(t.id)} className="compact">
      <span>
        <small>{t.id}</small>
        <strong>{t.title}</strong>
      </span>
      <Due task={t} asOf={asOf} />
    </Link>
  );
}
type Props = {
  s: Store;
  open: (d: Dialog) => void;
  message: (m: string) => void;
};
function Teams({ s }: Props) {
  return (
    <>
      <PageHead
        eyebrow="SEVEN WORKSTREAMS"
        title="Your team. Your next move."
        subtitle="Ownership follows the source plan, including shared responsibilities."
      />
      <div className="task-grid">
        {s.teams.map((tm: Row) => {
          const tasks = s.tasks.filter((t: Row) => t.primary_team === tm.id),
            next = ranked(s.tasks).find(
              (t: Row) =>
                t.primary_team === tm.id &&
                !blockers(t, s.tasks).length &&
                t.status !== "submitted",
            );
          return (
            <Link className="team-tile" to={"/team/" + tm.id} key={tm.id}>
              <div className="team-initial">{tm.prefix}</div>
              <h2>{tm.name}</h2>
              <p>
                {tasks.filter((t: Row) => t.status === "complete").length} /{" "}
                {tasks.length} primary tasks complete
              </p>
              <div className="progress">
                <i
                  style={{
                    width:
                      (tasks.filter((t: Row) => t.status === "complete")
                        .length /
                        (tasks.length || 1)) *
                        100 +
                      "%",
                  }}
                />
              </div>
              <small>NEXT ACTIONABLE TASK</small>
              <strong>
                {next
                  ? next.id + " · " + next.title
                  : "Resolve blockers or await review"}
              </strong>
              <ArrowUpRight size={20} />
            </Link>
          );
        })}
      </div>
    </>
  );
}
function Team({ s, open }: Props) {
  const { team } = useParams(),
    tm = s.teams.find((t: Row) => t.id === team);
  if (!tm) return <div className="empty">Team not found.</div>;
  const ordered = ranked(s.tasks).filter((t: Row) => t.primary_team === team),
    ready = ordered.filter(
      (t: Row) => !blockers(t, s.tasks).length && t.status !== "submitted",
    ),
    next = ready[0];
  return (
    <>
      <PageHead
        eyebrow="TEAM WORKSPACE"
        title={tm.name}
        subtitle="Start with the next task whose predecessors are complete."
      >
        {s.canManage(tm.id) && (
          <button className="button" onClick={() => addTask(s, open, tm.id)}>
            <Plus size={17} />
            Add Task
          </button>
        )}
      </PageHead>
      <div className="next-priority">
        <div className="eyebrow">NEXT ACTIONABLE TASK</div>
        {next ? (
          <>
            <div className="next-layout">
              <div>
                <span className="task-id">{next.id}</span>
                <h2>{next.title}</h2>
                <p>
                  <strong>Done when:</strong>{" "}
                  {next.definition_of_done ??
                    "Definition of Done needs confirmation."}
                </p>
                <Badge status={next.status} />
              </div>
              <Due task={next} />
            </div>
            <div className="actions">
              <Link className="button" to={taskUrl(next.id)}>
                View task <ArrowRight size={16} />
              </Link>
              {s.canWork(next) && (
                <>
                  <button
                    className="button subtle"
                    onClick={() => submitEvidence(next, s, open)}
                  >
                    Submit deliverable
                  </button>
                  <button
                    className="button subtle"
                    onClick={() => completion(next, s, open)}
                  >
                    Mark complete
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <h2>No actionable task right now.</h2>
            <p>Review the dependencies below or follow up on submitted work.</p>
          </>
        )}
      </div>
      <Section title="Next 3 tasks">
        <TaskList tasks={ready.slice(1, 4)} s={s} />
      </Section>
      {[
        [
          "Overdue",
          (t: Row) => active(t) && t.target_date && t.target_date < today(),
        ],
        [
          "Ready to work",
          (t: Row) =>
            active(t) &&
            t.status !== "submitted" &&
            !blockers(t, s.tasks).length,
        ],
        ["In progress", (t: Row) => t.status === "in_progress"],
        [
          "Waiting on another team",
          (t: Row) => active(t) && blockers(t, s.tasks).length > 0,
        ],
        [
          "Upcoming",
          (t: Row) => active(t) && t.target_date && t.target_date >= today(),
        ],
        ["Completed", (t: Row) => t.status === "complete"],
      ].map(([title, filter]: any) => (
        <Section key={title} title={title}>
          <TaskList
            tasks={s.tasks
              .filter((t: Row) => t.primary_team === team)
              .filter(filter)}
            s={s}
          />
        </Section>
      ))}
      <Section title="Secondary responsibilities">
        <TaskList
          tasks={s.tasks.filter((t: Row) =>
            (t.secondary_teams ?? []).includes(team),
          )}
          s={s}
        />
      </Section>
      <details>
        <summary>All team tasks</summary>
        <TaskList
          tasks={s.tasks.filter((t: Row) => t.primary_team === team)}
          s={s}
          all
        />
      </details>
    </>
  );
}
function completion(t: Row, s: Store, open: Props["open"]) {
  open({
    title: t.requires_review
      ? "Submit for completion review"
      : "Mark task complete",
    intro: t.requires_review
      ? "Evidence is required. The task will remain Awaiting Review until a director approves it."
      : "Confirm that every Definition of Done requirement is satisfied.",
    fields: [
      {
        name: "note",
        label: "Completion note",
        type: "textarea",
        required: true,
      },
    ],
    submit: (v) =>
      s.run("complete", { task_id: t.id, version: t.version, ...v }),
  });
}
function submitEvidence(t: Row, s: Store, open: Props["open"]) {
  open({
    title: "Submit deliverable · " + t.id,
    intro:
      "Evidence is private to authorized task users. Attach a file, an HTTPS reference, or a written report.",
    fields: [
      {
        name: "description",
        label: "Evidence / report description",
        type: "textarea",
        required: true,
      },
      {
        name: "reference",
        label: "OneDrive, Google Drive, GitHub or other HTTPS link",
        type: "url",
      },
      { name: "file", label: "Attachment (up to 25 MB)", type: "file" },
    ],
    submit: async (v) => {
      let file_path = "";
      if (v.file?.size) {
        if (v.file.size > 26214400) throw Error("File exceeds 25 MB");
        file_path =
          t.id +
          "/" +
          s.user.id +
          "/" +
          crypto.randomUUID() +
          "/" +
          v.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const r = await db!.storage
          .from("deliverables")
          .upload(file_path, v.file);
        if (r.error) throw r.error;
      }
      try {
        await s.run("deliverable", {
          task_id: t.id,
          description: v.description,
          reference: v.reference,
          file_path,
        });
      } catch (e) {
        if (file_path)
          await db!.storage.from("deliverables").remove([file_path]);
        throw e;
      }
    },
  });
}
function requestExtension(t: Row, s: Store, open: Props["open"]) {
  open({
    title: "Request extension · " + t.id,
    intro: `Current target: ${fmt(t.target_date)}. ${downstream(t.id, s.tasks).length} downstream tasks may be affected. The deadline stays unchanged until a director approves.`,
    fields: [
      {
        name: "requested_date",
        label: "Requested new target",
        type: "date",
        required: true,
      },
      {
        name: "reason",
        label: "Reason for delay",
        type: "textarea",
        required: true,
      },
      {
        name: "progress",
        label: "Current progress",
        type: "textarea",
        required: true,
      },
      {
        name: "recovery_action",
        label: "Proposed recovery action",
        type: "textarea",
        required: true,
      },
      { name: "notes", label: "Impact / additional notes", type: "textarea" },
    ],
    submit: (v) => s.run("request_extension", { task_id: t.id, ...v }),
  });
}
function addTask(s: Store, open: Props["open"], team?: string) {
  const teams = s.teams.filter((t: Row) => s.canManage(t.id));
  open({
    title: "Add a task",
    intro: "A unique team-prefixed ID will be assigned by the shared database.",
    fields: [
      {
        name: "primary_team",
        label: "Primary team",
        value: team ?? teams[0]?.id,
        options: teams.map((t: Row) => ({ value: t.id, label: t.name })),
      },
      { name: "title", label: "Title", required: true },
      {
        name: "definition_of_done",
        label: "Definition of Done",
        type: "textarea",
        required: true,
      },
      {
        name: "target_date",
        label: "Target date",
        type: "date",
        required: true,
      },
      { name: "description", label: "Description", type: "textarea" },
      { name: "recovery_date", label: "Recovery date", type: "date" },
      { name: "absolute_date", label: "Absolute deadline", type: "date" },
      { name: "phase", label: "Phase" },
      {
        name: "secondary_teams",
        label: "Secondary team IDs (comma separated)",
      },
      {
        name: "dependencies",
        label: "Predecessors",
        type: "multiselect",
        options: s.tasks.map((t: Row) => ({
          value: t.id,
          label: t.id + " · " + t.title,
        })),
      },
      {
        name: "requires_review",
        label: "Require evidence and director approval",
        type: "checkbox",
        value: true,
      },
      ...(s.admin
        ? [{ name: "critical", label: "Flight-critical", type: "checkbox" }]
        : []),
    ],
    submit: (v) =>
      s.run("create_task", {
        primary_team: v.primary_team,
        data: { ...v, secondary_teams: split(v.secondary_teams) },
      }),
  });
}
const split = (v: string) =>
  v
    ? v
        .split(",")
        .map((x: any) => x.trim())
        .filter(Boolean)
    : [];
function TaskDetail({ s, open, message }: Props) {
  const { id } = useParams(),
    t = s.tasks.find((x: Row) => x.id === id);
  if (!t) return <div className="empty">Task not found.</div>;
  const wait = blockers(t, s.tasks),
    succ = successors(t.id, s.tasks),
    can = s.canWork(t),
    evidence = s.deliverables.filter((d: Row) => d.task_id === id),
    history = s.history
      .filter((h: Row) => h.task_id === id)
      .sort((a: Row, b: Row) => b.id - a.id);
  const statusAction = (action: string, title: string) =>
    open({
      title,
      fields: [
        {
          name: "note",
          label: "Reason / review note",
          type: "textarea",
          required: true,
        },
      ],
      submit: (v) => s.run(action, { task_id: t.id, version: t.version, ...v }),
    });
  return (
    <>
      <Link className="backlink" to={"/team/" + t.primary_team}>
        ← Team workspace
      </Link>
      <PageHead
        eyebrow={t.id + " · PHASE " + (t.phase ?? "TBD")}
        title={t.title}
        subtitle={t.source_responsible_team ?? t.primary_team}
      />
      <div className="detail-toolbar">
        <Badge status={t.status} />
        {t.critical && <span className="critical">Flight-critical</span>}
        {wait.length > 0 && (
          <span className="badge blocked">
            Blocked by {wait.length} predecessor{wait.length > 1 ? "s" : ""}
          </span>
        )}
        {t.requires_review && (
          <span className="badge">Evidence + director review required</span>
        )}
      </div>
      {can && (
        <div className="actions">
          {!["complete", "submitted"].includes(t.status) && (
            <>
              <button className="button" onClick={() => completion(t, s, open)}>
                Mark complete
              </button>
              <button
                className="button subtle"
                onClick={() => statusAction("start", "Start task")}
              >
                Start task
              </button>
            </>
          )}
          <button
            className="button subtle"
            onClick={() => submitEvidence(t, s, open)}
          >
            Submit deliverable
          </button>
          <button
            className="button subtle"
            onClick={() => requestExtension(t, s, open)}
          >
            Request extension
          </button>
          <button
            className="button subtle"
            onClick={() => statusAction("update", "Add progress update")}
          >
            Add update
          </button>
          {s.canManage(t.primary_team) && (
            <button
              className="button subtle"
              onClick={() => editTask(t, s, open)}
            >
              Edit task
            </button>
          )}
          {s.admin && t.status === "submitted" && (
            <>
              <button
                className="button"
                onClick={() =>
                  statusAction("approve_task", "Approve task completion")
                }
              >
                Approve completion
              </button>
              <button
                className="button subtle"
                onClick={() =>
                  statusAction("return_task", "Return for changes")
                }
              >
                Needs changes
              </button>
            </>
          )}
          {s.admin && t.status === "complete" && (
            <button
              className="button subtle"
              onClick={() => statusAction("reopen", "Reopen with a reason")}
            >
              Reopen
            </button>
          )}
          {s.admin && active(t) && (
            <button
              className="button subtle"
              onClick={() => statusAction("defer", "Formally defer task")}
            >
              Defer
            </button>
          )}
        </div>
      )}
      <div className="two-columns">
        <Section title="Definition of Done">
          <div className="panel">
            <p className="definition">
              {t.definition_of_done ??
                "TBD — administrator confirmation required."}
            </p>
            {t.description && <p>{t.description}</p>}
            <dl>
              <dt>Primary ownership</dt>
              <dd>{t.primary_team_label ?? t.primary_team}</dd>
              <dt>Secondary ownership</dt>
              <dd>
                {(t.secondary_team_labels ?? t.secondary_teams ?? []).join(
                  ", ",
                ) || "None recorded"}
              </dd>
              <dt>Assigned owner</dt>
              <dd>
                {s.profiles.find((p: Row) => p.id === t.owner_id)
                  ?.display_name ?? (t.owner_id ? "Assigned" : "Unassigned")}
              </dd>
              <dt>Source</dt>
              <dd>
                {t.source_page
                  ? "PDF page " + t.source_page
                  : "Team-created task"}
              </dd>
            </dl>
          </div>
        </Section>
        <Section title="Schedule">
          <div className="panel date-grid">
            {[
              ["Active target", t.target_date],
              ["Original baseline", t.baseline_target_date],
              ["Recovery", t.recovery_date],
              ["Absolute / fallback", t.absolute_date],
            ].map(([name, date]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{fmt(date)}</strong>
              </div>
            ))}
          </div>
          {t.data_issues?.length > 0 && (
            <div className="notice">
              <div>
                <strong>Source data needs review</strong>
                <ul>
                  {t.data_issues.map((x: string) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Section>
      </div>
      <Section
        title="Dependency map"
        caption="Only approved completion satisfies a hard dependency. Deferred work remains a blocker."
      >
        <div className="dependency-map">
          <div>
            <h4>Previous tasks</h4>
            {t.dependencies.map((dep: string) => {
              const p = s.tasks.find((x: Row) => x.id === dep);
              return (
                <Link key={dep} to={taskUrl(dep)}>
                  <span>
                    {dep} · {p?.title}
                  </span>
                  <Badge status={p?.status ?? "not_started"} />
                </Link>
              );
            })}
            {!t.dependencies.length && <p>No predecessors</p>}
          </div>
          <ArrowRight />
          <div className="selected-node">
            <strong>{t.id}</strong>
            {t.title}
          </div>
          <ArrowRight />
          <div>
            <h4>Direct successors</h4>
            {succ.map((x: any) => (
              <Link key={x.id} to={taskUrl(x.id)}>
                {x.id} · {x.title}
              </Link>
            ))}
            {!succ.length && <p>No successors</p>}
          </div>
        </div>
        <p className="muted">
          {downstream(t.id, s.tasks).length} total downstream tasks.{" "}
          {wait.length
            ? `Waiting on: ${wait.join(", ")}`
            : "All predecessors are complete."}
        </p>
      </Section>
      <Section
        title="Deliverables"
        caption={
          can
            ? "Private evidence and review decisions."
            : "Sign in with task access to view private evidence."
        }
      >
        {evidence.map((d: Row) => (
          <div key={d.id} className="panel submission">
            <div>
              <Badge status={d.status} />
              <small>{new Date(d.created_at).toLocaleString()}</small>
            </div>
            <p>{d.description}</p>
            {d.reference && (
              <a href={d.reference} target="_blank" rel="noreferrer">
                Open reference ↗
              </a>
            )}
            {d.file_path && (
              <button
                className="button subtle"
                onClick={async () => {
                  const r = await db!.storage
                    .from("deliverables")
                    .createSignedUrl(d.file_path, 60);
                  if (r.error) message(r.error.message);
                  else
                    window.open(
                      r.data.signedUrl,
                      "_blank",
                      "noopener,noreferrer",
                    );
                }}
              >
                Open private attachment
              </button>
            )}
            {d.review_note && <p>Reviewer: {d.review_note}</p>}
            {s.admin && d.status === "submitted" && (
              <button
                className="button subtle"
                onClick={() => review(d, "deliverable", s, open)}
              >
                Review evidence
              </button>
            )}
          </div>
        ))}
        {can && !evidence.length && (
          <div className="empty">No evidence submitted yet.</div>
        )}
      </Section>
      <Section
        title="Comments & history"
        caption="Changes are recorded by the server. Imported completion timestamps remain unknown."
      >
        {history.slice(0, 30).map((h: Row) => (
          <div className="history" key={h.id}>
            <Clock size={15} />
            <div>
              <strong>{h.action.replaceAll("_", " ")}</strong>
              <p>
                {h.detail.note ?? h.detail.reason ?? h.detail.description ?? ""}
              </p>
              <small>
                {new Date(h.created_at).toLocaleString()} ·{" "}
                {s.profiles.find((p: Row) => p.id === h.actor)?.display_name ??
                  "Recorded user"}
              </small>
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}
function editTask(t: Row, s: Store, open: Props["open"]) {
  open({
    title: "Edit " + t.id,
    intro:
      "Baseline deadlines are preserved. Enter cleared data issues only after confirming their resolution.",
    fields: [
      { name: "title", label: "Title", value: t.title, required: true },
      {
        name: "definition_of_done",
        label: "Definition of Done",
        type: "textarea",
        value: t.definition_of_done,
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        value: t.description,
      },
      {
        name: "owner_id",
        label: "Owner",
        value: t.owner_id ?? "",
        options: [
          { value: "", label: "Unassigned" },
          ...s.profiles.map((p: Row) => ({
            value: p.id,
            label: p.display_name + " · " + p.id.slice(0, 8),
          })),
        ],
      },
      ...(s.admin
        ? [
            {
              name: "target_date",
              label: "Active target",
              type: "date",
              value: t.target_date,
            },
            {
              name: "recovery_date",
              label: "Recovery",
              type: "date",
              value: t.recovery_date,
            },
            {
              name: "absolute_date",
              label: "Absolute deadline",
              type: "date",
              value: t.absolute_date,
            },
            {
              name: "dependencies",
              label: "Predecessors",
              type: "multiselect",
              value: t.dependencies,
              options: s.tasks
                .filter((x: Row) => x.id !== t.id)
                .map((x: Row) => ({
                  value: x.id,
                  label: x.id + " · " + x.title,
                })),
            },
            {
              name: "critical",
              label: "Flight-critical",
              type: "checkbox",
              value: t.critical,
            },
            {
              name: "requires_review",
              label: "Require evidence and director review",
              type: "checkbox",
              value: t.requires_review,
            },
            {
              name: "data_issues",
              label: "Unresolved data issues (one per line)",
              type: "textarea",
              value: (t.data_issues ?? []).join("\n"),
            },
          ]
        : []),
    ],
    submit: (v) =>
      s.run("edit_task", {
        task_id: t.id,
        version: t.version,
        data: {
          ...v,
          ...(s.admin
            ? {
                target_date: v.target_date || null,
                recovery_date: v.recovery_date || null,
                absolute_date: v.absolute_date || null,
                data_issues: v.data_issues.split("\n").filter(Boolean),
              }
            : {}),
        },
      }),
  });
}
function review(item: Row, kind: string, s: Store, open: Props["open"]) {
  open({
    title: "Review " + kind + " · " + item.task_id,
    fields: [
      {
        name: "status",
        label: "Decision",
        options: (kind === "extension"
          ? ["approved", "denied"]
          : ["approved", "changes_requested", "rejected"]
        ).map((value) => ({ value, label: value.replaceAll("_", " ") })),
      },
      {
        name: "note",
        label: "Reason / reviewer comments",
        type: "textarea",
        required: true,
      },
    ],
    submit: (v) => s.run("review_" + kind, { id: item.id, ...v }),
  });
}
function Meetings({ s, open }: Props) {
  const [selected, setSelected] = useState(""),
    [full, setFull] = useState(false);
  const meetings = [...s.meetings].sort((a: Row, b: Row) =>
    a.date.localeCompare(b.date),
  );
  const m =
    meetings.find((x: Row) => x.id === selected) ??
    meetings.find((x: Row) => x.date >= today() && !x.cancelled) ??
    meetings.at(-1);
  if (!m) return <div className="empty">No meetings scheduled.</div>;
  const next =
      m.snapshot?.next_date ??
      meetings.find((x: Row) => x.date > m.date && !x.cancelled)?.date ??
      addDays(m.date, 14),
    snapshot = m.snapshot,
    ts = snapshot
      ? hydrate(snapshot.tasks ?? [], snapshot.dependencies ?? [])
      : s.tasks,
    ex = snapshot ? (snapshot.extensions ?? []) : s.extensions,
    notes = snapshot
      ? (snapshot.notes ?? [])
      : s.notes.filter((n: Row) => n.meeting_id === m.id),
    items = snapshot
      ? (snapshot.items ?? [])
      : s.items.filter((i: Row) => i.meeting_id === m.id),
    ms = snapshot ? (snapshot.milestones ?? []) : s.milestones;
  const ag = agenda(
    ts,
    m.date,
    next,
    ex,
    items,
    snapshot ? snapshot.as_of : today(),
  );
  const previous =
    snapshot?.previous_date ??
    meetings.filter((x: Row) => x.date < m.date).at(-1)?.date ??
    "2026-09-22";
  if (m.finalized_at && !snapshot)
    return (
      <>
        <PageHead
          eyebrow="MEETING HISTORY"
          title={fmt(m.date) + ", 2026"}
          subtitle="This meeting has a preserved historical record."
        />
        <div className="notice">
          Sign in with team authorization to view its private snapshot and
          notes. Current tasks are not substituted for historical records.
        </div>
        <select
          aria-label="Select meeting"
          value={m.id}
          onChange={(e) => setSelected(e.target.value)}
        >
          {meetings.map((x: Row) => (
            <option key={x.id} value={x.id}>
              {fmt(x.date)}
            </option>
          ))}
        </select>
      </>
    );
  const note = () =>
    open({
      title: "Meeting note",
      fields: [
        {
          name: "task_id",
          label: "Task (optional)",
          options: [
            { value: "", label: "General meeting item" },
            ...s.tasks
              .filter((t: Row) => s.canWork(t))
              .map((t: Row) => ({
                value: t.id,
                label: t.id + " · " + t.title,
              })),
          ],
        },
        {
          name: "kind",
          label: "Type",
          options: [
            "update",
            "decision",
            "action",
            "blocker",
            "discussed",
            "carry",
          ].map((value) => ({
            value,
            label: value === "carry" ? "Carry to next meeting" : value,
          })),
        },
        {
          name: "note",
          label: "Note / decision / action and responsible person",
          type: "textarea",
          required: true,
        },
      ],
      submit: (v) =>
        s.run("meeting_note", {
          ...v,
          task_id: v.task_id || null,
          meeting_id: m.id,
        }),
    });
  return (
    <>
      <PageHead
        eyebrow="LEADS / SUBLEADS MEETING"
        title={fmt(m.date) + ", 2026"}
        subtitle={m.focus}
      >
        <div className="actions">
          <select
            aria-label="Select meeting"
            value={m.id}
            onChange={(e) => {
              setSelected(e.target.value);
              setFull(false);
            }}
          >
            {meetings.map((x: Row) => (
              <option key={x.id} value={x.id}>
                {fmt(x.date)}
                {x.cancelled ? " · Cancelled" : ""}
                {x.finalized_at ? " · Finalized" : ""}
              </option>
            ))}
          </select>
          <button className="button subtle" onClick={() => window.print()}>
            <Printer size={16} />
            Print summary
          </button>
        </div>
      </PageHead>
      <div className="notice">
        <CalendarDays size={18} />
        {m.cancelled
          ? "This meeting is cancelled."
          : m.finalized_at
            ? "Finalized historical snapshot · " +
              new Date(m.finalized_at).toLocaleString()
            : s.preview
              ? "Source-plan agenda · connect Supabase for live updates."
              : "Live agenda · updates as shared task records change."}{" "}
        <span>Next meeting: {fmt(next)}. Time and room not set.</span>
      </div>
      {s.member && !m.finalized_at && !m.cancelled && (
        <div className="actions">
          <button className="button" onClick={note}>
            Record meeting note
          </button>
          <button className="button subtle" onClick={() => addTask(s, open)}>
            Add follow-up task
          </button>
          {s.admin && (
            <>
              <button
                className="button subtle"
                onClick={() =>
                  open({
                    title: "Finalize meeting",
                    intro:
                      "The server will preserve the current tasks, dependencies, decisions, extensions and milestones in an immutable snapshot.",
                    fields: [
                      {
                        name: "note",
                        label: "Finalization note",
                        required: true,
                      },
                    ],
                    submit: (v) =>
                      s.run("finalize_meeting", { meeting_id: m.id, ...v }),
                  })
                }
              >
                Finalize snapshot
              </button>
              <button
                className="button subtle"
                onClick={() =>
                  open({
                    title: "Edit meeting",
                    fields: [
                      {
                        name: "date",
                        label: "Meeting date",
                        type: "date",
                        value: m.date,
                        required: true,
                      },
                      { name: "focus", label: "Focus", value: m.focus },
                      {
                        name: "cancelled",
                        label: "Cancel this meeting",
                        type: "checkbox",
                        value: m.cancelled,
                      },
                    ],
                    submit: (v) =>
                      s.run("edit_meeting", {
                        meeting_id: m.id,
                        version: m.version,
                        ...v,
                      }),
                  })
                }
              >
                Edit meeting
              </button>
            </>
          )}
        </div>
      )}
      {s.admin && (
        <button
          className="button subtle"
          onClick={() =>
            open({
              title: "Schedule next meeting",
              fields: [
                {
                  name: "date",
                  label: "Meeting date",
                  type: "date",
                  value: addDays(meetings.at(-1)!.date, 14),
                  required: true,
                },
                {
                  name: "focus",
                  label: "Meeting focus",
                  value: "Leads / subleads coordination",
                },
              ],
              submit: (v) => s.run("create_meeting", v),
            })
          }
        >
          Schedule next biweekly meeting
        </button>
      )}
      <Section
        title="Agenda by team"
        caption={`${ag.length} tasks meet the agenda criteria. Overdue work, critical deadlines, cross-team blockers and pending decisions.`}
        extra={
          <button className="text-button" onClick={() => setFull(!full)}>
            {full ? "Show priorities" : "Expand full agenda"}
          </button>
        }
      >
        {s.teams.map((team: Row) => {
          const requirements = ms
            .filter((g: Row) => g.target_date >= m.date && g.target_date < next)
            .flatMap((g: Row) => g.requirements);
          const group = ag
            .filter((t: Row) => t.primary_team === team.id)
            .sort(
              (a: Row, b: Row) =>
                Number(requirements.includes(b.id)) -
                Number(requirements.includes(a.id)),
            );
          return group.length ? (
            <div className="agenda-team" key={team.id}>
              <h3>
                {team.name}
                <span>{group.length} items</span>
              </h3>
              {group.slice(0, full ? group.length : 3).map((t: Row) => (
                <div className="agenda-row" key={t.id}>
                  <Compact t={t} asOf={snapshot?.as_of} />
                  <div className="badges">
                    <Badge status={t.status} />
                    {blockers(t, ts).length > 0 && (
                      <span className="badge blocked">
                        Waiting on {blockers(t, ts).join(", ")}
                      </span>
                    )}
                    {notes.some(
                      (n: Row) => n.task_id === t.id && n.kind === "discussed",
                    ) && <span className="badge complete">Discussed</span>}
                  </div>
                </div>
              ))}
              {!full && group.length > 3 && (
                <small>{group.length - 3} more in full agenda</small>
              )}
            </div>
          ) : null;
        })}
      </Section>
      <div className="two-columns">
        <Section title="Milestones before next meeting">
          {ms
            .filter((x: Row) => x.target_date >= m.date && x.target_date < next)
            .map((x: Row) => (
              <div className="panel" key={x.id}>
                <strong>
                  {fmt(x.target_date)} · {x.title}
                </strong>
                <p>{x.requirements.join(", ")}</p>
              </div>
            ))}
        </Section>
        <Section title="Extension requests">
          {ex
            .filter((e: Row) => e.status === "pending")
            .map((e: Row) => (
              <div key={e.id} className="panel">
                <Link to={taskUrl(e.task_id)}>{e.task_id}</Link>
                <p>
                  {fmt(e.original_date)} → {fmt(e.requested_date)}
                </p>
                <p>{e.reason}</p>
              </div>
            ))}
          {!s.member && (
            <p>
              Sign in with leadership access to view private requests and notes.
            </p>
          )}
        </Section>
      </div>
      <Section title="Decisions, updates & actions">
        {notes.length ? (
          notes.map((n: Row) => (
            <div className="history" key={n.id}>
              <CheckCircle2 size={16} />
              <div>
                <strong>
                  {n.kind} {n.task_id && "· " + n.task_id}
                </strong>
                <p>{n.body}</p>
                <small>{new Date(n.created_at).toLocaleString()}</small>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">No meeting notes recorded.</div>
        )}
      </Section>
      <Section
        title="Meeting summary"
        caption="Task history and evidence remain available from each task."
      >
        <div className="summary-grid">
          <div>
            <h3>Completed since previous meeting</h3>
            {ts
              .filter(
                (t: Row) =>
                  t.completed_at &&
                  t.completed_at.slice(0, 10) >= previous &&
                  t.completed_at.slice(0, 10) <= m.date,
              )
              .map((t: Row) => (
                <Compact key={t.id} t={t} />
              ))}
          </div>
          <div>
            <h3>Still overdue</h3>
            {ts
              .filter(
                (t: Row) =>
                  active(t) && t.target_date && t.target_date < m.date,
              )
              .map((t: Row) => (
                <Compact key={t.id} t={t} />
              ))}
          </div>
          <div>
            <h3>Actions due before next meeting</h3>
            {ts
              .filter(
                (t: Row) =>
                  active(t) &&
                  t.target_date &&
                  t.target_date >= m.date &&
                  t.target_date < next,
              )
              .map((t: Row) => (
                <Compact key={t.id} t={t} />
              ))}
          </div>
          <div>
            <h3>Approved extensions</h3>
            {ex
              .filter(
                (e: Row) =>
                  e.status === "approved" &&
                  e.created_at.slice(0, 10) >= previous,
              )
              .map((e: Row) => (
                <p key={e.id}>
                  {e.task_id} → {fmt(e.requested_date)} · {e.review_note}
                </p>
              ))}
            <h3>New blockers / critical updates</h3>
            {notes
              .filter((n: Row) => ["blocker", "update"].includes(n.kind))
              .map((n: Row) => (
                <p key={n.id}>
                  {n.task_id} · {n.body}
                </p>
              ))}
          </div>
        </div>
      </Section>
    </>
  );
}
function Timeline({ s, open }: Props) {
  const [team, setTeam] = useState("all"),
    [critical, setCritical] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="TARGET · RECOVERY · FALLBACK"
        title="The path to November 21."
        subtitle="Thanksgiving week is recovery margin. Baseline dates remain visible when targets move."
      />
      <div className="filters">
        <select
          aria-label="Timeline team"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        >
          <option value="all">All teams</option>
          {s.teams.map((t: Row) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={critical}
            onChange={(e) => setCritical(e.target.checked)}
          />{" "}
          Flight-critical only
        </label>
      </div>
      <Section
        title="Program milestones"
        caption="Requirement mappings need director confirmation. Source gate labels do not establish task completion."
      >
        <div className="timeline">
          {[...s.milestones]
            .sort((a: Row, b: Row) =>
              a.target_date.localeCompare(b.target_date),
            )
            .map((m: Row) => (
              <div className="timeline-gate" key={m.id}>
                <div className="gate-date">
                  {fmt(m.target_date)}
                  {m.end_date !== m.target_date && (
                    <small>through {fmt(m.end_date)}</small>
                  )}
                </div>
                <div className="panel">
                  <h3>{m.title}</h3>
                  <p>
                    {
                      m.requirements.filter(
                        (id: string) =>
                          s.tasks.find((t: Row) => t.id === id)?.status ===
                          "complete",
                      ).length
                    }{" "}
                    / {m.requirements.length} task requirements complete ·{" "}
                    {m.reviewed
                      ? "Mapping reviewed"
                      : "Mapping needs confirmation"}
                  </p>
                  {m.source_status && (
                    <small>
                      PDF gate observation: {m.source_status}. Individual task
                      statuses are tracked separately.
                    </small>
                  )}
                  <div className="badges">
                    {m.requirements.map((id: string) => (
                      <Link key={id} className="badge" to={taskUrl(id)}>
                        {id}
                      </Link>
                    ))}
                  </div>
                  {s.admin && (
                    <button
                      className="text-button"
                      onClick={() =>
                        open({
                          title: "Edit milestone",
                          fields: [
                            {
                              name: "title",
                              label: "Title",
                              value: m.title,
                              required: true,
                            },
                            {
                              name: "target_date",
                              label: "Start date",
                              type: "date",
                              value: m.target_date,
                              required: true,
                            },
                            {
                              name: "end_date",
                              label: "End date",
                              type: "date",
                              value: m.end_date,
                            },
                            {
                              name: "requirements",
                              label: "Required tasks",
                              type: "multiselect",
                              value: m.requirements,
                              options: s.tasks.map((t: Row) => ({
                                value: t.id,
                                label: t.id + " · " + t.title,
                              })),
                            },
                          ],
                          submit: (v) =>
                            s.run("milestone", {
                              id: m.id,
                              version: m.version,
                              ...v,
                            }),
                        })
                      }
                    >
                      Edit milestone requirements
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </Section>
      <Section title="Task schedule">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Baseline</th>
                <th>Active target</th>
                <th>Recovery</th>
                <th>Fallback</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...s.tasks]
                .filter(
                  (t: Row) =>
                    (team === "all" || t.primary_team === team) &&
                    (!critical || t.critical),
                )
                .sort((a: Row, b: Row) =>
                  (a.target_date ?? "9999").localeCompare(
                    b.target_date ?? "9999",
                  ),
                )
                .map((t: Row) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={taskUrl(t.id)}>
                        <small>{t.id}</small>
                        {t.title}
                      </Link>
                    </td>
                    <td>{fmt(t.baseline_target_date)}</td>
                    <td>{fmt(t.target_date)}</td>
                    <td>{fmt(t.recovery_date)}</td>
                    <td>{fmt(t.absolute_date)}</td>
                    <td>
                      <Badge status={t.status} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
function Readiness({ s, open }: Props) {
  const status = s.settings.readiness_status;
  return (
    <>
      <PageHead
        eyebrow="EVIDENCE & AUTHORIZED REVIEW"
        title="Flight readiness"
        subtitle="Completion percentages never authorize flight. Every condition requires evidence and a director’s explicit review."
      />
      <div className={"readiness-banner " + status}>
        <ShieldCheck size={36} />
        <div>
          <h2>
            {status === "approved"
              ? "APPROVED FOR PLANNED TEST"
              : status === "pending_review"
                ? "PENDING REVIEW"
                : "NOT READY"}
          </h2>
          <p>
            {s.readiness.filter((r: Row) => r.status === "approved").length} of{" "}
            {s.readiness.length} conditions approved. The test crew retains
            responsibility for the actual go/no-go decision.
          </p>
        </div>
      </div>
      {s.admin && (
        <button
          className="button"
          onClick={() =>
            open({
              title: "Record flight-readiness decision",
              intro:
                "An approval requires all conditions and FT-008 to have approved completion. Record the approved configuration, test scope and limits.",
              fields: [
                {
                  name: "status",
                  label: "Decision",
                  options: [
                    { value: "not_ready", label: "Not ready" },
                    { value: "pending_review", label: "Pending review" },
                    { value: "approved", label: "Approved for planned test" },
                  ],
                },
                {
                  name: "note",
                  label: "Evidence and decision",
                  type: "textarea",
                  required: true,
                },
              ],
              submit: (v) => s.run("readiness_decision", v),
            })
          }
        >
          Record director decision
        </button>
      )}
      <Section title="First-flight checklist">
        <div className="readiness-list">
          {s.readiness.map((r: Row) => (
            <div className="readiness-row" key={r.id}>
              <span className={"check-icon " + r.status}>
                {r.status === "approved" ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <ShieldCheck size={22} />
                )}
              </span>
              <div>
                <h3>{r.title}</h3>
                <div className="badges">
                  {r.task_ids.map((id: string) => (
                    <Link key={id} to={taskUrl(id)}>
                      {id}
                    </Link>
                  ))}
                </div>
              </div>
              <Badge status={r.status} />
              {s.admin && (
                <button
                  className="button subtle"
                  onClick={() =>
                    open({
                      title: "Review readiness condition",
                      intro: r.title,
                      fields: [
                        {
                          name: "status",
                          label: "Review status",
                          options: [
                            { value: "not_ready", label: "Not ready" },
                            {
                              value: "pending_review",
                              label: "Pending review",
                            },
                            { value: "approved", label: "Approved" },
                          ],
                        },
                        {
                          name: "note",
                          label: "Evidence / configuration / reviewer findings",
                          type: "textarea",
                          required: true,
                        },
                      ],
                      submit: (v) =>
                        s.run("readiness_item", {
                          id: r.id,
                          version: r.version,
                          ...v,
                        }),
                    })
                  }
                >
                  Review
                </button>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
function Admin({ s, open }: Props) {
  if (!s.admin)
    return <div className="empty">Director access is required.</div>;
  return (
    <>
      <PageHead
        eyebrow="DIRECTOR WORKSPACE"
        title="Decisions that keep work moving."
        subtitle="Review requests, authorize team members and resolve source-data uncertainties."
      >
        <button
          className="button subtle"
          onClick={() =>
            download("cyclone-aero-export-" + today() + ".json", {
              exported_at: new Date().toISOString(),
              tasks: s.tasks,
              teams: s.teams,
              milestones: s.milestones,
              meetings: s.meetings,
              notes: s.notes,
              items: s.items,
              extensions: s.extensions,
              deliverables: s.deliverables,
              history: s.history,
              readiness: s.readiness,
              settings: s.settings,
              profiles: s.profiles,
              memberships: s.memberships,
            })
          }
        >
          <Download size={16} />
          Export project records
        </button>
      </PageHead>
      <Section title="Pending extensions">
        {s.extensions
          .filter((e: Row) => e.status === "pending")
          .map((e: Row) => (
            <div className="panel" key={e.id}>
              <Link to={taskUrl(e.task_id)}>
                <strong>{e.task_id}</strong>
              </Link>
              <p>
                {fmt(e.original_date)} → {fmt(e.requested_date)}
              </p>
              <p>
                <strong>Reason:</strong> {e.reason}
              </p>
              <p>
                <strong>Progress:</strong> {e.progress}
              </p>
              <p>
                <strong>Recovery:</strong> {e.recovery_action}
              </p>
              <p>
                <strong>Downstream impact:</strong>{" "}
                {downstream(e.task_id, s.tasks).join(", ") || "None"}
              </p>
              <button
                className="button"
                onClick={() => review(e, "extension", s, open)}
              >
                Review request
              </button>
            </div>
          ))}
      </Section>
      <Section title="Completion reviews">
        <TaskList
          tasks={s.tasks.filter((t: Row) => t.status === "submitted")}
          s={s}
        />
      </Section>
      <Section
        title="Authorize leads & subleads"
        caption="Users sign in once to register. Assign multiple memberships for people serving multiple teams."
      >
        <button
          className="button"
          onClick={() =>
            open({
              title: "Assign team role",
              fields: [
                {
                  name: "user_id",
                  label: "Registered user",
                  options: s.profiles.map((p: Row) => ({
                    value: p.id,
                    label: p.display_name + " · " + p.id,
                  })),
                },
                {
                  name: "team_id",
                  label: "Team",
                  options: s.teams.map((t: Row) => ({
                    value: t.id,
                    label: t.name,
                  })),
                },
                {
                  name: "role",
                  label: "Role",
                  options: [
                    { value: "lead", label: "Team lead" },
                    {
                      value: "sublead",
                      label: "Sublead (assigned tasks only)",
                    },
                  ],
                },
                {
                  name: "remove",
                  label: "Remove this membership instead",
                  type: "checkbox",
                },
              ],
              submit: (v) => s.run("membership", v),
            })
          }
        >
          Assign or remove team role
        </button>
        <button
          className="button subtle"
          onClick={() =>
            open({
              title: "Director authorization",
              fields: [
                {
                  name: "user_id",
                  label: "Registered user",
                  options: s.profiles
                    .filter((p: Row) => p.id !== s.user.id)
                    .map((p: Row) => ({
                      value: p.id,
                      label: p.display_name + " · " + p.id,
                    })),
                },
                {
                  name: "is_admin",
                  label: "Grant director access",
                  type: "checkbox",
                },
              ],
              submit: (v) => s.run("admin_role", v),
            })
          }
        >
          Manage directors
        </button>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Team</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {s.memberships.map((m: Row) => (
                <tr key={m.user_id + m.team_id}>
                  <td>
                    {
                      s.profiles.find((p: Row) => p.id === m.user_id)
                        ?.display_name
                    }{" "}
                    <small>{m.user_id}</small>
                  </td>
                  <td>{m.team_id}</td>
                  <td>{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Source data requiring confirmation">
        <TaskList
          tasks={s.tasks.filter((t: Row) => t.data_issues?.length)}
          s={s}
        />
      </Section>
      <p>
        Milestones can be edited on Timeline. Meetings can be rescheduled,
        cancelled or finalized on Meetings. A database backup must also include
        private storage objects; this export contains references only.
      </p>
    </>
  );
}
function FormDialog({
  dialog,
  close,
  message,
}: {
  dialog: Dialog;
  close: () => void;
  message: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [busy, close]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget),
      values: Row = {};
    dialog.fields.forEach((f) => {
      values[f.name] =
        f.type === "checkbox"
          ? data.has(f.name)
          : f.type === "multiselect"
            ? data.getAll(f.name)
            : data.get(f.name);
    });
    try {
      await dialog.submit(values);
      message(
        dialog.title.startsWith("Sign in")
          ? "Sign-in link requested. Check your email."
          : "Saved to the shared database.",
      );
      close();
    } catch (e: any) {
      setError(e.message ?? String(e));
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-title">
          <h2 id="dialog-title">{dialog.title}</h2>
          <button disabled={busy} aria-label="Close dialog" onClick={close}>
            <X />
          </button>
        </div>
        {dialog.intro && <p>{dialog.intro}</p>}
        <form onSubmit={submit}>
          {dialog.fields.map((f, i) => (
            <label
              className={
                "field " + (f.type === "checkbox" ? "check-field" : "")
              }
              key={f.name}
            >
              <span>
                {f.label}
                {f.required ? " *" : ""}
              </span>
              {f.type === "textarea" ? (
                <textarea
                  autoFocus={i === 0}
                  name={f.name}
                  defaultValue={f.value ?? ""}
                  required={f.required}
                  rows={4}
                />
              ) : f.options ? (
                <select
                  autoFocus={i === 0}
                  name={f.name}
                  multiple={f.type === "multiselect"}
                  defaultValue={
                    f.value ??
                    (f.type === "multiselect" ? [] : f.options[0]?.value)
                  }
                  required={f.required}
                  size={f.type === "multiselect" ? 6 : undefined}
                >
                  {f.options.map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "checkbox" ? (
                <input name={f.name} type="checkbox" defaultChecked={f.value} />
              ) : (
                <input
                  autoFocus={i === 0}
                  name={f.name}
                  type={f.type ?? "text"}
                  defaultValue={f.type === "file" ? undefined : (f.value ?? "")}
                  required={f.required}
                />
              )}
            </label>
          ))}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="actions">
            <button className="button" type="submit" disabled={busy}>
              {busy ? "Saving…" : (dialog.button ?? "Save")}
            </button>
            <button
              className="button subtle"
              type="button"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
