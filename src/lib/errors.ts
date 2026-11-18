const codes = [
  "invalid_phone",
  "invalid_name",
  "invalid_address",
  "invalid_city",
  "invalid_items",
  "invalid_idempotency",
  "insufficient_stock",
  "product_unavailable",
  "rate_limited",
  "not_found",
  "forbidden",
  "not_configured",
  "generic",
  "last_admin",
  "password",
  "file_type",
  "file_size",
  "duplicate",
  "not_confirmed",
  "ozone_exists",
  "ozone_busy",
  "city_unknown",
] as const;

export type ErrorCode = (typeof codes)[number];

export function errorCode(error: { message?: string; code?: string } | null | undefined): ErrorCode {
  const message = `${error?.message ?? ""} ${error?.code ?? ""}`;
  const found = codes.find((code) => message.includes(code));
  if (found) return found;
  if (error?.code === "23505") return "duplicate";
  if (error?.code === "23503") return "forbidden";
  return "generic";
}

export function statusFor(code: ErrorCode) {
  if (code === "not_found") return 404;
  if (code === "forbidden") return 403;
  if (code === "rate_limited") return 429;
  if (code === "not_configured") return 503;
  if (code === "insufficient_stock" || code === "product_unavailable" || code === "duplicate" || code === "ozone_exists" || code === "ozone_busy") return 409;
  if (code === "generic") return 500;
  return 400;
}

export function isMissingSchema(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache|could not find the function/i.test(error.message ?? "")
  );
}
