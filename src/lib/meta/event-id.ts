const FUNNEL_PREFIX = {
  ViewContent: "viewcontent",
  AddToCart: "addtocart",
  InitiateCheckout: "initiatecheckout",
} as const;

export type MetaFunnelEvent = keyof typeof FUNNEL_PREFIX;

/** Un seul identifiant, partagé par le Pixel et CAPI pour cette action. */
export function metaFunnelEventId(event: MetaFunnelEvent) {
  return `${FUNNEL_PREFIX[event]}_${crypto.randomUUID()}`;
}

/** Purchase déterministe. Le navigateur et le serveur doivent envoyer exactement cette valeur. */
export function metaPurchaseEventId(orderNumber: string) {
  return `purchase_${orderNumber.trim()}`;
}
