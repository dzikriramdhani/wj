-- RFQs are a B2B workflow and must belong to a verified organization.
-- Existing RFQs are unchanged; every new RFQ insert is checked atomically.

create or replace function private.enforce_verified_organization_for_rfq()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is null then
    raise exception 'verified organization membership required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = new.organization_id
      and om.user_id = new.user_id
      and om.role in ('owner', 'admin', 'buyer')
      and o.status = 'verified'
  ) then
    raise exception 'verified organization membership required' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_verified_organization_for_rfq() from public, anon, authenticated;

create trigger rfqs_require_verified_organization
before insert on public.rfqs
for each row execute function private.enforce_verified_organization_for_rfq();

comment on function private.enforce_verified_organization_for_rfq() is
  'Rejects new RFQs unless the submitting user belongs to the verified organization.';

-- Rollback:
-- drop trigger if exists rfqs_require_verified_organization on public.rfqs;
-- drop function if exists private.enforce_verified_organization_for_rfq();
