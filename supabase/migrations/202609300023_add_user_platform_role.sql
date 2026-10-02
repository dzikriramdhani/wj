-- Add the new baseline role in its own migration so PostgreSQL commits the
-- enum value before later migrations reference it.
alter type public.platform_role add value if not exists 'user';
