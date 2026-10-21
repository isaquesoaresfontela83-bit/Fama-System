create table public.fama_internal_threads (
 id uuid primary key default gen_random_uuid(), organization_id text not null references public.organizations(id) on delete cascade,
 kind text not null check(kind in ('direct','channel')), title text not null default '', announcements boolean not null default false,
 direct_key text, created_by text not null, created_at timestamptz not null default now(),
 unique(organization_id,direct_key), unique(organization_id,id), check(kind='channel' or (direct_key is not null and not announcements))
);
create table public.fama_internal_participants (
 organization_id text not null,thread_id uuid not null,member_id text not null references public.organization_members(id) on delete cascade,
 primary key(thread_id,member_id),foreign key(organization_id,thread_id) references public.fama_internal_threads(organization_id,id) on delete cascade
);
create table public.fama_internal_messages (
 id uuid primary key default gen_random_uuid(), organization_id text not null,thread_id uuid not null,
 sequence bigint generated always as identity unique, sender_id text not null,author text not null,
 body_ciphertext text not null,client_id uuid not null,reply_id uuid,urgent boolean not null default false,pinned boolean not null default false,
 created_at timestamptz not null default now(),unique(thread_id,sender_id,client_id),
 foreign key(organization_id,thread_id) references public.fama_internal_threads(organization_id,id) on delete cascade
);
create index fama_internal_message_page on public.fama_internal_messages(thread_id,sequence desc);
create index fama_internal_thread_company on public.fama_internal_threads(organization_id,created_at desc);
create index fama_internal_participant_member on public.fama_internal_participants(member_id,thread_id);
create table public.fama_internal_reads (
 organization_id text not null,thread_id uuid not null,member_id text not null references public.organization_members(id) on delete cascade,
 last_sequence bigint not null default 0 check(last_sequence>=0),primary key(thread_id,member_id),
 foreign key(organization_id,thread_id) references public.fama_internal_threads(organization_id,id) on delete cascade
);
alter table public.fama_internal_threads enable row level security;
alter table public.fama_internal_participants enable row level security;
alter table public.fama_internal_messages enable row level security;
alter table public.fama_internal_reads enable row level security;
revoke all on public.fama_internal_threads,public.fama_internal_participants,public.fama_internal_messages,public.fama_internal_reads from public,anon,authenticated;
grant select,insert,update,delete on public.fama_internal_threads,public.fama_internal_participants,public.fama_internal_messages,public.fama_internal_reads to service_role;
grant usage,select on sequence public.fama_internal_messages_sequence_seq to service_role;
create function public.fama_internal_chat(p_operation text,p_organization_id text,p_member_id text,p_thread_id uuid default null,p_recipient_id text default null,p_title text default null,p_announcements boolean default false,p_body text default null,p_client_id uuid default null,p_reply_id uuid default null,p_urgent boolean default false,p_cursor bigint default null,p_pinned boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.organization_members; t public.fama_internal_threads; m public.fama_internal_messages; k text; result jsonb;
begin
 select * into actor from public.organization_members where id=p_member_id and organization_id=p_organization_id and status='active';
 if actor.id is null then raise exception 'chat_access' using errcode='42501';end if;
 if p_operation='inbox' then
  select coalesce(jsonb_agg(row_to_json(x) order by x.last_at desc),'[]'::jsonb) into result from (
   select th.*,coalesce((select max(created_at) from public.fama_internal_messages where thread_id=th.id),th.created_at) last_at,
   coalesce((select body_ciphertext from public.fama_internal_messages where thread_id=th.id order by sequence desc limit 1),'') preview_ciphertext,
   (select count(*) from public.fama_internal_messages msg where msg.thread_id=th.id and msg.sender_id<>actor.id and msg.sequence>coalesce((select last_sequence from public.fama_internal_reads where thread_id=th.id and member_id=actor.id),0)) unread,
   coalesce((select jsonb_agg(member_id) from public.fama_internal_participants where thread_id=th.id),'[]'::jsonb) participant_ids
   from public.fama_internal_threads th where th.organization_id=p_organization_id and (th.kind='channel' or exists(select 1 from public.fama_internal_participants where thread_id=th.id and member_id=actor.id))
   order by last_at desc limit 200
  ) x; return result;
 end if;
 if p_operation='direct' then
  if p_recipient_id=actor.id or not exists(select 1 from public.organization_members where id=p_recipient_id and organization_id=p_organization_id and status='active' and user_id<>'') then raise exception 'chat_recipient' using errcode='22023';end if;
  k=least(actor.id,p_recipient_id)||':'||greatest(actor.id,p_recipient_id);
  insert into public.fama_internal_threads(organization_id,kind,direct_key,created_by) values(p_organization_id,'direct',k,actor.id) on conflict(organization_id,direct_key) do update set direct_key=excluded.direct_key returning * into t;
  insert into public.fama_internal_participants(organization_id,thread_id,member_id) values(p_organization_id,t.id,actor.id),(p_organization_id,t.id,p_recipient_id) on conflict do nothing;
  return jsonb_build_object('id',t.id);
 elsif p_operation='channel' then
  if actor.role not in ('owner','admin') then raise exception 'chat_admin' using errcode='42501';end if;
  if length(trim(coalesce(p_title,''))) not between 2 and 60 then raise exception 'chat_title' using errcode='22023';end if;
  insert into public.fama_internal_threads(organization_id,kind,title,announcements,created_by) values(p_organization_id,'channel',trim(p_title),p_announcements,actor.id) returning * into t;
  return jsonb_build_object('id',t.id);
 end if;
 select * into t from public.fama_internal_threads where id=p_thread_id and organization_id=p_organization_id for update;
 if t.id is null or (t.kind='direct' and not exists(select 1 from public.fama_internal_participants where thread_id=t.id and member_id=actor.id)) then raise exception 'chat_private' using errcode='42501';end if;
 if p_operation='page' or p_operation='pinned' then
  select coalesce(jsonb_agg(row_to_json(x) order by x.sequence),'[]'::jsonb) into result from (
   select msg.*,(select count(*) from public.fama_internal_reads r join public.organization_members mb on mb.id=r.member_id and mb.organization_id=p_organization_id and mb.status='active' where r.thread_id=t.id and r.member_id<>msg.sender_id and r.last_sequence>=msg.sequence) read_count
   from public.fama_internal_messages msg where msg.thread_id=t.id and (p_operation<>'pinned' or msg.pinned) and (p_cursor is null or msg.sequence<p_cursor) order by sequence desc limit 81
  )x;return result;
 elsif p_operation='send' then
  if t.announcements and actor.role not in ('owner','admin') then raise exception 'chat_announcements' using errcode='42501';end if;
  if p_client_id is null or p_body is null or length(p_body)>24000 then raise exception 'chat_body' using errcode='22023';end if;
  if p_reply_id is not null and not exists(select 1 from public.fama_internal_messages where id=p_reply_id and thread_id=t.id) then raise exception 'chat_reply' using errcode='22023';end if;
  insert into public.fama_internal_messages(organization_id,thread_id,sender_id,author,body_ciphertext,client_id,reply_id,urgent) values(p_organization_id,t.id,actor.id,coalesce(nullif(actor.display_name,''),'Usuário'),p_body,p_client_id,p_reply_id,p_urgent)
  on conflict(thread_id,sender_id,client_id) do update set client_id=excluded.client_id returning * into m;
  return to_jsonb(m);
 elsif p_operation='read' then
  insert into public.fama_internal_reads(organization_id,thread_id,member_id,last_sequence) values(p_organization_id,t.id,actor.id,least(greatest(coalesce(p_cursor,0),0),coalesce((select max(sequence) from public.fama_internal_messages where thread_id=t.id),0)))
  on conflict(thread_id,member_id) do update set last_sequence=greatest(public.fama_internal_reads.last_sequence,excluded.last_sequence);
  return jsonb_build_object('ok',true);
 elsif p_operation='pin' then
  if t.kind='channel' and actor.role not in ('owner','admin') then raise exception 'chat_admin' using errcode='42501';end if;
  if p_pinned and (select count(*) from public.fama_internal_messages where thread_id=t.id and pinned)>=10 then raise exception 'chat_pin_limit' using errcode='22023';end if;
  update public.fama_internal_messages set pinned=p_pinned where thread_id=t.id and id=p_reply_id returning * into m;
  if m.id is null then raise exception 'chat_message' using errcode='22023';end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'chat_operation' using errcode='22023';
end;$$;
revoke all on function public.fama_internal_chat(text,text,text,uuid,text,text,boolean,text,uuid,uuid,boolean,bigint,boolean) from public,anon,authenticated;
grant execute on function public.fama_internal_chat(text,text,text,uuid,text,text,boolean,text,uuid,uuid,boolean,bigint,boolean) to service_role;
notify pgrst,'reload schema';
