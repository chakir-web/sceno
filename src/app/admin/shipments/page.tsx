import { ShipmentBoard } from "@/components/admin/shipment-board";
import { PageIntro, Pagination } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { pageNumber } from "@/lib/http";
import { listOrders } from "@/lib/services/orders";
import { listCarriers } from "@/lib/services/settings";
import { ozoneConfigured } from "@/lib/shipping/ozone";

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const { dict } = await getI18n();
  const [orders, carriers] = await Promise.all([
    listOrders({ confirmedOnly: true, page }),
    listCarriers(),
  ]);
  return (
    <div>
      <PageIntro title={dict.admin.shipments.title} body={dict.admin.shipments.lead} />
      <p className="mb-4 text-sm text-stone">{dict.admin.shipments.onlyConfirmed}</p>
      {orders.data.items.length ? <ShipmentBoard orders={orders.data.items} carriers={carriers.data} ozoneReady={ozoneConfigured()} /> : <p>{dict.admin.shipments.empty}</p>}
      <Pagination page={page} total={orders.data.total} pageSize={orders.data.pageSize} pathname="/admin/shipments" params={params} />
    </div>
  );
}
