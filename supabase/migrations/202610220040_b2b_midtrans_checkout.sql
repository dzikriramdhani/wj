-- Payment lifecycle for accepted B2B quotations. This migration is additive;
-- it is intentionally not applied by the application or local test scripts.

alter table public.bulk_orders
  add column payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'expired', 'failed')),
  add column payment_expires_at timestamptz,
  add column paid_at timestamptz;

create table public.bulk_order_payments (
  id uuid primary key default gen_random_uuid(),
  bulk_order_id uuid not null references public.bulk_orders(id) on delete restrict,
  provider text not null default 'midtrans' check (provider = 'midtrans'),
  provider_transaction_id text,
  provider_order_id text not null unique,
  attempt_no integer not null check (attempt_no > 0),
  amount numeric(14, 2) not null check (amount > 0),
  currency char(3) not null default 'IDR' check (currency = 'IDR'),
  status text not null default 'pending'
    check (status in ('pending', 'capture', 'settlement', 'deny', 'cancel', 'expire', 'failure', 'refund', 'partial_refund')),
  payment_type text,
  provider_response_code text,
  provider_data jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_data) = 'object'),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bulk_order_id, attempt_no)
);

create unique index bulk_order_payments_provider_transaction_idx
  on public.bulk_order_payments (provider, provider_transaction_id)
  where provider_transaction_id is not null;
create index bulk_order_payments_order_created_idx
  on public.bulk_order_payments (bulk_order_id, created_at desc);
create trigger bulk_order_payments_set_updated_at
  before update on public.bulk_order_payments
  for each row execute function private.set_updated_at();

create table public.bulk_order_payment_events (
  id uuid primary key default gen_random_uuid(),
  bulk_order_payment_id uuid references public.bulk_order_payments(id) on delete set null,
  provider_order_id text not null,
  event_fingerprint text not null unique,
  transaction_status text,
  fraud_status text,
  signature_valid boolean not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now()
);

alter table public.bulk_order_payments enable row level security;
alter table public.bulk_order_payment_events enable row level security;
revoke all on public.bulk_order_payments, public.bulk_order_payment_events from public, anon, authenticated;
grant all on public.bulk_order_payments, public.bulk_order_payment_events to service_role;

