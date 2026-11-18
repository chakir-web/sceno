alter table public.product_images
  add column if not exists color text;

comment on column public.product_images.color is
  'Couleur de variante associée. Null : photo commune, conservée pour les produits déjà en ligne.';
