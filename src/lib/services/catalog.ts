import { errorCode, isMissingSchema } from "@/lib/errors";
import { asArray, asNumber, cleanQuery } from "@/lib/http";
import type { Locale } from "@/lib/i18n/locales";
import { unitPrice } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import type { CatalogCategory, CatalogProduct, DataState, Variant } from "@/types/commerce";

const pageSize = 12;

const productSelect = `
  id, slug, sku, price_mad, promo_price_mad, stock_quantity, low_stock_threshold,
  is_active, is_featured, is_new, category_id, created_at,
  product_translations (locale, name, short_description, description),
  product_images (id, url, alt, sort_order),
  product_variants (id, sku, size, color, color_hex, price_mad, stock_quantity, is_active),
  categories (id, slug, category_translations (locale, name))
`;

type Translation = { locale: string; name: string; short_description?: string; description?: string };
type ImageRow = { id: string; url: string; alt: string; sort_order: number };
type VariantRow = {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  price_mad: number | string | null;
  stock_quantity: number;
  is_active: boolean;
};
type CategoryJoin = { id: string; slug: string; category_translations?: Translation[] | null } | null;

type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  price_mad: number | string;
  promo_price_mad: number | string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  category_id: string | null;
  created_at: string;
  product_translations?: Translation[] | null;
  product_images?: ImageRow[] | null;
  product_variants?: VariantRow[] | null;
  categories?: CategoryJoin | CategoryJoin[];
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function mapProduct(row: ProductRow, locale: Locale, includeInactive = false): CatalogProduct {
  const translations = asArray<Translation>(row.product_translations);
  const french = translations.find((item) => item.locale === "fr");
  const arabic = translations.find((item) => item.locale === "ar");
  const current = (locale === "ar" ? arabic ?? french : french ?? arabic) ?? null;
  const category = one(row.categories);
  const categoryTranslations = asArray<Translation>(category?.category_translations);
  const categoryCurrent =
    categoryTranslations.find((item) => item.locale === locale) ??
    categoryTranslations.find((item) => item.locale === "fr");
  const variants: Variant[] = asArray<VariantRow>(row.product_variants)
    .filter((variant) => includeInactive || variant.is_active)
    .map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      colorHex: variant.color_hex,
      priceMad: variant.price_mad == null ? null : asNumber(variant.price_mad),
      stockQuantity: variant.stock_quantity,
      isActive: variant.is_active,
    }));

  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    priceMad: asNumber(row.price_mad),
    promoPriceMad: row.promo_price_mad == null ? null : asNumber(row.promo_price_mad),
    stockQuantity: row.stock_quantity,
    lowStockThreshold: row.low_stock_threshold,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    isNew: row.is_new,
    categoryId: row.category_id,
    categorySlug: category?.slug ?? null,
    categoryName: categoryCurrent?.name ?? null,
    name: current?.name ?? row.sku,
    shortDescription: current?.short_description ?? "",
    description: current?.description ?? "",
    nameFr: french?.name ?? row.sku,
    nameAr: arabic?.name ?? row.sku,
    shortFr: french?.short_description ?? "",
    shortAr: arabic?.short_description ?? "",
    descriptionFr: french?.description ?? "",
    descriptionAr: arabic?.description ?? "",
    images: asArray<ImageRow>(row.product_images)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({ id: image.id, url: image.url, alt: image.alt || current?.name || row.sku })),
    variants,
    createdAt: row.created_at,
  };
}

export function displayPrice(product: CatalogProduct) {
  const active = product.variants.filter((variant) => variant.isActive);
  const prices = (active.length ? active : product.variants).map((variant) =>
    unitPrice(product.priceMad, product.promoPriceMad, variant.priceMad),
  );
  const amount = prices.length ? Math.min(...prices) : unitPrice(product.priceMad, product.promoPriceMad, null);
  const compare = amount < product.priceMad ? product.priceMad : null;
  return { amount, compare };
}

