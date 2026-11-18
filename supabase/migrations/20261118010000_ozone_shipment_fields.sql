-- Champs de lecture Ozone Express. Le statut SCENO, le stock et le paiement
-- ne sont pas modifiés par cette fonction.

alter table public.shipments
  add column if not exists ozone_parcel_id text,
  add column if not exists ozone_status text,
  add column if not exists ozone_status_label text,
  add column if not exists ozone_last_event_at timestamptz,
  add column if not exists ozone_synced_at timestamptz,
  add column if not exists ozone_error text;

create or replace function public.record_ozone_reading(
  p_order_id uuid,
  p_accepted boolean,
  p_error text
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

  update public.shipments
  set ozone_synced_at = now(),
      ozone_error = case
        when p_accepted then null
        else left(trim(coalesce(p_error, '')), 400)
      end
  where id = v_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.record_ozone_reading(uuid, boolean, text) from public, anon;
grant execute on function public.record_ozone_reading(uuid, boolean, text) to authenticated;
