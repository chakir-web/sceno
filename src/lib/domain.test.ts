import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv, toCsv } from "@/lib/csv";
import { formatPhone, normalizeMoroccanPhone } from "@/lib/phone";
import {
  lineTotal,
  orderTotal,
  resolveShippingFee,
  sellingPrice,
  unitPrice,
} from "@/lib/pricing";
import {
  canAccessOrder,
  canEditCommerceSettings,
  canTransitionConfirmation,
  canTransitionShipment,
  paymentAfterShipment,
  restoresStock,
} from "@/lib/orders/transitions";
import { manualShippingProvider } from "@/lib/shipping/provider";

describe("téléphone marocain", () => {
  it("accepte les formats nationaux et internationaux", () => {
    expect(normalizeMoroccanPhone("06 12 34 56 78")).toBe("0612345678");
    expect(normalizeMoroccanPhone("+212612345678")).toBe("0612345678");
    expect(normalizeMoroccanPhone("00212712345678")).toBe("0712345678");
    expect(normalizeMoroccanPhone("212522000000")).toBe("0522000000");
  });

  it("refuse un numéro incomplet ou étranger", () => {
    expect(normalizeMoroccanPhone("061234567")).toBeNull();
    expect(normalizeMoroccanPhone("+33612345678")).toBeNull();
    expect(normalizeMoroccanPhone("0412345678")).toBeNull();
  });

  it("formate un numéro national", () => {
    expect(formatPhone("0612345678")).toBe("06 12 34 56 78");
  });
});

describe("prix et livraison", () => {
  it("retient le prix promotionnel seulement s'il est inférieur", () => {
    expect(sellingPrice(480, 420)).toBe(420);
    expect(sellingPrice(480, 480)).toBe(480);
    expect(sellingPrice(480, null)).toBe(480);
  });

  it("laisse une variante fixer son propre prix", () => {
    expect(unitPrice(480, 420, 390)).toBe(390);
    expect(unitPrice(480, 420, null)).toBe(420);
  });

  it("calcule le total sans faire confiance à un prix client", () => {
    expect(lineTotal(420.5, 2)).toBe(841);
    expect(orderTotal(841, 35)).toBe(876);
    expect(
      resolveShippingFee("Casablanca", [{ city: "casablanca", feeMad: 25, isActive: true }], 65),
    ).toBe(25);
    expect(resolveShippingFee("Errachidia", [{ city: "Casablanca", feeMad: 25, isActive: true }], 65)).toBe(65);
  });
});

describe("statuts et permissions", () => {
  it("limite les transitions de confirmation", () => {
    expect(canTransitionConfirmation("new", "confirmed", "pending")).toBe(true);
    expect(canTransitionConfirmation("cancelled", "confirmed", "pending")).toBe(false);
    expect(canTransitionConfirmation("confirmed", "cancelled", "shipped")).toBe(false);
    expect(canTransitionConfirmation("confirmed", "cancelled", "pending")).toBe(true);
  });

  it("réserve l'expédition aux commandes confirmées", () => {
    expect(canTransitionShipment("pending", "prepared", "confirmed")).toBe(true);
    expect(canTransitionShipment("pending", "prepared", "new")).toBe(false);
    expect(restoresStock("confirmation", "cancelled", "pending")).toBe(true);
    expect(restoresStock("confirmation", "unreachable", "pending")).toBe(false);
    expect(restoresStock("shipment", "returned", "delivered")).toBe(true);
    expect(paymentAfterShipment("delivered", "pending")).toBe("collected");
    expect(paymentAfterShipment("returned", "collected")).toBe("reversed");
  });

  it("isole les commandes des confirmateurs", () => {
    expect(canAccessOrder({ id: "a", role: "confirmer" }, "a")).toBe(true);
    expect(canAccessOrder({ id: "a", role: "confirmer" }, "b")).toBe(false);
    expect(canAccessOrder({ id: "admin", role: "admin" }, "b")).toBe(true);
    expect(canEditCommerceSettings("confirmer")).toBe(false);
    expect(canEditCommerceSettings("admin")).toBe(true);
  });
});

describe("csv", () => {
  it("échappe les guillemets et relit les colonnes", () => {
    const csv = toCsv(["order_number", "address"], [["SC-1", 'Rue "Atlas", 12']]);
    const records = csvRecords(csv);
    expect(records[0]?.order_number).toBe("SC-1");
    expect(records[0]?.address).toBe('Rue "Atlas", 12');
    expect(parseCsv("a,b\n1,2").length).toBe(2);
  });

  it("exporte un bordereau manuel sans appeler de transporteur", () => {
    const csv = manualShippingProvider.exportOrders([
      {
        orderNumber: "SC-1",
        customerName: "Sara Bennani",
        phone: "0612345678",
        city: "Rabat",
        address: "12 rue des Consuls",
        totalMad: 500,
        shippingFeeMad: 30,
        items: "Lampe Atlas x1",
      },
    ]);
    expect(manualShippingProvider.mode).toBe("manual");
    expect(csv).toContain("order_number");
    expect(csv).toContain("SC-1");
  });
});
