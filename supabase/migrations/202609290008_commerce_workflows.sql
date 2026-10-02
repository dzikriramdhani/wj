-- Phase 2 lifecycle: payment sessions, verified webhook handling, stock release,
-- invoices, and controlled shipment fulfillment. Every function is server-owned.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  invoice_number text not null unique,
  status text not null default 'issued' check (status in ('issued', 'void')),
  amount numeric(14, 2) not null check (amount >= 0),
  issued_at timestamptz not null default now(),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_issued_idx on public.invoices (issued_at desc);
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function private.set_updated_at();

alter table public.invoices enable row level security;
grant select on public.invoices to authenticated;
revoke insert, update, delete on public.invoices from anon, authenticated;
create policy "owners read their invoices" on public.invoices
  for select to authenticated using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = (select auth.uid()) or private.is_platform_admin())
  ));

create or replace function private.release_order_reservations(
  p_order_id uuid,
  p_reservation_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.inventory_reservations%rowtype;
begin
  if p_reservation_status not in ('released', 'expired') then
    raise exception 'invalid reservation release status' using errcode = '22023';
  end if;

  for reservation_row in
    select * from public.inventory_reservations
    where order_id = p_order_id and status = 'reserved'
    for update
  loop
    if reservation_row.inventory_scope = 'variant' then
      update public.variant_inventory
      set reserved = reserved - reservation_row.quantity_meters
      where variant_id = reservation_row.variant_id
        and reserved >= reservation_row.quantity_meters;
    else
      update public.inventory
      set reserved = reserved - reservation_row.quantity_meters
      where product_id = reservation_row.product_id
        and reserved >= reservation_row.quantity_meters;
    end if;
    if not found then
      raise exception 'reserved inventory is inconsistent for order %', p_order_id using errcode = '23514';
    end if;

    update public.inventory_reservations
    set status = p_reservation_status, released_at = now()
    where id = reservation_row.id;
  end loop;
end;
$$;

create or replace function private.commit_order_reservations(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.inventory_reservations%rowtype;
begin
  for reservation_row in
    select * from public.inventory_reservations
    where order_id = p_order_id and status = 'reserved'
    for update
  loop
    if reservation_row.inventory_scope = 'variant' then
      update public.variant_inventory
      set on_hand = on_hand - reservation_row.quantity_meters,
          reserved = reserved - reservation_row.quantity_meters
      where variant_id = reservation_row.variant_id
        and on_hand >= reservation_row.quantity_meters
        and reserved >= reservation_row.quantity_meters;
    else
      update public.inventory
      set on_hand = on_hand - reservation_row.quantity_meters,
          reserved = reserved - reservation_row.quantity_meters
      where product_id = reservation_row.product_id
        and on_hand >= reservation_row.quantity_meters
        and reserved >= reservation_row.quantity_meters;
    end if;
    if not found then
      raise exception 'reserved inventory cannot be committed for order %', p_order_id using errcode = '23514';
    end if;

    update public.inventory_reservations
    set status = 'committed', committed_at = now()
    where id = reservation_row.id;
  end loop;
end;
$$;

create or replace function public.prepare_midtrans_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_guest_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  payment_row public.payments%rowtype;
begin
  if (p_user_id is not null) = (p_guest_session_id is not null) then
    raise exception 'exactly one payment owner is required' using errcode = '22023';
  end if;

  select * into order_row
  from public.orders o
  where o.id = p_order_id
    and ((p_user_id is not null and o.user_id = p_user_id)
      or (p_guest_session_id is not null and o.guest_session_id = p_guest_session_id))
  for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if order_row.status <> 'PENDING_PAYMENT' then
    raise exception 'order is not awaiting payment' using errcode = '22023';
  end if;
  if order_row.payment_expires_at <= now() then
    perform private.release_order_reservations(order_row.id, 'expired');
    update public.orders set status = 'EXPIRED', cancelled_at = now() where id = order_row.id;
    raise exception 'order payment window has expired' using errcode = '22023';
  end if;

  select * into payment_row
  from public.payments p
  where p.order_id = order_row.id and p.provider = 'midtrans'
  order by p.created_at desc
  limit 1
  for update;

  if found then
    if payment_row.status not in ('pending', 'failure') then
      raise exception 'payment is already finalized' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'orderId', order_row.id,
      'orderNumber', order_row.order_number,
      'amount', order_row.grand_total,
      'customerName', order_row.customer_name,
      'customerEmail', order_row.customer_email,
      'customerPhone', order_row.customer_phone,
      'paymentUrl', payment_row.payment_url,
      'providerOrderId', payment_row.provider_order_id,
      'expiresAt', order_row.payment_expires_at,
      'reused', true
    );
  end if;

  insert into public.payments (
    order_id, provider, provider_order_id, amount, expires_at
  ) values (
    order_row.id, 'midtrans', order_row.order_number, order_row.grand_total, order_row.payment_expires_at
  ) returning * into payment_row;

  return jsonb_build_object(
    'orderId', order_row.id,
    'orderNumber', order_row.order_number,
    'amount', order_row.grand_total,
    'customerName', order_row.customer_name,
    'customerEmail', order_row.customer_email,
    'customerPhone', order_row.customer_phone,
    'paymentUrl', null,
    'providerOrderId', payment_row.provider_order_id,
    'expiresAt', order_row.payment_expires_at,
    'reused', false
  );
end;
$$;

create or replace function public.complete_midtrans_payment_session(
  p_provider_order_id text,
  p_payment_url text,
  p_provider_response_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
begin
  if char_length(trim(coalesce(p_payment_url, ''))) < 12 then
    raise exception 'payment URL is required' using errcode = '22023';
  end if;
  update public.payments
  set payment_url = p_payment_url,
      provider_response_code = p_provider_response_code
  where provider = 'midtrans'
    and provider_order_id = p_provider_order_id
    and status in ('pending', 'failure')
  returning * into payment_row;
  if not found then
    select * into payment_row from public.payments
    where provider = 'midtrans' and provider_order_id = p_provider_order_id;
  end if;
  if payment_row.id is null then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('paymentUrl', payment_row.payment_url, 'status', payment_row.status);
end;
$$;

create or replace function public.apply_midtrans_payment_notification(
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
  payment_id uuid;
  order_id uuid;
  payment_amount numeric(14, 2);
  payment_status text;
  order_status text;
  event_id uuid;
  should_settle boolean;
  should_release boolean;
  quote_row public.shipping_quotes%rowtype;
begin
  if char_length(coalesce(p_event_fingerprint, '')) <> 64 then
    raise exception 'invalid event fingerprint' using errcode = '22023';
  end if;

  select p.id, p.order_id, p.amount, p.status, o.status
  into payment_id, order_id, payment_amount, payment_status, order_status
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.provider = 'midtrans' and p.provider_order_id = p_provider_order_id
  for update of p, o;

  insert into public.payment_events (
    payment_id, order_id, provider, event_fingerprint, transaction_status, fraud_status, signature_valid
  ) values (
    payment_id, order_id, 'midtrans', p_event_fingerprint, p_transaction_status, p_fraud_status, p_signature_valid
  ) on conflict (event_fingerprint) do nothing
  returning id into event_id;

  if event_id is null then
    return jsonb_build_object('accepted', true, 'duplicate', true);
  end if;
  if not p_signature_valid then
    update public.payment_events set processing_error = 'invalid signature' where id = event_id;
    return jsonb_build_object('accepted', false, 'reason', 'invalid_signature');
  end if;
  if payment_id is null or order_id is null then
    update public.payment_events set processing_error = 'unknown provider order ID' where id = event_id;
    return jsonb_build_object('accepted', false, 'reason', 'unknown_order');
  end if;
  if p_amount is null or p_amount <> payment_amount then
    update public.payment_events set processing_error = 'gross amount does not match payment' where id = event_id;
    return jsonb_build_object('accepted', false, 'reason', 'amount_mismatch');
  end if;

  should_settle := p_transaction_status = 'settlement'
    or (p_transaction_status = 'capture' and coalesce(p_fraud_status, 'accept') = 'accept');
  should_release := p_transaction_status in ('deny', 'cancel', 'expire', 'failure');

  if payment_status not in ('capture', 'settlement', 'refund', 'partial_refund') then
    update public.payments
    set provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
        status = case
          when p_transaction_status in ('capture', 'settlement', 'deny', 'cancel', 'expire', 'failure', 'refund', 'partial_refund')
            then p_transaction_status
          else status
        end,
        payment_type = coalesce(p_payment_type, payment_type),
        provider_response_code = coalesce(p_status_code, provider_response_code),
        paid_at = case when should_settle then now() else paid_at end
    where id = payment_id;
  end if;

  if should_settle and order_status = 'PENDING_PAYMENT' then
    perform private.commit_order_reservations(order_id);
    update public.orders set status = 'PAID', paid_at = now() where id = order_id;

    insert into public.invoices (order_id, invoice_number, amount)
    select o.id, 'INV-' || o.order_number, o.grand_total
    from public.orders o where o.id = order_id
    on conflict (order_id) do nothing;

    select q.* into quote_row
    from public.orders o join public.shipping_quotes q on q.id = o.shipping_quote_id
    where o.id = order_id;
    if found then
      insert into public.shipments (
        order_id, provider, courier_code, courier_name, service_code, service_name
      ) values (
        order_id, quote_row.provider, quote_row.courier_code, quote_row.courier_name,
        quote_row.service_code, quote_row.service_name
      ) on conflict (order_id) do nothing;
    end if;

    insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
    values ('payment.settled', 'order', order_id::text, jsonb_build_object('order_id', order_id));
    insert into public.email_outbox (dedupe_key, recipient_email, template_key, payload)
    select 'payment-settled:' || o.id::text, o.customer_email, 'payment_settled',
      jsonb_build_object('order_id', o.id, 'order_number', o.order_number)
    from public.orders o where o.id = order_id
    on conflict (dedupe_key) do nothing;
  elsif should_release and order_status = 'PENDING_PAYMENT' then
    perform private.release_order_reservations(order_id,
      case when p_transaction_status = 'expire' then 'expired' else 'released' end);
    update public.orders
    set status = case when p_transaction_status = 'expire' then 'EXPIRED' else 'CANCELLED' end,
        cancelled_at = now()
    where id = order_id;
    insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
    values ('payment.' || p_transaction_status, 'order', order_id::text,
      jsonb_build_object('order_id', order_id));
  end if;

  update public.payment_events set processed_at = now() where id = event_id;
  return jsonb_build_object('accepted', true, 'duplicate', false, 'order_id', order_id);
end;
$$;

create or replace function public.expire_pending_checkout_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  expired_count integer := 0;
begin
  for order_row in
    select * from public.orders
    where status = 'PENDING_PAYMENT' and payment_expires_at <= now()
    for update skip locked
  loop
    perform private.release_order_reservations(order_row.id, 'expired');
    update public.orders set status = 'EXPIRED', cancelled_at = now() where id = order_row.id;
    update public.payments set status = 'expire'
    where order_id = order_row.id and status = 'pending';
    insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
    values ('order.expired', 'order', order_row.id::text, jsonb_build_object('order_id', order_row.id));
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

create or replace function public.update_order_fulfillment(
  p_order_id uuid,
  p_order_status text,
  p_tracking_number text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  shipment_row public.shipments%rowtype;
begin
  if p_order_status not in ('PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED') then
    raise exception 'invalid fulfillment status' using errcode = '22023';
  end if;
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if order_row.status not in ('PAID', 'PROCESSING', 'PACKED', 'SHIPPED') then
    raise exception 'order is not eligible for fulfillment' using errcode = '22023';
  end if;
  if p_order_status = 'DELIVERED' and order_row.status <> 'SHIPPED' then
    raise exception 'only shipped orders can be delivered' using errcode = '22023';
  end if;
  if p_order_status = 'SHIPPED' and char_length(trim(coalesce(p_tracking_number, ''))) < 4 then
    raise exception 'tracking number is required before shipping' using errcode = '22023';
  end if;

  select * into shipment_row from public.shipments where order_id = order_row.id for update;
  if not found then raise exception 'shipment does not exist for order' using errcode = 'P0002'; end if;

  update public.orders set status = p_order_status where id = order_row.id;
  update public.shipments
  set tracking_number = coalesce(nullif(trim(p_tracking_number), ''), tracking_number),
      status = case p_order_status
        when 'PROCESSING' then status
        when 'PACKED' then 'booked'
        when 'SHIPPED' then 'in_transit'
        when 'DELIVERED' then 'delivered'
      end,
      shipped_at = case when p_order_status = 'SHIPPED' then now() else shipped_at end,
      delivered_at = case when p_order_status = 'DELIVERED' then now() else delivered_at end
  where id = shipment_row.id;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
  values ('order.' || lower(p_order_status), 'order', order_row.id::text,
    jsonb_build_object('order_id', order_row.id, 'tracking_number', p_tracking_number));
  return jsonb_build_object('order_id', order_row.id, 'status', p_order_status);
end;
$$;

revoke all on function private.release_order_reservations(uuid, text), private.commit_order_reservations(uuid)
  from public, anon, authenticated;
revoke all on function public.prepare_midtrans_payment(uuid, uuid, uuid),
  public.complete_midtrans_payment_session(text, text, text),
  public.apply_midtrans_payment_notification(text, text, text, text, text, text, numeric, boolean, text),
  public.expire_pending_checkout_orders(), public.update_order_fulfillment(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_midtrans_payment(uuid, uuid, uuid),
  public.complete_midtrans_payment_session(text, text, text),
  public.apply_midtrans_payment_notification(text, text, text, text, text, text, numeric, boolean, text),
  public.expire_pending_checkout_orders(), public.update_order_fulfillment(uuid, text, text)
  to service_role;

comment on table public.invoices is 'One immutable issued invoice per settled order. Rendered documents are generated from these authoritative values.';
