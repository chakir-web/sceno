import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createDeliveryNote, fetchDeliveryNotePdf } from "@/lib/shipping/ozone";

export async function GET(request: Request) {
  const session = await getSession();
  if (session.profile?.role !== "admin" || !session.profile.isActive || !session.supabase) {
    return NextResponse.json({ code: "forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId") ?? "";
  const inline = url.searchParams.get("inline") === "1";
  const { data } = await session.supabase
    .from("shipments")
    .select("tracking_number, ozone_delivery_note_ref")
    .eq("order_id", orderId)
    .maybeSingle();
  const tracking = String(data?.tracking_number ?? "").trim();
  if (!tracking) return NextResponse.json({ code: "not_found" }, { status: 404 });

  let ref = String(data?.ozone_delivery_note_ref ?? "").trim();
  if (!ref) {
    const note = await createDeliveryNote(tracking);
    if (!note.ok) return NextResponse.json({ message: note.message }, { status: 502 });
    const { data: saved, error } = await session.supabase.rpc("save_ozone_delivery_note", {
      p_order_id: orderId,
      p_ref: note.ref,
    });
    if (error) return NextResponse.json({ message: "Le bordereau Ozone a été créé mais n'a pas pu être enregistré." }, { status: 500 });
    ref = String((saved as { ref?: string } | null)?.ref ?? note.ref);
  }

  const pdf = await fetchDeliveryNotePdf(ref);
  if (!pdf.ok) return NextResponse.json({ message: pdf.message }, { status: 502 });
  const filename = `sceno-ozone-${ref.replace(/[^\w.-]/g, "")}.pdf`;
  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
