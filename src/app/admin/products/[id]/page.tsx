import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { PageIntro } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { getProductById, listCategories } from "@/lib/services/catalog";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, dict } = await getI18n();
  const [product, categories] = await Promise.all([getProductById(id, locale), listCategories(locale, true)]);
  if (!product.data) notFound();
  return (
    <div>
      <PageIntro title={dict.admin.products.edit} />
      <ProductForm product={product.data} categories={categories.data} />
    </div>
  );
}
