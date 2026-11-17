import { saveCategoryForm } from "@/lib/actions/catalog";
import { CategoryDeleteButton } from "@/components/admin/category-delete";
import { Pill, StatePill } from "@/components/office/indicators";
import { PageIntro } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { countProductsByCategory, listCategories } from "@/lib/services/catalog";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const { locale, dict } = await getI18n();
  const [categories, counts] = await Promise.all([listCategories(locale, true), countProductsByCategory()]);
  const current = categories.data.find((category) => category.id === edit);
  const copy = dict.admin.categories;
  return (
    <div>
      <PageIntro title={copy.title} />
      <form action={saveCategoryForm} className="mb-8 grid gap-3 border border-line bg-ivory p-5 md:grid-cols-2">
        {current ? <input type="hidden" name="id" value={current.id} /> : null}
        <input className="field" name="nameFr" placeholder={copy.nameFr} defaultValue={current?.nameFr} required />
        <input className="field" name="nameAr" placeholder={copy.nameAr} dir="rtl" defaultValue={current?.nameAr} required />
        <textarea className="field" name="descriptionFr" placeholder={copy.descFr} defaultValue={current?.descriptionFr} />
        <textarea className="field" name="descriptionAr" placeholder={copy.descAr} dir="rtl" defaultValue={current?.descriptionAr} />
        <input className="field" type="number" name="sortOrder" defaultValue={current?.sortOrder ?? categories.data.length + 1} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={current?.isActive ?? true} />{dict.common.active}</label>
        <input type="file" name="image" accept="image/png,image/jpeg,image/webp" />
        <button className="btn btn-primary w-fit" type="submit">{current ? dict.common.save : copy.new}</button>
      </form>
      <div className="overflow-x-auto border border-line bg-ivory">
        <table className="data">
          <thead><tr><th>{dict.common.name}</th><th>{copy.slug}</th><th>{dict.common.status}</th><th></th></tr></thead>
          <tbody>
            {categories.data.map((category) => (
              <tr key={category.id}>
                <td>{category.nameFr} / {category.nameAr}</td>
                <td>{category.slug}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <StatePill active={category.isActive} activeLabel={dict.common.active} inactiveLabel={dict.common.inactive} />
                    <Pill tone={(counts[category.id] ?? 0) > 0 ? "info" : "neutral"}>{(counts[category.id] ?? 0) > 0 ? `${dict.office.withProducts} · ${counts[category.id]}` : dict.office.emptyCategory}</Pill>
                  </div>
                </td>
                <td className="flex gap-3">
                  <a href={`/admin/categories?edit=${category.id}`}>{dict.common.edit}</a>
                  <CategoryDeleteButton id={category.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
