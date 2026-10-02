-- Public catalog data. Inventory mutation is intentionally reserved for
-- transactional server-side operations in a later commerce migration.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 200),
  slug text not null unique,
  sku text not null unique,
  composition text not null,
  gsm integer not null check (gsm > 0),
  width_cm integer not null check (width_cm > 0),
  description text not null default '',
  certifications text[] not null default '{}',
  moq_retail numeric(12, 2) not null default 1 check (moq_retail >= 0),
  is_custom_only boolean not null default false,
  is_active boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_active_idx on public.products (category_id, is_active, name);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique,
  color_name text not null,
  color_hex text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, color_name)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  position integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, storage_path)
);

create unique index one_primary_image_per_product
  on public.product_images (product_id) where is_primary;

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  price_tier text not null default 'retail' check (price_tier in ('retail', 'business')),
  currency char(3) not null default 'IDR',
  price_per_meter numeric(14, 2) not null check (price_per_meter >= 0),
  min_quantity numeric(12, 2) not null default 0 check (min_quantity >= 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  check ((price_tier = 'business') or organization_id is null)
);

create index product_prices_lookup_idx
  on public.product_prices (product_id, price_tier, valid_from desc, valid_until);
create index product_prices_organization_idx
  on public.product_prices (organization_id, product_id) where organization_id is not null;

create table public.inventory (
  product_id uuid primary key references public.products(id) on delete cascade,
  on_hand numeric(14, 2) not null default 0 check (on_hand >= 0),
  reserved numeric(14, 2) not null default 0 check (reserved >= 0 and reserved <= on_hand),
  updated_at timestamptz not null default now()
);

create table public.variant_inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  on_hand numeric(14, 2) not null default 0 check (on_hand >= 0),
  reserved numeric(14, 2) not null default 0 check (reserved >= 0 and reserved <= on_hand),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger inventory_set_updated_at before update on public.inventory
  for each row execute function private.set_updated_at();
create trigger variant_inventory_set_updated_at before update on public.variant_inventory
  for each row execute function private.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.product_prices enable row level security;
alter table public.inventory enable row level security;
alter table public.variant_inventory enable row level security;

grant select on public.categories, public.products, public.product_variants, public.product_images, public.product_prices to anon, authenticated;

create policy "public can read active categories" on public.categories
  for select to anon, authenticated using (is_active);
create policy "public can read published products" on public.products
  for select to anon, authenticated using (is_active and published_at is not null and published_at <= now());
create policy "public can read active variants of published products" on public.product_variants
  for select to anon, authenticated using (
    is_active and exists (
      select 1 from public.products p where p.id = product_id
        and p.is_active and p.published_at is not null and p.published_at <= now()
    )
  );
create policy "public can read images of published products" on public.product_images
  for select to anon, authenticated using (
    exists (
      select 1 from public.products p where p.id = product_id
        and p.is_active and p.published_at is not null and p.published_at <= now()
    )
  );
create policy "public can read current retail prices" on public.product_prices
  for select to anon, authenticated using (
    price_tier = 'retail' and organization_id is null
    and min_quantity = 0
    and valid_from <= now() and (valid_until is null or valid_until > now())
    and exists (
      select 1 from public.products p where p.id = product_id
        and p.is_active and p.published_at is not null and p.published_at <= now()
    )
  );

create or replace function public.get_catalog_availability(p_product_ids uuid[])
returns table (product_id uuid, is_available boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(i.on_hand > i.reserved, false)
  from public.products p
  left join public.inventory i on i.product_id = p.id
  where p.id = any (coalesce(p_product_ids, '{}'::uuid[]))
    and p.is_active and p.published_at is not null and p.published_at <= now();
$$;

revoke all on function public.get_catalog_availability(uuid[]) from public;
grant execute on function public.get_catalog_availability(uuid[]) to anon, authenticated;

create or replace function public.get_admin_catalog()
returns table (
  id uuid,
  sku text,
  name text,
  category text,
  price_per_meter numeric,
  stock_meters numeric,
  is_custom_only boolean,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_platform_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
    select p.id, p.sku, p.name, c.name,
      coalesce(price.price_per_meter, 0),
      coalesce(i.on_hand - i.reserved, 0),
      p.is_custom_only, p.is_active
    from public.products p
    join public.categories c on c.id = p.category_id
    left join public.inventory i on i.product_id = p.id
    left join lateral (
      select pp.price_per_meter
      from public.product_prices pp
      where pp.product_id = p.id and pp.price_tier = 'retail'
        and pp.organization_id is null and pp.min_quantity = 0
        and pp.valid_from <= now() and (pp.valid_until is null or pp.valid_until > now())
      order by pp.valid_from desc
      limit 1
    ) price on true
    order by p.name;
end;
$$;

revoke all on function public.get_admin_catalog() from public, anon;
grant execute on function public.get_admin_catalog() to authenticated;

revoke all on public.inventory, public.variant_inventory from anon, authenticated;
revoke insert, update, delete on public.categories, public.products, public.product_variants,
  public.product_images, public.product_prices from anon, authenticated;

comment on table public.inventory is 'Private source of truth. Exposed only through approved server-side availability operations.';
comment on table public.product_prices is 'Versioned price book. Public API exposes only active retail prices.';
