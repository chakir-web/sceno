export type ShippingRate = {
  city: string;
  feeMad: number;
  isActive: boolean;
};

/** Prix de vente affiché et facturé. Le prix promo n'est retenu que s'il est strictement inférieur. */
export function sellingPrice(priceMad: number, promoPriceMad: number | null | undefined) {
  if (promoPriceMad != null && promoPriceMad >= 0 && promoPriceMad < priceMad) return roundMoney(promoPriceMad);
  return roundMoney(priceMad);
}

export function unitPrice(productPrice: number, promoPrice: number | null | undefined, variantPrice: number | null | undefined) {
  if (variantPrice != null && variantPrice >= 0) return roundMoney(variantPrice);
  return sellingPrice(productPrice, promoPrice);
}

export function lineTotal(unit: number, quantity: number) {
  return roundMoney(unit * quantity);
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function resolveShippingFee(city: string, rates: ShippingRate[], defaultFeeMad: number) {
  const key = city.trim().toLocaleLowerCase("fr");
  const match = rates.find((rate) => rate.isActive && rate.city.trim().toLocaleLowerCase("fr") === key);
  return roundMoney(match ? match.feeMad : defaultFeeMad);
}

export function orderTotal(subtotalMad: number, shippingFeeMad: number) {
  return roundMoney(subtotalMad + shippingFeeMad);
}
