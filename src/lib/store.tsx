import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import seed from "../../data/first_flight_tasks.json";
import planning from "../../data/planning.json";
export type Row = Record<string, any>;
type DataState = {
  tasks: Row[];
  teams: Row[];
  milestones: Row[];
  meetings: Row[];
  readiness: Row[];
  extensions: Row[];
  deliverables: Row[];
  history: Row[];
  notes: Row[];
  items: Row[];
  profiles: Row[];
  memberships: Row[];
  notifications: Row[];
  settings: Row;
};
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const db =
  url && key
    ? createClient(url, key, {
        auth: { flowType: "pkce", detectSessionInUrl: true },
      })
    : null;
export const hydrate = (rows: Row[], deps: Row[]) =>
  rows.map((r) => ({
    ...r.data,
    ...r,
    dependencies: deps
      .filter((d) => d.task_id === r.id)
      .map((d) => d.predecessor_id),
  }));
export function useStore() {
  const [state, set] = useState<DataState>({
    tasks: [],
    teams: [],
    milestones: [],
    meetings: [],
    readiness: [],
    extensions: [],
    deliverables: [],
    history: [],
    notes: [],
    items: [],
    profiles: [],
    memberships: [],
    notifications: [],
    settings: { flight_target: "2026-11-21", readiness_status: "not_ready" },
  });
  const [user, setUser] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      if (!db) {
        set((s) => ({ ...s, ...planning, tasks: seed }));
        setLoading(false);
        return;
      }
      const {
        data: { session },
      } = await db.auth.getSession();
      setUser(session?.user ?? null);
      if (session) {
        const r = await db.rpc("register_profile");
        if (r.error) throw r.error;
      }
      const query = async (table: string) => {
        const r = await db!.from(table).select("*");
        if (r.error) throw r.error;
        return r.data ?? [];
      };
      const publicTables = [
        "tasks",
        "teams",
        "task_dependencies",
        "milestones",
        "flight_readiness_items",
        "project_settings",
      ];
      const values = await Promise.all(publicTables.map(query));
      const schedule = await db.rpc("meeting_schedule");
      if (schedule.error) throw schedule.error;
      const next: Row = {
        tasks: hydrate(values[0], values[2]),
        teams: values[1],
        milestones: values[3],
        readiness: values[4],
        settings: values[5][0],
        meetings: schedule.data ?? [],
        extensions: [],
        deliverables: [],
        history: [],
        notes: [],
        items: [],
        profiles: [],
        memberships: [],
        notifications: [],
      };
      if (session) {
        const tables = [
          "extension_requests",
          "deliverables",
          "task_history",
          "meeting_notes",
          "meeting_agenda_items",
          "profiles",
          "team_memberships",
          "notifications",
          "meetings",
        ];
        const priv = await Promise.all(tables.map(query));
        [
          "extensions",
          "deliverables",
          "history",
          "notes",
          "items",
          "profiles",
          "memberships",
          "notifications",
        ].forEach((k, i) => (next[k] = priv[i]));
        if (priv[8].length) next.meetings = priv[8];
      }
      set(next as DataState);
      setError("");
      setLoading(false);
    } catch (e: any) {
      setError(e.message ?? String(e));
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    const timer = setInterval(reload, 15000);
    const focus = () => void reload();
    window.addEventListener("focus", focus);
    const sub = db?.auth.onAuthStateChange(() => setTimeout(reload, 0));
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      sub?.data.subscription.unsubscribe();
    };
  }, [reload]);
  const run = async (
    action: string,
    payload: Row,
    request = crypto.randomUUID(),
  ) => {
    if (!db) throw Error("Connect Supabase to save shared changes.");
    const r = await db.rpc("command", {
      p_action: action,
      p_payload: payload,
      p_request: request,
    });
    if (r.error) throw r.error;
    await reload();
    return r.data;
  };
  const admin = !!state.profiles.find((p: Row) => p.id === user?.id)?.is_admin;
  const member =
    admin || state.memberships.some((m: Row) => m.user_id === user?.id);
  const canManage = (team: string) =>
    admin ||
    state.memberships.some(
      (m: Row) =>
        m.user_id === user?.id && m.team_id === team && m.role === "lead",
    );
  const canWork = (task: Row) =>
    admin ||
    canManage(task.primary_team) ||
    state.memberships.some(
      (m: Row) =>
        m.user_id === user?.id &&
        m.team_id === task.primary_team &&
        task.owner_id === user?.id,
    );
  return {
    ...state,
    user,
    admin,
    member,
    canManage,
    canWork,
    error,
    loading,
    reload,
    run,
    preview: !db,
  };
}
