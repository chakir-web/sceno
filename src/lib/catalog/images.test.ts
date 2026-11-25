import { describe, expect, it } from "vitest";
import { galleryImages } from "@/lib/catalog/images";

const pack = [
  { id: "cover", url: "cover.jpg", alt: "", color: null },
  { id: "noir-1", url: "noir.jpg", alt: "", color: "NOIR" },
  { id: "noir-2", url: "noir.jpg", alt: "", color: "NOIR" },
  { id: "bord", url: "bordeaux.jpg", alt: "", color: "BORDEAUX" },
  { id: "vert", url: "vert.jpg", alt: "", color: "VERT" },
];

describe("galerie par couleur", () => {
  it("n'affiche que les photos de la couleur choisie", () => {
    expect(galleryImages(pack, "BORDEAUX").map((image) => image.id)).toEqual(["bord"]);
    expect(galleryImages(pack, "NOIR").map((image) => image.id)).toEqual(["noir-1"]);
    expect(galleryImages(pack, "VERT").map((image) => image.url)).toEqual(["vert.jpg"]);
  });

  it("retombe sur les photos communes quand la couleur n'a pas d'image", () => {
    expect(galleryImages(pack, "BEIGE").map((image) => image.id)).toEqual(["cover"]);
  });
});