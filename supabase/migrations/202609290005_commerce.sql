-- Phase 2 commerce persistence. All writes to these tables are server-owned;
-- checkout/payment operations will be added as transactional RPCs in follow-up
-- migrations before the storefront enables order creation.

create sequence public.order_number_seq;

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 32),
  address_line text not null check (char_length(address_line) between 10 and 500),
  province_id text not null,
  province_name text not null,
  city_id text not null,
  city_name text not null,
  district_id text,
  district_name text,
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index addresses_one_default_per_user
  on public.addresses (user_id) where is_default;
create index addresses_user_idx on public.addresses (user_id, created_at desc);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  guest_session_id uuid,
  status text not null default 'active' check (status in ('active', 'converted', 'abandoned')),
  currency char(3) not null default 'IDR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is not null) <> (guest_session_id is not null))
);

create unique index carts_one_active_per_user
  on public.carts (user_id) where user_id is not null and status = 'active';
create unique index carts_one_active_per_guest
  on public.carts (guest_session_id) where guest_session_id is not null and status = 'active';

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  quantity_meters numeric(12, 2) not null check (quantity_meters > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (cart_id, product_id, variant_id)
);

create table public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  guest_session_id uuid,
  address_id uuid references public.addresses(id) on delete set null,
  provider text not null check (char_length(provider) between 2 and 60),
  courier_code text not null,
  courier_name text not null,
  service_code text not null,
  service_name text not null,
  destination_city_id text not null,
  total_cost numeric(14, 2) not null check (total_cost >= 0),
  currency char(3) not null default 'IDR',
  provider_reference text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((user_id is not null) <> (guest_session_id is not null))
);

create index shipping_quotes_owner_expiry_idx
  on public.shipping_quotes (user_id, expires_at desc) where user_id is not null;
create index shipping_quotes_guest_expiry_idx
  on public.shipping_quotes (guest_session_id, expires_at desc) where guest_session_id is not null;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'WJ-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-' ||
    lpad(nextval('public.order_number_seq')::text, 8, '0')
  ),
  user_id uuid references public.profiles(id) on delete set null,
  guest_session_id uuid,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text not null,
  customer_phone text,
  status text not null default 'PENDING_PAYMENT'
    check (status in ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED',
      'DELIVERED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED')),
  currency char(3) not null default 'IDR' check (currency = 'IDR'),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  shipping_cost numeric(14, 2) not null check (shipping_cost >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  grand_total numeric(14, 2) not null check (grand_total >= 0),
  shipping_quote_id uuid references public.shipping_quotes(id) on delete set null,
  shipping_address_snapshot jsonb not null check (jsonb_typeof(shipping_address_snapshot) = 'object'),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 200),
  payment_expires_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is not null) <> (guest_session_id is not null)),
  check (grand_total = subtotal + shipping_cost + tax_amount - discount_amount)
);

create unique index orders_user_idempotency_idx
  on public.orders (user_id, idempotency_key) where user_id is not null;
create unique index orders_guest_idempotency_idx
  on public.orders (guest_session_id, idempotency_key) where guest_session_id is not null;
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at);
create index orders_payment_expiry_idx on public.orders (payment_expires_at) where status = 'PENDING_PAYMENT';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  product_sku text not null,
  variant_name text,
  quantity_meters numeric(12, 2) not null check (quantity_meters > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) not null check (line_total = round(quantity_meters * unit_price, 2)),
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  quantity_meters numeric(12, 2) not null check (quantity_meters > 0),
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'released', 'expired')),
  expires_at timestamptz not null,
  committed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique nulls not distinct (order_id, product_id, variant_id)
);

create index inventory_reservations_expiry_idx
  on public.inventory_reservations (expires_at) where status = 'reserved';