export async function listProducts(options: {
  locale: Locale;
  page?: number;
  q?: string;
  category?: string;
  sort?: string;
  inStock?: boolean;
  featured?: boolean;
  newest?: boolean;
  admin?: boolean;
}): Promise<DataState<{ items: CatalogProduct[]; total: number; pageSize: number }>> {
  const empty = { items: [], total: 0, pageSize };
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: empty };

  const page = options.page ?? 1;
  let query = supabase.from("products").select(productSelect, { count: "exact" });
  if (!options.admin) query = query.eq("is_active", true);
  if (options.featured) query = query.eq("is_featured", true);
  if (options.newest) query = query.eq("is_new", true);
  if (options.inStock) query = query.gt("stock_quantity", 0);

  const q = cleanQuery(options.q);
  if (q) {
    const [{ data: names }, { data: skus }] = await Promise.all([
      supabase.from("product_translations").select("product_id").ilike("name", `%${q}%`),
      supabase.from("products").select("id").ilike("sku", `%${q}%`),
    ]);
    const ids = Array.from(
      new Set([...(names ?? []).map((row) => row.product_id as string), ...(skus ?? []).map((row) => row.id as string)]),
    );
    if (ids.length === 0) return { configured: true, ready: true, data: empty };
    query = query.in("id", ids);
  }

  if (options.category) {
    const { data: category } = await supabase.from("categories").select("id").eq("slug", options.category).maybeSingle();
    if (!category) return { configured: true, ready: true, data: empty };
    query = query.eq("category_id", category.id);
  }

  if (options.sort === "price_asc") query = query.order("selling_price_mad", { ascending: true });
  else if (options.sort === "price_desc") query = query.order("selling_price_mad", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) {
    if (isMissingSchema(error)) return { configured: true, ready: false, data: empty };
    throw new Error(errorCode(error));
  }

  return {
    configured: true,
    ready: true,
    data: {
      items: ((data ?? []) as ProductRow[]).map((row) => mapProduct(row, options.locale, options.admin)),
      total: count ?? 0,
      pageSize,
    },
  };
}

export async function getProductBySlug(slug: string, locale: Locale) {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: null as CatalogProduct | null };
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return { configured: true, ready: false, data: null };
    throw new Error(errorCode(error));
  }
  return { configured: true, ready: true, data: data ? mapProduct(data as ProductRow, locale) : null };
}

export async function getProductById(id: string, locale: Locale) {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: null as CatalogProduct | null };
  const { data, error } = await supabase.from("products").select(productSelect).eq("id", id).maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return { configured: true, ready: false, data: null };
    throw new Error(errorCode(error));
  }
  return { configured: true, ready: true, data: data ? mapProduct(data as ProductRow, locale, true) : null };
}

export async function listSimilar(product: CatalogProduct, locale: Locale) {
  if (!product.categoryId) return [];
  const result = await listProducts({ locale, category: product.categorySlug ?? undefined, page: 1 });
  return result.data.items.filter((item) => item.id !== product.id).slice(0, 4);
}

type CategoryRow = {
  id: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  category_translations?: Translation[] | null;
};

export function mapCategory(row: CategoryRow, locale: Locale): CatalogCategory {
  const translations = asArray<Translation>(row.category_translations);
  const french = translations.find((item) => item.locale === "fr");
  const arabic = translations.find((item) => item.locale === "ar");
  const current = locale === "ar" ? arabic ?? french : french ?? arabic;
  return {
    id: row.id,
    slug: row.slug,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    name: current?.name ?? row.slug,
    description: current?.description ?? "",
    nameFr: french?.name ?? row.slug,
    nameAr: arabic?.name ?? row.slug,
    descriptionFr: french?.description ?? "",
    descriptionAr: arabic?.description ?? "",
  };
}

export async function listCategories(locale: Locale, admin = false): Promise<DataState<CatalogCategory[]>> {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: [] };
  let query = supabase
    .from("categories")
    .select("id, slug, image_url, sort_order, is_active, category_translations (locale, name, description)")
    .order("sort_order", { ascending: true });
  if (!admin) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) {
    if (isMissingSchema(error)) return { configured: true, ready: false, data: [] };
    throw new Error(errorCode(error));
  }
  return { configured: true, ready: true, data: ((data ?? []) as CategoryRow[]).map((row) => mapCategory(row, locale)) };
}

export async function countProductsByCategory() {
  const supabase = await createClient();
  const counts: Record<string, number> = {};
  if (!supabase) return counts;
  const { data } = await supabase.from("products").select("category_id");
  for (const row of data ?? []) {
    const id = row.category_id as string | null;
    if (!id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function categorySlugForAlias(slug: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("category_slug_aliases").select("category_id").eq("slug", slug).maybeSingle();
  if (error || !data?.category_id) return null;
  const { data: category } = await supabase.from("categories").select("slug").eq("id", data.category_id).maybeSingle();
  return category?.slug ?? null;
}

export async function listProductSlugs() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("products").select("slug, updated_at").eq("is_active", true);
  return (data ?? []) as { slug: string; updated_at: string }[];
}
