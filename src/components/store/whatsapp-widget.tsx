"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { whatsappHref } from "@/lib/phone";

const WHATSAPP_NUMBER = "0775588894";

export function WhatsAppWidget({ label }: { label: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <a
      href={whatsappHref(WHATSAPP_NUMBER)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 end-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-soft md:bottom-6"
      aria-label={`${label} ${WHATSAPP_NUMBER}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8 fill-current">
        <path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l6-1.6A11 11 0 0 0 20.5 3.5Zm-8.5 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-3.6.9.9-3.5-.2-.3A9.1 9.1 0 1 1 12 20.5Zm5-6.8c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a1.7 1.7 0 0 0 0-.5c0-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.6.6 2.2.7 3 .6a2.5 2.5 0 0 0 1.7-1.2 2 2 0 0 0 .1-1.2c-.1-.1-.3-.2-.6-.3Z" />
      </svg>
    </a>,
    document.body,
  );
}
