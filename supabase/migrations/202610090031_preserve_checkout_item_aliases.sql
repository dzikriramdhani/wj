-- Keep the snake_case aliases used by the PL/pgSQL item record while reading
-- the camelCase fields that arrive from the checkout API.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.create_checkout_order(uuid,uuid,text,text,text,uuid,jsonb,jsonb,text,text)'::regprocedure
  ) into function_definition;

  function_definition := replace(
    function_definition,
    'select parsed."productId", parsed."variantId", sum(parsed."qtyMeters")::numeric(12, 2) as qty_meters',
    'select parsed."productId" as product_id, parsed."variantId" as variant_id, sum(parsed."qtyMeters")::numeric(12, 2) as qty_meters'
  );

  execute function_definition;
end;
$$;
