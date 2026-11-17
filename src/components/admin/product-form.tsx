"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { saveProduct, uploadProductImage, deleteProductImage } from "@/lib/actions/catalog";
import { Notice } from "@/components/office/indicators";
import { useI18n } from "@/components/providers";
import { productInputSchema } from "@/lib/validations/commerce";
import type { CatalogCategory, CatalogImage, CatalogProduct } from "@/types/commerce";

type Values = z.infer<typeof productInputSchema>;
type Dict = ReturnType<typeof useI18n>["dict"];

const drafts = new Map<string, Values>();

function messageFor(dict: Dict, code: string) {
  return dict.errors[code as keyof typeof dict.errors] ?? dict.errors.generic;
}

function ProductPhotos({
  productId,
  images,
  remember,
}: {
  productId: string;
  images: CatalogImage[];
  remember: () => void;
}) {
  const { dict } = useI18n();
  const copy = dict.admin.products;
  const [photos, setPhotos] = useState(images);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function addPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    remember();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("productId", productId);
    setBusy(true);
    const result = await uploadProductImage(data);
    setBusy(false);
    if (!result.ok) {
      setNotice(messageFor(dict, result.code));
      return;
    }
    setPhotos((current) => [...current, result.image]);
    setNotice("");
    form.reset();
  }

  async function removePhoto(image: CatalogImage) {
    remember();
    const data = new FormData();
    data.set("id", image.id);
    data.set("productId", productId);
    setBusy(true);
    await deleteProductImage(data);
    setBusy(false);
    setPhotos((current) => current.filter((item) => item.id !== image.id));
    setNotice("");
  }

  return (
    <div className="border border-line p-4">
      <h2 className="font-display text-3xl">{copy.images}</h2>
      <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
        {photos.map((image) => (
          <div key={image.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.alt} className="aspect-square object-cover" />
            <button className="mt-2 text-xs" type="button" disabled={busy} onClick={() => removePhoto(image)}>
              {copy.removeImage}
            </button>
          </div>
        ))}
      </div>
      <form className="mt-4 flex gap-3" onSubmit={addPhoto}>
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp" />
        <button className="btn btn-ghost" type="submit" disabled={busy}>{copy.addImages}</button>
      </form>
      {notice ? <div className="mt-3"><Notice tone="danger">{notice}</Notice></div> : null}
    </div>
  );
}

