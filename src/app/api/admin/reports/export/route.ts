import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { getSession } from "@/lib/auth/session";
import { getAdminReports } from "@/lib/services/dashboard";

export async function GET(request: Request) {
  const session = await getSession();
  if (session.profile?.role !== "admin" || !session.profile.isActive) {
    return NextResponse.json({ code: "forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? from;
  const report = await getAdminReports(from, to);
  const data = report.data;
  const csv = toCsv(
    ["metric", "value"],
    [
      ["created", data.created],
      ["confirmed", data.confirmed],
      ["delivered", data.delivered],
      ["collected_mad", data.collected],
      ["confirmed_amount_mad", data.confirmedAmount],
      ["shipping_charged_mad", data.shippingCharged],
      ["carrier_fees_mad", data.carrierFees],
      ["cancelled", data.cancelled],
      ["refused", data.refused],
      ["returned", data.returned],
      ...data.byDay.map((row) => [`day:${row.period}`, `${row.orders}|${row.collected}`]),
    ],
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=sceno-rapport.csv",
    },
  });
}
