begin;
-- authorized_actor takes FOR SHARE locks to serialize access checks against
-- revocation. PostgREST POST RPCs marked STABLE run in READ ONLY transactions,
-- which forbid those locks. Keep the existing function, body and grants;
-- only correct the transaction classification for this lock-taking RPC.
alter function public.intrack_coordinator_roster(text,jsonb) volatile;
notify pgrst, 'reload schema';
commit;
