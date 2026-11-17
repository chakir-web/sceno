import { notFound } from "next/navigation";
import { OrderWorkspace } from "@/components/orders/workspace";
import { getOrder, listConfirmers } from "@/lib/services/orders";
import { listCarriers } from "@/lib/services/settings";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, confirmers, carriers] = await Promise.all([getOrder(id), listConfirmers(), listCarriers()]);
  if (!order.data) notFound();
  return <OrderWorkspace order={order.data} mode="admin" confirmers={confirmers.data} carriers={carriers.data} />;
}
