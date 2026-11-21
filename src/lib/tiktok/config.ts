const PUBLIC_PIXEL_ID = "DC0ER73C77U8M2UV7I20";

export function tiktokPixelId() {
  const configured = process.env.TIKTOK_PIXEL_ID ?? "";
  return /^[A-Z0-9]{16,32}$/.test(configured) ? configured : PUBLIC_PIXEL_ID;
}