export function ProductForm({ product, categories }: { product: CatalogProduct | null; categories: CatalogCategory[] }) {
  const { dict } = useI18n();
  const router = useRouter();
  const copy = dict.admin.products;
  const draftKey = product?.id ?? "new";
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const form = useForm<Values>({
    resolver: zodResolver(productInputSchema),
    defaultValues: drafts.get(draftKey) ?? (product ? {
      id: product.id,
      categoryId: product.categoryId ?? categories[0]?.id ?? "",
      sku: product.sku,
      priceMad: product.priceMad,
      promoPriceMad: product.promoPriceMad,
      lowStockThreshold: product.lowStockThreshold,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      isNew: product.isNew,
      nameFr: product.nameFr,
      nameAr: product.nameAr,
      shortFr: product.shortFr,
      shortAr: product.shortAr,
      descriptionFr: product.descriptionFr,
      descriptionAr: product.descriptionAr,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        size: variant.size ?? "",
        color: variant.color ?? "",
        colorHex: variant.colorHex ?? "",
        priceMad: variant.priceMad,
        stockQuantity: variant.stockQuantity,
        expectedStock: variant.stockQuantity,
      })),
    } : {
      categoryId: categories[0]?.id ?? "",
      sku: "",
      priceMad: 0,
      promoPriceMad: null,
      lowStockThreshold: 5,
      isActive: true,
      isFeatured: false,
      isNew: true,
      nameFr: "",
      nameAr: "",
      shortFr: "",
      shortAr: "",
      descriptionFr: "",
      descriptionAr: "",
      variants: [{ sku: "", size: "", color: "", colorHex: "", priceMad: null, stockQuantity: 0 }],
    }),
  });
  const variants = useFieldArray({ control: form.control, name: "variants" });
  const error = form.formState.errors.root?.message;

  function remember() {
    drafts.set(draftKey, form.getValues());
  }

  useEffect(() => {
    const subscription = form.watch(() => {
      drafts.set(draftKey, form.getValues());
    });
    return () => subscription.unsubscribe();
  }, [draftKey, form]);

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-6"
        onSubmit={form.handleSubmit(async (values) => {
          remember();
          const result = await saveProduct(values);
          if (!result.ok) {
            form.setError("root", { message: messageFor(dict, result.code) });
            return;
          }
          const files = pendingFiles;
          for (const file of files) {
            const data = new FormData();
            data.set("productId", result.id);
            data.set("file", file);
            const uploaded = await uploadProductImage(data);
            if (!uploaded.ok) {
              drafts.set(draftKey, { ...form.getValues(), id: result.id });
              form.setValue("id", result.id);
              form.setError("root", { message: messageFor(dict, uploaded.code) });
              return;
            }
          }
          drafts.delete(draftKey);
          drafts.delete(result.id);
          router.push(`/admin/products/${result.id}`);
        })}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">{copy.nameFr}<input className="field" {...form.register("nameFr")} /></label>
          <label className="grid gap-2 text-sm">{copy.nameAr}<input className="field" dir="rtl" {...form.register("nameAr")} /></label>
          <label className="grid gap-2 text-sm">{copy.shortFr}<input className="field" {...form.register("shortFr")} /></label>
          <label className="grid gap-2 text-sm">{copy.shortAr}<input className="field" dir="rtl" {...form.register("shortAr")} /></label>
          <label className="grid gap-2 text-sm md:col-span-2">{copy.descFr}<textarea className="field min-h-28" {...form.register("descriptionFr")} /></label>
          <label className="grid gap-2 text-sm md:col-span-2">{copy.descAr}<textarea className="field min-h-28" dir="rtl" {...form.register("descriptionAr")} /></label>
          <label className="grid gap-2 text-sm">{copy.sku}<input className="field" {...form.register("sku")} /></label>
          <label className="grid gap-2 text-sm">{copy.category}
            <select className="field" {...form.register("categoryId")}>{categories.map((category) => <option key={category.id} value={category.id}>{category.nameFr}</option>)}</select>
          </label>
          <label className="grid gap-2 text-sm">{copy.price}<input className="field" type="number" step="0.01" {...form.register("priceMad", { valueAsNumber: true })} /></label>
          <label className="grid gap-2 text-sm">{copy.promo}<input className="field" type="number" step="0.01" {...form.register("promoPriceMad", { setValueAs: (value) => value === "" || value == null ? null : Number(value) })} /></label>
          <label className="grid gap-2 text-sm">{copy.threshold}<input className="field" type="number" {...form.register("lowStockThreshold", { valueAsNumber: true })} /></label>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label><input type="checkbox" {...form.register("isActive")} /> {copy.active}</label>
            <label><input type="checkbox" {...form.register("isFeatured")} /> {copy.featured}</label>
            <label><input type="checkbox" {...form.register("isNew")} /> {copy.isNew}</label>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-3xl">{copy.variants}</h2>
            <button type="button" className="btn btn-ghost" onClick={() => variants.append({ sku: "", size: "", color: "", colorHex: "", priceMad: null, stockQuantity: 0 })}>{copy.addVariant}</button>
          </div>
          <div className="mt-4 grid gap-4">
            {variants.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 border border-line p-4 md:grid-cols-6">
                <input className="field" placeholder="SKU" {...form.register(`variants.${index}.sku`)} />
                <input className="field" placeholder={copy.size} {...form.register(`variants.${index}.size`)} />
                <input className="field" placeholder={copy.color} {...form.register(`variants.${index}.color`)} />
                <input className="field" placeholder={copy.colorHex} {...form.register(`variants.${index}.colorHex`)} />
                <input className="field" type="number" step="0.01" placeholder={copy.variantPrice} {...form.register(`variants.${index}.priceMad`, { setValueAs: (value) => value === "" || value == null ? null : Number(value) })} />
                <input className="field" type="number" placeholder={dict.common.quantity} {...form.register(`variants.${index}.stockQuantity`, { valueAsNumber: true })} />
              </div>
            ))}
          </div>
        </div>
        {product ? null : (
          <div className="border border-line p-4">
            <h2 className="font-display text-3xl">{copy.images}</h2>
            <input
              className="mt-4"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                remember();
                setPendingFiles(Array.from(event.target.files ?? []));
              }}
            />
            {pendingFiles.length > 0 ? <p className="mt-3 text-sm">{pendingFiles.map((file) => file.name).join(", ")}</p> : null}
          </div>
        )}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <button className="btn btn-primary w-fit" type="submit">{dict.common.save}</button>
      </form>
      {product ? <ProductPhotos productId={product.id} images={product.images} remember={remember} /> : null}
    </div>
  );
}
