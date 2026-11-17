import { toCsv } from "@/lib/csv";

export type ShipmentExportRow = {
  orderNumber: string;
  customerName: string;
  phone: string;
  city: string;
  address: string;
  totalMad: number;
  shippingFeeMad: number;
  items: string;
};

/**
 * Contrat prévu pour une future API transporteur.
 * La version actuelle n'effectue aucun appel réseau et ne simule pas de suivi automatique.
 */
export interface ShippingProvider {
  readonly id: string;
  readonly mode: "manual" | "api";
  exportOrders(rows: ShipmentExportRow[]): string;
}

export const manualShippingProvider: ShippingProvider = {
  id: "manual",
  mode: "manual",
  exportOrders(rows) {
    return toCsv(
      ["order_number", "customer_name", "phone", "city", "address", "total_mad", "shipping_fee_mad", "items"],
      rows.map((row) => [
        row.orderNumber,
        row.customerName,
        row.phone,
        row.city,
        row.address,
        row.totalMad,
        row.shippingFeeMad,
        row.items,
      ]),
    );
  },
};
