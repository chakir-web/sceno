import type { Metadata } from "next";
import { CartView } from "@/components/store/cart-view";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: { absolute: dict.meta.cartTitle } };
}

export default async function CartPage() {
  const { dict } = await getI18n();
  return (
    <div>
      <h1 className="font-display text-5xl">{dict.cart.title}</h1>
      <div className="mt-8"><CartView /></div>
    </div>
  );
}
