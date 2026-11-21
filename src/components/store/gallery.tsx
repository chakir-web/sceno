"use client";

import { ChevronLeft, ChevronRight, Minus, Plus, X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/providers";
import { galleryImages } from "@/lib/catalog/images";
import { Media } from "@/components/store/media";
import { useProductColor } from "@/components/store/product-color";
import type { CatalogProduct } from "@/types/commerce";

type Frame = { id: string; url: string; alt: string };

function wrap(index: number, total: number) {
  return (index + total) % total;
}

function clampScale(value: number) {
  return Math.min(4, Math.max(1, value));
}

export function Gallery({ product }: { product: CatalogProduct }) {
  const { dict, locale } = useI18n();
  const selectedColor = useProductColor()?.color ?? null;
  const available = galleryImages(product.images, selectedColor);
  const images: Frame[] = available.length ? available : [{ id: "empty", url: "", alt: product.name }];
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setIndex(0);
    setOpen(false);
  }, [selectedColor]);
  const many = images.length > 1 && images.some((image) => image.url);
  const current = images[wrap(index, images.length)] ?? images[0];
  const rtl = locale === "ar";
  const touch = useRef<{ x: number; y: number } | null>(null);

  function step(delta: number) {
    setIndex((value) => wrap(value + delta, images.length));
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (!many || !touch.current || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touch.current.x;
    const dy = event.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    const forward = rtl ? dx > 0 : dx < 0;
    step(forward ? 1 : -1);
  }

  return (
    <div className={`grid w-full min-w-0 items-start gap-3 self-start ${many ? "md:grid-cols-[4.5rem_minmax(0,1fr)]" : ""}`}>
      {many ? (
        <div className="order-2 flex max-w-full gap-2 overflow-x-auto md:order-1 md:max-h-[40rem] md:flex-col md:overflow-y-auto" aria-label={dict.a11y.gallery}>
          {images.map((image, imageIndex) => (
            <button
              key={image.id}
              type="button"
              aria-current={imageIndex === index}
              aria-label={image.alt || product.name}
              className={`relative h-16 w-16 shrink-0 bg-mist md:h-[4.5rem] md:w-[4.5rem] ${imageIndex === index ? "outline outline-1 outline-offset-2 outline-champagne" : "outline outline-1 outline-transparent"}`}
              onClick={() => setIndex(imageIndex)}
            >
              <Media src={image.url || null} alt="" sizes="72px" />
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="relative order-1 aspect-[4/5] w-full min-w-0 max-w-full overflow-hidden bg-mist md:order-2"
        onTouchStart={(event) => {
          if (event.touches.length === 1) touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchEnd={onTouchEnd}
      >
        <button type="button" className="absolute inset-0" aria-label={dict.a11y.zoom} onClick={() => current.url && setOpen(true)}>
          <Media key={current.id} src={current.url || null} alt={current.alt || product.name} priority={index === 0} sizes="(max-width: 768px) 100vw, 45vw" className="gallery-fade" />
        </button>
        {many ? (
          <>
            <button type="button" className="absolute start-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-ivory/90" aria-label={dict.a11y.previousImage} onClick={() => step(-1)}>
              {rtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <button type="button" className="absolute end-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-ivory/90" aria-label={dict.a11y.nextImage} onClick={() => step(1)}>
              {rtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </>
        ) : null}
        {current.url ? (
          <button type="button" className="absolute bottom-3 end-3 grid h-11 w-11 place-items-center bg-ivory/90" aria-label={dict.a11y.zoom} onClick={() => setOpen(true)}>
            <ZoomIn size={16} />
          </button>
        ) : null}
      </div>
      {open && current.url ? <Viewer images={images} index={wrap(index, images.length)} onIndex={setIndex} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function Viewer({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: Frame[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const { dict, locale } = useI18n();
  const rtl = locale === "ar";
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onIndexRef = useRef(onIndex);
  const indexRef = useRef(index);
  const imagesRef = useRef(images);
  const rtlRef = useRef(rtl);
  onCloseRef.current = onClose;
  onIndexRef.current = onIndex;
  indexRef.current = index;
  imagesRef.current = images;
  rtlRef.current = rtl;
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const current = images[index];
  const many = images.length > 1;

  function step(delta: number) {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    onIndex(wrap(index + delta, images.length));
  }

  useEffect(() => {
    closeRef.current?.focus();
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      const direction = rtlRef.current;
      const delta = event.key === "ArrowRight" ? (direction ? -1 : 1) : event.key === "ArrowLeft" ? (direction ? 1 : -1) : 0;
      if (delta) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        onIndexRef.current(wrap(indexRef.current + delta, imagesRef.current.length));
      }
      if (event.key === "+" || event.key === "=") setScale((value) => clampScale(value + 0.25));
      if (event.key === "-" || event.key === "_") setScale((value) => clampScale(value - 0.25));
    };
    document.addEventListener("keydown", onKey);
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      document.removeEventListener("keydown", onKey);
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setScale((value) => clampScale(value + (event.deltaY < 0 ? 0.2 : -0.2)));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (scale === 1) setOffset({ x: 0, y: 0 });
  }, [scale]);

  if (!current || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-hidden bg-ink" role="dialog" aria-modal="true" aria-label={current.alt} onClick={onClose}>
      <button ref={closeRef} type="button" className="absolute end-3 top-3 z-10 grid h-11 w-11 place-items-center text-ivory" aria-label={dict.a11y.closeViewer} onClick={onClose}>
        <X />
      </button>
      {many ? (
        <button type="button" className="absolute start-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center bg-ink/40 text-ivory" aria-label={dict.a11y.previousImage} onClick={(event) => { event.stopPropagation(); step(-1); }}>
          {rtl ? <ChevronRight /> : <ChevronLeft />}
        </button>
      ) : null}
      {many ? (
        <button type="button" className="absolute end-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center bg-ink/40 text-ivory" aria-label={dict.a11y.nextImage} onClick={(event) => { event.stopPropagation(); step(1); }}>
          {rtl ? <ChevronLeft /> : <ChevronRight />}
        </button>
      ) : null}
      <div
        ref={stageRef}
        className="grid h-full w-full min-h-0 place-items-center overflow-hidden px-4 py-16"
        onPointerDown={(event) => {
          if (scale <= 1 || event.button !== 0) return;
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setOffset({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y });
        }}
        onPointerUp={() => { drag.current = null; }}
        onTouchStart={(event) => {
          if (event.touches.length === 1) swipe.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
          if (event.touches.length === 2) {
            const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
            pinch.current = { distance, scale };
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length !== 2 || !pinch.current) return;
          const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
          setScale(clampScale(pinch.current.scale * (distance / pinch.current.distance)));
        }}
        onTouchEnd={(event) => {
          pinch.current = null;
          if (event.changedTouches.length !== 1) return;
          if (scale <= 1 && swipe.current && many) {
            const dx = event.changedTouches[0].clientX - swipe.current.x;
            const dy = event.changedTouches[0].clientY - swipe.current.y;
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
              step(rtl ? (dx > 0 ? 1 : -1) : (dx < 0 ? 1 : -1));
              swipe.current = null;
              return;
            }
          }
          swipe.current = null;
          if (scale > 1) return;
          const now = Date.now();
          if (now - lastTap.current < 280) setScale((value) => (value > 1 ? 1 : 2));
          lastTap.current = now;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt}
          draggable={false}
          className="h-auto max-h-full w-auto min-h-0 min-w-0 max-w-full object-contain"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
      <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-3 text-sm text-ivory" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="grid h-11 w-11 place-items-center" aria-label={dict.a11y.zoomOut} onClick={() => setScale((value) => clampScale(value - 0.25))}>
          <Minus size={16} />
        </button>
        <span aria-live="polite">{index + 1} / {images.length}</span>
        <button type="button" className="grid h-11 w-11 place-items-center" aria-label={dict.a11y.zoomIn} onClick={() => setScale((value) => clampScale(value + 0.25))}>
          <Plus size={16} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
