-- MANUAL ROLLBACK ONLY.
-- Do not place this file in supabase/migrations and do not run it through db push.
-- Run only after disabling the server-side password-reset rate-limit caller.

begin;

drop function if exists public.consume_password_reset_rate_limit(text, text, integer, integer);
drop function if exists public.purge_password_reset_rate_limits(integer);
drop table if exists public.password_reset_rate_limits;

commit;
