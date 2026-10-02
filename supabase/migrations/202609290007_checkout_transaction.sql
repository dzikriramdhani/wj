-- Atomic checkout primitive. Only trusted server code can call this function.
alter table public.inventory_reservations
  add column inventory_scope text not null default 'product'
    check (inventory_scope in ('product', 'variant'));

create or replace function public.create_checkout_order(
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
  existing_order public.orders%rowtype;
  quote_row public.shipping_quotes%rowtype;
  item record;
  product_row public.products%rowtype;
  variant_row public.product_variants%rowtype;
  unit_price numeric(14, 2);
  line_total numeric(14, 2);
  subtotal_amount numeric(14, 2) := 0;
  grand_total_amount numeric(14, 2);
  reservation_expires_at timestamptz := now() + interval '30 minutes';
  new_order public.orders%rowtype;
  stock_row record;
  has_variant_inventory boolean;
  item_product_name text;
  item_product_sku text;
  item_variant_name text;
  idem_key text;
  idem_hash text;
  idem_response jsonb;
begin
  if (p_user_id is not null) = (p_guest_session_id is not null) then
    raise exception 'exactly one checkout owner is required' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_customer_name, ''))) not between 2 and 120
     or char_length(trim(coalesce(p_customer_email, ''))) not between 5 and 254
     or position('@' in p_customer_email) < 2 then
    raise exception 'valid customer name and email are required' using errcode = '22023';
  end if;
  if p_customer_phone is not null and char_length(p_customer_phone) > 32 then
    raise exception 'customer phone is too long' using errcode = '22023';
  end if;
  if p_shipping_address_snapshot is null
     or jsonb_typeof(p_shipping_address_snapshot) <> 'object'
     or char_length(trim(coalesce(p_shipping_address_snapshot ->> 'addressLine', ''))) < 10 then
    raise exception 'valid shipping address is required' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'checkout requires between 1 and 30 items' using errcode = '22023';
  end if;
  if char_length(coalesce(p_idempotency_key, '')) not between 16 and 119
     or coalesce(p_request_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'valid idempotency key and request hash are required' using errcode = '22023';
  end if;

  checkout_owner := coalesce(p_user_id::text, p_guest_session_id::text);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(checkout_owner || ':checkout:' || p_idempotency_key, 0)
  );

  if p_user_id is not null then
    select * into existing_order
    from public.orders o
    where o.user_id = p_user_id and o.idempotency_key = p_idempotency_key;
  else
    select * into existing_order
    from public.orders o
    where o.guest_session_id = p_guest_session_id and o.idempotency_key = p_idempotency_key;
  end if;

  if found then
    return jsonb_build_object(
      'id', existing_order.id,
      'orderNumber', existing_order.order_number,
      'status', existing_order.status,
      'grandTotal', existing_order.grand_total,
      'paymentExpiresAt', existing_order.payment_expires_at,
      'idempotentReplay', true
    );
  end if;

  if p_user_id is not null then
    idem_key := 'checkout:' || p_idempotency_key;
    select request_hash, response into idem_hash, idem_response
    from public.idempotency_keys
    where user_id = p_user_id and request_key = idem_key
    for update;
    if found and idem_hash <> p_request_hash then
      raise exception 'idempotency key reused with different request' using errcode = '22023';
    end if;
    if found and idem_response is not null then
      select * into existing_order
      from public.orders
      where id = (idem_response ->> 'order_id')::uuid;
      if found then
        return jsonb_build_object(
          'id', existing_order.id,
          'orderNumber', existing_order.order_number,
          'status', existing_order.status,
          'grandTotal', existing_order.grand_total,
          'paymentExpiresAt', existing_order.payment_expires_at,
          'idempotentReplay', true
        );
      end if;
    end if;
  end if;

  select * into quote_row
  from public.shipping_quotes q
  where q.id = p_shipping_quote_id
    and q.expires_at > now()
    and q.consumed_at is null
    and ((p_user_id is not null and q.user_id = p_user_id)
      or (p_guest_session_id is not null and q.guest_session_id = p_guest_session_id))
  for update;
  if not found then
    raise exception 'shipping quote is missing, expired, consumed, or not owned by checkout session' using errcode = '22023';
  end if;
  if coalesce(p_shipping_address_snapshot ->> 'destinationId', '') <> quote_row.destination_city_id then
    raise exception 'shipping address destination does not match selected quote' using errcode = '22023';
  end if;

  for item in
    select parsed.product_id, parsed.variant_id, sum(parsed.qty_meters)::numeric(12, 2) as qty_meters
    from jsonb_to_recordset(p_items) as parsed("productId" uuid, "variantId" uuid, "qtyMeters" numeric)
    group by parsed.product_id, parsed.variant_id
    order by parsed.product_id, parsed.variant_id nulls first
  loop
    if item.product_id is null or item.qty_meters is null or item.qty_meters <= 0 then
      raise exception 'product and positive quantity are required' using errcode = '22023';
    end if;

    select * into product_row
    from public.products p
    where p.id = item.product_id
      and p.is_active
      and p.published_at is not null
      and p.published_at <= now()
      and not p.is_custom_only
    for share;
    if not found then
      raise exception 'product is unavailable for direct checkout' using errcode = '22023';
    end if;
    if item.qty_meters < product_row.moq_retail then
      raise exception 'quantity is below the product minimum order quantity' using errcode = '22023';
    end if;

    if item.variant_id is not null then
      select * into variant_row
      from public.product_variants v
      where v.id = item.variant_id and v.product_id = item.product_id and v.is_active
      for share;
      if not found then
        raise exception 'product variant is unavailable' using errcode = '22023';
      end if;
    end if;

    select pp.price_per_meter into unit_price
    from public.product_prices pp
    where pp.product_id = item.product_id
      and pp.price_tier = 'retail'
      and pp.organization_id is null
      and pp.min_quantity <= item.qty_meters
      and pp.valid_from <= now()
      and (pp.valid_until is null or pp.valid_until > now())
    order by pp.min_quantity desc, pp.valid_from desc
    limit 1
    for share;
    if unit_price is null then
      raise exception 'current retail price is unavailable' using errcode = '22023';
    end if;

    line_total := round(unit_price * item.qty_meters, 2);
    subtotal_amount := subtotal_amount + line_total;
  end loop;

  if subtotal_amount <= 0 then
    raise exception 'checkout total must be positive' using errcode = '22023';
  end if;
  grand_total_amount := subtotal_amount + quote_row.total_cost;

  insert into public.orders (
    user_id, guest_session_id, customer_name, customer_email, customer_phone,
    subtotal, shipping_cost, tax_amount, discount_amount, grand_total,
    shipping_quote_id, shipping_address_snapshot, idempotency_key, payment_expires_at
  ) values (
    p_user_id, p_guest_session_id, trim(p_customer_name), lower(trim(p_customer_email)), p_customer_phone,
    subtotal_amount, quote_row.total_cost, 0, 0, grand_total_amount,
    quote_row.id, p_shipping_address_snapshot, p_idempotency_key, reservation_expires_at
  ) returning * into new_order;

  -- Stock holds and order items are written only after the order ID exists.
  -- Any inventory failure rolls back the entire function call and the order.
  for item in
    select parsed.product_id, parsed.variant_id, sum(parsed.qty_meters)::numeric(12, 2) as qty_meters
    from jsonb_to_recordset(p_items) as parsed("productId" uuid, "variantId" uuid, "qtyMeters" numeric)
    group by parsed.product_id, parsed.variant_id
    order by parsed.product_id, parsed.variant_id nulls first
  loop
    select p.name, p.sku into item_product_name, item_product_sku
    from public.products p where p.id = item.product_id;
    select pp.price_per_meter into unit_price
    from public.product_prices pp
    where pp.product_id = item.product_id and pp.price_tier = 'retail'
      and pp.organization_id is null and pp.min_quantity <= item.qty_meters
      and pp.valid_from <= now() and (pp.valid_until is null or pp.valid_until > now())
    order by pp.min_quantity desc, pp.valid_from desc limit 1;
    line_total := round(unit_price * item.qty_meters, 2);
    item_variant_name := null;
    if item.variant_id is not null then
      select v.color_name into item_variant_name
      from public.product_variants v where v.id = item.variant_id;
      select vi.on_hand, vi.reserved into stock_row
      from public.variant_inventory vi where vi.variant_id = item.variant_id
      for update;
      has_variant_inventory := found;
    else
      has_variant_inventory := false;
    end if;

    if has_variant_inventory then
      if stock_row.on_hand - stock_row.reserved < item.qty_meters then
        raise exception 'insufficient variant inventory' using errcode = '22023';
      end if;
      update public.variant_inventory
      set reserved = reserved + item.qty_meters
      where variant_id = item.variant_id;
    else
      select i.on_hand, i.reserved into stock_row
      from public.inventory i where i.product_id = item.product_id
      for update;
      if not found or stock_row.on_hand - stock_row.reserved < item.qty_meters then
        raise exception 'insufficient inventory' using errcode = '22023';
      end if;
      update public.inventory
      set reserved = reserved + item.qty_meters
      where product_id = item.product_id;
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, product_sku, variant_name,
      quantity_meters, unit_price, line_total
    ) values (
      new_order.id, item.product_id, item.variant_id, item_product_name, item_product_sku,
      item_variant_name, item.qty_meters, unit_price, line_total
    );
    insert into public.inventory_reservations (
      order_id, product_id, variant_id, inventory_scope, quantity_meters, expires_at
    ) values (
      new_order.id, item.product_id, item.variant_id,
      case when has_variant_inventory then 'variant' else 'product' end,
      item.qty_meters, reservation_expires_at
    );
  end loop;

  update public.shipping_quotes set consumed_at = now() where id = quote_row.id;

  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
  values ('order.created', 'order', new_order.id::text,
    jsonb_build_object('order_id', new_order.id, 'order_number', new_order.order_number));

  if p_user_id is not null then
    insert into public.idempotency_keys (
      user_id, request_key, request_hash, response, expires_at,
      scope, response_status, resource_id
    ) values (
      p_user_id, 'checkout:' || p_idempotency_key, p_request_hash,
      jsonb_build_object('order_id', new_order.id), now() + interval '7 days',
      'checkout', 201, new_order.id
    ) on conflict (user_id, request_key) do update
      set response = excluded.response,
          response_status = excluded.response_status,
          resource_id = excluded.resource_id,
          expires_at = excluded.expires_at;
  end if;

  return jsonb_build_object(
    'id', new_order.id,
    'orderNumber', new_order.order_number,
    'status', new_order.status,
    'subtotal', new_order.subtotal,
    'shippingCost', new_order.shipping_cost,
    'grandTotal', new_order.grand_total,
    'paymentExpiresAt', new_order.payment_expires_at,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.create_checkout_order(uuid, uuid, text, text, text, uuid, jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.create_checkout_order(uuid, uuid, text, text, text, uuid, jsonb, jsonb, text, text)
  to service_role;

comment on function public.create_checkout_order(uuid, uuid, text, text, text, uuid, jsonb, jsonb, text, text)
  is 'Creates an order and reserves stock atomically from trusted server code using database prices and a server-stored shipping quote.';
