-- All mutations go through the checked, transactional command API.
create table public.teams(id text primary key,name text not null,prefix text unique not null);
create table public.profiles(id uuid primary key references auth.users(id),display_name text not null default 'Team member',is_admin boolean not null default false);
create table public.team_memberships(user_id uuid references public.profiles(id),team_id text references public.teams(id),role text not null check(role in ('lead','sublead')),primary key(user_id,team_id));
create table public.tasks(id text primary key,primary_team text not null references public.teams(id),status text not null default 'not_started' check(status in ('not_started','in_progress','submitted','needs_changes','complete','deferred')),version integer not null default 1,data jsonb not null,owner_id uuid references public.profiles(id),completed_at timestamptz,completed_by uuid references public.profiles(id),updated_at timestamptz not null default now());
create table public.task_dependencies(task_id text references public.tasks(id),predecessor_id text references public.tasks(id),primary key(task_id,predecessor_id),check(task_id<>predecessor_id));
create table public.task_history(id bigint generated always as identity primary key,task_id text references public.tasks(id),actor uuid references public.profiles(id),action text not null,detail jsonb not null,created_at timestamptz default now());
create table public.deliverables(id uuid primary key,task_id text not null references public.tasks(id),submitted_by uuid not null references public.profiles(id),description text not null,reference text,file_path text,status text not null default 'submitted' check(status in ('submitted','approved','changes_requested','rejected')),review_note text,reviewer uuid references public.profiles(id),created_at timestamptz default now());
create table public.extension_requests(id uuid primary key,task_id text not null references public.tasks(id),requested_by uuid references public.profiles(id),original_date date,requested_date date not null,reason text not null,progress text not null,recovery_action text not null,notes text,status text not null default 'pending' check(status in ('pending','approved','denied')),review_note text,reviewer uuid references public.profiles(id),created_at timestamptz default now());
create unique index one_pending_extension on public.extension_requests(task_id) where status='pending';
create table public.milestones(id text primary key,title text not null,target_date date not null,end_date date,requirements text[] not null default '{}',source_status text,reviewed boolean not null default false);
create table public.meetings(id uuid primary key,date date not null,focus text not null default '',cancelled boolean not null default false,snapshot jsonb,finalized_at timestamptz,version integer not null default 1);
create table public.meeting_notes(id uuid primary key,meeting_id uuid not null references public.meetings(id),task_id text references public.tasks(id),kind text not null check(kind in ('update','decision','action','blocker','discussed','carry')),body text not null,actor uuid references public.profiles(id),created_at timestamptz default now());
create table public.meeting_agenda_items(meeting_id uuid references public.meetings(id),task_id text references public.tasks(id),primary key(meeting_id,task_id));
create table public.flight_readiness_items(id text primary key,title text not null,task_ids text[] not null default '{}',status text not null default 'not_ready' check(status in ('not_ready','pending_review','approved')),version integer not null default 1);
create table public.readiness_reviews(id bigint generated always as identity primary key,item_id text references public.flight_readiness_items(id),actor uuid references public.profiles(id),evidence text not null,status text not null,created_at timestamptz default now());
create table public.project_settings(id boolean primary key default true check(id),flight_target date not null default '2026-11-21',readiness_status text not null default 'not_ready' check(readiness_status in ('not_ready','pending_review','approved')),version integer not null default 1);
insert into public.project_settings(id) values(true);
create table public.notifications(id bigint generated always as identity primary key,user_id uuid references public.profiles(id),task_id text references public.tasks(id),message text not null,created_at timestamptz default now());
create table public.command_receipts(id uuid primary key,actor uuid not null,action text not null,result jsonb not null);
create table public.task_counters(team_id text primary key references public.teams(id),next_number integer not null);

create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and is_admin)$$;
create function public.is_member() returns boolean language sql stable security definer set search_path='' as $$select public.is_admin() or exists(select 1 from public.team_memberships where user_id=auth.uid())$$;
create function public.can_manage_team(p_team text) returns boolean language sql stable security definer set search_path='' as $$select public.is_admin() or exists(select 1 from public.team_memberships where user_id=auth.uid() and team_id=p_team and role='lead')$$;
create function public.can_work(p_task text) returns boolean language sql stable security definer set search_path='' as $$select public.is_admin() or exists(select 1 from public.tasks t join public.team_memberships m on m.team_id=t.primary_team where t.id=p_task and m.user_id=auth.uid() and (m.role='lead' or t.owner_id=auth.uid()))$$;

