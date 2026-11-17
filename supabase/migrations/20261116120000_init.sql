-- SCENO — schéma initial.
-- Rôles applicatifs : admin, confirmer, customer.
-- Aucun rôle livreur. L'expédition est externe et gérée par l'administrateur.
-- Les prix et le stock d'une commande sont calculés ici, jamais à partir du navigateur.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_phone(input text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  d := regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g');
  if d like '+212%' then
    d := '0' || substr(d, 5);
  elsif d like '00212%' then
    d := '0' || substr(d, 6);
  elsif d like '212%' and char_length(d) = 12 then
    d := '0' || substr(d, 4);
  end if;
  if d ~ '^0[5-8][0-9]{8}$' then
    return d;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer' check (role in ('admin', 'confirmer', 'customer')),
  full_name text not null default '',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  singleton boolean not null default true unique check (singleton),
  store_name text not null default 'SCENO',
  support_phone text not null default '',
  support_email text not null default '',
  address text not null default '',
  currency text not null default 'MAD' check (currency = 'MAD'),
  default_locale text not null default 'fr' check (default_locale in ('fr', 'ar')),
  default_shipping_fee_mad numeric(12,2) not null default 49 check (default_shipping_fee_mad >= 0),
  about_fr text not null default '',
  about_ar text not null default '',
  instagram text not null default '',
  facebook text not null default '',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  city text not null unique,
  fee_mad numeric(12,2) not null check (fee_mad >= 0),
  zone text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.category_translations (
  category_id uuid not null references public.categories (id) on delete cascade,
  locale text not null check (locale in ('fr', 'ar')),
  name text not null,
  description text not null default '',
  primary key (category_id, locale)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete restrict,
  slug text not null unique,
  sku text not null unique,
  price_mad numeric(12,2) not null check (price_mad >= 0),
  promo_price_mad numeric(12,2) check (promo_price_mad is null or promo_price_mad >= 0),
  selling_price_mad numeric(12,2) generated always as (
    case
      when promo_price_mad is not null and promo_price_mad < price_mad then promo_price_mad
      else price_mad
    end
  ) stored,
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_new boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_translations (
  product_id uuid not null references public.products (id) on delete cascade,
  locale text not null check (locale in ('fr', 'ar')),
  name text not null,
  short_description text not null default '',
  description text not null default '',
  primary key (product_id, locale)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  alt text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  size text,
  color text,
  color_hex text,
  price_mad numeric(12,2) check (price_mad is null or price_mad >= 0),
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_normalized text not null unique,
  city text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.carriers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  full_name text not null,
  phone_normalized text not null,
  city text not null,
  address text not null,
  customer_notes text,
  locale text not null default 'fr' check (locale in ('fr', 'ar')),
  confirmation_status text not null default 'new' check (
    confirmation_status in ('new', 'confirming', 'confirmed', 'cancelled', 'unreachable')
  ),
  shipment_status text not null default 'pending' check (
    shipment_status in ('pending', 'prepared', 'shipped', 'in_transit', 'delivered', 'absent', 'postponed', 'refused', 'returned')
  ),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'collected', 'reversed')),
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  subtotal_mad numeric(12,2) not null check (subtotal_mad >= 0),
  shipping_fee_mad numeric(12,2) not null check (shipping_fee_mad >= 0),
  total_mad numeric(12,2) not null check (total_mad >= 0),
  assigned_confirmer_id uuid references public.profiles (id) on delete set null,
  stock_restored boolean not null default false,
  idempotency_key uuid unique,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete restrict,
  variant_id uuid references public.product_variants (id) on delete restrict,
  name_fr text not null,
  name_ar text not null,
  variant_label text,
  sku text not null,
  unit_price_mad numeric(12,2) not null check (unit_price_mad >= 0),
  quantity int not null check (quantity > 0),
  line_total_mad numeric(12,2) not null check (line_total_mad >= 0)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('confirmation', 'shipment', 'payment', 'assignment')),
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.order_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  confirmer_id uuid not null references public.profiles (id) on delete restrict,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  released_at timestamptz
);