create index inventory_reservations_product_idx
  on public.inventory_reservations (product_id, status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('midtrans')),
  provider_transaction_id text,
  provider_order_id text not null unique,
  amount numeric(14, 2) not null check (amount >= 0),
  currency char(3) not null default 'IDR' check (currency = 'IDR'),
  status text not null default 'pending'
    check (status in ('pending', 'capture', 'settlement', 'deny', 'cancel', 'expire', 'failure', 'refund', 'partial_refund')),
  payment_type text,
  payment_url text,
  provider_response_code text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payments_provider_transaction_idx
  on public.payments (provider, provider_transaction_id) where provider_transaction_id is not null;
create index payments_order_created_idx on public.payments (order_id, created_at desc);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  provider text not null,
  event_fingerprint text not null unique,
  transaction_status text,
  fraud_status text,
  signature_valid boolean not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now()
);

create index payment_events_order_idx on public.payment_events (order_id, received_at desc);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  provider text not null,
  courier_code text not null,
  courier_name text not null,
  service_code text not null,
  service_name text not null,
  tracking_number text,
  status text not null default 'pending' check (status in ('pending', 'booked', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RFQ already introduced shared idempotency and outbox tables. Extend them
-- compatibly so the commerce pipeline can use the same durable primitives.
alter table public.idempotency_keys
  add column scope text not null default 'rfq'
    check (char_length(scope) between 1 and 80),
  add column response_status integer,
  add column resource_id uuid;

create index idempotency_keys_expiry_idx
  on public.idempotency_keys (expires_at);

alter table public.outbox_events
  add column status text not null default 'pending'
    check (status in ('pending', 'processing', 'published', 'failed')),
  add column available_at timestamptz not null default now(),
  add column last_error text;

update public.outbox_events set status = 'published' where processed_at is not null;

create index outbox_events_delivery_idx
  on public.outbox_events (available_at, created_at)
  where status in ('pending', 'failed');

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  recipient_email text not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index email_outbox_delivery_idx on public.email_outbox (available_at, created_at) where status in ('pending', 'failed');

create trigger addresses_set_updated_at before update on public.addresses
  for each row execute function private.set_updated_at();
create trigger carts_set_updated_at before update on public.carts
  for each row execute function private.set_updated_at();
create trigger cart_items_set_updated_at before update on public.cart_items
  for each row execute function private.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();
create trigger shipments_set_updated_at before update on public.shipments
  for each row execute function private.set_updated_at();

alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.shipping_quotes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.shipments enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.outbox_events enable row level security;
alter table public.email_outbox enable row level security;

grant select, insert, update, delete on public.addresses to authenticated;
grant select on public.carts, public.cart_items, public.shipping_quotes, public.orders,
  public.order_items, public.payments, public.shipments to authenticated;
revoke all on public.inventory_reservations, public.payment_events, public.idempotency_keys,
  public.outbox_events, public.email_outbox from anon, authenticated;
revoke insert, update, delete on public.carts, public.cart_items, public.shipping_quotes,
  public.orders, public.order_items, public.payments, public.shipments from anon, authenticated;
revoke all on public.addresses from anon;

create policy "owners manage their addresses" on public.addresses
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "owners read their carts" on public.carts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owners read their cart items" on public.cart_items
  for select to authenticated using (exists (
    select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())
  ));
create policy "owners read their shipping quotes" on public.shipping_quotes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owners read their orders" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id or private.is_platform_admin());
create policy "owners read their order items" on public.order_items
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = (select auth.uid()) or private.is_platform_admin())
  ));
create policy "owners read their payments" on public.payments
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = (select auth.uid()) or private.is_platform_admin())
  ));
create policy "owners read their shipments" on public.shipments
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = (select auth.uid()) or private.is_platform_admin())
  ));

comment on table public.inventory_reservations is 'Server-owned stock holds. Reservation and inventory updates must happen atomically.';
comment on table public.payment_events is 'Webhook event audit trail; signature verification and idempotency are server-owned.';
comment on table public.shipping_quotes is 'Server-verified shipping choices with expiry; clients must never submit a trusted cost.';
comment on table public.outbox_events is 'Transactional outbox for asynchronous order, payment, shipment, and notification work.';
