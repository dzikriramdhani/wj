-- MANUAL ROLLBACK ONLY.
-- Roll back the application code that calls this RPC before running this file.
-- Role assignments already changed by the RPC remain as recorded in audit_logs.

begin;

drop function if exists public.replace_platform_user_role(uuid, uuid, public.platform_role);

commit;
