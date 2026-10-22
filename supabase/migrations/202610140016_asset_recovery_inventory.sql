begin;
-- Trusted backup/restore worker only; no application-wide file inventory API.
create function public.intrack_asset_recovery_inventory()
returns jsonb language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(asset) order by asset.bucket,asset.path),'[]'::jsonb) from (
    select d.id,'document'::text kind,d.bucket,d.object_path path,d.mime_type mime,d.byte_count bytes,d.sha256
      from intrack.documents d where d.status in ('validated','attached') and d.validated_at is not null
    union all
    select t.id,'template'::text kind,'ojt-templates'::text bucket,t.object_path path,t.mime_type mime,t.byte_count bytes,t.sha256
      from intrack.template_versions t
  )asset
$$;
revoke all on function public.intrack_asset_recovery_inventory() from public,anon,authenticated;
grant execute on function public.intrack_asset_recovery_inventory() to service_role;
commit;
