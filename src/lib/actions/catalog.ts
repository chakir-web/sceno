"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { errorCode } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { productInputSchema } from "@/lib/validations/commerce";

function fail(code: string) {
  return { ok: false as const, code };
}

function revalidateCatalog() {
  revalidatePath("/", "layout");
}

async function availableCategorySlug(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAdmin>>["supabase"]>,
  categoryId: string | null,
  nameFr: string,
) {
  const base = slugify(nameFr) || "categorie";
  let slug = base;
  for (let attempt = 2; attempt < 30; attempt += 1) {
    const { data } = await supabase.from("categories").select("id").eq("slug", slug).maybeSingle();
    if (!data || data.id === categoryId) return slug;
    slug = `${base}-${attempt}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function saveProduct(input: unknown) {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_items");
  const { supabase } = await requireAdmin();
  const value = parsed.data;
  const promo = value.promoPriceMad != null && value.promoPriceMad < value.priceMad ? value.promoPriceMad : null;
  let id = value.id;

  if (!id) {
    let slug = slugify(value.nameFr) || slugify(value.sku);
    const { data: clash } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${slugify(value.sku)}`;
    const { data, error } = await supabase
      .from("products")
      .insert({
        category_id: value.categoryId,
        slug,
        sku: value.sku,
        price_mad: value.priceMad,
        promo_price_mad: promo,
        low_stock_threshold: value.lowStockThreshold,
        is_active: value.isActive,
        is_featured: value.isFeatured,
        is_new: value.isNew,
      })
      .select("id")
      .single();
    if (error || !data) return fail(errorCode(error));
    id = data.id as string;
  } else {
    const { error } = await supabase
      .from("products")
      .update({
        category_id: value.categoryId,
        sku: value.sku,
        price_mad: value.priceMad,
        promo_price_mad: promo,
        low_stock_threshold: value.lowStockThreshold,
        is_active: value.isActive,
        is_featured: value.isFeatured,
        is_new: value.isNew,
      })
      .eq("id", id);
    if (error) return fail(errorCode(error));
  }

  const translations = [
    { product_id: id, locale: "fr", name: value.nameFr, short_description: value.shortFr, description: value.descriptionFr },
    { product_id: id, locale: "ar", name: value.nameAr, short_description: value.shortAr, description: value.descriptionAr },
  ];
  const { error: translationError } = await supabase.from("product_translations").upsert(translations);
  if (translationError) return fail(errorCode(translationError));

  const kept: string[] = [];
  for (const variant of value.variants) {
    const payload = {
      product_id: id,
      sku: variant.sku,
      size: variant.size || null,
      color: variant.color || null,
      color_hex: variant.colorHex || null,
      price_mad: variant.priceMad,
      is_active: true,
    };
    if (variant.id) {
      const { data: current, error: readError } = await supabase
        .from("product_variants")
        .select("stock_quantity")
        .eq("id", variant.id)
        .maybeSingle();
      if (readError || !current) return fail("not_found");
      if (variant.expectedStock != null && current.stock_quantity !== variant.expectedStock) return fail("insufficient_stock");
      const { error } = await supabase.from("product_variants").update(payload).eq("id", variant.id);
      if (error) return fail(errorCode(error));
      const delta = variant.stockQuantity - current.stock_quantity;
      if (delta !== 0) {
        const { error: stockError } = await supabase.rpc("adjust_stock", {
          p_variant_id: variant.id,
          p_delta: delta,
          p_reason: "adjustment",
        });
        if (stockError) return fail(errorCode(stockError));
      }
      kept.push(variant.id);
    } else {
      const { data, error } = await supabase
        .from("product_variants")
        .insert({ ...payload, stock_quantity: 0 })
        .select("id")
        .single();
      if (error || !data) return fail(errorCode(error));
      if (variant.stockQuantity > 0) {
        const { error: stockError } = await supabase.rpc("adjust_stock", {
          p_variant_id: data.id,
          p_delta: variant.stockQuantity,
          p_reason: "restock",
        });
        if (stockError) return fail(errorCode(stockError));
      }
      kept.push(data.id as string);
    }
  }

  const { data: existingVariants } = await supabase.from("product_variants").select("id").eq("product_id", id);
  for (const row of existingVariants ?? []) {
    if (!kept.includes(row.id as string)) {
      await supabase.from("product_variants").update({ is_active: false }).eq("id", row.id);
    }
  }
  await supabase.rpc("write_audit", {
    p_action: "product.save",
    p_entity: "products",
    p_entity_id: id,
    p_metadata: { sku: value.sku },
  });
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true as const, id };
}

export async function setProductActive(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("active") === "true";
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) return fail(errorCode(error));
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true as const };
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    await supabase.from("products").update({ is_active: false }).eq("id", id);
  }
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true as const, deactivated: Boolean(error) };
}

export async function uploadProductImage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("file_type");
  if (file.size > 5_000_000) return fail("file_size");
  const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const ext = types[file.type];
  if (!ext) return fail("file_type");
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
  });
  if (error) return fail("generic");
  const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  const { data: image, error: insertError } = await supabase
    .from("product_images")
    .insert({ product_id: productId, url, alt: file.name, sort_order: Date.now() % 1000 })
    .select("id, url, alt")
    .single();
  if (insertError || !image) return fail(errorCode(insertError));
  revalidateCatalog();
  return { ok: true as const, image: { id: image.id as string, url: image.url as string, alt: image.alt as string } };
}

export async function deleteProductImage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");
  await supabase.from("product_images").delete().eq("id", id);
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  return { ok: true as const };
}

