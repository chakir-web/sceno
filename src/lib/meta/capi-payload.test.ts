import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildMetaData, capiTestCode, hashMetaCountry, hashMetaEmail, hashMetaPhone, hashMetaText, metaUserData, splitPersonName } from "@/lib/meta/capi-payload";
import { metaPurchaseEventId } from "@/lib/meta/event-id";

const phoneHash = createHash("sha256").update("212612345678").digest("hex");

describe("Meta Conversions API", () => {
  it("partage un event_id Purchase déterministe", () => {
    expect(metaPurchaseEventId("SC-3BB0A0A3")).toBe("purchase_SC-3BB0A0A3");
    expect(metaPurchaseEventId(" SC-EAC277B9 ")).toBe("purchase_SC-EAC277B9");
  });

  it("hashe les données personnelles et laisse ip, user-agent, fbp et fbc en clair", () => {
    expect(hashMetaPhone("06 12 34 56 78")).toBe(phoneHash);
    expect(hashMetaEmail("  Client@Example.com ")).toBe(createHash("sha256").update("client@example.com").digest("hex"));
    expect(hashMetaText("Fès")).toBe(createHash("sha256").update("fes").digest("hex"));
    expect(hashMetaCountry("MA")).toBe(createHash("sha256").update("ma").digest("hex"));
    expect(hashMetaPhone("123")).toBe("");

    const user = metaUserData({
      phone: "0612345678",
      email: "client@example.com",
      firstName: "Sara",
      lastName: "Bennani",
      city: "FES",
      country: "ma",
      ip: "203.0.113.8",
      userAgent: "Mozilla/5.0",
      fbp: "fb.1.1558571054389.1098115397",
      fbc: "fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz1234567890",
    });
    expect(user.ph).toEqual([phoneHash]);
    expect(user.client_ip_address).toBe("203.0.113.8");
    expect(user.client_user_agent).toBe("Mozilla/5.0");
    expect(user.fbp).toBe("fb.1.1558571054389.1098115397");
    expect(user.fbc).toBe("fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz1234567890");
    expect(JSON.stringify(user)).not.toContain("0612345678");
    expect(metaUserData({ fbp: "invented", fbc: "also-invented" })).not.toHaveProperty("fbp");
  });

  it("aligne le Purchase serveur sur la valeur, la devise et les produits du Pixel", () => {
    const eventId = metaPurchaseEventId("SC-3BB0A0A3");
    const event = buildMetaData({
      eventName: "Purchase",
      eventId,
      eventTime: 1_763_000_000,
      eventSourceUrl: "https://sceno.store/checkout",
      value: 274,
      orderId: "SC-3BB0A0A3",
      contentIds: ["product-1"],
      contents: [{ id: "product-1", quantity: 1, itemPrice: 249 }],
      numItems: 1,
      user: { phone: "0612345678", city: "FES", country: "ma", ip: "203.0.113.8", userAgent: "Mozilla/5.0" },
    });
    expect(event.event_name).toBe("Purchase");
    expect(event.event_id).toBe("purchase_SC-3BB0A0A3");
    expect(event.event_time).toBe(1_763_000_000);
    expect(event.action_source).toBe("website");
    expect(event.custom_data).toMatchObject({
      value: 274,
      currency: "MAD",
      order_id: "SC-3BB0A0A3",
      content_type: "product",
      content_ids: ["product-1"],
      num_items: 1,
    });
    expect(event).not.toHaveProperty("access_token");
    expect(event).not.toHaveProperty("test_event_code");
    expect(splitPersonName("Sara Bennani")).toEqual({ firstName: "Sara", lastName: "Bennani" });
    expect(capiTestCode("TEST12345", { vercel: "preview", node: "production" })).toBe("TEST12345");
    expect(capiTestCode("TEST12345", { vercel: "production", node: "production" })).toBe("");
    expect(capiTestCode("not-a-code", { vercel: "preview" })).toBe("");
  });
});