create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 2 and 1000),
  created_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  carrier_id uuid references public.carriers (id) on delete set null,
  carrier_name text not null default '',
  tracking_number text not null default '',
  status text not null default 'pending' check (
    status in ('pending', 'prepared', 'shipped', 'in_transit', 'delivered', 'absent', 'postponed', 'refused', 'returned')
  ),
  carrier_fee_mad numeric(12,2) check (carrier_fee_mad is null or carrier_fee_mad >= 0),
  shipped_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  quantity_delta int not null,
  reason text not null check (
    reason in ('order_created', 'order_cancelled', 'order_returned', 'restock', 'adjustment', 'correction')
  ),
  order_id uuid references public.orders (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.track_lookup_attempts (
  id uuid primary key default gen_random_uuid(),
  phone_normalized text not null,
  created_at timestamptz not null default now()
);

create index orders_phone_idx on public.orders (phone_normalized);
create index orders_confirmation_idx on public.orders (confirmation_status);
create index orders_shipment_idx on public.orders (shipment_status);
create index orders_created_idx on public.orders (created_at desc);
create index orders_confirmer_idx on public.orders (assigned_confirmer_id);
create index products_category_idx on public.products (category_id);
create index products_created_idx on public.products (created_at desc);
create index variants_product_idx on public.product_variants (product_id);
create index movements_created_idx on public.inventory_movements (created_at desc);
create index track_attempts_idx on public.track_lookup_attempts (phone_normalized, created_at desc);
create index audit_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.sync_product_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid;
begin
  v_product := coalesce(new.product_id, old.product_id);
  update public.products
    set stock_quantity = coalesce((
      select sum(stock_quantity)::int from public.product_variants
      where product_id = v_product and is_active
    ), 0)
    where id = v_product;
  return null;
end;
$$;

create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();
create trigger variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger customers_updated before update on public.customers
  for each row execute function public.set_updated_at();
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger settings_updated before update on public.store_settings
  for each row execute function public.set_updated_at();
create trigger carriers_updated before update on public.carriers
  for each row execute function public.set_updated_at();
create trigger rates_updated before update on public.shipping_rates
  for each row execute function public.set_updated_at();
create trigger shipments_updated before update on public.shipments
  for each row execute function public.set_updated_at();

create trigger variants_stock after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_stock();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.store_settings (store_name, about_fr, about_ar)
values (
  'SCENO',
  'SCENO est une maison d''objets pour le Maroc.',
  'SCENO دار أشياء للمغرب.'
);

-- ---------------------------------------------------------------------------
-- Role helpers. security definer pour éviter la récursion RLS.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.is_confirmer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'confirmer' and is_active
  );
$$;

