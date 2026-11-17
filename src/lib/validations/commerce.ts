import { z } from "zod";
import { confirmationStatuses, shipmentStatuses } from "@/lib/orders/transitions";

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

export const quoteSchema = z.object({
  city: z.string().trim().min(2).max(80),
  locale: z.enum(["fr", "ar"]),
  items: z.array(cartItemSchema).min(1).max(30),
});

export const checkoutSchema = quoteSchema.extend({
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().min(8).max(20),
  address: z.string().trim().min(5).max(300),
  notes: z.string().trim().max(500).optional().default(""),
  idempotencyKey: z.string().uuid(),
});

export const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(2).max(60),
  size: z.string().trim().max(40).optional().default(""),
  color: z.string().trim().max(40).optional().default(""),
  colorHex: z.string().trim().max(7).optional().default(""),
  priceMad: z.number().nonnegative().nullable(),
  stockQuantity: z.number().int().min(0).max(100000),
  expectedStock: z.number().int().min(0).optional(),
});

export const productInputSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  sku: z.string().trim().min(2).max(60),
  priceMad: z.number().nonnegative(),
  promoPriceMad: z.number().nonnegative().nullable(),
  lowStockThreshold: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isNew: z.boolean(),
  nameFr: z.string().trim().min(2).max(160),
  nameAr: z.string().trim().min(2).max(160),
  shortFr: z.string().trim().max(240).default(""),
  shortAr: z.string().trim().max(240).default(""),
  descriptionFr: z.string().trim().max(4000).default(""),
  descriptionAr: z.string().trim().max(4000).default(""),
  variants: z.array(variantInputSchema).min(1).max(40),
});

export const trackSchema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  phone: z.string().trim().min(8).max(20),
});

export const shipmentImportSchema = z.object({
  order_number: z.string().trim().min(4),
  carrier_name: z.string().trim().max(120).optional().default(""),
  tracking_number: z.string().trim().max(120).optional().default(""),
  status: z.enum(shipmentStatuses).optional(),
  shipped_at: z.string().trim().optional().default(""),
  carrier_fee_mad: z.string().trim().optional().default(""),
});

export const confirmationSchema = z.enum(confirmationStatuses);
