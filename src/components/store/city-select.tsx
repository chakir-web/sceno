"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/components/providers";

type CityOption = { city: string; feeMad: number };

const OTHER = "__other";

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
}

function feeLabel(feeMad: number) {
  const amount = Number.isInteger(feeMad) ? String(feeMad) : feeMad.toFixed(2).replace(".", ",");
  return `${amount} DH`;
}

export function CitySelect({
  id,
  cities,
  value,
  onChange,
}: {
  id: string;
  cities: CityOption[];
  value: string;
  onChange: (city: string) => void;
}) {
  const { dict } = useI18n();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const options = useMemo(() => {
    const needle = fold(query.trim());
    const matched = cities.filter((item) => !needle || fold(item.city).includes(needle));
    const otherMatches = !needle || fold(dict.checkout.cityOther).includes(needle);
    return otherMatches ? [...matched, { city: OTHER, feeMad: null as number | null }] : matched;
  }, [cities, query, dict.checkout.cityOther]);

  const selected = cities.find((item) => item.city === value);
  const closedLabel = !value ? dict.checkout.cityChoose : value === OTHER ? dict.checkout.cityOther : value;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const node = document.getElementById(`${listId}-opt-${active}`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  function choose(next: string) {
    onChange(next);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option.city);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        className={`field pe-16 ${!open && !value ? "text-stone" : ""}`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? `${listId}-opt-${active}` : undefined}
        placeholder={dict.checkout.citySearch}
        autoComplete="off"
        value={open ? query : closedLabel}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onMouseDown={() => setOpen(true)}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {!open && selected ? (
        <span dir="ltr" className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[10px] font-semibold text-champagne">{feeLabel(selected.feeMad)}</span>
      ) : null}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={dict.a11y.cityList}
          className="city-list absolute inset-x-0 z-50 mt-1 max-h-52 overflow-y-auto border border-line bg-[#fffdf8] shadow-[0_8px_32px_-8px_rgba(23,23,23,0.18)]"
          style={{ top: "100%" }}
        >
          {options.length ? options.map((item, index) => {
            const label = item.city === OTHER ? dict.checkout.cityOther : item.city;
            const highlighted = index === active;
            return (
              <li
                id={`${listId}-opt-${index}`}
                key={item.city}
                role="option"
                aria-selected={item.city === value}
                className={`flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-2.5 text-sm text-ink/80 ${highlighted ? "bg-mist" : ""}`}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(item.city);
                }}
              >
                <span className="truncate">{label}</span>
                {item.feeMad != null ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span dir="ltr" className="text-[10px] font-semibold text-champagne">{feeLabel(item.feeMad)}</span>
                  </span>
                ) : null}
              </li>
            );
          }) : <li className="px-4 py-2.5 text-sm text-stone">{dict.checkout.cityEmpty}</li>}
        </ul>
      ) : null}
    </div>
  );
}
