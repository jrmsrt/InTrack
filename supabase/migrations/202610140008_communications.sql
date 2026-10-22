begin;
create function intrack.has_enrollment_scope(actor uuid, actor_role text, target uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from intrack.enrollments e join intrack.memberships m on m.program_id=e.program_id
    where e.id=target and m.profile_id=actor and m.role=actor_role and m.active and
      (actor_role='coordinator' or (actor_role='student' and e.student_id=actor)
        or (actor_role='adviser' and exists(select 1 from intrack.adviser_assignments a where a.enrollment_id=e.id and a.adviser_id=actor and a.ends_at is null and a.starts_at<=now()))))
$$;
revoke all on function intrack.has_enrollment_scope(uuid,text,uuid) from public,anon,authenticated;

create function public.intrack_list_notifications(actor_role text, before_id uuid default null, page_size integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; boundary timestamptz; rows jsonb; unread bigint;
begin
  actor:=intrack.authorized_actor(actor_role);
  if page_size not between 1 and 100 then raise exception 'Page size must be 1–100' using errcode='22023';end if;
  if before_id is not null then
    select created_at into boundary from intrack.notifications where id=before_id and recipient_id=actor;
    if not found then raise exception 'Cursor unavailable' using errcode='42501';end if;
  end if;
  select count(*) into unread from intrack.notifications n where n.recipient_id=actor and n.read_at is null
    and (n.enrollment_id is null or intrack.has_enrollment_scope(actor,actor_role,n.enrollment_id));
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]') into rows from
    (select n.id,n.enrollment_id,n.content,n.created_at,n.read_at from intrack.notifications n where n.recipient_id=actor
      and (n.enrollment_id is null or intrack.has_enrollment_scope(actor,actor_role,n.enrollment_id))
      and (before_id is null or (n.created_at,n.id)<(boundary,before_id)) order by n.created_at desc,n.id desc limit page_size)q;
  return jsonb_build_object('items',rows,'unreadCount',unread,'nextCursor',case when jsonb_array_length(rows)=page_size then rows->(page_size-1)->>'id' else null end);
