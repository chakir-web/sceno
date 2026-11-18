import type { Metadata } from "next";
import { CheckoutForm } from "@/components/store/checkout-form";
import { getI18n } from "@/lib/i18n/server";
import { listRates } from "@/lib/services/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: { absolute: dict.meta.checkoutTitle } };
}

export default async function CheckoutPage() {
  const { dict } = await getI18n();
  const rates = await listRates(false);
  const cities = rates.data.map((rate) => ({ city: rate.city, feeMad: rate.feeMad }));
  const casablanca = cities.find((item) => item.city.trim().toLocaleLowerCase("fr") === "casablanca");
  return (
    <div>
      <h1 className="font-display text-5xl">{dict.checkout.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone">{dict.checkout.lead}</p>
      <div className="mt-8">
        <CheckoutForm cities={cities} defaultCity={casablanca?.city ?? cities[0]?.city ?? ""} />
      </div>
    </div>
  );
}
