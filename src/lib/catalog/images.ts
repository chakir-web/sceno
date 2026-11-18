import type { CatalogImage } from "@/types/commerce";

export function colorKey(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function imagesForColor(images: CatalogImage[], color: string | null | undefined) {
  const key = colorKey(color);
  const shared = images.filter((image) => !colorKey(image.color));
  if (!key) return shared.length ? shared : images;
  const specific = images.filter((image) => colorKey(image.color) === key);
  if (specific.length) return specific;
  return shared.length ? shared : images;
}

export function galleryImages(images: CatalogImage[], color: string | null | undefined) {
  const visible = images.filter((image) => image.url);
  const key = colorKey(color);
  if (!key) return visible;
  const specific = visible.filter((image) => colorKey(image.color) === key);
  if (!specific.length) return visible;
  const rest = visible.filter((image) => colorKey(image.color) !== key);
  return [...specific, ...rest];
}
