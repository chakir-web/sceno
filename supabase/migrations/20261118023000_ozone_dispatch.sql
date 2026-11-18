-- Verrou de création Ozone et lecture enrichie.
-- N'appelle pas l'API. Ne change pas le stock. Le statut de commande
-- reste du ressort de transition_order.

alter table public.shipments
  add column if not exists ozone_dispatch_started_at timestamptz,
  add column if not exists ozone_delivery_note_ref text;

create or replace function public.claim_ozone_dispatch(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders%rowtype;
  s public.shipments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select * into v from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.confirmation_status <> 'confirmed' then
    raise exception 'not_confirmed' using errcode = 'P0001';
  end if;

  insert into public.shipments (order_id, carrier_name, tracking_number, status)
  values (v.id, 'Ozone Express', '', v.shipment_status)
  on conflict (order_id) do nothing;

  select * into s from public.shipments where order_id = v.id for update;
  if nullif(trim(s.tracking_number), '') is not null or nullif(trim(coalesce(s.ozone_parcel_id, '')), '') is not null then
    raise exception 'ozone_exists' using errcode = 'P0001';
  end if;
  if s.ozone_dispatch_started_at is not null and s.ozone_dispatch_started_at > now() - interval '2 minutes' then
    raise exception 'ozone_busy' using errcode = 'P0001';
  end if;

  update public.shipments
  set ozone_dispatch_started_at = now(),
      carrier_name = case when trim(carrier_name) = '' then 'Ozone Express' else carrier_name end
  where id = s.id;

  return jsonb_build_object('ok', true, 'shipment_status', v.shipment_status);
end;
$$;

create or replace function public.fail_ozone_dispatch(p_order_id uuid, p_error text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.shipments
  set ozone_dispatch_started_at = null,
      ozone_error = left(trim(coalesce(p_error, '')), 400),
      ozone_synced_at = now()
  where order_id = p_order_id
    and nullif(trim(tracking_number), '') is null
    and nullif(trim(coalesce(ozone_parcel_id, '')), '') is null;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.save_ozone_parcel(
  p_order_id uuid,
  p_tracking text,
  p_parcel_id text,
  p_status text,
  p_label text,
  p_event_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tracking text := trim(coalesce(p_tracking, ''));
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_tracking = '' then
    raise exception 'invalid_items' using errcode = 'P0001';
  end if;

  update public.shipments
  set carrier_name = case when trim(carrier_name) = '' then 'Ozone Express' else carrier_name end,
      tracking_number = v_tracking,
      ozone_parcel_id = nullif(trim(coalesce(p_parcel_id, '')), ''),
      ozone_status = nullif(trim(coalesce(p_status, '')), ''),
      ozone_status_label = nullif(trim(coalesce(p_label, '')), ''),
      ozone_last_event_at = p_event_at,
      ozone_synced_at = now(),
      ozone_error = null,
      ozone_dispatch_started_at = null
  where order_id = p_order_id
    and nullif(trim(tracking_number), '') is null
    and nullif(trim(coalesce(ozone_parcel_id, '')), '') is null;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'ozone_exists' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'ozone.create', 'orders', p_order_id, jsonb_build_object('tracking', v_tracking));

  return jsonb_build_object('ok', true);
end;
$$;

drop function if exists public.record_ozone_reading(uuid, boolean, text);

create or replace function public.record_ozone_reading(
  p_order_id uuid,
  p_accepted boolean,
  p_error text,
  p_status text default null,
  p_label text default null,
  p_event_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select id into v_id from public.shipments where order_id = p_order_id;
  if v_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if p_accepted then
    update public.shipments
    set ozone_synced_at = now(),
        ozone_error = null,
        ozone_status = coalesce(nullif(trim(coalesce(p_status, '')), ''), ozone_status),
        ozone_status_label = coalesce(nullif(trim(coalesce(p_label, '')), ''), ozone_status_label),
        ozone_last_event_at = coalesce(p_event_at, ozone_last_event_at)
    where id = v_id;
  else
    update public.shipments
    set ozone_synced_at = now(),
        ozone_error = left(trim(coalesce(p_error, '')), 400)
    where id = v_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.track_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v public.orders%rowtype;
  v_attempts int;
  v_items jsonb;
  v_history jsonb;
  v_carrier text;
  v_tracking text;
  v_ozone_status text;
  v_ozone_label text;
  v_ozone_event timestamptz;
  v_ozone_synced timestamptz;
begin
  v_phone := public.normalize_phone(coalesce(p_phone, ''));
  if v_phone is null or char_length(trim(coalesce(p_order_number, ''))) < 4 then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;

  delete from public.track_lookup_attempts
    where phone_normalized = v_phone and created_at < now() - interval '1 day';
  insert into public.track_lookup_attempts (phone_normalized) values (v_phone);
  select count(*) into v_attempts
    from public.track_lookup_attempts
    where phone_normalized = v_phone and created_at > now() - interval '15 minutes';
  if v_attempts > 8 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select * into v
    from public.orders
    where order_number = upper(trim(p_order_number))
      and phone_normalized = v_phone;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name_fr', name_fr,
    'name_ar', name_ar,
    'variant_label', variant_label,
    'quantity', quantity,
    'line_total_mad', line_total_mad
  )), '[]'::jsonb) into v_items
  from public.order_items where order_id = v.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', kind,
    'from_status', from_status,
    'to_status', to_status,
    'created_at', created_at
  ) order by created_at), '[]'::jsonb) into v_history
  from public.order_status_history
  where order_id = v.id and kind in ('confirmation', 'shipment');

  select carrier_name, nullif(tracking_number, ''), ozone_status, ozone_status_label, ozone_last_event_at, ozone_synced_at
    into v_carrier, v_tracking, v_ozone_status, v_ozone_label, v_ozone_event, v_ozone_synced
    from public.shipments where order_id = v.id;

  return jsonb_build_object(
    'order_number', v.order_number,
    'created_at', v.created_at,
    'locale', v.locale,
    'items', v_items,
    'history', coalesce(v_history, '[]'::jsonb),
    'subtotal_mad', v.subtotal_mad,
    'shipping_fee_mad', v.shipping_fee_mad,
    'total_mad', v.total_mad,
    'confirmation_status', v.confirmation_status,
    'shipment_status', v.shipment_status,
    'payment_status', v.payment_status,
    'carrier_name', v_carrier,
    'tracking_number', v_tracking,
    'ozone_status', v_ozone_status,
    'ozone_status_label', v_ozone_label,
    'ozone_last_event_at', v_ozone_event,
    'ozone_synced_at', v_ozone_synced
  );
