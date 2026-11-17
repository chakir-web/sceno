import { ProductForm } from "@/components/admin/product-form";
import { PageIntro } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { listCategories } from "@/lib/services/catalog";

export default async function NewProductPage() {
  const { locale, dict } = await getI18n();
  const categories = await listCategories(locale, true);
  return (
    <div>
      <PageIntro title={dict.admin.products.new} />
      <ProductForm product={null} categories={categories.data} />
    </div>
  );
}
