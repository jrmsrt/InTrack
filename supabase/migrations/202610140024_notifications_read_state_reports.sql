begin;
create function intrack.notify_workflow_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare student uuid;adviser uuid;
begin
 if new.enrollment_id is null or new.action not in ('attendance_exception','attendance_correction','reconstruction','dtr','academic','evaluation','portfolio','finalization','bind_specialized') then return new;end if;
 select student_id into student from intrack.enrollments where id=new.enrollment_id;
 select adviser_id into adviser from intrack.adviser_assignments where enrollment_id=new.enrollment_id and ends_at is null and starts_at<=now();
 if student is not null and student<>new.actor_id then insert into intrack.notifications(recipient_id,enrollment_id,event_key,content) values(student,new.enrollment_id,new.command_id::text,jsonb_build_object('kind',new.action,'entityId',new.entity_id)) on conflict do nothing;end if;
 if adviser is not null and adviser<>new.actor_id then insert into intrack.notifications(recipient_id,enrollment_id,event_key,content) values(adviser,new.enrollment_id,new.command_id::text,jsonb_build_object('kind',new.action,'entityId',new.entity_id)) on conflict do nothing;end if;
 return new;
end $$;
create trigger notify_workflow_audit after insert on intrack.audit_events for each row execute function intrack.notify_workflow_audit();

create function public.intrack_read_message(command_id uuid,message_id uuid,actor_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare m intrack.messages%rowtype;actor uuid;receipt jsonb;payload jsonb:=jsonb_build_object('messageId',message_id,'role',actor_role);
begin
 select * into m from intrack.messages where id=message_id for update;
 if m.id is null then raise exception 'Message unavailable' using errcode='42501';end if;
 actor:=intrack.enrollment_actor(m.enrollment_id,actor_role);
 if actor<>m.recipient_id then raise exception 'Only the receiver may mark a message read' using errcode='42501';end if;
 receipt:=intrack.begin_command(actor,command_id,'read_message',payload);if receipt is not null then return receipt;end if;
 update intrack.messages set read_at=coalesce(read_at,now()) where id=m.id;
 return intrack.finish_command(actor,command_id,'read_message',payload,jsonb_build_object('messageId',m.id,'read',true),'message',m.id,m.enrollment_id);
end $$;

create function public.intrack_enrollment_report(actor_role text,search_text text default '',page_offset integer default 0,page_size integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;rows jsonb;total integer;projection jsonb;
begin
 actor:=intrack.authorized_actor(actor_role);
 if page_offset is null or page_size is null or page_offset<0 or page_offset>100000 or page_size not between 1 and 100 or length(search_text)>200 then raise exception 'Bounded report page required' using errcode='22023';end if;
 projection:=public.intrack_list_enrollments(actor_role);
 select count(*) into total from jsonb_array_elements(projection) e where search_text='' or position(lower(search_text) in lower(e->>'studentName'))>0 or position(lower(search_text) in lower(e->>'programCode'))>0;
 select coalesce(jsonb_agg(q.item order by q.item->>'studentName',q.item->>'id'),'[]') into rows from (select e as item from jsonb_array_elements(projection) e where search_text='' or position(lower(search_text) in lower(e->>'studentName'))>0 or position(lower(search_text) in lower(e->>'programCode'))>0 order by e->>'studentName',e->>'id' offset page_offset limit page_size) q;
 return jsonb_build_object('items',rows,'total',total,'nextOffset',case when page_offset+page_size<total then page_offset+page_size end);
end $$;
revoke all on function intrack.notify_workflow_audit() from public,anon,authenticated;
revoke all on function public.intrack_read_message(uuid,uuid,text),public.intrack_enrollment_report(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.intrack_read_message(uuid,uuid,text),public.intrack_enrollment_report(text,text,integer,integer) to authenticated;
commit;
