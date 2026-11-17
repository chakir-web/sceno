-- Journal d'audit appelable par un administrateur authentifié.
create or replace function public.write_audit(p_action text, p_entity text, p_entity_id uuid, p_metadata jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), left(coalesce(p_action, ''), 80), left(coalesce(p_entity, ''), 80), p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.write_audit(text, text, uuid, jsonb) from public;
grant execute on function public.write_audit(text, text, uuid, jsonb) to authenticated;
