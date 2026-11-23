-- Livraison offerte pour le client. Un frais exceptionnel reste possible depuis l'administration.
update public.shipping_rates set fee_mad = 0 where fee_mad <> 0;
update public.store_settings set default_shipping_fee_mad = 0 where default_shipping_fee_mad <> 0;

create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_phone text;
  v_city text;
  v_address text;
  v_notes text;
  v_locale text;
  v_key uuid;
  v_existing public.orders%rowtype;
  v_requested int := 0;
  v_locked int := 0;
  r record;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2);
  v_default_fee numeric(12,2);
  v_customer_id uuid;
  v_order_id uuid;
  v_number text;
  v_try int;
begin
  v_name := trim(coalesce(payload->>'full_name', ''));
  v_city := trim(coalesce(payload->>'city', ''));
  v_address := trim(coalesce(payload->>'address', ''));
  v_notes := left(trim(coalesce(payload->>'notes', '')), 500);
  v_locale := case when payload->>'locale' = 'ar' then 'ar' else 'fr' end;
  v_phone := public.normalize_phone(coalesce(payload->>'phone', ''));

  if v_phone is null then raise exception 'invalid_phone' using errcode = 'P0001'; end if;
  if char_length(v_name) < 3 or char_length(v_name) > 120 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if char_length(v_city) < 2 or char_length(v_city) > 80 then raise exception 'invalid_city' using errcode = 'P0001'; end if;
  if char_length(v_address) < 5 or char_length(v_address) > 300 then raise exception 'invalid_address' using errcode = 'P0001'; end if;

  begin
    v_key := (payload->>'idempotency_key')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid_idempotency' using errcode = 'P0001';
  end;

  select * into v_existing from public.orders where idempotency_key = v_key;
  if found then
    if v_existing.phone_normalized <> v_phone then
      raise exception 'invalid_idempotency' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'order_id', v_existing.id,
      'order_number', v_existing.order_number,
      'subtotal_mad', v_existing.subtotal_mad,
      'shipping_fee_mad', v_existing.shipping_fee_mad,
      'total_mad', v_existing.total_mad,
      'replayed', true
    );
  end if;

  if (select count(*) from public.orders where phone_normalized = v_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if jsonb_typeof(payload->'items') is distinct from 'array'
     or jsonb_array_length(payload->'items') < 1
     or jsonb_array_length(payload->'items') > 30 then
    raise exception 'invalid_items' using errcode = 'P0001';
  end if;

  begin
    select count(*) into v_requested from (
      select (item->>'variant_id')::uuid
      from jsonb_array_elements(payload->'items') item
      group by 1
    ) requested;
  exception when invalid_text_representation then
    raise exception 'invalid_items' using errcode = 'P0001';
  end;

  for r in
    select
      req.quantity,
      v.id as variant_id,
      v.product_id,
      v.stock_quantity,
      v.sku,
      nullif(trim(coalesce(v.size, '')), '') as size,
      nullif(trim(coalesce(v.color, '')), '') as color,
      coalesce(
        v.price_mad,
        case
          when p.promo_price_mad is not null and p.promo_price_mad < p.price_mad then p.promo_price_mad
          else p.price_mad
        end
      ) as unit_price,
      coalesce((select t.name from public.product_translations t where t.product_id = p.id and t.locale = 'fr' limit 1), p.sku) as name_fr,
      coalesce((select t.name from public.product_translations t where t.product_id = p.id and t.locale = 'ar' limit 1), p.sku) as name_ar
    from (
      select
        (item->>'variant_id')::uuid as variant_id,
        (item->>'product_id')::uuid as product_id,
        sum((item->>'quantity')::int)::int as quantity
      from jsonb_array_elements(payload->'items') item
      group by 1, 2
    ) req
    join public.product_variants v on v.id = req.variant_id and v.product_id = req.product_id
    join public.products p on p.id = v.product_id
    where v.is_active and p.is_active and req.quantity between 1 and 20
    order by v.id
    for update of v
  loop
    if r.stock_quantity < r.quantity or r.unit_price < 0 then
      raise exception 'insufficient_stock' using errcode = 'P0001';
    end if;
    v_locked := v_locked + 1;
    v_subtotal := v_subtotal + round(r.unit_price * r.quantity, 2);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'quantity', r.quantity,
      'variant_id', r.variant_id,
      'product_id', r.product_id,
      'sku', r.sku,
      'size', r.size,
      'color', r.color,
      'unit_price', r.unit_price,
      'name_fr', r.name_fr,
      'name_ar', r.name_ar
    ));
  end loop;

  if v_locked = 0 or v_locked <> v_requested then
    raise exception 'product_unavailable' using errcode = 'P0001';
  end if;

  v_shipping := 0;

  insert into public.customers (full_name, phone_normalized, city, address)
  values (v_name, v_phone, v_city, v_address)
  on conflict (phone_normalized) do update
    set full_name = excluded.full_name,
        city = excluded.city,
        address = excluded.address,
        updated_at = now()
  returning id into v_customer_id;

  v_number := null;
  for v_try in 1..6 loop
    v_number := 'SC-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from public.orders where order_number = v_number);
    v_number := null;
  end loop;
  if v_number is null then
    raise exception 'generic' using errcode = 'P0001';
  end if;

  insert into public.orders (
    order_number, customer_id, full_name, phone_normalized, city, address, customer_notes,
    locale, confirmation_status, shipment_status, payment_status, payment_method,
    subtotal_mad, shipping_fee_mad, total_mad, idempotency_key
  ) values (
    v_number, v_customer_id, v_name, v_phone, v_city, v_address, nullif(v_notes, ''),
    v_locale, 'new', 'pending', 'pending', 'cod',
    v_subtotal, v_shipping, round(v_subtotal + v_shipping, 2), v_key
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(v_lines)
  loop
    insert into public.order_items (
      order_id, product_id, variant_id, name_fr, name_ar, variant_label, sku,
      unit_price_mad, quantity, line_total_mad
    ) values (
      v_order_id,
      (v_line->>'product_id')::uuid,
      (v_line->>'variant_id')::uuid,
      v_line->>'name_fr',
      v_line->>'name_ar',
      nullif(concat_ws(' / ', nullif(v_line->>'size', ''), nullif(v_line->>'color', '')), ''),
      v_line->>'sku',
      round((v_line->>'unit_price')::numeric, 2),
      (v_line->>'quantity')::int,
      round((v_line->>'unit_price')::numeric * (v_line->>'quantity')::int, 2)
    );
    update public.product_variants
      set stock_quantity = stock_quantity - (v_line->>'quantity')::int
      where id = (v_line->>'variant_id')::uuid;
    insert into public.inventory_movements (product_id, variant_id, quantity_delta, reason, order_id)
    values (
      (v_line->>'product_id')::uuid,
      (v_line->>'variant_id')::uuid,
      - (v_line->>'quantity')::int,
      'order_created',
      v_order_id
    );
  end loop;

  insert into public.order_status_history (order_id, kind, to_status, note)
  values (v_order_id, 'confirmation', 'new', 'created');

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    auth.uid(),
    'order.create',
    'orders',
    v_order_id,
    jsonb_build_object('order_number', v_number, 'total_mad', round(v_subtotal + v_shipping, 2))
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_number,
    'subtotal_mad', v_subtotal,
    'shipping_fee_mad', v_shipping,
    'total_mad', round(v_subtotal + v_shipping, 2),
    'replayed', false
  );
