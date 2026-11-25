import { describe, expect, it } from "vitest";
import { getMetaProductData, metaContentId, purchasePixelData, variantForSelection } from "@/lib/meta/product";
import { metaFunnelEventId, metaPurchaseEventId } from "@/lib/meta/event-id";
import { buildMetaData } from "@/lib/meta/capi-payload";
import { initialFunnelSent, nextDirectFunnelEvents, readFunnelSent, shouldSendPurchase, writeFunnelSent, type DirectOrderFields, type FunnelSent } from "@/lib/meta/direct-funnel";

const ponchoId = "90e04d10-1ca1-4d70-aebb-c372cf1d9308";
const poncho = { id: ponchoId, sku: "PON-STD", name: "Poncho Nuage", categoryName: "Pyjama Femme" };
const variants = [
  { id: "noir", isActive: true, color: "NOIR", sku: "PON-STD-NOIR" },
  { id: "bord", isActive: true, color: "BORDEAUX", sku: "PON-STD-BORD" },
  { id: "xl-noir", isActive: true, color: "NOIR", sku: "PYJ-XL-NOIR" },
];

const empty: DirectOrderFields = { fullName: "", phone: "", address: "", city: "" };
const nameOnly: DirectOrderFields = { ...empty, fullName: "Ahmed Bennani" };
const namePhone: DirectOrderFields = { ...nameOnly, phone: "0612345678" };
const ready: DirectOrderFields = { ...namePhone, address: "12 rue Atlas", city: "Fès" };

function walk(steps: Array<{ fields: DirectOrderFields; sku: string }>) {
  let sent: FunnelSent = initialFunnelSent();
  const fired: Array<{ event: "AddToCart" | "InitiateCheckout"; sku: string }> = [];
  for (const step of steps) {
    const next = nextDirectFunnelEvents(sent, step.fields);
    if (next.fireAddToCart) fired.push({ event: "AddToCart", sku: step.sku });
    if (next.fireInitiateCheckout) fired.push({ event: "InitiateCheckout", sku: step.sku });
    sent = next.sent;
  }
  return fired;
}

