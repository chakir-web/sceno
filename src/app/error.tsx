"use client";

import { useI18n } from "@/components/providers";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { dict } = useI18n();
  return (
    <main className="grid min-h-[50vh] place-items-center px-4 text-center">
      <div>
        <h1 className="font-display text-4xl">{dict.common.error}</h1>
        <button className="btn btn-primary mt-6" type="button" onClick={reset}>{dict.common.back}</button>
      </div>
    </main>
  );
}
