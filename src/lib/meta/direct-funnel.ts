import { normalizeMoroccanPhone } from "@/lib/phone";

export type DirectOrderFields = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
};

export type FunnelSent = {
  addToCart: boolean;
  initiateCheckout: boolean;
};

const emptySent: FunnelSent = { addToCart: false, initiateCheckout: false };

export function directOrderIntent(fields: DirectOrderFields) {
  const nameReady = fields.fullName.trim().length >= 3;
  const phoneReady = normalizeMoroccanPhone(fields.phone) !== null;
  const addressReady = fields.address.trim().length >= 5;
  const cityReady = fields.city.trim().length >= 2;
  const addToCart = nameReady && phoneReady;
  return {
    addToCart,
    initiateCheckout: addToCart && addressReady && cityReady,
  };
}

/** Un seul AddToCart et un seul InitiateCheckout. L'ordre reste AddToCart puis InitiateCheckout. */
export function nextDirectFunnelEvents(sent: FunnelSent, fields: DirectOrderFields) {
  const intent = directOrderIntent(fields);
  const fireAddToCart = !sent.addToCart && intent.addToCart;
  const fireInitiateCheckout = !sent.initiateCheckout && intent.initiateCheckout;
  return {
    fireAddToCart,
    fireInitiateCheckout,
    sent: {
      addToCart: sent.addToCart || fireAddToCart,
      initiateCheckout: sent.initiateCheckout || fireInitiateCheckout,
    },
  };
}

export function initialFunnelSent(): FunnelSent {
  return { ...emptySent };
}

const FUNNEL_STORAGE_PREFIX = "sceno-meta-funnel:";

export function funnelStorageKey(productId: string) {
  return `${FUNNEL_STORAGE_PREFIX}${productId.trim()}`;
}

type FunnelStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function readFunnelSent(storage: FunnelStorage | null, productId: string): FunnelSent {
  if (!storage || !productId.trim()) return initialFunnelSent();
  try {
    const raw = storage.getItem(funnelStorageKey(productId));
    if (!raw) return initialFunnelSent();
    const parsed = JSON.parse(raw) as Partial<FunnelSent>;
    return {
      addToCart: parsed.addToCart === true,
      initiateCheckout: parsed.initiateCheckout === true,
    };
  } catch {
    return initialFunnelSent();
  }
}

export function writeFunnelSent(storage: FunnelStorage | null, productId: string, sent: FunnelSent) {
  if (!storage || !productId.trim()) return;
  try {
    storage.setItem(funnelStorageKey(productId), JSON.stringify({
      addToCart: sent.addToCart === true,
      initiateCheckout: sent.initiateCheckout === true,
    }));
  } catch {
    // navigation privée ou quota : le ref de la page reste la protection locale
  }
}

export function browserSessionStorage(): FunnelStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function shouldSendPurchase(order: { replayed?: boolean } | null | undefined) {
  return Boolean(order) && order?.replayed !== true;
}