create or replace function public.restore_order_stock(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restored boolean;
  r record;
begin
  if p_reason not in ('order_cancelled', 'order_returned') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select stock_restored into v_restored from public.orders where id = p_order_id for update;
  if v_restored is null or v_restored then
    return;
  end if;
  for r in select * from public.order_items where order_id = p_order_id loop
    if r.variant_id is not null then
      update public.product_variants
        set stock_quantity = stock_quantity + r.quantity
        where id = r.variant_id;
    end if;
    insert into public.inventory_movements (product_id, variant_id, quantity_delta, reason, order_id, actor_id)
    values (r.product_id, r.variant_id, r.quantity, p_reason, p_order_id, auth.uid());
  end loop;
  update public.orders set stock_restored = true where id = p_order_id;
end;
$$;

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

  select default_shipping_fee_mad into v_default_fee from public.store_settings limit 1;
  select fee_mad into v_shipping
    from public.shipping_rates
    where is_active and lower(trim(city)) = lower(trim(v_city))
    limit 1;
  if v_shipping is null then
    v_shipping := coalesce(v_default_fee, 0);
  end if;

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

create or replace function public.transition_order(p_order_id uuid, p_kind text, p_to text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders%rowtype;
  v_allowed boolean := false;
  v_payment text;
  v_current text;
  v_note text := left(trim(coalesce(p_note, '')), 500);
begin
  select * into v from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  if p_kind = 'shipment' then
    if not public.is_admin() then raise exception 'forbidden' using errcode = 'P0001'; end if;
    if v.confirmation_status <> 'confirmed' then raise exception 'forbidden' using errcode = 'P0001'; end if;
    v_allowed := case
      when v.shipment_status = 'pending' and p_to in ('prepared', 'shipped') then true
      when v.shipment_status = 'prepared' and p_to in ('pending', 'shipped') then true
      when v.shipment_status = 'shipped' and p_to in ('in_transit', 'delivered', 'absent', 'postponed', 'refused', 'returned') then true
      when v.shipment_status = 'in_transit' and p_to in ('delivered', 'absent', 'postponed', 'refused', 'returned') then true
      when v.shipment_status = 'absent' and p_to in ('in_transit', 'postponed', 'returned', 'delivered') then true
      when v.shipment_status = 'postponed' and p_to in ('in_transit', 'shipped', 'returned', 'absent') then true
      when v.shipment_status = 'delivered' and p_to = 'returned' then true
      else false
    end;
  elsif p_kind = 'confirmation' then
    if public.is_admin() then
      null;
    elsif public.is_confirmer() and v.assigned_confirmer_id = auth.uid() then
      null;
    else
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
    v_allowed := case
      when v.confirmation_status = 'new' and p_to in ('confirming', 'confirmed', 'cancelled', 'unreachable') then true
      when v.confirmation_status = 'confirming' and p_to in ('new', 'confirmed', 'cancelled', 'unreachable') then true
      when v.confirmation_status = 'unreachable' and p_to in ('confirming', 'confirmed', 'cancelled') then true
      when v.confirmation_status = 'confirmed' and p_to = 'cancelled' and v.shipment_status in ('pending', 'prepared') then true
      else false
    end;
  else
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  v_current := case when p_kind = 'shipment' then v.shipment_status else v.confirmation_status end;
  if not v_allowed or p_to = v_current then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  v_payment := v.payment_status;
  if p_kind = 'shipment' and p_to = 'delivered' then
    v_payment := 'collected';
  elsif p_kind = 'shipment' and p_to in ('refused', 'returned') and v.payment_status = 'collected' then
    v_payment := 'reversed';
  end if;

  if p_kind = 'confirmation' then
    update public.orders
      set confirmation_status = p_to,
          payment_status = v_payment
      where id = v.id;
  else
    update public.orders
      set shipment_status = p_to,
          payment_status = v_payment,
          collected_at = case when p_to = 'delivered' then coalesce(collected_at, now()) else collected_at end
      where id = v.id;
    update public.shipments set status = p_to where order_id = v.id;
  end if;

  if p_kind = 'confirmation' and p_to = 'cancelled' and v.shipment_status in ('pending', 'prepared') then
    perform public.restore_order_stock(v.id, 'order_cancelled');
  elsif p_kind = 'shipment' and p_to in ('refused', 'returned') then
    perform public.restore_order_stock(v.id, 'order_returned');
  end if;

  insert into public.order_status_history (order_id, kind, from_status, to_status, actor_id, note)
  values (
    v.id,
    p_kind,
    case when p_kind = 'shipment' then v.shipment_status else v.confirmation_status end,
    p_to,
    auth.uid(),
    nullif(v_note, '')
  );

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'order.status', 'orders', v.id, jsonb_build_object('kind', p_kind, 'to', p_to));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.assign_order(p_order_id uuid, p_confirmer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.profiles where id = p_confirmer_id and role = 'confirmer' and is_active
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into v from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  update public.order_assignments
    set released_at = now()
    where order_id = v.id and released_at is null and confirmer_id <> p_confirmer_id;

  update public.orders set assigned_confirmer_id = p_confirmer_id where id = v.id;

  insert into public.order_assignments (order_id, confirmer_id, assigned_by)
  values (v.id, p_confirmer_id, auth.uid());

  insert into public.order_status_history (order_id, kind, from_status, to_status, actor_id, note)
  values (v.id, 'assignment', v.assigned_confirmer_id::text, p_confirmer_id::text, auth.uid(), 'assigned');

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'order.assign', 'orders', v.id, jsonb_build_object('confirmer_id', p_confirmer_id));

  return jsonb_build_object('ok', true);
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
      select fee_mad into v_fee from public.shipping_rates
        where is_active and lower(trim(city)) = lower(v_city) limit 1;
      if v_fee is null then
        select default_shipping_fee_mad into v_default from public.store_settings limit 1;
        v_fee := coalesce(v_default, 0);
      end if;
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

create or replace function public.add_order_note(p_order_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders%rowtype;
  v_body text := trim(coalesce(p_body, ''));
begin
  if char_length(v_body) < 2 then raise exception 'invalid_items' using errcode = 'P0001'; end if;
  select * into v from public.orders where id = p_order_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if public.is_admin() then
    null;
  elsif public.is_confirmer() and v.assigned_confirmer_id = auth.uid() then
    null;
  else
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  insert into public.order_notes (order_id, author_id, body) values (v.id, auth.uid(), left(v_body, 1000));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.adjust_stock(p_variant_id uuid, p_delta int, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.product_variants%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if p_delta = 0 or p_reason not in ('restock', 'adjustment', 'correction') then
    raise exception 'invalid_items' using errcode = 'P0001';
  end if;
  select * into v from public.product_variants where id = p_variant_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.stock_quantity + p_delta < 0 then raise exception 'insufficient_stock' using errcode = 'P0001'; end if;
  update public.product_variants set stock_quantity = stock_quantity + p_delta where id = v.id;
  insert into public.inventory_movements (product_id, variant_id, quantity_delta, reason, actor_id)
  values (v.product_id, v.id, p_delta, p_reason, auth.uid());
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'stock.adjust', 'product_variants', v.id, jsonb_build_object('delta', p_delta, 'reason', p_reason));
  return jsonb_build_object('stock_quantity', v.stock_quantity + p_delta);
end;
$$;

create or replace function public.upsert_shipment(
  p_order_id uuid,
  p_carrier_id uuid,
  p_carrier_name text,
  p_tracking text,
  p_status text,
  p_shipped_at timestamptz,
  p_carrier_fee numeric,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders%rowtype;
  v_name text := trim(coalesce(p_carrier_name, ''));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  select * into v from public.orders where id = p_order_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.confirmation_status <> 'confirmed' then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if p_carrier_id is not null and not exists (select 1 from public.carriers where id = p_carrier_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_carrier_id is not null and v_name = '' then
    select name into v_name from public.carriers where id = p_carrier_id;
  end if;

  insert into public.shipments (order_id, carrier_id, carrier_name, tracking_number, status, carrier_fee_mad, shipped_at, notes)
  values (
    v.id,
    p_carrier_id,
    coalesce(v_name, ''),
    trim(coalesce(p_tracking, '')),
    v.shipment_status,
    p_carrier_fee,
    p_shipped_at,
    left(trim(coalesce(p_note, '')), 500)
  )
  on conflict (order_id) do update
    set carrier_id = excluded.carrier_id,
        carrier_name = excluded.carrier_name,
        tracking_number = excluded.tracking_number,
        carrier_fee_mad = excluded.carrier_fee_mad,
        shipped_at = excluded.shipped_at,
        notes = excluded.notes,
        updated_at = now();

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'shipment.update', 'orders', v.id, jsonb_build_object('tracking', trim(coalesce(p_tracking, ''))));

  if p_status is not null and p_status <> '' and p_status <> v.shipment_status then
    perform public.transition_order(v.id, 'shipment', p_status, p_note);
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
  v_carrier text;
  v_tracking text;
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

  select carrier_name, nullif(tracking_number, '')
    into v_carrier, v_tracking
    from public.shipments where order_id = v.id;

  return jsonb_build_object(
    'order_number', v.order_number,
    'created_at', v.created_at,
    'locale', v.locale,
    'items', v_items,
    'subtotal_mad', v.subtotal_mad,
    'shipping_fee_mad', v.shipping_fee_mad,
    'total_mad', v.total_mad,
    'confirmation_status', v.confirmation_status,
    'shipment_status', v.shipment_status,
    'payment_status', v.payment_status,
    'carrier_name', v_carrier,
    'tracking_number', v_tracking
  );
end;
$$;

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
  v_confirmed int;
  v_decided int;
  v_delivered int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  select count(*) into v_confirmed from public.orders where confirmation_status = 'confirmed';
  select count(*) into v_decided from public.orders where confirmation_status in ('confirmed', 'cancelled', 'unreachable');
  select count(*) into v_delivered from public.orders where shipment_status = 'delivered';

  return jsonb_build_object(
    'orders_total', (select count(*) from public.orders),
    'orders_today', (select count(*) from public.orders where (created_at at time zone 'Africa/Casablanca')::date = v_today),
    'revenue_collected', (select coalesce(sum(total_mad), 0) from public.orders where payment_status = 'collected'),
    'pipeline_confirmed', (select coalesce(sum(total_mad), 0) from public.orders where confirmation_status = 'confirmed' and payment_status = 'pending'),
    'pending_confirmation', (select count(*) from public.orders where confirmation_status in ('new', 'confirming', 'unreachable')),
    'confirmed', v_confirmed,
    'shipped', (select count(*) from public.orders where shipment_status in ('shipped', 'in_transit')),
    'delivered', v_delivered,
    'cancelled', (select count(*) from public.orders where confirmation_status = 'cancelled'),
    'returned', (select count(*) from public.orders where shipment_status = 'returned'),
    'confirmation_rate', case when v_decided = 0 then null else round(v_confirmed::numeric / v_decided, 4) end,
    'delivery_rate', case when v_confirmed = 0 then null else round(v_delivered::numeric / v_confirmed, 4) end,
    'low_stock', (
      select count(*) from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.is_active and p.is_active and v.stock_quantity <= p.low_stock_threshold
    ),
    'unassigned', (select count(*) from public.orders where assigned_confirmer_id is null and confirmation_status in ('new', 'confirming')),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', day,
        'orders', orders,
        'collected', collected
      ) order by day), '[]'::jsonb)
      from (
        select
          d::date as day,
          (select count(*) from public.orders o where (o.created_at at time zone 'Africa/Casablanca')::date = d::date) as orders,
          (select coalesce(sum(o.total_mad), 0) from public.orders o where o.payment_status = 'collected' and (o.collected_at at time zone 'Africa/Casablanca')::date = d::date) as collected
        from generate_series(v_today - 13, v_today, interval '1 day') d
      ) days
    ),
    'recent_orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'order_number', order_number, 'full_name', full_name, 'total_mad', total_mad,
        'confirmation_status', confirmation_status, 'shipment_status', shipment_status, 'created_at', created_at
      ) order by created_at desc), '[]'::jsonb)
      from (select * from public.orders order by created_at desc limit 8) recent
    ),
    'popular_products', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'amount', amount) order by quantity desc), '[]'::jsonb)
      from (
        select coalesce(oi.name_fr, oi.sku) as name, sum(oi.quantity)::int as quantity, sum(oi.line_total_mad) as amount
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.confirmation_status <> 'cancelled'
        group by 1
        order by quantity desc
        limit 5
      ) top_products
    )
  );
