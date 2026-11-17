const origin = "http://localhost:3010";

async function text(path) {
  const response = await fetch(origin + path, { redirect: "manual" });
  const body = await response.text();
  return { status: response.status, location: response.headers.get("location"), body };
}

async function post(path, payload) {
  const response = await fetch(origin + path, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { status: response.status, body };
}

const home = await text("/");
const products = await text("/products");
const category = await text("/categories/luminaires");
const cart = await text("/cart");
const login = await text("/auth/login");
const admin = await text("/admin/dashboard");
const confirmer = await text("/confirmer/dashboard");

const quote = await post("/api/checkout/quote", {
  city: "Casablanca",
  locale: "fr",
  items: [{ productId: "10000000-0000-4000-8000-000000000001", variantId: "20000000-0000-4000-8000-000000000001", quantity: 1, price: 1 }],
});
const track = await post("/api/track", { orderNumber: "SC-ABSENT1", phone: "0612345678" });

const quoteBody = quote.body?.quote ?? {};
console.log(JSON.stringify({
  home: home.status,
  catalog: home.body.includes("Lampe Atlas") && products.body.includes("Lampe Atlas"),
  categories: category.body.includes("Lampe Atlas") || category.body.includes("Luminaires"),
  cart: cart.status === 200,
  quoteStatus: quote.status,
  unit: quoteBody.subtotalMad ?? quoteBody.subtotal_mad ?? null,
  shipping: quoteBody.shippingFeeMad ?? quoteBody.shipping_fee_mad ?? null,
  total: quoteBody.totalMad ?? quoteBody.total_mad ?? null,
  ignoredClientPrice: (quoteBody.subtotalMad ?? quoteBody.subtotal_mad) !== 1,
  trackStatus: track.status,
  trackCode: track.body?.code ?? null,
  loginBootstrap: login.body.includes("Premier administrateur"),
  admin: `${admin.status} ${admin.location ?? ""}`,
  confirmer: `${confirmer.status} ${confirmer.location ?? ""}`,
}, null, 2));
