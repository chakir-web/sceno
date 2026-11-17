import { NextResponse } from "next/server";
import { statusFor, type ErrorCode } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { placeOrder } from "@/lib/services/checkout";
import { checkoutSchema } from "@/lib/validations/commerce";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, code: "invalid_items" }, { status: 400 });
  const phone = normalizeMoroccanPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ ok: false, code: "invalid_phone" }, { status: 400 });
  const result = await placeOrder({ ...parsed.data, phone, notes: parsed.data.notes ?? "" });
  if (!result.ok) return NextResponse.json({ ok: false, code: result.code }, { status: statusFor(result.code as ErrorCode) });
  return NextResponse.json({ ok: true, order: result.order });
}
