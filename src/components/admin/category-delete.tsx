"use client";

import { useState } from "react";
import { deleteCategory } from "@/lib/actions/catalog";
import { Notice } from "@/components/office/indicators";
import { useI18n } from "@/components/providers";

export function CategoryDeleteButton({ id }: { id: string }) {
  const { dict } = useI18n();
  const [message, setMessage] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData();
        data.set("id", id);
        const result = await deleteCategory(data);
        if (result.ok) setMessage({ tone: "success", text: dict.toast.deleted });
        else if (result.code === "category_in_use") setMessage({ tone: "warning", text: dict.errors.category_in_use });
        else setMessage({ tone: "danger", text: dict.errors[result.code as keyof typeof dict.errors] ?? dict.errors.generic });
      }}
    >
      <button type="submit">{dict.common.delete}</button>
      {message ? <div className="mt-2 max-w-64"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
    </form>
  );
}