do $$declare n text;begin
foreach n in array array['teams','profiles','team_memberships','tasks','task_dependencies','task_history','deliverables','extension_requests','milestones','meetings','meeting_notes','meeting_agenda_items','flight_readiness_items','readiness_reviews','project_settings','notifications','command_receipts','task_counters'] loop
execute format('alter table public.%I enable row level security',n);
execute format('revoke all on public.%I from anon, authenticated',n);
end loop;
foreach n in array array['teams','tasks','task_dependencies','milestones','flight_readiness_items','project_settings'] loop
execute format('grant select on public.%I to anon, authenticated',n);
execute format('create policy public_read on public.%I for select using (true)',n);
end loop;
foreach n in array array['task_history','deliverables','extension_requests'] loop
execute format('grant select on public.%I to authenticated',n);
execute format('create policy task_read on public.%I for select to authenticated using (public.can_work(task_id))',n);
end loop;
foreach n in array array['meetings','meeting_notes','meeting_agenda_items','readiness_reviews'] loop
execute format('grant select on public.%I to authenticated',n);
execute format('create policy member_read on public.%I for select to authenticated using (public.is_member())',n);
end loop;
end$$;
grant select on public.profiles,public.team_memberships,public.notifications to authenticated;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin() or public.is_member());
create policy membership_read on public.team_memberships for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy notification_read on public.notifications for select to authenticated using(user_id=auth.uid());

-- Public schedule has no notes, attendees, snapshots, or private records.
create function public.meeting_schedule() returns table(id uuid,date date,focus text,cancelled boolean,finalized_at timestamptz,version integer) language sql stable security definer set search_path='' as $$select id,date,focus,cancelled,finalized_at,version from public.meetings$$;

create function public.check_dependencies(p_task text,p_deps jsonb) returns void language plpgsql security definer set search_path='' as $$
declare dep text;begin
-- Serialize graph writes across different task rows to prevent concurrent cycles.
perform pg_advisory_xact_lock(871426);
for dep in select jsonb_array_elements_text(coalesce(p_deps,'[]')) loop
 if dep=p_task or not exists(select 1 from public.tasks where id=dep) then raise exception 'Invalid dependency %',dep;end if;
 if exists(with recursive chain(id) as (select dep union select d.predecessor_id from public.task_dependencies d join chain c on d.task_id=c.id) select 1 from chain where id=p_task) then raise exception 'Circular dependency';end if;
end loop;
delete from public.task_dependencies where task_id=p_task;
insert into public.task_dependencies select p_task,value from jsonb_array_elements_text(coalesce(p_deps,'[]')) on conflict do nothing;
end$$;

