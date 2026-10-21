-- Serialize authenticated checkout requests by owner/key, then compare the
-- persisted request hash before the legacy checkout function can replay an
-- existing order. The old function's replay branch runs before its hash check.
create or replace function public.create_checkout_order_with_idempotency_guard(
  p_user_id uuid,
  p_guest_session_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_quote_id uuid,
  p_shipping_address_snapshot jsonb,
  p_items jsonb,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout_owner text;
  stored_request_hash text;
begin
  -- Apply this guard only to a structurally valid authenticated request. The
  -- underlying checkout function remains responsible for rejecting invalid
  -- owner, key, or hash inputs and for supporting any internal guest callers.
  if p_user_id is not null
     and p_guest_session_id is null
     and char_length(coalesce(p_idempotency_key, '')) between 16 and 119
     and coalesce(p_request_hash, '') ~ '^[0-9a-f]{64}$' then
    checkout_owner := p_user_id::text;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(checkout_owner || ':checkout:' || p_idempotency_key, 0)
    );

    select request_hash into stored_request_hash
    from public.idempotency_keys
    where user_id = p_user_id
      and request_key = 'checkout:' || p_idempotency_key
    for update;

    if found and stored_request_hash is distinct from p_request_hash then
      raise exception 'idempotency key reused with different request'
        using errcode = '22023';
    end if;
  end if;

  return public.create_checkout_order(
    p_user_id,
    p_guest_session_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_shipping_quote_id,
    p_shipping_address_snapshot,
    p_items,
    p_idempotency_key,
    p_request_hash
  );
end;
$$;

revoke all on function public.create_checkout_order_with_idempotency_guard(
  uuid, uuid, text, text, text, uuid, jsonb, jsonb, text, text
) from public, anon, authenticated;

grant execute on function public.create_checkout_order_with_idempotency_guard(
  uuid, uuid, text, text, text, uuid, jsonb, jsonb, text, text
) to service_role;

comment on function public.create_checkout_order_with_idempotency_guard(
  uuid, uuid, text, text, text, uuid, jsonb, jsonb, text, text
) is 'Checks an authenticated checkout idempotency hash under the same transaction lock before delegating to the atomic order creator.';
