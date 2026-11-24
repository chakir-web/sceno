import { describe, expect, it } from "vitest";
import { getMetaCartData, getMetaProductData, metaContentId } from "@/lib/meta/product";

const ponchoId = "90e04d10-1ca1-4d70-aebb-c372cf1d9308";
const poncho = {
  id: ponchoId,
  sku: "PON-STD",
  name: "Poncho Nuage",
  categoryName: "Pyjama Femme",
};

describe("identifiant produit Meta", () => {
  it("utilise le SKU produit quand il n'y a pas de variante", () => {
    const event = getMetaProductData({ id: "lampe-id", sku: "LAMPE-ATLAS", name: "Lampe Atlas" }, { quantity: 1, unitPrice: 1890 });
    expect(metaContentId({ id: "lampe-id", sku: "LAMPE-ATLAS" })).toBe("LAMPE-ATLAS");
    expect(event?.content_ids).toEqual(["LAMPE-ATLAS"]);
    expect(event?.contents[0]?.id).toBe("LAMPE-ATLAS");
  });

  it("préfère le SKU de la variante noire au SKU produit", () => {
    const event = getMetaProductData(poncho, { variantSku: "PON-STD-NOIR", quantity: 1, unitPrice: 249 });
    expect(event).toMatchObject({
      content_ids: ["PON-STD-NOIR"],
      content_type: "product",
      contents: [{ id: "PON-STD-NOIR", quantity: 1, item_price: 249 }],
      value: 249,
      currency: "MAD",
    });
    expect(event?.content_ids).not.toContain("PON-STD");
    expect(event?.content_ids).not.toContain(ponchoId);
  });

  it("utilise le SKU bordeaux de la variante sélectionnée", () => {
    expect(metaContentId(poncho, "PON-STD-BORD")).toBe("PON-STD-BORD");
    expect(getMetaProductData(poncho, { variantSku: "PON-STD-BORD", quantity: 1, unitPrice: 249 })?.content_ids).toEqual(["PON-STD-BORD"]);
  });

  it("retombe sur l'UUID Supabase sans SKU", () => {
    const event = getMetaProductData({ id: ponchoId, sku: "  " }, { variantSku: " ", quantity: 1, unitPrice: 249 });
    expect(event?.content_ids).toEqual([ponchoId]);
    expect(event?.contents[0]?.id).toBe(ponchoId);
  });

  it("donne un content ID propre à chaque ligne du panier", () => {
    const event = getMetaCartData([
      { id: ponchoId, sku: "PON-STD-NOIR", quantity: 1, unitPrice: 249 },
      { id: "lampe-id", sku: "LAMPE-ATLAS", quantity: 2, unitPrice: 1890 },
    ], 4029);
    expect(event?.content_ids).toEqual(["PON-STD-NOIR", "LAMPE-ATLAS"]);
    expect(event?.contents.map((item) => item.id)).toEqual(["PON-STD-NOIR", "LAMPE-ATLAS"]);
    expect(event?.content_type).toBe("product");
    expect(event?.currency).toBe("MAD");
  });

  it("envoie une quantité et un prix numériques", () => {
    const event = getMetaProductData(poncho, { variantSku: "PON-STD-VER", quantity: 3, unitPrice: 249 });
    expect(event?.contents[0]?.quantity).toBe(3);
    expect(typeof event?.contents[0]?.quantity).toBe("number");
    expect(event?.contents[0]?.item_price).toBe(249);
    expect(typeof event?.contents[0]?.item_price).toBe("number");
    expect(event?.value).toBe(747);
    expect(getMetaProductData(poncho, { variantSku: "PON-STD-BEG", quantity: 1, unitPrice: 249 })?.content_ids).toEqual(["PON-STD-BEG"]);
  });
});
