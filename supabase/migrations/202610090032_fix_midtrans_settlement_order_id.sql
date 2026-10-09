-- The settlement branch used an unqualified PL/pgSQL variable named order_id.
-- Once Midtrans sends a settlement notification, PostgreSQL cannot distinguish
-- it from table columns named order_id. Use a distinct variable name throughout.
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
  v_order_id uuid;
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
  into payment_id, v_order_id, payment_amount, payment_status, order_status
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.provider = 'midtrans' and p.provider_order_id = p_provider_order_id
  for update of p, o;

  insert into public.payment_events (
    payment_id, order_id, provider, event_fingerprint, transaction_status, fraud_status, signature_valid
  ) values (
    payment_id, v_order_id, 'midtrans', p_event_fingerprint, p_transaction_status, p_fraud_status, p_signature_valid
  ) on conflict (event_fingerprint) do nothing
  returning id into event_id;

  if event_id is null then
    return jsonb_build_object('accepted', true, 'duplicate', true);
  end if;
  if not p_signature_valid then
    update public.payment_events set processing_error = 'invalid signature' where id = event_id;
    return jsonb_build_object('accepted', false, 'reason', 'invalid_signature');
  end if;
  if payment_id is null or v_order_id is null then
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
    perform private.commit_order_reservations(v_order_id);
    update public.orders set status = 'PAID', paid_at = now() where id = v_order_id;

    insert into public.invoices (order_id, invoice_number, amount)
    select o.id, 'INV-' || o.order_number, o.grand_total
    from public.orders o where o.id = v_order_id
    on conflict (order_id) do nothing;

    select q.* into quote_row
    from public.orders o join public.shipping_quotes q on q.id = o.shipping_quote_id
    where o.id = v_order_id;
    if found then
      insert into public.shipments (
        order_id, provider, courier_code, courier_name, service_code, service_name
      ) values (
        v_order_id, quote_row.provider, quote_row.courier_code, quote_row.courier_name,
        quote_row.service_code, quote_row.service_name
      ) on conflict (order_id) do nothing;
    end if;

    insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
    values ('payment.settled', 'order', v_order_id::text, jsonb_build_object('order_id', v_order_id));
    insert into public.email_outbox (dedupe_key, recipient_email, template_key, payload)
    select 'payment-settled:' || o.id::text, o.customer_email, 'payment_settled',
      jsonb_build_object('order_id', o.id, 'order_number', o.order_number)
    from public.orders o where o.id = v_order_id
    on conflict (dedupe_key) do nothing;
  elsif should_release and order_status = 'PENDING_PAYMENT' then
    perform private.release_order_reservations(v_order_id,
      case when p_transaction_status = 'expire' then 'expired' else 'released' end);
    update public.orders
    set status = case when p_transaction_status = 'expire' then 'EXPIRED' else 'CANCELLED' end,
        cancelled_at = now()
    where id = v_order_id;
    insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
    values ('payment.' || p_transaction_status, 'order', v_order_id::text,
      jsonb_build_object('order_id', v_order_id));
  end if;

  update public.payment_events set processed_at = now() where id = event_id;
  return jsonb_build_object('accepted', true, 'duplicate', false, 'order_id', v_order_id);
end;
$$;
