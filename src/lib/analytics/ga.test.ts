import { afterEach, describe, expect, it, vi } from "vitest";
import { purchaseEvent, trackPurchase } from "@/lib/analytics/ga";

const poncho = {
  id: "PON-STD-NOIR",
  name: "Poncho Nuage",
  variant: "STANDARD / NOIR",
  price: 249,
  quantity: 1,
};

describe("GA4 purchase", () => {
  it("sends the order number, the paid total, the shipping fee and the SKU once", () => {
    const payload = purchaseEvent({
      transactionId: "SC-C023F239",
      value: 274,
      shipping: 25,
      items: [poncho],
    });
    expect(payload).toEqual({
      transaction_id: "SC-C023F239",
      value: 274,
      currency: "MAD",
      shipping: 25,
      items: [{ item_id: "PON-STD-NOIR", item_name: "Poncho Nuage", item_variant: "STANDARD / NOIR", price: 249, quantity: 1 }],
    });
  });

  it("drops a replayed order, a missing order number and an order without products", () => {
    expect(purchaseEvent({ replayed: true, transactionId: "SC-1", value: 274, items: [poncho] })).toBeNull();
    expect(purchaseEvent({ transactionId: "  ", value: 274, items: [poncho] })).toBeNull();
    expect(purchaseEvent({ transactionId: "SC-1", value: 274, items: [{ ...poncho, id: " " }] })).toBeNull();
  });
});

describe("GA4 purchase is sent once per order", () => {
  const events: unknown[][] = [];
  const storage = new Map<string, string>();

  afterEach(() => {
    events.length = 0;
    storage.clear();
    vi.unstubAllGlobals();
  });

  it("pushes a single purchase even if the success handler runs twice", () => {
    vi.stubGlobal("window", {
      gtag: (...args: unknown[]) => { events.push(args); },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
      },
    });
    const input = { transactionId: "SC-ONCE", value: 274, shipping: 25, items: [poncho] };
    expect(trackPurchase(input)).toBe(true);
    expect(trackPurchase(input)).toBe(false);
    expect(trackPurchase({ ...input, replayed: true })).toBe(false);
    expect(events).toEqual([["event", "purchase", purchaseEvent(input)]]);
  });
});