create function public.command(p_action text,p_payload jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.tasks; e public.extension_requests; d public.deliverables; m public.meetings; result jsonb; target text; newstatus text; note text; n integer; team text; obj jsonb; mid uuid; v integer;
begin
if auth.uid() is null then raise exception 'Sign in required';end if;
if not public.is_member() then raise exception 'Ask a director to authorize your account';end if;
-- A short project-wide transaction lock also orders completion vs. reopen and FRR decisions.
perform pg_advisory_xact_lock(871426);
perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
select r.result into result from public.command_receipts r where r.id=p_request and r.actor=auth.uid() and r.action=p_action;
if found then return result;end if;
target:=p_payload->>'task_id';note:=trim(coalesce(p_payload->>'note',''));
if target is not null then
 select * into t from public.tasks where id=target for update;
 if not found then raise exception 'Task not found';end if;
 if not public.can_work(target) then raise exception 'Task permission denied';end if;
 if p_payload ? 'version' and t.version<>(p_payload->>'version')::integer then raise exception 'Another lead changed this task. Refresh and review before saving.';end if;
end if;
if p_action in ('start','complete','reopen','defer','approve_task','return_task') then
 if target is null then raise exception 'Task required';end if;
 if p_payload->>'version' is null then raise exception 'Version required';end if;
 if p_action in ('reopen','defer','approve_task','return_task') and not public.is_admin() then raise exception 'Director approval required';end if;
 if p_action in ('complete','reopen','defer','approve_task','return_task') and note='' then raise exception 'A reason or completion note is required';end if;
 if t.status='complete' and p_action<>'reopen' then raise exception 'Reopen completed work with a reason first';end if;
 if p_action='reopen' and t.status<>'complete' then raise exception 'Only completed work can be reopened';end if;
 if p_action in ('complete','approve_task') then
  if coalesce(t.data->>'definition_of_done','')='' then raise exception 'Definition of Done must be confirmed first';end if;
  if exists(select 1 from public.task_dependencies dep join public.tasks prev on prev.id=dep.predecessor_id where dep.task_id=target and prev.status<>'complete') then raise exception 'Unresolved predecessors must be completed first';end if;
  if coalesce((t.data->>'requires_review')::boolean,false) and not exists(select 1 from public.deliverables where task_id=target and status in ('submitted','approved')) then raise exception 'Submit evidence first';end if;
 end if;
 if p_action='approve_task' and (t.status<>'submitted' or not exists(select 1 from public.deliverables where task_id=target and status='approved')) then raise exception 'Review and approve evidence before task approval';end if;
 newstatus:=case p_action when 'start' then 'in_progress' when 'reopen' then 'in_progress' when 'defer' then 'deferred' when 'return_task' then 'needs_changes' when 'approve_task' then 'complete' else case when coalesce((t.data->>'requires_review')::boolean,false) then 'submitted' else 'complete' end end;
 update public.tasks set status=newstatus,version=version+1,updated_at=now(),completed_at=case when newstatus='complete' then now() else null end,completed_by=case when newstatus='complete' then auth.uid() else null end where id=target;
 -- Any task state transition invalidates prior aircraft authorization.
 update public.project_settings set readiness_status='not_ready',version=version+1 where readiness_status<>'not_ready';
 if p_action in ('reopen','defer','return_task','start') then update public.flight_readiness_items set status='not_ready',version=version+1 where task_ids && array(with recursive affected(id) as (select target union select deps.task_id from public.task_dependencies deps join affected a on deps.predecessor_id=a.id) select id from affected);end if;
elsif p_action='update' then
 if target is null or note='' then raise exception 'Task and update text required';end if;
elsif p_action='edit_task' then
 if target is null or not public.can_manage_team(t.primary_team) then raise exception 'Team lead required';end if;
 if t.version is distinct from (p_payload->>'version')::integer then raise exception 'Refresh before editing';end if;
 obj:=p_payload->'data';
 if not public.is_admin() and (coalesce((t.data->>'critical')::boolean,false) or obj ?| array['target_date','recovery_date','absolute_date','critical','requires_review','dependencies']) then raise exception 'Director required for schedule, critical or dependency changes';end if;
 if obj ? 'dependencies' then perform public.check_dependencies(target,obj->'dependencies');end if;
 if t.status='complete' and obj ?| array['dependencies','definition_of_done','requires_review','critical'] then raise exception 'Reopen completed work before changing acceptance conditions or dependencies';end if;
 if obj ? 'owner_id' and nullif(obj->>'owner_id','') is not null and not exists(select 1 from public.team_memberships where user_id=(obj->>'owner_id')::uuid and team_id=t.primary_team) then raise exception 'Owner must belong to the primary team';end if;
 if obj ? 'owner_id' then update public.tasks set owner_id=nullif(obj->>'owner_id','')::uuid where id=target;end if;
 -- Explicit whitelist prevents overwriting baselines, statuses, identity or ownership authority.
 select coalesce(jsonb_object_agg(key,value),'{}') into obj from jsonb_each(obj) where key=any(array['title','description','definition_of_done','target_date','recovery_date','absolute_date','critical','requires_review','secondary_teams','phase','data_issues']);
 if obj ? 'target_date' then perform (obj->>'target_date')::date;end if;
 if obj ? 'recovery_date' then perform (obj->>'recovery_date')::date;end if;
 if obj ? 'absolute_date' then perform (obj->>'absolute_date')::date;end if;
 if obj ? 'title' and coalesce(trim(obj->>'title'),'')='' then raise exception 'Title required';end if;
 update public.tasks set data=data||obj,version=version+1,updated_at=now() where id=target;
 update public.flight_readiness_items set status='not_ready',version=version+1 where task_ids && array(with recursive affected(id) as (select target union select deps.task_id from public.task_dependencies deps join affected a on deps.predecessor_id=a.id) select id from affected);
 update public.project_settings set readiness_status='not_ready',version=version+1;
elsif p_action='create_task' then
 team:=p_payload->>'primary_team';obj:=p_payload->'data';
 if not public.can_manage_team(team) then raise exception 'Team lead required';end if;
 if coalesce(trim(obj->>'title'),'')='' or coalesce(trim(obj->>'definition_of_done'),'')='' or nullif(obj->>'target_date','') is null then raise exception 'Title, Definition of Done and target date required';end if;
 perform (obj->>'target_date')::date;
 if not public.is_admin() and (coalesce((obj->>'critical')::boolean,false) or exists(select 1 from public.tasks where id in(select jsonb_array_elements_text(coalesce(obj->'dependencies','[]'))) and (data->>'critical')::boolean)) then raise exception 'Director required for critical relationships';end if;
 update public.task_counters set next_number=next_number+1 where team_id=team returning next_number-1 into n;
 select prefix||'-'||lpad(n::text,3,'0') into target from public.teams where id=team;
 if target is null then raise exception 'Team counter not initialized';end if;
 obj:=jsonb_build_object('title',obj->>'title','description',obj->>'description','definition_of_done',obj->>'definition_of_done','target_date',obj->>'target_date','baseline_target_date',obj->>'target_date','recovery_date',nullif(obj->>'recovery_date',''),'absolute_date',nullif(obj->>'absolute_date',''),'phase',obj->>'phase','secondary_teams',coalesce(obj->'secondary_teams','[]'),'critical',coalesce((obj->>'critical')::boolean,false),'requires_review',coalesce((obj->>'critical')::boolean,false) or coalesce((obj->>'requires_review')::boolean,false),'data_issues','[]'::jsonb,'source_responsible_team',team);
 insert into public.tasks(id,primary_team,data) values(target,team,obj);
 perform public.check_dependencies(target,p_payload->'data'->'dependencies');
elsif p_action='deliverable' then
 if target is null or coalesce(trim(p_payload->>'description'),'')='' then raise exception 'Task and evidence description required';end if;
 if nullif(p_payload->>'reference','') is not null and p_payload->>'reference' !~ '^https://' then raise exception 'Use an HTTPS reference link';end if;
 if nullif(p_payload->>'file_path','') is not null and p_payload->>'file_path' not like target||'/'||auth.uid()::text||'/%' then raise exception 'Invalid upload path';end if;
 insert into public.deliverables(id,task_id,submitted_by,description,reference,file_path) values(p_request,target,auth.uid(),p_payload->>'description',nullif(p_payload->>'reference',''),nullif(p_payload->>'file_path',''));
elsif p_action='review_deliverable' then
 if not public.is_admin() or note='' then raise exception 'Director review and reason required';end if;
 select * into d from public.deliverables where id=(p_payload->>'id')::uuid for update;
 if not found or d.status<>'submitted' then raise exception 'Submission already reviewed or missing';end if;
 if p_payload->>'status' not in ('approved','changes_requested','rejected') then raise exception 'Invalid review status';end if;
 target:=d.task_id;
 update public.deliverables set status=p_payload->>'status',reviewer=auth.uid(),review_note=note where id=d.id;
 if p_payload->>'status'<>'approved' then update public.tasks set status='needs_changes',version=version+1,completed_at=null,completed_by=null where id=target;update public.project_settings set readiness_status='not_ready',version=version+1;end if;
elsif p_action='request_extension' then
 if target is null or coalesce(trim(p_payload->>'reason'),'')='' or coalesce(trim(p_payload->>'progress'),'')='' or coalesce(trim(p_payload->>'recovery_action'),'')='' then raise exception 'Reason, progress and recovery action required';end if;
 if (p_payload->>'requested_date')::date<=coalesce((t.data->>'target_date')::date,'1900-01-01') then raise exception 'Requested date must be after current target';end if;
 insert into public.extension_requests(id,task_id,requested_by,original_date,requested_date,reason,progress,recovery_action,notes) values(p_request,target,auth.uid(),(t.data->>'target_date')::date,(p_payload->>'requested_date')::date,p_payload->>'reason',p_payload->>'progress',p_payload->>'recovery_action',p_payload->>'notes');
elsif p_action='review_extension' then
 if not public.is_admin() or note='' then raise exception 'Director review and reason required';end if;
 select * into e from public.extension_requests where id=(p_payload->>'id')::uuid for update;
 if not found or e.status<>'pending' then raise exception 'Request already reviewed or missing';end if;
 if p_payload->>'status' not in ('approved','denied') then raise exception 'Invalid review status';end if;
 target:=e.task_id;
 select * into t from public.tasks where id=target for update;
 if p_payload->>'status'='approved' then
  if (t.data->>'target_date')::date is distinct from e.original_date then raise exception 'Deadline changed since request; submit a fresh request';end if;
  update public.tasks set data=jsonb_set(data,'{target_date}',to_jsonb(e.requested_date::text)),version=version+1,updated_at=now() where id=target;
  insert into public.notifications(user_id,task_id,message) select distinct tm.user_id,affected.id,'Predecessor extension approved: '||target||'. Review schedule impact.' from (with recursive chain(id) as (select deps.task_id from public.task_dependencies deps where deps.predecessor_id=target union select deps.task_id from public.task_dependencies deps join chain c on deps.predecessor_id=c.id) select id from chain) affected join public.tasks successor on successor.id=affected.id join public.team_memberships tm on tm.team_id=successor.primary_team;
 end if;
 update public.extension_requests set status=p_payload->>'status',reviewer=auth.uid(),review_note=note where id=e.id;
 insert into public.notifications(user_id,task_id,message) values(e.requested_by,target,'Extension '||(p_payload->>'status'));
elsif p_action in ('meeting_note','finalize_meeting','edit_meeting') then
 mid:=(p_payload->>'meeting_id')::uuid;select * into m from public.meetings where id=mid for update;
 if not found then raise exception 'Meeting missing';end if;
 if m.finalized_at is not null then raise exception 'Finalized meeting is immutable';end if;
 if p_action='meeting_note' then
  if note='' then raise exception 'Note required';end if;
  insert into public.meeting_notes values(p_request,mid,target,p_payload->>'kind',note,auth.uid(),now());
  if target is not null then insert into public.meeting_agenda_items values(mid,target) on conflict do nothing;end if;
  if p_payload->>'kind'='carry' and target is not null then
   insert into public.meeting_agenda_items select id,target from public.meetings where date>m.date and not cancelled order by date limit 1 on conflict do nothing;
  end if;
 elsif p_action='edit_meeting' then
  if not public.is_admin() then raise exception 'Director required';end if;
  if m.version is distinct from (p_payload->>'version')::integer then raise exception 'Meeting changed; refresh';end if;
  update public.meetings set date=(p_payload->>'date')::date,focus=p_payload->>'focus',cancelled=coalesce((p_payload->>'cancelled')::boolean,false),version=version+1 where id=mid;
 else
  if not public.is_admin() then raise exception 'Director required';end if;
  -- Snapshot captured inside this transaction, never accepted from the browser.
  update public.meetings set snapshot=jsonb_build_object('as_of',(now() at time zone 'America/Chicago')::date,'next_date',coalesce((select min(date) from public.meetings where date>m.date and not cancelled),m.date+14),'previous_date',coalesce((select max(date) from public.meetings where date<m.date),'2026-09-22'::date),'tasks',(select jsonb_agg(to_jsonb(x)) from public.tasks x),'dependencies',(select jsonb_agg(to_jsonb(x)) from public.task_dependencies x),'notes',(select jsonb_agg(to_jsonb(x)) from public.meeting_notes x where meeting_id=mid),'extensions',(select jsonb_agg(to_jsonb(x)) from public.extension_requests x),'items',(select jsonb_agg(to_jsonb(x)) from public.meeting_agenda_items x where meeting_id=mid),'milestones',(select jsonb_agg(to_jsonb(x)) from public.milestones x)),finalized_at=now(),version=version+1 where id=mid;
 end if;
elsif p_action='create_meeting' then
 if not public.is_admin() then raise exception 'Director required';end if;
 insert into public.meetings(id,date,focus) values(p_request,(p_payload->>'date')::date,coalesce(p_payload->>'focus','Leads / subleads coordination'));
elsif p_action='membership' then
 if not public.is_admin() then raise exception 'Director required';end if;
 if (p_payload->>'remove')::boolean then delete from public.team_memberships where user_id=(p_payload->>'user_id')::uuid and team_id=p_payload->>'team_id';
 else insert into public.team_memberships values((p_payload->>'user_id')::uuid,p_payload->>'team_id',p_payload->>'role') on conflict(user_id,team_id) do update set role=excluded.role;end if;
elsif p_action='admin_role' then
 if not public.is_admin() then raise exception 'Director required';end if;
 if (p_payload->>'user_id')::uuid=auth.uid() then raise exception 'Another director must change your role';end if;
 update public.profiles set is_admin=(p_payload->>'is_admin')::boolean where id=(p_payload->>'user_id')::uuid;
elsif p_action='milestone' then
 if not public.is_admin() then raise exception 'Director required';end if;
 if exists(select 1 from jsonb_array_elements_text(p_payload->'requirements') r where not exists(select 1 from public.tasks where id=r.value)) then raise exception 'Unknown milestone task';end if;
 update public.milestones set title=p_payload->>'title',target_date=(p_payload->>'target_date')::date,end_date=nullif(p_payload->>'end_date','')::date,requirements=array(select jsonb_array_elements_text(p_payload->'requirements')),reviewed=true where id=p_payload->>'id';
elsif p_action='readiness_item' then
 if not public.is_admin() or note='' then raise exception 'Director and evidence required';end if;
 select version into v from public.flight_readiness_items where id=p_payload->>'id' for update;
 if v is distinct from (p_payload->>'version')::integer then raise exception 'Readiness changed; refresh';end if;
 if p_payload->>'status'='approved' and exists(select 1 from public.flight_readiness_items r,unnest(r.task_ids) x join public.tasks linked on linked.id=x where r.id=p_payload->>'id' and linked.status<>'complete') then raise exception 'Linked tasks require approved completion';end if;
 update public.flight_readiness_items set status=p_payload->>'status',version=version+1 where id=p_payload->>'id';
 insert into public.readiness_reviews(item_id,actor,evidence,status) values(p_payload->>'id',auth.uid(),note,p_payload->>'status');
 update public.project_settings set readiness_status='not_ready',version=version+1;
elsif p_action='readiness_decision' then
 if not public.is_admin() or note='' then raise exception 'Explicit director decision and evidence required';end if;
 perform 1 from public.project_settings for update;
 if p_payload->>'status'='approved' and (exists(select 1 from public.flight_readiness_items where status<>'approved') or not exists(select 1 from public.tasks where id='FT-008' and status='complete')) then raise exception 'All readiness conditions and FRR require approval';end if;
 update public.project_settings set readiness_status=p_payload->>'status',version=version+1;
 insert into public.readiness_reviews(actor,evidence,status) values(auth.uid(),note,p_payload->>'status');
else raise exception 'Unknown command';end if;
insert into public.task_history(task_id,actor,action,detail) values(target,auth.uid(),p_action,p_payload);
if target is not null then
 insert into public.notifications(user_id,task_id,message) select distinct user_id,target,p_action||' · '||target from public.team_memberships where team_id=(select primary_team from public.tasks where id=target);
 if newstatus='complete' then
  insert into public.notifications(user_id,task_id,message) select distinct tm.user_id,s.id,'Task unblocked' from public.task_dependencies dep join public.tasks s on s.id=dep.task_id join public.team_memberships tm on tm.team_id=s.primary_team where dep.predecessor_id=target and s.status not in ('complete','deferred') and not exists(select 1 from public.task_dependencies prereq join public.tasks p on p.id=prereq.predecessor_id where prereq.task_id=s.id and p.status<>'complete');
 end if;
end if;
result:=jsonb_build_object('ok',true,'task_id',target);
insert into public.command_receipts values(p_request,auth.uid(),p_action,result);return result;
end$$;

create function public.register_profile() returns void language plpgsql security definer set search_path='' as $$begin
if auth.uid() is null then raise exception 'Sign in required';end if;
insert into public.profiles(id) values(auth.uid()) on conflict do nothing;
end$$;

revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_admin(),public.is_member(),public.can_manage_team(text),public.can_work(text) to authenticated;
grant execute on function public.meeting_schedule() to anon,authenticated;
grant execute on function public.register_profile(),public.command(text,jsonb,uuid) to authenticated;
-- No client can execute check_dependencies directly.