end $$;
revoke all on function public.intrack_list_notifications(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.intrack_list_notifications(text,uuid,integer) to authenticated;

create function public.intrack_read_notification(command_id uuid, notification_id uuid, actor_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; notification intrack.notifications%rowtype; payload jsonb; receipt jsonb;
begin
  actor:=intrack.authorized_actor(actor_role);
  select * into notification from intrack.notifications where id=notification_id and recipient_id=actor for update;
  if not found or (notification.enrollment_id is not null and not intrack.has_enrollment_scope(actor,actor_role,notification.enrollment_id)) then raise exception 'Notification unavailable' using errcode='42501';end if;
  payload:=jsonb_build_object('notificationId',notification_id,'role',actor_role);receipt:=intrack.begin_command(actor,command_id,'read_notification',payload);if receipt is not null then return receipt;end if;
  update intrack.notifications set read_at=coalesce(read_at,now()) where id=notification.id;
  return intrack.finish_command(actor,command_id,'read_notification',payload,jsonb_build_object('notificationId',notification.id,'read',true),'notification',notification.id,notification.enrollment_id);
end $$;
revoke all on function public.intrack_read_notification(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_read_notification(uuid,uuid,text) to authenticated;

create function public.intrack_send_message(command_id uuid, enrollment_id uuid, actor_role text, recipient_id uuid, body text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; actor uuid; recipient_role text; payload jsonb; receipt jsonb; id uuid;
begin
  select * into e from intrack.enrollments where enrollments.id=enrollment_id for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  actor:=intrack.enrollment_actor(e.id,actor_role);
  payload:=jsonb_build_object('enrollmentId',e.id,'role',actor_role,'recipientId',recipient_id,'body',body);
  receipt:=intrack.begin_command(actor,command_id,'send_message',payload);if receipt is not null then return receipt;end if;
  if recipient_id=actor or coalesce(length(trim(body)),0) not between 1 and 4000 then raise exception 'Other recipient and message required' using errcode='22023';end if;
  if not exists(select 1 from intrack.profiles where profiles.id=recipient_id and status='active') then raise exception 'Recipient unavailable' using errcode='42501';end if;
  if recipient_id=e.student_id then recipient_role:='student';
  elsif exists(select 1 from intrack.adviser_assignments where adviser_assignments.enrollment_id=e.id and adviser_id=recipient_id and ends_at is null and starts_at<=now()) then recipient_role:='adviser';
  elsif exists(select 1 from intrack.memberships where profile_id=recipient_id and program_id=e.program_id and role='coordinator' and active) then recipient_role:='coordinator';
  else raise exception 'Recipient is outside current enrollment relationship' using errcode='42501';end if;
  if not intrack.has_enrollment_scope(recipient_id,recipient_role,e.id) then raise exception 'Recipient membership unavailable' using errcode='42501';end if;
  insert into intrack.messages(enrollment_id,sender_id,recipient_id,body) values(e.id,actor,recipient_id,trim(body)) returning messages.id into id;
  insert into intrack.notifications(recipient_id,enrollment_id,event_key,content) values(recipient_id,e.id,command_id::text,jsonb_build_object('kind','message','messageId',id));
  return intrack.finish_command(actor,command_id,'send_message',payload,jsonb_build_object('messageId',id),'message',id,e.id);
end $$;
revoke all on function public.intrack_send_message(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_send_message(uuid,uuid,text,uuid,text) to authenticated;

create function public.intrack_list_messages(enrollment_id uuid, actor_role text, before_id uuid default null, page_size integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; boundary timestamptz; rows jsonb;
begin
  actor:=intrack.enrollment_actor(enrollment_id,actor_role);
  if page_size not between 1 and 100 then raise exception 'Page size must be 1–100' using errcode='22023';end if;
  if before_id is not null then
    select created_at into boundary from intrack.messages m where m.id=before_id and m.enrollment_id=intrack_list_messages.enrollment_id and actor in (m.sender_id,m.recipient_id);
    if not found then raise exception 'Cursor unavailable' using errcode='42501';end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]') into rows from
    (select m.id,m.sender_id,m.recipient_id,m.body,m.created_at,m.read_at from intrack.messages m
      where m.enrollment_id=intrack_list_messages.enrollment_id and actor in(m.sender_id,m.recipient_id)
        and (before_id is null or (m.created_at,m.id)<(boundary,before_id)) order by m.created_at desc,m.id desc limit page_size)q;
  return jsonb_build_object('items',rows,'nextCursor',case when jsonb_array_length(rows)=page_size then rows->(page_size-1)->>'id' else null end);
end $$;
revoke all on function public.intrack_list_messages(uuid,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.intrack_list_messages(uuid,text,uuid,integer) to authenticated;

create function public.intrack_publish_announcement(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt jsonb; id uuid; program uuid; audience text;
begin
  program:=(payload->>'programId')::uuid;actor:=intrack.authorized_actor('coordinator',program);
  receipt:=intrack.begin_command(actor,command_id,'publish_announcement',payload);if receipt is not null then return receipt;end if;
  audience:=payload->>'role';
  if coalesce(length(trim(payload->>'title')),0) not between 1 and 240 or coalesce(length(trim(payload->>'body')),0) not between 1 and 4000
    or (audience is not null and audience not in ('student','adviser','coordinator')) then raise exception 'Announcement title, body and valid audience required' using errcode='22023';end if;
  insert into intrack.announcements(program_id,term_id,audience_role,author_id,title,body,published_at)
    values(program,(payload->>'termId')::uuid,audience,actor,trim(payload->>'title'),trim(payload->>'body'),now()) returning announcements.id into id;
  return intrack.finish_command(actor,command_id,'publish_announcement',payload,jsonb_build_object('announcementId',id),'announcement',id);
end $$;
revoke all on function public.intrack_publish_announcement(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_publish_announcement(uuid,jsonb) to authenticated;

create function public.intrack_list_announcements(actor_role text, before_id uuid default null, page_size integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; rows jsonb; boundary timestamptz;
begin
  actor:=intrack.authorized_actor(actor_role);
  if page_size not between 1 and 100 then raise exception 'Page size must be 1–100' using errcode='22023';end if;
  if before_id is not null then select published_at into boundary from intrack.announcements where id=before_id;
    if not found then raise exception 'Cursor unavailable' using errcode='42501';end if;end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.published_at desc,q.id desc),'[]') into rows from
    (select a.id,a.title,a.body,a.program_id,a.term_id,a.published_at from intrack.announcements a
      where a.published_at is not null and a.archived_at is null and (a.audience_role is null or a.audience_role=actor_role)
      and exists(select 1 from intrack.memberships m where m.profile_id=actor and m.role=actor_role and m.program_id=a.program_id and m.active)
      and (a.term_id is null or actor_role<>'student' or exists(select 1 from intrack.enrollments e where e.student_id=actor and e.program_id=a.program_id and e.term_id=a.term_id))
      and (before_id is null or (a.published_at,a.id)<(boundary,before_id)) order by a.published_at desc,a.id desc limit page_size)q;
  return jsonb_build_object('items',rows,'nextCursor',case when jsonb_array_length(rows)=page_size then rows->(page_size-1)->>'id' else null end);
end $$;
revoke all on function public.intrack_list_announcements(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.intrack_list_announcements(text,uuid,integer) to authenticated;
commit;
