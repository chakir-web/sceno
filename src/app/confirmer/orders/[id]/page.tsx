import { notFound } from "next/navigation";
import { OrderWorkspace } from "@/components/orders/workspace";
import { requireConfirmer } from "@/lib/auth/session";
import { getOrder } from "@/lib/services/orders";

export default async function ConfirmerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireConfirmer();
  const order = await getOrder(id);
  if (!order.data || order.data.assignedConfirmerId !== profile.id) notFound();
  return <OrderWorkspace order={order.data} mode="confirmer" />;
}
