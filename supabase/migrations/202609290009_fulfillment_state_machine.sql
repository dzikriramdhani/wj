-- Fulfillment transitions are strictly forward-only. Retried requests may repeat
-- the current state, but cannot move an order backward in the lifecycle.
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
  if (order_row.status, p_order_status) not in (
    ('PAID', 'PROCESSING'),
    ('PROCESSING', 'PROCESSING'),
    ('PROCESSING', 'PACKED'),
    ('PACKED', 'PACKED'),
    ('PACKED', 'SHIPPED'),
    ('SHIPPED', 'SHIPPED'),
    ('SHIPPED', 'DELIVERED'),
    ('DELIVERED', 'DELIVERED')
  ) then
    raise exception 'invalid fulfillment transition from % to %', order_row.status, p_order_status using errcode = '22023';
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
      shipped_at = case when p_order_status = 'SHIPPED' then coalesce(shipped_at, now()) else shipped_at end,
      delivered_at = case when p_order_status = 'DELIVERED' then coalesce(delivered_at, now()) else delivered_at end
  where id = shipment_row.id;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
  values ('order.' || lower(p_order_status), 'order', order_row.id::text,
    jsonb_build_object('order_id', order_row.id, 'tracking_number', p_tracking_number));
  return jsonb_build_object('order_id', order_row.id, 'status', p_order_status);
end;
$$;
