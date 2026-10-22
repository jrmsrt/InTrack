begin;
-- External reference links are distinct from privately uploaded file versions.
create table intrack.template_links (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references intrack.programs(id),
 source_key text, name text not null, category text not null, description text not null default '',
 link_url text not null, status text not null default 'Published' check(status in ('Published','Disabled')),
 revision integer not null default 1, updated_at timestamptz not null default now(),
 unique(program_id,source_key),
 check(category in ('Pre-OJT','During-OJT','Post-OJT','Portfolio','Evaluation')),
 check(length(trim(name)) between 1 and 200), check(length(description)<=2000),
 check(length(link_url)<=2048 and link_url ~ '^https://[^[:space:]]+$')
);
alter table intrack.template_links enable row level security;
revoke all on intrack.template_links from public,anon,authenticated;

create function public.intrack_list_template_links(actor_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=intrack.authorized_actor(actor_role);
 return (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'programId',p.id,'programCode',p.code,
 'name',t.name,'category',t.category,'description',t.description,'linkUrl',t.link_url,'status',t.status,
 'revision',t.revision,'lastUpdated',t.updated_at) order by t.name,p.code),'[]')
 from intrack.template_links t join intrack.programs p on p.id=t.program_id
 where exists(select 1 from intrack.memberships m where m.profile_id=actor and m.program_id=t.program_id and m.role=actor_role and m.active)
 and (actor_role='coordinator' or t.status='Published'));
end $$;

create function public.intrack_save_template_link(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt jsonb; entry intrack.template_links%rowtype; target uuid; entry_id uuid; url text;
begin
 target:=(payload->>'programId')::uuid;actor:=intrack.authorized_actor('coordinator',target);
 receipt:=intrack.begin_command(actor,command_id,'save_template_link',payload);if receipt is not null then return receipt;end if;
 url:=trim(payload->>'linkUrl');
 if url is null or url !~ '^https://[^[:space:]]+$' or url ~ '^https://[^/]*@' or length(url)>2048
 or coalesce(length(trim(payload->>'name')),0) not between 1 and 200
 or coalesce(payload->>'category','') not in ('Pre-OJT','During-OJT','Post-OJT','Portfolio','Evaluation')
 or coalesce(payload->>'status','') not in ('Published','Disabled')
 or length(coalesce(payload->>'description',''))>2000 then raise exception 'Valid name, category, HTTPS link and status required' using errcode='22023';end if;
 entry_id:=nullif(payload->>'id','')::uuid;
 if entry_id is null then
  insert into intrack.template_links(program_id,name,category,description,link_url,status)
  values(target,trim(payload->>'name'),payload->>'category',coalesce(payload->>'description',''),url,payload->>'status') returning * into entry;
 else
  select * into entry from intrack.template_links where id=entry_id and program_id=target for update;
  if not found then raise exception 'Template not available in this program' using errcode='42501';end if;
  if entry.revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'Template changed. Refresh before editing.' using errcode='40001';end if;
  update intrack.template_links set name=trim(payload->>'name'),category=payload->>'category',description=coalesce(payload->>'description',''),link_url=url,status=payload->>'status',revision=revision+1,updated_at=now() where id=entry_id returning * into entry;
 end if;
 return intrack.finish_command(actor,command_id,'save_template_link',payload,jsonb_build_object('id',entry.id,'revision',entry.revision),'template_link',entry.id);
end $$;
revoke all on function public.intrack_list_template_links(text),public.intrack_save_template_link(uuid,jsonb) from public,anon;
grant execute on function public.intrack_list_template_links(text),public.intrack_save_template_link(uuid,jsonb) to authenticated;

-- Restore the original reference catalog, independently editable per program.
insert into intrack.template_links(program_id,source_key,name,category,description,link_url)
select p.id,v.* from intrack.programs p cross join (values
('t1','Pre-OJT Requirements Checklist','Pre-OJT','Checklist of requirements to complete before deployment.','https://drive.google.com/file/d/1cytqwLtfoy1hTMAtQQEQBgbxMOHDgK_f/view?usp=drive_link'),
('t2','Parent Consent & Waiver Form','Pre-OJT','Notarized parental permission template.','https://docs.google.com/document/d/1Tlob2HvS0RhAaZwYQszSypwBV8jndk8w/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t3','Memorandum of Agreement (HTE Model)','Pre-OJT','MOA template for companies to review.','https://docs.google.com/document/d/1A_3zSLiUpLxNSmEYj03WWhszT1_W7rPb/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t4','Weekly Journal Official Layout','During-OJT','Weekly accomplishment log template.','https://docs.google.com/document/d/1XzumsAU-vdbzNSx5PqMAi8IlwotT8Wyd/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t5','Daily Time Record Log Sheet','During-OJT','Daily attendance record template for HTE verification.','https://docs.google.com/document/d/1BlNjqPliq7w4IvGHApA7Y9Wf0cZUEuyv/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t6','HTE Evaluation Form','Post-OJT','Host Training Establishment evaluation form.','https://docs.google.com/document/d/1y70ljUvnhhcuphVlmu7flycEmHz0J8DM/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t7','OJT Student Evaluation Form','Post-OJT','Student evaluation form for post-OJT completion.','https://docs.google.com/document/d/1rJV55UVuZgAEcioWRfeHRtC4vWjs_Kn5/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t8','Final Portfolio Compiler Layout','Portfolio','Final compilation blueprint.','https://docs.google.com/document/d/1WGtNJmNtuu8aSH2p7ZMUKFvlJ3JifDzM/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t9','Internship Agreement Template','Pre-OJT','Agreement template confirming student, university, and HTE responsibilities.','https://docs.google.com/document/d/1urYpXNmm3FEqohvttEHpibtJVAdPUHUR/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t10','Endorsement/Recommendation Letter Template','Pre-OJT','Official endorsement letter template for internship applications.','https://docs.google.com/document/d/1stp4vDdC3jdBDrE-paRJK3D3A5rIj_YM/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t11','Practicum Plan Letter Template','Pre-OJT','Template letter for practicum plan details.','https://docs.google.com/document/d/1qFO7wjDSz4X60fj-bbWM7DLnIK28Ebc2/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t12','OJT Supervisor Evaluation Form - BSIT','Post-OJT','Supervisor evaluation form for BSIT students.','https://docs.google.com/document/d/1IxNeRF1LN-2OHjGWgjjW4ByBUXlygli0/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t13','OJT Supervisor Evaluation Form - BSOA','Post-OJT','Supervisor evaluation form for BSOA students.','https://docs.google.com/document/d/1z7oW3u81_23HgmuQKaymbT8mIWesZuKU/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t14','Self-Reflection Template','Post-OJT','Self-reflection template for post-OJT completion.','https://docs.google.com/document/d/1wMzLb6Nm65-mRxLc0GdfSJesnXZ5f7aS/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'),
('t15','Reflective Journal Template','Post-OJT','Reflective journal template for internship learning and professional growth.','https://docs.google.com/document/d/1ipDpySKQK5TrdY9ymSGlRcrkK6Qc8S6C/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true')
) as v(source_key,name,category,description,link_url);
notify pgrst,'reload schema';
commit;