create or replace function public.prepare_midtrans_bulk_order_payment(
  p_bulk_order_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bulk_row public.bulk_orders%rowtype;
  payment_row public.bulk_order_payments%rowtype;
  attempt integer;
  expiry timestamptz;
  customer_name text;
  customer_email text;
  customer_phone text;
begin
  if p_bulk_order_id is null or p_user_id is null then
    raise exception 'payment owner is required' using errcode = '22023';
  end if;

  select b.* into bulk_row
  from public.bulk_orders b
  where b.id = p_bulk_order_id
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = b.organization_id
        and m.user_id = p_user_id
        and m.role in ('owner', 'admin')
    )
  for update of b;
  if not found then raise exception 'bulk order not found' using errcode = 'P0002'; end if;
  if bulk_row.status::text = 'cancelled' then
    raise exception 'bulk order is cancelled' using errcode = '22023';
  end if;
  if bulk_row.total_amount <= 0 or bulk_row.total_amount <> round(bulk_row.total_amount) then
    raise exception 'B2B payment requires a positive whole-rupiah quotation total' using errcode = '22023';
  end if;
  if bulk_row.payment_status = 'paid' then
    raise exception 'bulk order is already paid' using errcode = '22023';
  end if;

  select p.* into payment_row
  from public.bulk_order_payments p
  where p.bulk_order_id = bulk_row.id
  order by p.attempt_no desc
  limit 1
  for update;

  if found and payment_row.status in ('pending', 'capture')
      and (payment_row.expires_at > now() or payment_row.status = 'capture') then
    select
      coalesce(nullif(trim(pr.full_name), ''), nullif(split_part(u.email, '@', 1), ''), 'Pelanggan'),
      u.email,
      pr.phone
    into customer_name, customer_email, customer_phone
    from auth.users u
    left join public.profiles pr on pr.id = u.id
    where u.id = p_user_id;

    return jsonb_build_object(
      'bulkOrderId', bulk_row.id,
      'bulkOrderNumber', bulk_row.bulk_order_number,
      'amount', bulk_row.total_amount,
      'customerName', coalesce(customer_name, 'Pelanggan'),
      'customerEmail', customer_email,
      'customerPhone', customer_phone,
      'providerOrderId', payment_row.provider_order_id,
      'expiresAt', payment_row.expires_at,
      'status', payment_row.status,
      'providerData', payment_row.provider_data,
      'reused', true
    );
  end if;

  if found and payment_row.status = 'pending' and payment_row.expires_at <= now() then
    update public.bulk_order_payments set status = 'expire' where id = payment_row.id;
    update public.bulk_orders set payment_status = 'expired' where id = bulk_row.id;
  end if;

  select coalesce(max(p.attempt_no), 0) + 1 into attempt
  from public.bulk_order_payments p
  where p.bulk_order_id = bulk_row.id;
  if attempt > 20 then raise exception 'payment attempts exceeded' using errcode = '22023'; end if;

  expiry := now() + interval '60 minutes';
  if char_length(bulk_row.bulk_order_number || '-P' || attempt::text) > 50 then
    raise exception 'bulk order number is too long for payment provider' using errcode = '22023';
  end if;

  select
    coalesce(nullif(trim(pr.full_name), ''), nullif(split_part(u.email, '@', 1), ''), 'Pelanggan'),
    u.email,
    pr.phone
  into customer_name, customer_email, customer_phone
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where u.id = p_user_id;
  if customer_email is null then raise exception 'customer email is required' using errcode = '22023'; end if;

  insert into public.bulk_order_payments (
    bulk_order_id, provider_order_id, attempt_no, amount, expires_at
  ) values (
    bulk_row.id, bulk_row.bulk_order_number || '-P' || attempt::text, attempt, bulk_row.total_amount, expiry
  ) returning * into payment_row;

  update public.bulk_orders
  set payment_status = 'pending', payment_expires_at = expiry
  where id = bulk_row.id;

  return jsonb_build_object(
    'bulkOrderId', bulk_row.id,
    'bulkOrderNumber', bulk_row.bulk_order_number,
    'amount', bulk_row.total_amount,
    'customerName', coalesce(customer_name, 'Pelanggan'),
    'customerEmail', customer_email,
    'customerPhone', customer_phone,
    'providerOrderId', payment_row.provider_order_id,
    'expiresAt', payment_row.expires_at,
    'status', payment_row.status,
    'providerData', payment_row.provider_data,
    'reused', false
  );
end;
$$;