end;
$$;

create or replace function public.admin_reports(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to > p_from + 366 then
    raise exception 'invalid_items' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'created', (select count(*) from public.orders where (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'confirmed', (select count(*) from public.orders where confirmation_status = 'confirmed' and (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'delivered', (select count(*) from public.orders where shipment_status = 'delivered' and (coalesce(collected_at, updated_at) at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'collected', (select coalesce(sum(total_mad), 0) from public.orders where payment_status = 'collected' and (collected_at at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'confirmed_amount', (select coalesce(sum(total_mad), 0) from public.orders where confirmation_status = 'confirmed' and (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'shipping_charged', (select coalesce(sum(shipping_fee_mad), 0) from public.orders where confirmation_status <> 'cancelled' and (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'carrier_fees', (select coalesce(sum(s.carrier_fee_mad), 0) from public.shipments s join public.orders o on o.id = s.order_id where (o.created_at at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'cancelled', (select count(*) from public.orders where confirmation_status = 'cancelled' and (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'refused', (select count(*) from public.orders where shipment_status = 'refused' and (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'returned', (select count(*) from public.orders where shipment_status = 'returned' and (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('period', period, 'orders', orders, 'collected', collected) order by period), '[]'::jsonb)
      from (
        select (created_at at time zone 'Africa/Casablanca')::date as period, count(*) as orders,
          coalesce(sum(total_mad) filter (where payment_status = 'collected'), 0) as collected
        from public.orders
        where (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to
        group by 1
      ) d
    ),
    'by_week', (
      select coalesce(jsonb_agg(jsonb_build_object('period', period, 'orders', orders, 'collected', collected) order by period), '[]'::jsonb)
      from (
        select date_trunc('week', created_at at time zone 'Africa/Casablanca')::date as period, count(*) as orders,
          coalesce(sum(total_mad) filter (where payment_status = 'collected'), 0) as collected
        from public.orders
        where (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to
        group by 1
      ) w
    ),
    'by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('period', period, 'orders', orders, 'collected', collected) order by period), '[]'::jsonb)
      from (
        select date_trunc('month', created_at at time zone 'Africa/Casablanca')::date as period, count(*) as orders,
          coalesce(sum(total_mad) filter (where payment_status = 'collected'), 0) as collected
        from public.orders
        where (created_at at time zone 'Africa/Casablanca')::date between p_from and p_to
        group by 1
      ) m
    ),
    'confirmers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'received', received, 'treated', treated,
        'confirmed', confirmed, 'cancelled', cancelled, 'unreachable', unreachable,
        'rate', case when treated = 0 then null else round(confirmed::numeric / treated, 4) end
      ) order by name), '[]'::jsonb)
      from (
        select p.id, coalesce(nullif(p.full_name, ''), '—') as name,
          count(o.id)::int as received,
          count(o.id) filter (where o.confirmation_status in ('confirmed', 'cancelled', 'unreachable'))::int as treated,
          count(o.id) filter (where o.confirmation_status = 'confirmed')::int as confirmed,
          count(o.id) filter (where o.confirmation_status = 'cancelled')::int as cancelled,
          count(o.id) filter (where o.confirmation_status = 'unreachable')::int as unreachable
        from public.profiles p
        left join public.orders o on o.assigned_confirmer_id = p.id
          and (o.created_at at time zone 'Africa/Casablanca')::date between p_from and p_to
        where p.role = 'confirmer'
        group by p.id, p.full_name
      ) c
    ),
    'top_products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', name, 'quantity', quantity, 'collected_quantity', collected_quantity, 'amount', amount
      ) order by quantity desc), '[]'::jsonb)
      from (
        select oi.name_fr as name,
          sum(oi.quantity)::int as quantity,
          coalesce(sum(oi.quantity) filter (where o.payment_status = 'collected'), 0)::int as collected_quantity,
          sum(oi.line_total_mad) as amount
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.confirmation_status <> 'cancelled'
          and (o.created_at at time zone 'Africa/Casablanca')::date between p_from and p_to
        group by oi.name_fr
        order by quantity desc
        limit 10
      ) t
    )
  );
end;
$$;

create or replace function public.confirmer_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid := auth.uid();
  v_treated int;
  v_confirmed int;
begin
  if not public.is_confirmer() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  select count(*) into v_treated from public.orders
    where assigned_confirmer_id = v_id and confirmation_status in ('confirmed', 'cancelled', 'unreachable');
  select count(*) into v_confirmed from public.orders
    where assigned_confirmer_id = v_id and confirmation_status = 'confirmed';

  return jsonb_build_object(
    'received', (select count(*) from public.orders where assigned_confirmer_id = v_id),
    'treated', v_treated,
    'confirmed', v_confirmed,
    'cancelled', (select count(*) from public.orders where assigned_confirmer_id = v_id and confirmation_status = 'cancelled'),
    'unreachable', (select count(*) from public.orders where assigned_confirmer_id = v_id and confirmation_status = 'unreachable'),
    'rate', case when v_treated = 0 then null else round(v_confirmed::numeric / v_treated, 4) end,
    'queue', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'order_number', order_number, 'full_name', full_name, 'phone_normalized', phone_normalized,
        'city', city, 'total_mad', total_mad, 'confirmation_status', confirmation_status, 'created_at', created_at
      ) order by created_at), '[]'::jsonb)
      from (
        select * from public.orders
        where assigned_confirmer_id = v_id and confirmation_status in ('new', 'confirming', 'unreachable')
        order by created_at
        limit 12
      ) q
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.categories enable row level security;
alter table public.category_translations enable row level security;
alter table public.products enable row level security;
alter table public.product_translations enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers enable row level security;
alter table public.carriers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_assignments enable row level security;
alter table public.order_notes enable row level security;
alter table public.shipments enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.track_lookup_attempts enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy settings_public_read on public.store_settings for select to anon, authenticated using (true);
create policy settings_admin_write on public.store_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy rates_public_read on public.shipping_rates for select to anon, authenticated using (is_active or public.is_admin());
create policy rates_admin_write on public.shipping_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy categories_read on public.categories for select to anon, authenticated using (is_active or public.is_admin());
create policy categories_admin on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy category_tr_read on public.category_translations for select to anon, authenticated
  using (exists (select 1 from public.categories c where c.id = category_id and (c.is_active or public.is_admin())));
create policy category_tr_admin on public.category_translations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select to anon, authenticated using (is_active or public.is_admin());
create policy products_admin on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy product_tr_read on public.product_translations for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())));
create policy product_tr_admin on public.product_translations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy product_img_read on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())));
create policy product_img_admin on public.product_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy variants_read on public.product_variants for select to anon, authenticated
  using (
    (product_variants.is_active or public.is_admin())
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and (p.is_active or public.is_admin())
    )
  );
create policy variants_admin on public.product_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy customers_admin on public.customers for select to authenticated using (public.is_admin());
create policy customers_confirmer on public.customers for select to authenticated
  using (public.is_confirmer() and exists (
    select 1 from public.orders o where o.customer_id = customers.id and o.assigned_confirmer_id = auth.uid()
  ));

create policy carriers_admin on public.carriers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy orders_admin on public.orders for select to authenticated using (public.is_admin());
create policy orders_confirmer on public.orders for select to authenticated
  using (public.is_confirmer() and assigned_confirmer_id = auth.uid());

create policy items_admin on public.order_items for select to authenticated using (public.is_admin());
create policy items_confirmer on public.order_items for select to authenticated
  using (public.is_confirmer() and exists (
    select 1 from public.orders o where o.id = order_items.order_id and o.assigned_confirmer_id = auth.uid()
  ));

create policy history_admin on public.order_status_history for select to authenticated using (public.is_admin());
create policy history_confirmer on public.order_status_history for select to authenticated
  using (public.is_confirmer() and exists (
    select 1 from public.orders o where o.id = order_status_history.order_id and o.assigned_confirmer_id = auth.uid()
  ));

create policy assign_admin on public.order_assignments for select to authenticated using (public.is_admin());
create policy notes_admin on public.order_notes for select to authenticated using (public.is_admin());
create policy notes_confirmer on public.order_notes for select to authenticated
  using (public.is_confirmer() and exists (
    select 1 from public.orders o where o.id = order_notes.order_id and o.assigned_confirmer_id = auth.uid()
  ));

create policy shipments_admin on public.shipments for select to authenticated using (public.is_admin());
create policy movements_admin on public.inventory_movements for select to authenticated using (public.is_admin());
create policy audit_admin on public.audit_logs for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.store_settings, public.shipping_rates, public.categories, public.category_translations,
  public.products, public.product_translations, public.product_images, public.product_variants
  to anon, authenticated;

grant select, insert, update, delete on
  public.products, public.product_translations, public.product_images, public.product_variants,
  public.categories, public.category_translations, public.carriers, public.shipping_rates
  to authenticated;
grant update on public.store_settings to authenticated;
grant select on public.profiles, public.orders, public.order_items, public.order_status_history,
  public.order_assignments, public.order_notes, public.customers, public.shipments,
  public.inventory_movements, public.audit_logs
  to authenticated;
grant update on public.profiles to authenticated;

revoke all on function public.restore_order_stock(uuid, text) from public, anon, authenticated;
revoke all on function public.create_order(jsonb) from public;
revoke all on function public.transition_order(uuid, text, text, text) from public;
revoke all on function public.assign_order(uuid, uuid) from public;
revoke all on function public.update_order_delivery(uuid, text, text, numeric) from public;
revoke all on function public.add_order_note(uuid, text) from public;
revoke all on function public.adjust_stock(uuid, int, text) from public;
revoke all on function public.upsert_shipment(uuid, uuid, text, text, text, timestamptz, numeric, text) from public;
revoke all on function public.track_order(text, text) from public;
revoke all on function public.admin_dashboard() from public;
revoke all on function public.admin_reports(date, date) from public;
revoke all on function public.confirmer_dashboard() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_confirmer() from public;

grant execute on function public.create_order(jsonb) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.transition_order(uuid, text, text, text) to authenticated;
grant execute on function public.assign_order(uuid, uuid) to authenticated;
grant execute on function public.update_order_delivery(uuid, text, text, numeric) to authenticated;
grant execute on function public.add_order_note(uuid, text) to authenticated;
grant execute on function public.adjust_stock(uuid, int, text) to authenticated;
grant execute on function public.upsert_shipment(uuid, uuid, text, text, text, timestamptz, numeric, text) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_reports(date, date) to authenticated;
grant execute on function public.confirmer_dashboard() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_confirmer() to authenticated;

-- Storage Supabase. Ignoré si le schéma storage est absent.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('product-images', 'product-images', true)
    on conflict (id) do nothing;
    insert into storage.buckets (id, name, public)
    values ('brand', 'brand', true)
    on conflict (id) do nothing;
    execute 'drop policy if exists sceno_public_read_images on storage.objects';
    execute 'create policy sceno_public_read_images on storage.objects for select using (bucket_id in (''product-images'', ''brand''))';
    execute 'drop policy if exists sceno_admin_insert_images on storage.objects';
    execute 'create policy sceno_admin_insert_images on storage.objects for insert to authenticated with check (bucket_id in (''product-images'', ''brand'') and public.is_admin())';
    execute 'drop policy if exists sceno_admin_update_images on storage.objects';
    execute 'create policy sceno_admin_update_images on storage.objects for update to authenticated using (bucket_id in (''product-images'', ''brand'') and public.is_admin())';
    execute 'drop policy if exists sceno_admin_delete_images on storage.objects';
    execute 'create policy sceno_admin_delete_images on storage.objects for delete to authenticated using (bucket_id in (''product-images'', ''brand'') and public.is_admin())';
  end if;
end $$;