end;
$$;

create or replace function public.save_ozone_delivery_note(p_order_id uuid, p_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.shipments%rowtype;
  v_ref text := left(trim(coalesce(p_ref, '')), 80);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_ref = '' then
    raise exception 'invalid_items' using errcode = 'P0001';
  end if;
  select * into s from public.shipments where order_id = p_order_id for update;
  if not found or nullif(trim(s.tracking_number), '') is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(s.ozone_delivery_note_ref, '')), '') is not null then
    return jsonb_build_object('ok', true, 'ref', s.ozone_delivery_note_ref, 'reused', true);
  end if;
  update public.shipments
  set ozone_delivery_note_ref = v_ref
  where id = s.id;
  return jsonb_build_object('ok', true, 'ref', v_ref, 'reused', false);
end;
$$;

revoke all on function public.claim_ozone_dispatch(uuid) from public, anon;
revoke all on function public.save_ozone_delivery_note(uuid, text) from public, anon;
revoke all on function public.fail_ozone_dispatch(uuid, text) from public, anon;
revoke all on function public.save_ozone_parcel(uuid, text, text, text, text, timestamptz) from public, anon;
revoke all on function public.record_ozone_reading(uuid, boolean, text, text, text, timestamptz) from public, anon;
grant execute on function public.claim_ozone_dispatch(uuid) to authenticated;
grant execute on function public.fail_ozone_dispatch(uuid, text) to authenticated;
grant execute on function public.save_ozone_parcel(uuid, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.record_ozone_reading(uuid, boolean, text, text, text, timestamptz) to authenticated;
grant execute on function public.save_ozone_delivery_note(uuid, text) to authenticated;
