-- Une commande confirmée mais déjà expédiée, refusée ou retournée
-- ne peut plus réserver un envoi Ozone. Le verrou admin + confirmé reste.

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
  if v.shipment_status not in ('pending', 'prepared') then
    raise exception 'already_shipped' using errcode = 'P0001';
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
