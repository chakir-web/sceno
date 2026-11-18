import type { ConfirmationStatus, PaymentStatus, ShipmentStatus } from "@/lib/orders/transitions";

export type Variant = {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  priceMad: number | null;
  stockQuantity: number;
  isActive: boolean;
};

export type CatalogImage = {
  id: string;
  url: string;
  alt: string;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  sku: string;
  priceMad: number;
  promoPriceMad: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  name: string;
  shortDescription: string;
  description: string;
  nameFr: string;
  nameAr: string;
  shortFr: string;
  shortAr: string;
  descriptionFr: string;
  descriptionAr: string;
  images: CatalogImage[];
  variants: Variant[];
  createdAt: string;
};

export type CatalogCategory = {
  id: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  name: string;
  description: string;
  nameFr: string;
  nameAr: string;
  descriptionFr: string;
  descriptionAr: string;
};

export type StoreSettings = {
  id: string;
  storeName: string;
  supportPhone: string;
  supportEmail: string;
  address: string;
  currency: "MAD";
  defaultLocale: "fr" | "ar";
  defaultShippingFeeMad: number;
  aboutFr: string;
  aboutAr: string;
  instagram: string;
  facebook: string;
  logoUrl: string | null;
};

export type ShippingRate = {
  id: string;
  city: string;
  feeMad: number;
  zone: string;
  isActive: boolean;
};

export type OrderItem = {
  id: string;
  productId: string | null;
  variantId: string | null;
  nameFr: string;
  nameAr: string;
  variantLabel: string | null;
  sku: string;
  unitPriceMad: number;
  quantity: number;
  lineTotalMad: number;
};

export type OrderNote = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
};

export type OrderHistory = {
  id: string;
  kind: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
};

export type OrderRecord = {
  id: string;
  orderNumber: string;
  fullName: string;
  phone: string;
  city: string;
  address: string;
  customerNotes: string | null;
  locale: "fr" | "ar";
  confirmationStatus: ConfirmationStatus;
  shipmentStatus: ShipmentStatus;
  paymentStatus: PaymentStatus;
  subtotalMad: number;
  shippingFeeMad: number;
  totalMad: number;
  assignedConfirmerId: string | null;
  confirmerName: string | null;
  createdAt: string;
  items?: OrderItem[];
  notes?: OrderNote[];
  history?: OrderHistory[];
  carrierName?: string | null;
  trackingNumber?: string | null;
  carrierFeeMad?: number | null;
  shippedAt?: string | null;
  ozoneParcelId?: string | null;
  ozoneStatus?: string | null;
  ozoneStatusLabel?: string | null;
  ozoneLastEventAt?: string | null;
  ozoneSyncedAt?: string | null;
  ozoneError?: string | null;
  ozoneDispatchStartedAt?: string | null;
  ozoneDeliveryNoteRef?: string | null;
};

export type Carrier = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  isActive: boolean;
};

export type StaffProfile = {
  id: string;
  role: "admin" | "confirmer" | "customer";
  fullName: string;
  phone: string | null;
  isActive: boolean;
  email?: string;
};

export type DataState<T> = {
  configured: boolean;
  ready: boolean;
  data: T;
};
