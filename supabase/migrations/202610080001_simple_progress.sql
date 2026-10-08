-- Shared checklist mode: server-verified team code required for every write.
-- No access to files, profiles, leadership decisions or other private records.
create table public.team_access (id boolean primary key default true check(id),salt text not null,code_hash bytea not null);
alter table public.team_access enable row level security;
revoke all on public.team_access from public,anon,authenticated;
create function public.verify_team_code(p_code text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(length(p_code) between 1 and 256 and exists(select 1 from public.team_access where code_hash=pg_catalog.sha256(convert_to(salt||p_code,'UTF8'))),false)
$$;
revoke all on function public.verify_team_code(text) from public,anon,authenticated;
grant execute on function public.verify_team_code(text) to anon,authenticated;
create table public.progress_receipts (
 id uuid primary key, task_id text not null, requested_status text not null,
 requested_version integer not null, result jsonb not null, created_at timestamptz not null default now()
);
alter table public.progress_receipts enable row level security;
revoke all on public.progress_receipts from public, anon, authenticated;
create function public.set_task_progress(p_task text,p_status text,p_version integer,p_request uuid,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.tasks; receipt public.progress_receipts; result jsonb;
begin
 if not public.verify_team_code(p_code) then raise exception 'Enter the shared team code to update tasks.';end if;
 if p_request is null or p_version is null or p_task is null or p_status is null then raise exception 'Task, status, version and request are required';end if;
 if p_status not in ('not_started','in_progress','complete') then raise exception 'Unsupported task status';end if;
 perform pg_advisory_xact_lock(871426);
 select * into receipt from public.progress_receipts where id=p_request;
 if found then
  if receipt.task_id<>p_task or receipt.requested_status<>p_status or receipt.requested_version<>p_version then raise exception 'Request was already used for another change';end if;
  return receipt.result;
 end if;
 select * into t from public.tasks where id=p_task for update;
 if not found then raise exception 'Task not found';end if;
 if t.version<>p_version then raise exception 'This task changed on another device. Refresh and try again.';end if;
 if p_status='complete' and exists(select 1 from public.task_dependencies d join public.tasks p on p.id=d.predecessor_id where d.task_id=p_task and p.status<>'complete') then raise exception 'Finish the tasks listed under Waiting on first.';end if;
 if t.status<>p_status then
  update public.tasks set status=p_status, version=version+1,updated_at=now(),completed_at=case when p_status='complete' then now() else null end,completed_by=null where id=p_task;
  insert into public.task_history(task_id,actor,action,detail) values(p_task,null,'shared_progress',jsonb_build_object('from',t.status,'to',p_status,'source','shared team code','technical_approval',false));
  update public.project_settings set readiness_status='not_ready',version=version+1 where readiness_status<>'not_ready';
  update public.flight_readiness_items set status='not_ready',version=version+1 where task_ids && array(with recursive affected(id) as (select p_task union select d.task_id from public.task_dependencies d join affected a on d.predecessor_id=a.id) select id from affected);
 end if;
 select jsonb_build_object('id',id,'status',status,'version',version) into result from public.tasks where id=p_task;
 insert into public.progress_receipts(id,task_id,requested_status,requested_version,result) values(p_request,p_task,p_status,p_version,result);
 return result;
end$$;
revoke all on function public.set_task_progress(text,text,integer,uuid,text) from public, anon, authenticated;
grant execute on function public.set_task_progress(text,text,integer,uuid,text) to anon, authenticated;
