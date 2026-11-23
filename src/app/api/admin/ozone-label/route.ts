import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createDeliveryNote, fetchDeliveryNotePdf } from "@/lib/shipping/ozone";
import type { DeliveryNotePdfKind } from "@/lib/shipping/ozone-rules";

function ticketPage(message: string, orderId: string, status: number) {
  const safe = message.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
  const back = /^[0-9a-f-]{36}$/i.test(orderId) ? `/admin/orders/${orderId}` : "/admin/orders";
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ticket Ozone</title><body style="font-family:Georgia,serif;padding:2rem;max-width:36rem;line-height:1.5"><p>${safe}</p><p><a href="${back}">Retour à la commande</a></p></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId") ?? "";
  const session = await getSession();
  if (session.profile?.role !== "admin" || !session.profile.isActive || !session.supabase) {
    return ticketPage("Action non autorisée.", orderId, 403);
  }
  const inline = url.searchParams.get("inline") === "1";
  const ticket = url.searchParams.get("ticket");
  const kind: DeliveryNotePdfKind = ticket === "a4" ? "tickets-a4" : ticket === "10" ? "tickets-10" : "note";
  const { data } = await session.supabase
    .from("shipments")
    .select("tracking_number, ozone_delivery_note_ref")
    .eq("order_id", orderId)
    .maybeSingle();
  const tracking = String(data?.tracking_number ?? "").trim();
  if (!tracking) return ticketPage("Cette commande n'a pas de numéro de suivi Ozone.", orderId, 404);

  let ref = String(data?.ozone_delivery_note_ref ?? "").trim();
  if (!ref) {
    const note = await createDeliveryNote(tracking);
    if (!note.ok) return ticketPage(note.message, orderId, 502);
    const { data: saved, error } = await session.supabase.rpc("save_ozone_delivery_note", {
      p_order_id: orderId,
      p_ref: note.ref,
    });
    if (error) return ticketPage("Le bordereau Ozone a été créé mais n'a pas pu être enregistré.", orderId, 500);
    ref = String((saved as { ref?: string } | null)?.ref ?? note.ref);
  }

  const pdf = await fetchDeliveryNotePdf(ref, kind);
  if (!pdf.ok) return ticketPage(pdf.message, orderId, 502);
  const filename = `sceno-ozone-${kind === "note" ? "bl" : "ticket"}-${ref.replace(/[^\w.-]/g, "")}.pdf`;
  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