export async function saveCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const nameFr = String(formData.get("nameFr") ?? "").trim();
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const descriptionFr = String(formData.get("descriptionFr") ?? "").trim();
  const descriptionAr = String(formData.get("descriptionAr") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";
  if (nameFr.length < 2 || nameAr.length < 2) return fail("invalid_items");
  let categoryId = id;
  let imageUrl: string | undefined;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadNamedFile(supabase, file, "categories");
    if (!uploaded.ok) return uploaded;
    imageUrl = uploaded.url;
  }
  const desiredSlug = await availableCategorySlug(supabase, categoryId || null, nameFr);
  if (!categoryId) {
    const { data, error } = await supabase
      .from("categories")
      .insert({ slug: desiredSlug, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0, is_active: isActive, image_url: imageUrl ?? null })
      .select("id")
      .single();
    if (error || !data) return fail(errorCode(error));
    categoryId = data.id as string;
  } else {
    const { data: current, error: readError } = await supabase.from("categories").select("slug").eq("id", categoryId).maybeSingle();
    if (readError || !current) return fail("not_found");
    const { data: french } = await supabase.from("category_translations").select("name").eq("category_id", categoryId).eq("locale", "fr").maybeSingle();
    const nameChanged = slugify(String(french?.name ?? "")) !== slugify(nameFr);
    const patch: { sort_order: number; is_active: boolean; slug?: string; image_url?: string } = {
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: isActive,
    };
    if (imageUrl) patch.image_url = imageUrl;
    if (nameChanged && desiredSlug !== current.slug) {
      const { error: aliasError } = await supabase.from("category_slug_aliases").upsert({ slug: current.slug, category_id: categoryId }, { onConflict: "slug" });
      if (aliasError) return fail(errorCode(aliasError));
      await supabase.from("category_slug_aliases").delete().eq("slug", desiredSlug);
      patch.slug = desiredSlug;
    }
    const { error } = await supabase.from("categories").update(patch).eq("id", categoryId);
    if (error) return fail(errorCode(error));
  }
  const { error } = await supabase.from("category_translations").upsert([
    { category_id: categoryId, locale: "fr", name: nameFr, description: descriptionFr },
    { category_id: categoryId, locale: "ar", name: nameAr, description: descriptionAr },
  ], { onConflict: "category_id,locale" });
  if (error) return fail(errorCode(error));
  revalidateCatalog();
  return { ok: true as const };
}

export async function deleteCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
  if ((count ?? 0) > 0) {
    await supabase.from("categories").update({ is_active: false }).eq("id", id);
    revalidateCatalog();
    return fail("category_in_use");
  }
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return fail(errorCode(error));
  revalidateCatalog();
  return { ok: true as const };
}

async function uploadNamedFile(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  file: File,
  folder: string,
) {
  if (file.size > 5_000_000) return fail("file_size");
  const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };
  const ext = types[file.type];
  if (!ext) return fail("file_type");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const bucket = folder === "brand" ? "brand" : "product-images";
  const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) return fail("generic");
  return { ok: true as const, url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}

export async function saveSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { data: current } = await supabase.from("store_settings").select("id").limit(1).maybeSingle();
  if (!current) return fail("not_configured");
  let logoUrl: string | undefined;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadNamedFile(supabase, file, "brand");
    if (!uploaded.ok) return uploaded;
    logoUrl = uploaded.url;
  }
  const patch = {
    store_name: String(formData.get("storeName") ?? "SCENO").trim() || "SCENO",
    support_phone: String(formData.get("phone") ?? "").trim(),
    support_email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    currency: "MAD",
    default_locale: formData.get("defaultLocale") === "ar" ? "ar" : "fr",
    default_shipping_fee_mad: Math.max(0, Number(formData.get("defaultFee") ?? 0) || 0),
    about_fr: String(formData.get("aboutFr") ?? ""),
    about_ar: String(formData.get("aboutAr") ?? ""),
    instagram: String(formData.get("instagram") ?? "").trim(),
    facebook: String(formData.get("facebook") ?? "").trim(),
    ...(logoUrl ? { logo_url: logoUrl } : {}),
  };
  const { error } = await supabase.from("store_settings").update(patch).eq("id", current.id);
  if (error) return fail(errorCode(error));

  let rates: { city: string; feeMad: number; zone: string; isActive: boolean }[] = [];
  try {
    const parsedRates = JSON.parse(String(formData.get("rates") ?? "[]")) as { city: string; feeMad: number; zone: string; isActive: boolean }[];
    if (Array.isArray(parsedRates)) rates = parsedRates;
  } catch {
    return fail("invalid_items");
  }
  if (rates.length >= 0) {
    const clean = rates
      .map((rate) => ({
        city: String(rate.city ?? "").trim(),
        fee_mad: Math.max(0, Number(rate.feeMad) || 0),
        zone: String(rate.zone ?? "").trim(),
        is_active: Boolean(rate.isActive),
      }))
      .filter((rate) => rate.city.length > 1);
    if (clean.length) {
      const { error: rateError } = await supabase.from("shipping_rates").upsert(clean, { onConflict: "city" });
      if (rateError) return fail(errorCode(rateError));
    }
    const cities = clean.map((rate) => rate.city);
    if (cities.length) {
      await supabase.from("shipping_rates").delete().not("city", "in", `(${cities.map((city) => `"${city.replaceAll('"', "")}"`).join(",")})`);
    }
  }
  await supabase.rpc("write_audit", { p_action: "settings.update", p_entity: "store_settings", p_entity_id: current.id, p_metadata: {} });
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true as const };
}

export async function setProductActiveForm(formData: FormData) {
  await setProductActive(formData);
}

export async function deleteProductForm(formData: FormData) {
  await deleteProduct(formData);
}

export async function saveCategoryForm(formData: FormData) {
  await saveCategory(formData);
}
