import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { shipmentRows } from "@/lib/services/orders";
import { manualShippingProvider } from "@/lib/shipping/provider";

export async function GET(request: Request) {
  const session = await getSession();
  if (session.profile?.role !== "admin" || !session.profile.isActive) {
    return NextResponse.json({ code: "forbidden" }, { status: 403 });
  }
  const ids = new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean);
  const rows = await shipmentRows(ids);
  const csv = manualShippingProvider.exportOrders(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=sceno-expeditions.csv",
    },
  });
}
