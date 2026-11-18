"use client";

import { useState, type FormEvent } from "react";
import { deleteProductImage, reorderProductImages, uploadProductImage } from "@/lib/actions/catalog";
import { colorKey } from "@/lib/catalog/images";
import { Notice } from "@/components/office/indicators";
import { useI18n } from "@/components/providers";
import type { CatalogImage, CatalogProduct } from "@/types/commerce";

function messageFor(dict: ReturnType<typeof useI18n>["dict"], code: string) {
  return dict.errors[code as keyof typeof dict.errors] ?? dict.errors.generic;
}

export function ColorPhotos({
  product,
  draftColors,
}: {
  product: CatalogProduct;
  draftColors: string[];
}) {
  const { dict } = useI18n();
  const copy = dict.admin.products;
  const [photos, setPhotos] = useState(product.images);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = new Map<string, { label: string; hex: string | null }>();
  for (const variant of product.variants) {
    const key = colorKey(variant.color);
    if (!key || saved.has(key)) continue;
    saved.set(key, { label: variant.color?.trim() || key, hex: variant.colorHex });
  }
  const pending = draftColors.filter((color) => color.trim() && !saved.has(colorKey(color)));
  const groups = [
    { key: "", label: copy.sharedPhotos, hex: null as string | null, hint: copy.sharedPhotosHint },
    ...[...saved.entries()].map(([key, color]) => ({ key, label: color.label, hex: color.hex, hint: "" })),
  ];

  async function addPhoto(event: FormEvent<HTMLFormElement>, color: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = [...(form.elements.namedItem("file") as HTMLInputElement).files ?? []];
    if (!files.length) return;
    setBusy(true);
    const added: CatalogImage[] = [];
    for (const file of files) {
      const data = new FormData();
      data.set("productId", product.id);
      data.set("file", file);
      if (color) data.set("color", color);
      const result = await uploadProductImage(data);
      if (!result.ok) {
        setNotice(messageFor(dict, result.code));
        break;
      }
      added.push(result.image);
    }
    setBusy(false);
    if (added.length) setPhotos((current) => [...current, ...added]);
    if (added.length === files.length) setNotice("");
    form.reset();
  }

  async function movePhoto(group: CatalogImage[], from: number, delta: number) {
    const target = from + delta;
    if (target < 0 || target >= group.length) return;
    const next = [...group];
    const [item] = next.splice(from, 1);
    next.splice(target, 0, item);
    setPhotos((current) => {
      const rest = current.filter((image) => !next.some((item) => item.id === image.id));
      return [...rest, ...next];
    });
    const data = new FormData();
    data.set("productId", product.id);
    data.set("ids", next.map((image) => image.id).join(","));
    await reorderProductImages(data);
  }

  async function removePhoto(image: CatalogImage) {
    const data = new FormData();
    data.set("id", image.id);
    data.set("productId", product.id);
    setBusy(true);
    await deleteProductImage(data);
    setBusy(false);
    setPhotos((current) => current.filter((item) => item.id !== image.id));
    setNotice("");
  }

  return (
    <div id="photos-couleur" className="grid gap-4 border border-line p-4">
      <div>
        <h2 className="font-display text-3xl">{copy.photosByColor}</h2>
        <p className="mt-2 text-sm text-stone">{copy.photosByColorHint}</p>
      </div>
      {saved.size === 0 ? <p className="text-sm">{copy.noVariantColor}</p> : null}
      {pending.map((color) => (
        <p key={color} className="text-sm">{copy.unsavedColor} {color.trim()}.</p>
      ))}
      {groups.map((group) => {
        const items = photos.filter((image) => colorKey(image.color) === group.key);
        return (
          <section key={group.key || "shared"} className="grid gap-3 border border-line p-4">
            <div className="flex items-center gap-2">
              {group.hex ? <span className="inline-block h-3 w-3 border border-line" style={{ background: group.hex }} /> : null}
              <h3 className="text-sm uppercase tracking-[0.14em]">{group.label}</h3>
            </div>
            {group.hint ? <p className="text-sm text-stone">{group.hint}</p> : null}
            {items.length === 0 ? <p className="text-sm text-stone">{copy.noColorPhotos}</p> : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {items.map((image, imageIndex) => (
                <div key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.alt} className="aspect-square w-full object-cover" />
                  {imageIndex === 0 ? <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-champagne">{copy.mainPhoto}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button type="button" disabled={busy || imageIndex === 0} onClick={() => movePhoto(items, imageIndex, -1)}>{copy.moveUp}</button>
                    <button type="button" disabled={busy || imageIndex === items.length - 1} onClick={() => movePhoto(items, imageIndex, 1)}>{copy.moveDown}</button>
                    <button type="button" disabled={busy} onClick={() => removePhoto(image)}>{copy.removeImage}</button>
                  </div>
                </div>
              ))}
            </div>
            <form className="flex flex-wrap items-center gap-3" onSubmit={(event) => addPhoto(event, group.key ? group.label : "")}>
              <input name="file" type="file" accept="image/jpeg,image/png,image/webp" multiple />
              <button className="btn btn-ghost" type="submit" disabled={busy}>{copy.addImages}</button>
            </form>
          </section>
        );
      })}
      {notice ? <Notice tone="danger">{notice}</Notice> : null}
    </div>
  );
}
