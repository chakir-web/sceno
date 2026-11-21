import { describe, expect, it } from "vitest";
import { catalogContentId, tiktokCommerce } from "@/lib/tiktok/commerce";
import { buildTikTokBody, hashTikTokPhone } from "@/lib/tiktok/event-payload";

describe("TikTok commerce payload", () => {
  it("uses the variant SKU and puts content_id on the event and on each product", () => {
    expect(catalogContentId({ id: "product-uuid", sku: "SCN-LUM-001" }, { sku: "SCN-LUM-001-LAI" })).toBe("SCN-LUM-001-LAI");
    expect(catalogContentId({ id: "product-uuid", sku: "" }, { sku: "  " })).toBe("product-uuid");

    const single = tiktokCommerce([{ id: "SCN-LUM-001-LAI", name: "Lampe Atlas", quantity: 1, price: 249 }], 249, "Luminaire");
    expect(single).toMatchObject({
      content_id: "SCN-LUM-001-LAI",
      content_ids: ["SCN-LUM-001-LAI"],
      content_type: "product",
      content_category: "Luminaire",
      quantity: 1,
      num_items: 1,
      value: 249,
      currency: "MAD",
    });
    expect(single?.contents[0]).toEqual({ content_id: "SCN-LUM-001-LAI", content_name: "Lampe Atlas", quantity: 1, price: 249 });
    expect(single?.contents[0]).not.toHaveProperty("content_type");

    const many = tiktokCommerce([
      { id: "SCN-LUM-001-LAI", name: "Lampe Atlas", quantity: 1, price: 249 },
      { id: "SCN-CER-002-SAB", name: "Vase Sirocco", quantity: 2, price: 80 },
    ], 409);
    expect(many?.content_id).toBe("SCN-LUM-001-LAI");
    expect(many?.content_ids).toEqual(["SCN-LUM-001-LAI", "SCN-CER-002-SAB"]);
    expect(many?.contents.map((item) => item.content_id)).toEqual(["SCN-LUM-001-LAI", "SCN-CER-002-SAB"]);
    expect(many?.quantity).toBe(3);
    expect(tiktokCommerce([{ id: "   " }])).toBeNull();
  });

  it("hashes a Moroccan phone and never puts a token in the body", () => {
    const phone = hashTikTokPhone("0612345678");
    expect(phone).toMatch(/^[a-f0-9]{64}$/);
    expect(phone).not.toContain("0612345678");

    const commerce = tiktokCommerce([{ id: "SCN-LUM-001-LAI", name: "Poncho Nuage", quantity: 1, price: 249 }], 274);
    const body = buildTikTokBody({
      ...commerce!,
      event: "Purchase",
      eventId: "SC-TEST0001",
      phone: "0612345678",
    });

    expect(body.event_source_id).toBe("DC0ER73C77U8M2UV7I20");
    expect(body.data[0].event).toBe("Purchase");
    expect(body.data[0].event_id).toBe("SC-TEST0001");
    expect(body.data[0].properties).toMatchObject({
      currency: "MAD",
      value: 274,
      content_type: "product",
      content_id: "SCN-LUM-001-LAI",
      content_ids: ["SCN-LUM-001-LAI"],
      quantity: 1,
      num_items: 1,
      order_id: "SC-TEST0001",
    });
    expect(JSON.stringify(body)).not.toMatch(/token|Access-Token/i);
    expect(JSON.stringify(body)).not.toContain("0612345678");
    expect(JSON.stringify(body.data[0].properties)).not.toContain("content_type\":\"product\",\"content_name");
  });
});
