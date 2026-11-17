create table if not exists public.category_slug_aliases (
  slug text primary key,
  category_id uuid not null references public.categories (id) on delete cascade
);

alter table public.category_slug_aliases enable row level security;

grant select on public.category_slug_aliases to anon, authenticated;
grant insert, update, delete on public.category_slug_aliases to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'category_slug_aliases' and policyname = 'category_alias_read'
  ) then
    create policy category_alias_read on public.category_slug_aliases
      for select to anon, authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'category_slug_aliases' and policyname = 'category_alias_admin'
  ) then
    create policy category_alias_admin on public.category_slug_aliases
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
