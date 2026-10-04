-- PostgreSQL treated \s in the original bracket expression as a literal `s`.
-- Use the POSIX whitespace class so valid internal order paths are accepted.
alter table public.notifications
  drop constraint if exists notifications_link_path_check;

alter table public.notifications
  add constraint notifications_link_path_check
  check (link_path is null or link_path ~ '^/[^[:space:]]*$');
