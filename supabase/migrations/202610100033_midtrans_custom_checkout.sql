alter table public.payments
  add column if not exists provider_data jsonb not null default '{}'::jsonb;

create or replace function public.complete_midtrans_core_payment(
  p_provider_order_id text,
  p_provider_transaction_id text,
  p_payment_type text,
  p_provider_response_code text,
  p_provider_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
begin
  if char_length(trim(coalesce(p_provider_order_id, ''))) < 1
    or char_length(trim(coalesce(p_provider_transaction_id, ''))) < 1
    or char_length(trim(coalesce(p_payment_type, ''))) < 1
    or jsonb_typeof(coalesce(p_provider_data, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_provider_data, '{}'::jsonb)::text) > 12000 then
    raise exception 'invalid Midtrans Core API payment data' using errcode = '22023';
  end if;

  update public.payments
  set provider_transaction_id = p_provider_transaction_id,
      payment_type = p_payment_type,
      provider_response_code = p_provider_response_code,
      provider_data = p_provider_data
  where provider = 'midtrans'
    and provider_order_id = p_provider_order_id
    and status in ('pending', 'failure')
  returning * into payment_row;

  if not found then
    select * into payment_row
    from public.payments
    where provider = 'midtrans'
      and provider_order_id = p_provider_order_id;
  end if;

  if payment_row.id is null then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'paymentType', payment_row.payment_type,
    'providerData', payment_row.provider_data,
    'status', payment_row.status
  );
end;
$$;

revoke all on function public.complete_midtrans_core_payment(text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_midtrans_core_payment(text, text, text, text, jsonb)
  to service_role;

comment on column public.payments.provider_data is
  'Sanitized Midtrans payment instructions for owner-authorized custom checkout rendering; never contains credentials or signatures.';
