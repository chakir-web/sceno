"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers";

export function ConfirmButton({
  action,
  fields,
  label,
  title,
  body,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; code?: string } | void>;
  fields: Record<string, string>;
  label: string;
  title: string;
  body: string;
}) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button className="btn btn-ghost" type="button" onClick={() => setOpen(true)}>{label}</button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <form
            className="w-full max-w-md bg-ivory p-6"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData();
              Object.entries(fields).forEach(([key, value]) => data.set(key, value));
              const result = await action(data);
              if (result && "ok" in result && !result.ok) setError(dict.errors[result.code as keyof typeof dict.errors] ?? dict.errors.generic);
              else setOpen(false);
            }}
          >
            <h3 className="font-display text-3xl">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-stone">{body}</p>
            {error ? <p className="mt-3 text-sm text-red-900">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>{dict.common.cancel}</button>
              <button className="btn btn-primary" type="submit">{label}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
