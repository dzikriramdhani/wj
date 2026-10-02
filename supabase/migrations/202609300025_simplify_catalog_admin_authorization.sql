-- The historical catalog function recognised Content Admin. The platform now
-- has only user, admin, and super_admin, so catalog writes are operational
-- Admin work while retaining Super Admin access.
create or replace function public.admin_save_catalog_product(
  p_actor_user_id uuid,
  p_product_id uuid,
  p_category_id uuid,
  p_name text,
  p_slug text,
  p_sku text,
  p_composition text,
  p_gsm integer,
  p_width_cm integer,
  p_description text,
  p_price_per_meter numeric,
  p_stock_meters numeric,
  p_moq_retail numeric,
  p_shipping_weight_grams_per_meter integer,
  p_is_custom_only boolean,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_product_id uuid;
  current_price_id uuid;
  current_price numeric;
  current_reserved numeric;
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_actor_user_id
      and r.name in ('admin'::public.platform_role, 'super_admin'::public.platform_role)
  ) then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if p_category_id is null or not exists (
    select 1 from public.categories c where c.id = p_category_id and c.is_active
  ) then
    raise exception 'active category required' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(trim(p_name)) > 200 then
    raise exception 'invalid product name' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_slug, ''))) < 3 or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid product slug' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_sku, ''))) < 2 or char_length(trim(p_sku)) > 120 then
    raise exception 'invalid SKU' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_composition, ''))) < 2
    or p_gsm is null or p_gsm <= 0
    or p_width_cm is null or p_width_cm <= 0
    or char_length(trim(coalesce(p_description, ''))) < 10
    or p_price_per_meter is null or p_price_per_meter < 0
    or p_stock_meters is null or p_stock_meters < 0
    or p_moq_retail is null or p_moq_retail < 0
    or p_shipping_weight_grams_per_meter is null or p_shipping_weight_grams_per_meter <= 0 then
    raise exception 'invalid catalog product values' using errcode = '22023';
  end if;

  if p_product_id is null then
    insert into public.products (
      category_id, name, slug, sku, composition, gsm, width_cm, description,
      moq_retail, shipping_weight_grams_per_meter, is_custom_only, is_active, published_at
    ) values (
      p_category_id, trim(p_name), p_slug, trim(p_sku), trim(p_composition), p_gsm, p_width_cm,
      trim(p_description), p_moq_retail, p_shipping_weight_grams_per_meter,
      coalesce(p_is_custom_only, false), coalesce(p_is_active, true),
      case when coalesce(p_is_active, true) then now() else null end
    ) returning id into saved_product_id;

    insert into public.product_prices (
      product_id, price_tier, currency, price_per_meter, min_quantity
    ) values (saved_product_id, 'retail', 'IDR', p_price_per_meter, 0);

    insert into public.inventory (product_id, on_hand, reserved)
    values (saved_product_id, p_stock_meters, 0);
  else
    select p.id into saved_product_id
    from public.products p
    where p.id = p_product_id
    for update;
    if saved_product_id is null then
      raise exception 'product not found' using errcode = 'P0002';
    end if;

    select pp.id, pp.price_per_meter into current_price_id, current_price
    from public.product_prices pp
    where pp.product_id = saved_product_id
      and pp.price_tier = 'retail'
      and pp.organization_id is null
      and pp.min_quantity = 0
      and pp.valid_from <= now()
      and (pp.valid_until is null or pp.valid_until > now())
    order by pp.valid_from desc
    limit 1
    for update;

    select i.reserved into current_reserved
    from public.inventory i
    where i.product_id = saved_product_id
    for update;
    if current_reserved is not null and p_stock_meters < current_reserved then
      raise exception 'stock cannot be lower than reserved quantity' using errcode = '22023';
    end if;

    update public.products
    set category_id = p_category_id,
        name = trim(p_name),
        slug = p_slug,
        sku = trim(p_sku),
        composition = trim(p_composition),
        gsm = p_gsm,
        width_cm = p_width_cm,
        description = trim(p_description),
        moq_retail = p_moq_retail,
        shipping_weight_grams_per_meter = p_shipping_weight_grams_per_meter,
        is_custom_only = coalesce(p_is_custom_only, false),
        is_active = coalesce(p_is_active, true),
        published_at = case
          when coalesce(p_is_active, true) then coalesce(published_at, now())
          else published_at
        end
    where id = saved_product_id;

    if current_price_id is null then
      insert into public.product_prices (
        product_id, price_tier, currency, price_per_meter, min_quantity
      ) values (saved_product_id, 'retail', 'IDR', p_price_per_meter, 0);
    elsif current_price <> p_price_per_meter then
      update public.product_prices set valid_until = now() where id = current_price_id;
      insert into public.product_prices (
        product_id, price_tier, currency, price_per_meter, min_quantity
      ) values (saved_product_id, 'retail', 'IDR', p_price_per_meter, 0);
    end if;

    if current_reserved is null then
      insert into public.inventory (product_id, on_hand, reserved)
      values (saved_product_id, p_stock_meters, 0);
    else
      update public.inventory set on_hand = p_stock_meters where product_id = saved_product_id;
    end if;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_user_id,
    case when p_product_id is null then 'catalog.product_created' else 'catalog.product_updated' end,
    'product', saved_product_id::text,
    jsonb_build_object('sku', trim(p_sku), 'is_active', coalesce(p_is_active, true))
  );

  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
  values (
    case when p_product_id is null then 'catalog.product_created' else 'catalog.product_updated' end,
    'product', saved_product_id::text,
    jsonb_build_object('product_id', saved_product_id, 'actor_user_id', p_actor_user_id)
  );

  return saved_product_id;
end;
$$;

revoke all on function public.admin_save_catalog_product(
  uuid, uuid, uuid, text, text, text, text, integer, integer, text, numeric,
  numeric, numeric, integer, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.admin_save_catalog_product(
  uuid, uuid, uuid, text, text, text, text, integer, integer, text, numeric,
  numeric, numeric, integer, boolean, boolean
) to service_role;

comment on function public.admin_save_catalog_product is
  'Server-only Admin and Super Admin catalog write that atomically saves product, retail price, inventory, audit log, and outbox event.';