exception
  when invalid_text_representation then
    raise exception 'invalid_items' using errcode = 'P0001';
end;
$$;

create or replace function public.update_order_delivery(
  p_order_id uuid,
  p_city text,
  p_address text,
  p_manual_shipping numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders%rowtype;
  v_city text := trim(coalesce(p_city, ''));
  v_address text := trim(coalesce(p_address, ''));
  v_fee numeric(12,2);
  v_default numeric(12,2);
begin
  if char_length(v_city) < 2 or char_length(v_address) < 5 then
    raise exception 'invalid_address' using errcode = 'P0001';
  end if;
  select * into v from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  if public.is_admin() then
    null;
  elsif public.is_confirmer() and v.assigned_confirmer_id = auth.uid() then
    if p_manual_shipping is not null then raise exception 'forbidden' using errcode = 'P0001'; end if;
  else
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  if v.shipment_status in ('pending', 'prepared') then
    if public.is_admin() and p_manual_shipping is not null then
      if p_manual_shipping < 0 then raise exception 'forbidden' using errcode = 'P0001'; end if;
      v_fee := round(p_manual_shipping, 2);
    else
      v_fee := 0;
    end if;
    update public.orders
      set city = v_city,
          address = v_address,
          shipping_fee_mad = v_fee,
          total_mad = round(subtotal_mad + v_fee, 2)
      where id = v.id;
  else
    update public.orders set city = v_city, address = v_address where id = v.id;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'order.delivery', 'orders', v.id, jsonb_build_object('city', v_city));
  return jsonb_build_object('ok', true);
end;
$$;
