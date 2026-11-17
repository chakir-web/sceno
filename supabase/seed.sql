-- SCENO — DONNÉES DE DÉMONSTRATION
-- À remplacer par le catalogue réel. Aucune API transporteur n'est simulée.
-- Exécuter après la migration 20261116120000_init.sql.

insert into public.categories (id, slug, sort_order, image_url) values
  ('11111111-1111-4111-8111-111111111111', 'luminaires', 1, '/catalog/lampe.jpg'),
  ('22222222-2222-4222-8222-222222222222', 'ceramique', 2, '/catalog/vase.jpg'),
  ('33333333-3333-4333-8333-333333333333', 'textile', 3, '/catalog/linge.jpg'),
  ('44444444-4444-4444-8444-444444444444', 'parfum-dinterieur', 4, '/catalog/bougie.jpg')
on conflict (id) do nothing;

insert into public.category_translations (category_id, locale, name, description) values
  ('11111111-1111-4111-8111-111111111111', 'fr', 'Luminaires', 'Lumières basses et arches discrètes.'),
  ('11111111-1111-4111-8111-111111111111', 'ar', 'المصابيح', 'إضاءة منخفضة وأقواس هادئة.'),
  ('22222222-2222-4222-8222-222222222222', 'fr', 'Céramique', 'Volumes émaillés, pièces tournées.'),
  ('22222222-2222-4222-8222-222222222222', 'ar', 'الخزف', 'أحجام مطلية وقطع مخروطة.'),
  ('33333333-3333-4333-8333-333333333333', 'fr', 'Textile', 'Linges et coussins en fibres naturelles.'),
  ('33333333-3333-4333-8333-333333333333', 'ar', 'النسيج', 'أقمشة ووسائد من ألياف طبيعية.'),
  ('44444444-4444-4444-8444-444444444444', 'fr', 'Parfum d''intérieur', 'Cires et notes de cèdre.'),
  ('44444444-4444-4444-8444-444444444444', 'ar', 'عطر البيت', 'شموع ونفحات الأرز.')
on conflict (category_id, locale) do nothing;

insert into public.products (id, category_id, slug, sku, price_mad, promo_price_mad, low_stock_threshold, is_featured, is_new) values
  ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'lampe-atlas', 'SCN-LUM-001', 1890, null, 3, true, true),
  ('10000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'vase-sirocco', 'SCN-CER-002', 740, 640, 4, true, false),
  ('10000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'parure-sable', 'SCN-TEX-003', 2200, null, 2, true, false),
  ('10000000-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', 'bougie-cedre', 'SCN-PAR-004', 280, 240, 8, false, true),
  ('10000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'plateau-medina', 'SCN-CER-005', 960, null, 3, true, false),
  ('10000000-0000-4000-8000-000000000006', '33333333-3333-4333-8333-333333333333', 'coussin-noyer', 'SCN-TEX-006', 540, null, 4, false, true)
on conflict (id) do nothing;

insert into public.product_translations (product_id, locale, name, short_description, description) values
  ('10000000-0000-4000-8000-000000000001', 'fr', 'Lampe Atlas', 'Arche de laiton brossé.', 'Lampe à poser. Lumière chaude, pied en laiton, abat-jour en lin ivoire.'),
  ('10000000-0000-4000-8000-000000000001', 'ar', 'مصباح الأطلس', 'قوس من النحاس المصقول.', 'مصباح طاولة. ضوء دافئ، قاعدة نحاسية، عاكس من الكتان العاجي.'),
  ('10000000-0000-4000-8000-000000000002', 'fr', 'Vase Sirocco', 'Grès émaillé sable.', 'Vase tourné, émail sable et lèvre champagne.'),
  ('10000000-0000-4000-8000-000000000002', 'ar', 'مزهرية سيروكو', 'خزف مطلي بلون الرمل.', 'مزهرية مخروطة، طلاء رملي وحافة شامبانيا.'),
  ('10000000-0000-4000-8000-000000000003', 'fr', 'Parure Sable', 'Lin lavé, deux tailles.', 'Housse de couette et taies en lin lavé.'),
  ('10000000-0000-4000-8000-000000000003', 'ar', 'طقم الرمل', 'كتان مغسول، مقاسان.', 'غطاء لحاف وأكياس وسائد من الكتان المغسول.'),
  ('10000000-0000-4000-8000-000000000004', 'fr', 'Bougie Cèdre', 'Cire végétale, 48 heures.', 'Bougie parfumée au cèdre de l''Atlas.'),
  ('10000000-0000-4000-8000-000000000004', 'ar', 'شمعة الأرز', 'شمع نباتي، 48 ساعة.', 'شمعة معطرة بأرز الأطلس.'),
  ('10000000-0000-4000-8000-000000000005', 'fr', 'Plateau Médina', 'Laiton et bord mat.', 'Plateau de service en laiton.'),
  ('10000000-0000-4000-8000-000000000005', 'ar', 'صينية المدينة', 'نحاس وحافة مطفية.', 'صينية تقديم من النحاس.'),
  ('10000000-0000-4000-8000-000000000006', 'fr', 'Coussin Noyer', 'Toile de coton, deux formats.', 'Coussin carré, garnissage ferme.'),
  ('10000000-0000-4000-8000-000000000006', 'ar', 'وسادة الجوز', 'قماش قطني، مقاسان.', 'وسادة مربعة بحشوة ثابتة.')
on conflict (product_id, locale) do nothing;

insert into public.product_images (id, product_id, url, alt, sort_order) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '/catalog/lampe.jpg', 'Lampe Atlas', 0),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '/catalog/vase.jpg', 'Vase Sirocco', 0),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '/catalog/linge.jpg', 'Parure Sable', 0),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', '/catalog/bougie.jpg', 'Bougie Cèdre', 0),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', '/catalog/plateau.jpg', 'Plateau Médina', 0),
  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', '/catalog/coussin.jpg', 'Coussin Noyer', 0)
