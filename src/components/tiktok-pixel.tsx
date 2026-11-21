"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { TIKTOK_PIXEL_ID, trackTikTokPage } from "@/lib/tiktok/pixel";

export function TikTokPixel() {
  const pathname = usePathname();
  const search = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    if (!TIKTOK_PIXEL_ID) return;
    if (first.current) {
      first.current = false;
      return;
    }
    trackTikTokPage();
  }, [pathname, search]);

  return null;
}
