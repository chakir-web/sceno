"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getDictionary } from "@/lib/i18n";
import { direction, type Locale } from "@/lib/i18n/locales";

export type CartLine = {
  productId: string;
  variantId: string;
  quantity: number;
  name: string;
  slug: string;
  image: string | null;
  unitPrice: number;
  variantLabel: string;
};

export type CartNotice = {
  key: number;
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  variantLabel: string;
};

const LocaleContext = createContext<{ locale: Locale; dict: ReturnType<typeof getDictionary> } | null>(null);
const CartContext = createContext<{
  items: CartLine[];
  count: number;
  notice: CartNotice | null;
  bump: number;
  drawer: boolean;
  add: (line: CartLine) => void;
  update: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  dismissNotice: () => void;
} | null>(null);

const CART_KEY = "sceno_cart";

export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("Locale manquante");
  return value;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("Panier manquant");
  return value;
}

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const dict = useMemo(() => getDictionary(locale), [locale]);
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<CartNotice | null>(null);
  const [bump, setBump] = useState(0);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale === "ar" ? "ar" : "fr";
    document.documentElement.dir = direction(locale);
  }, [locale]);

  useEffect(() => {
    const stored = window.localStorage.getItem(CART_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CartLine[];
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {
        setItems([]);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, ready]);

  const openDrawer = useCallback(() => setDrawer(true), []);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const cart = useMemo(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    notice,
    bump,
    drawer,
    add(line: CartLine) {
      setItems((current) => {
        const index = current.findIndex((item) => item.variantId === line.variantId);
        if (index < 0) return [...current, line];
        return current.map((item) => item.variantId === line.variantId ? { ...item, quantity: Math.min(20, item.quantity + line.quantity) } : item);
      });
      setNotice({
        key: Date.now(),
        name: line.name,
        image: line.image,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        variantLabel: line.variantLabel,
      });
      setBump((value) => value + 1);
    },
    update(variantId: string, quantity: number) {
      setItems((current) => current.flatMap((item) => item.variantId !== variantId ? [item] : quantity < 1 ? [] : [{ ...item, quantity: Math.min(20, quantity) }]));
    },
    remove(variantId: string) {
      setItems((current) => current.filter((item) => item.variantId !== variantId));
    },
    clear() {
      setItems([]);
      setNotice(null);
    },
    openDrawer,
    closeDrawer,
    dismissNotice,
  }), [items, notice, bump, drawer, openDrawer, closeDrawer, dismissNotice]);

  return (
    <LocaleContext.Provider value={{ locale, dict }}>
      <CartContext.Provider value={cart}>{children}</CartContext.Provider>
    </LocaleContext.Provider>
  );
}
