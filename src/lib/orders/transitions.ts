export const confirmationStatuses = ["new", "confirming", "confirmed", "cancelled", "unreachable"] as const;
export const shipmentStatuses = [
  "pending",
  "prepared",
  "shipped",
  "in_transit",
  "delivered",
  "absent",
  "postponed",
  "refused",
  "returned",
] as const;
export const paymentStatuses = ["pending", "collected", "reversed"] as const;

export type ConfirmationStatus = (typeof confirmationStatuses)[number];
export type ShipmentStatus = (typeof shipmentStatuses)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type StaffRole = "admin" | "confirmer";

const confirmationGraph: Record<ConfirmationStatus, ConfirmationStatus[]> = {
  new: ["confirming", "confirmed", "cancelled", "unreachable"],
  confirming: ["new", "confirmed", "cancelled", "unreachable"],
  unreachable: ["confirming", "confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
};

const shipmentGraph: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ["prepared", "shipped"],
  prepared: ["pending", "shipped"],
  shipped: ["in_transit", "delivered", "absent", "postponed", "refused", "returned"],
  in_transit: ["delivered", "absent", "postponed", "refused", "returned"],
  absent: ["in_transit", "postponed", "returned", "delivered"],
  postponed: ["in_transit", "shipped", "returned", "absent"],
  delivered: ["returned"],
  refused: [],
  returned: [],
};

export function canTransitionConfirmation(from: ConfirmationStatus, to: ConfirmationStatus, shipment: ShipmentStatus) {
  if (!confirmationGraph[from].includes(to)) return false;
  if (from === "confirmed" && to === "cancelled") return shipment === "pending" || shipment === "prepared";
  return true;
}

export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus, confirmation: ConfirmationStatus) {
  if (confirmation !== "confirmed") return false;
  return shipmentGraph[from].includes(to);
}

export function restoresStock(kind: "confirmation" | "shipment", to: ConfirmationStatus | ShipmentStatus, shipment: ShipmentStatus) {
  if (kind === "confirmation" && to === "cancelled") return shipment === "pending" || shipment === "prepared";
  if (kind === "shipment" && (to === "refused" || to === "returned")) return true;
  return false;
}

export function paymentAfterShipment(to: ShipmentStatus, current: PaymentStatus): PaymentStatus {
  if (to === "delivered") return "collected";
  if ((to === "refused" || to === "returned") && current === "collected") return "reversed";
  return current;
}

export function canAccessOrder(actor: { id: string; role: StaffRole }, assignedConfirmerId: string | null) {
  if (actor.role === "admin") return true;
  return actor.role === "confirmer" && assignedConfirmerId === actor.id;
}

export function canEditCommerceSettings(role: StaffRole) {
  return role === "admin";
}