describe("entonnoir commande directe", () => {
  it("ouvre une fiche sur une seule variante", () => {
    const variant = variantForSelection(variants, { variantId: "noir", color: "NOIR" });
    expect(variant?.sku).toBe("PON-STD-NOIR");
    expect(getMetaProductData(poncho, { variantSku: variant?.sku, quantity: 1, unitPrice: 249 })?.content_ids).toEqual(["PON-STD-NOIR"]);
  });

  it("ne marque pas AddToCart sans saisie", () => {
    expect(walk([{ fields: empty, sku: "PON-STD-NOIR" }])).toEqual([]);
  });

  it("attend le téléphone en plus du nom", () => {
    expect(walk([{ fields: nameOnly, sku: "PON-STD-NOIR" }])).toEqual([]);
  });

  it("marque AddToCart une fois avec un nom et un téléphone valides", () => {
    expect(walk([{ fields: namePhone, sku: "PON-STD-NOIR" }])).toEqual([{ event: "AddToCart", sku: "PON-STD-NOIR" }]);
  });

  it("ne répète pas AddToCart quand la saisie continue", () => {
    const fired = walk([
      { fields: namePhone, sku: "PON-STD-NOIR" },
      { fields: { ...namePhone, address: "12 r" }, sku: "PON-STD-NOIR" },
      { fields: namePhone, sku: "PON-STD-NOIR" },
    ]);
    expect(fired.filter((event) => event.event === "AddToCart")).toHaveLength(1);
  });

  it("marque InitiateCheckout une fois quand le formulaire est prêt", () => {
    const fired = walk([
      { fields: namePhone, sku: "PON-STD-NOIR" },
      { fields: ready, sku: "PON-STD-BORD" },
      { fields: { ...ready, address: "12 rue Atlas, étage 2" }, sku: "PON-STD-BORD" },
    ]);
    expect(fired).toEqual([
      { event: "AddToCart", sku: "PON-STD-NOIR" },
      { event: "InitiateCheckout", sku: "PON-STD-BORD" },
    ]);
  });

  it("utilise le nouveau SKU si la variante change avant AddToCart", () => {
    expect(walk([
      { fields: nameOnly, sku: "PON-STD-NOIR" },
      { fields: namePhone, sku: "PON-STD-BORD" },
    ])).toEqual([{ event: "AddToCart", sku: "PON-STD-BORD" }]);
  });

  it("ne renvoie pas AddToCart si la variante change après", () => {
    const fired = walk([
      { fields: namePhone, sku: "PON-STD-NOIR" },
      { fields: namePhone, sku: "PON-STD-BORD" },
    ]);
    expect(fired).toEqual([{ event: "AddToCart", sku: "PON-STD-NOIR" }]);
  });

  it("ne compte pas une commande échouée ou rejouée", () => {
    expect(shouldSendPurchase(null)).toBe(false);
    expect(shouldSendPurchase({ replayed: true })).toBe(false);
    expect(shouldSendPurchase({ replayed: false })).toBe(true);
  });

  it("partage un event_id Purchase et sépare les événements d'intention", () => {
    const purchase = metaPurchaseEventId("SC-3BB0A0A3");
    const cart = metaFunnelEventId("AddToCart");
    const checkout = metaFunnelEventId("InitiateCheckout");
    const capi = buildMetaData({
      eventName: "Purchase",
      eventId: purchase,
      eventTime: 1,
      value: 249,
      orderId: "SC-3BB0A0A3",
      contentIds: ["PON-STD-NOIR"],
      contents: [{ id: "PON-STD-NOIR", quantity: 1, itemPrice: 249 }],
    });
    expect(purchase).toBe("purchase_SC-3BB0A0A3");
    expect(capi.event_id).toBe(purchase);
    expect(capi.custom_data.currency).toBe("MAD");
    expect(cart.startsWith("addtocart_")).toBe(true);
    expect(checkout.startsWith("initiatecheckout_")).toBe(true);
    expect(cart).not.toBe(checkout);
    expect(cart).not.toBe(purchase);
  });

  it("retient AddToCart dans la session du produit", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const first = nextDirectFunnelEvents(readFunnelSent(storage, ponchoId), namePhone);
    writeFunnelSent(storage, ponchoId, first.sent);
    const again = nextDirectFunnelEvents(readFunnelSent(storage, ponchoId), ready);
    const otherProduct = nextDirectFunnelEvents(readFunnelSent(storage, "autre-produit"), namePhone);
    expect(first.fireAddToCart).toBe(true);
    expect(again.fireAddToCart).toBe(false);
    expect(again.fireInitiateCheckout).toBe(true);
    expect(otherProduct.fireAddToCart).toBe(true);
  });

  it("n'utilise pas l'UUID quand un SKU existe et garde MAD", () => {
    const meta = getMetaProductData(poncho, { variantSku: "PON-STD-VER", quantity: 1, unitPrice: 249 });
    expect(meta).not.toBeNull();
    const pixel = purchasePixelData(meta!, 249);
    expect(pixel.currency).toBe("MAD");
    expect(pixel.value).toBe(249);
    expect(pixel.content_type).toBe("product");
    expect(pixel.content_ids).toEqual(["PON-STD-VER"]);
    expect(pixel.content_ids).not.toContain(ponchoId);
    expect(metaContentId(poncho, "PON-STD-BEG")).toBe("PON-STD-BEG");
    expect("currency" in pixel.contents[0]!).toBe(false);
  });

  it("suit la variante choisie même si une autre taille a la même couleur", () => {
    expect(variantForSelection(variants, { variantId: "xl-noir", color: "NOIR" })?.sku).toBe("PYJ-XL-NOIR");
  });
});
