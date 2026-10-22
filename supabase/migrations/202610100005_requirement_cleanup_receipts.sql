begin;
alter table intrack.requirement_uploads add column cleaned_at timestamptz;

create or replace function public.intrack_expired_requirement_files()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare doc intrack.documents%rowtype; result jsonb:='[]'::jsonb;
begin
  for doc in select d.* from intrack.documents d join intrack.requirement_uploads u on u.document_id=d.id
    where u.cleaned_at is null and u.expires_at<now()-interval '1 hour' and d.status in ('pending','validated','quarantined')
      and not exists(select 1 from intrack.submission_versions s where s.document_id=d.id)
    order by u.expires_at limit 100 for update of d skip locked loop
    if doc.status<>'quarantined' then
      update intrack.documents set status='quarantined' where id=doc.id;
      insert into intrack.audit_events(enrollment_id,entity_type,entity_id,action,command_id)
        values(doc.enrollment_id,'document',doc.id,'expired_upload_quarantined',gen_random_uuid());
    end if;
    result:=result||jsonb_build_array(jsonb_build_object('id',doc.id,'path',doc.object_path));
  end loop;
  return result;
end $$;

create function public.intrack_complete_requirement_cleanup(document_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from intrack.documents d where d.id=document_id and d.status='quarantined'
    and not exists(select 1 from intrack.submission_versions s where s.document_id=d.id) for update;
  if not found then raise exception 'Cleanup not permitted' using errcode='42501'; end if;
  update intrack.requirement_uploads u set cleaned_at=now()
    where u.document_id=intrack_complete_requirement_cleanup.document_id and u.cleaned_at is null and u.expires_at<now()-interval '1 hour';
end $$;
revoke all on function public.intrack_complete_requirement_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.intrack_complete_requirement_cleanup(uuid) to service_role;
commit;