create or replace function public.complete_midtrans_bulk_order_payment(
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
  payment_row public.bulk_order_payments%rowtype;
begin
  if char_length(trim(coalesce(p_provider_order_id, ''))) < 1
    or char_length(trim(coalesce(p_provider_transaction_id, ''))) < 1
    or char_length(trim(coalesce(p_payment_type, ''))) < 1
    or jsonb_typeof(coalesce(p_provider_data, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_provider_data, '{}'::jsonb)::text) > 12000 then
    raise exception 'invalid Midtrans Core API payment data' using errcode = '22023';
  end if;

  update public.bulk_order_payments
  set provider_transaction_id = p_provider_transaction_id,
      payment_type = p_payment_type,
      provider_response_code = p_provider_response_code,
      provider_data = p_provider_data
  where provider = 'midtrans'
    and provider_order_id = p_provider_order_id
    and status in ('pending', 'failure')
  returning * into payment_row;
  if not found then
    select * into payment_row from public.bulk_order_payments
    where provider = 'midtrans' and provider_order_id = p_provider_order_id;
  end if;
  if payment_row.id is null then raise exception 'bulk payment not found' using errcode = 'P0002'; end if;

  return jsonb_build_object(
    'paymentType', payment_row.payment_type,
    'providerData', payment_row.provider_data,
    'status', payment_row.status
  );
end;
$$;

create or replace function public.apply_midtrans_bulk_order_payment_notification(
  p_provider_order_id text,
  p_provider_transaction_id text,
  p_transaction_status text,
  p_fraud_status text,
  p_payment_type text,
  p_status_code text,
  p_amount numeric,
  p_signature_valid boolean,
  p_event_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.bulk_order_payments%rowtype;
  bulk_row public.bulk_orders%rowtype;
  event_id uuid;
  should_settle boolean;
  should_release boolean;
begin
  if char_length(coalesce(p_event_fingerprint, '')) <> 64 then
    raise exception 'invalid event fingerprint' using errcode = '22023';
  end if;

  select p.* into payment_row
  from public.bulk_order_payments p
  where p.provider = 'midtrans' and p.provider_order_id = p_provider_order_id
  for update;
  if found then
    select b.* into bulk_row from public.bulk_orders b
    where b.id = payment_row.bulk_order_id for update;
  end if;

  insert into public.bulk_order_payment_events (
    bulk_order_payment_id, provider_order_id, event_fingerprint,
    transaction_status, fraud_status, signature_valid
  ) values (
    payment_row.id, p_provider_order_id, p_event_fingerprint,
    p_transaction_status, p_fraud_status, p_signature_valid
  ) on conflict (event_fingerprint) do nothing
  returning id into event_id;

  if event_id is null then return jsonb_build_object('accepted', true, 'duplicate', true); end if;
  if not p_signature_valid then
    update public.bulk_order_payment_events set processing_error = 'invalid signature' where id = event_id;
    return jsonb_build_object('accepted', false, 'reason', 'invalid_signature');
  end if;
  if payment_row.id is null or bulk_row.id is null then
    update public.bulk_order_payment_events set processing_error = 'unknown provider order ID' where id = event_id;
    return jsonb_build_object('accepted', false, 'reason', 'unknown_order');
  end if;
  if p_amount is null or p_amount <> payment_row.amount then
    update public.bulk_order_payment_events set processing_error = 'gross amount does not match payment' where id = event_id;
    return jsonb_build_object('accepted', false, 'reason', 'amount_mismatch');
  end if;

  should_settle := p_transaction_status = 'settlement'
    or (p_transaction_status = 'capture' and coalesce(p_fraud_status, 'accept') = 'accept');
  should_release := p_transaction_status in ('deny', 'cancel', 'expire', 'failure');

  -- A fraud-review capture can be followed by an accepted capture/settlement.
  -- Do not let a later failure/cancel notification downgrade a captured payment.
  if should_settle or payment_row.status not in ('capture', 'settlement', 'refund', 'partial_refund') then
    update public.bulk_order_payments
    set provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
        status = case
          when should_settle
            or p_transaction_status in ('capture', 'settlement', 'deny', 'cancel', 'expire', 'failure', 'refund', 'partial_refund')
            then p_transaction_status
          else status
        end,
        payment_type = coalesce(p_payment_type, payment_type),
        provider_response_code = coalesce(p_status_code, provider_response_code),
        paid_at = case when should_settle then now() else paid_at end
    where id = payment_row.id;
  end if;

  if should_settle then
    update public.bulk_orders
    set payment_status = 'paid', paid_at = coalesce(paid_at, now())
    where id = bulk_row.id;
  elsif should_release and bulk_row.payment_status <> 'paid' then
    update public.bulk_orders
    set payment_status = case when p_transaction_status = 'expire' then 'expired' else 'failed' end
    where id = bulk_row.id;
  end if;

  update public.bulk_order_payment_events set processed_at = now() where id = event_id;
  return jsonb_build_object('accepted', true, 'duplicate', false, 'bulk_order_id', bulk_row.id);
end;
$$;

revoke all on function public.prepare_midtrans_bulk_order_payment(uuid, uuid),
  public.complete_midtrans_bulk_order_payment(text, text, text, text, jsonb),
  public.apply_midtrans_bulk_order_payment_notification(text, text, text, text, text, text, numeric, boolean, text)
  from public, anon, authenticated;
grant execute on function public.prepare_midtrans_bulk_order_payment(uuid, uuid),
  public.complete_midtrans_bulk_order_payment(text, text, text, text, jsonb),
  public.apply_midtrans_bulk_order_payment_notification(text, text, text, text, text, text, numeric, boolean, text)
  to service_role;

comment on table public.bulk_order_payments is
  'Midtrans payment attempts for accepted B2B quotation orders; payment details are service-role only.';
