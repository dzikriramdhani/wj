-- Checkout sends camelCase JSON keys from the API. PostgreSQL preserves the
-- quoted key names created by jsonb_to_recordset, so the function must refer
-- to those names with quotes instead of the snake_case SQL aliases.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.create_checkout_order(uuid,uuid,text,text,text,uuid,jsonb,jsonb,text,text)'::regprocedure
  ) into function_definition;

  function_definition := replace(function_definition, 'parsed.product_id', 'parsed."productId"');
  function_definition := replace(function_definition, 'parsed.variant_id', 'parsed."variantId"');
  function_definition := replace(function_definition, 'parsed.qty_meters', 'parsed."qtyMeters"');

  execute function_definition;
end;
$$;
