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