on conflict (id) do nothing;

insert into public.product_variants (id, product_id, sku, size, color, color_hex, stock_quantity) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'SCN-LUM-001-LAI', null, 'Laiton', '#A58B62', 8),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'SCN-CER-002-SAB', null, 'Sable', '#C6B69B', 12),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'SCN-TEX-003-140', '140', 'Ivoire', '#F5F1E9', 4),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'SCN-TEX-003-240', '240', 'Ivoire', '#F5F1E9', 2),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'SCN-PAR-004-CED', null, 'Cèdre', '#8A847A', 30),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'SCN-CER-005-LAI', null, 'Laiton', '#A58B62', 10),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'SCN-TEX-006-45', '45', 'Noyer', '#6F5B45', 9),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000006', 'SCN-TEX-006-60', '60', 'Noyer', '#6F5B45', 6)
on conflict (id) do nothing;

insert into public.carriers (id, name, phone, notes) values
  ('50000000-0000-4000-8000-000000000001', 'Transporteur démo', '', 'Donnée de démonstration. Aucune API n''est connectée.')
on conflict (id) do nothing;

insert into public.shipping_rates (city, fee_mad, zone) values
  ('Casablanca', 25, 'Centre'),
  ('Rabat', 30, 'Centre'),
  ('Salé', 30, 'Centre'),
  ('Témara', 35, 'Centre'),
  ('Mohammedia', 35, 'Centre'),
  ('Kénitra', 40, 'Nord'),
  ('Marrakech', 45, 'Sud'),
  ('Tanger', 50, 'Nord'),
  ('Fès', 45, 'Est'),
  ('Meknès', 45, 'Est'),
  ('Agadir', 55, 'Sud'),
  ('Oujda', 60, 'Est'),
  ('Tétouan', 50, 'Nord'),
  ('El Jadida', 40, 'Centre'),
  ('Nador', 60, 'Est')
on conflict (city) do nothing;

update public.store_settings
set support_phone = '',
    support_email = '',
    address = '',
    default_shipping_fee_mad = 65,
    about_fr = 'SCENO est une maison d''objets pour le Maroc. Chaque pièce est choisie pour sa matière, sa ligne et sa tenue dans le temps.',
    about_ar = 'SCENO دار أشياء للمغرب. كل قطعة مختارة لمادتها وخطها وثباتها مع الوقت.';
