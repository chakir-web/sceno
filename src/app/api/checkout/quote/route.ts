import { NextResponse } from "next/server";
import { errorCode, statusFor, type ErrorCode } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http";
import { quoteOrder } from "@/lib/services/checkout";
import { quoteSchema } from "@/lib/validations/commerce";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, code: "invalid_items" }, { status: 400 });
  try {
    const result = await quoteOrder(parsed.data);
    if (!result.ok) return NextResponse.json({ ok: false, code: result.code }, { status: statusFor(result.code as ErrorCode) });
    return NextResponse.json({ ok: true, quote: result.quote });
  } catch (error) {
    return NextResponse.json({ ok: false, code: errorCode(error as { message?: string }) }, { status: 500 });
  }
}
