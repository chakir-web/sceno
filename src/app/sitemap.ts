import type { MetadataRoute } from "next";
import { listProductSlugs } from "@/lib/services/catalog";
import { listCategories } from "@/lib/services/catalog";
import { siteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, categories] = await Promise.all([listProductSlugs(), listCategories("fr")]);
  return [
    "",
    "/products",
    "/track-order",
    "/suivi-commande",
    ...products.map((product) => `/products/${product.slug}`),
    ...categories.data.map((category) => `/categories/${category.slug}`),
  ].map((path) => ({ url: `${base}${path}`, changeFrequency: "daily" as const, priority: path === "" ? 1 : 0.7 }));
}
