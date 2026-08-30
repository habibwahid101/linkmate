import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const AUTO_MS = 5500;
const SWIPE_PX = 48;

const SLIDES = [
  {
    id: "avenue",
    caption: "Illustrative Development View",
    alt: "Illustrative street-level view of a landscaped project avenue with plots — conceptual render, not a photograph of a completed site",
    width: 1255,
    height: 941,
    badge: "Illustrative",
    note: "Conceptual render — not a photograph of a completed site.",
    srcJpg: "/hero/illustrative-avenue.jpg",
    srcSetJpg:
      "/hero/illustrative-avenue-640.jpg 640w, /hero/illustrative-avenue-960.jpg 960w, /hero/illustrative-avenue.jpg 1255w",
    srcSetWebp:
      "/hero/illustrative-avenue-640.webp 640w, /hero/illustrative-avenue-960.webp 960w, /hero/illustrative-avenue.webp 1255w",
  },
  {
    id: "aerial",
    caption: "Illustrative Aerial View",
    alt: "Illustrative aerial view of the land project with roads and plots — conceptual render, not a photograph of a completed site",
    width: 1255,
    height: 941,
    badge: "Illustrative",
    note: "Conceptual render — not a photograph of a completed site.",
    srcJpg: "/hero/illustrative-aerial.jpg",
    srcSetJpg:
      "/hero/illustrative-aerial-640.jpg 640w, /hero/illustrative-aerial-960.jpg 960w, /hero/illustrative-aerial.jpg 1255w",
    srcSetWebp:
      "/hero/illustrative-aerial-640.webp 640w, /hero/illustrative-aerial-960.webp 960w, /hero/illustrative-aerial.webp 1255w",
  },
] as const;

const SIZES = "(min-width: 1024px) 32rem, (min-width: 640px) 36rem, 100vw";

export function HeroProjectVisual() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [loadRest, setLoadRest] = useState(false);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const slide = SLIDES[index];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setLoadRest(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (paused || hover || reduced) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [paused, hover, reduced]);

  function goTo(next: number, fromUser = false) {
    setIndex((next + SLIDES.length) % SLIDES.length);
    if (fromUser) setPaused(true);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointer.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const start = pointer.current;
    pointer.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    goTo(index + (dx < 0 ? 1 : -1), true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1, true);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1, true);
    }
  }

  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)] sm:p-4">
      <div
        className="relative overflow-hidden rounded-xl bg-bg touch-pan-y"
        role="region"
        aria-roledescription="carousel"
        aria-label="Project visuals"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointer.current = null;
        }}
      >
        <div className="relative aspect-[4/3]">
          {SLIDES.map((item, i) => {
            if (i > 0 && !loadRest && index !== i) return null;
            const active = i === index;
            return (
              <div
                key={item.id}
                className={cn(
                  "absolute inset-0 overflow-hidden bg-bg",
                  reduced ? "" : "transition-opacity duration-500 ease-out",
                  active ? "z-10 opacity-100" : "z-0 pointer-events-none opacity-0",
                )}
                aria-hidden={!active}
              >
                <picture>
                  <source type="image/webp" srcSet={item.srcSetWebp} sizes={SIZES} />
                  <img
                    src={item.srcJpg}
                    srcSet={item.srcSetJpg}
                    sizes={SIZES}
                    alt={active ? item.alt : ""}
                    width={item.width}
                    height={item.height}
                    decoding="async"
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                    draggable={false}
                    className="h-full w-full max-w-none object-cover object-center"
                  />
                </picture>
                <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium text-muted shadow-[var(--shadow-card)]">
                  {item.badge}
                </span>
              </div>
            );
          })}
        </div>

        <p className="sr-only" aria-live="polite">
          Slide {index + 1} of {SLIDES.length}: {slide.caption}
        </p>

        <button
          type="button"
          className="absolute left-2 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-ink shadow-[var(--shadow-card)] transition-colors duration-150 hover:bg-surface sm:grid"
          aria-label="Previous project visual"
          onClick={() => goTo(index - 1, true)}
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="absolute right-2 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-ink shadow-[var(--shadow-card)] transition-colors duration-150 hover:bg-surface sm:grid"
          aria-label="Next project visual"
          onClick={() => goTo(index + 1, true)}
        >
          <ChevronRight className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-3">
        <p data-hero-slide-caption className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          {slide.caption}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{slide.note}</p>
      </div>

      <div className="mt-1 flex justify-center" role="tablist" aria-label="Choose project visual">
        {SLIDES.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={item.caption}
            className="grid size-11 place-items-center"
            onClick={() => goTo(i, true)}
          >
            <span
              className={cn(
                "h-2 rounded-full transition-[width,background-color] duration-200 ease-out",
                i === index ? "w-6 bg-accent" : "w-2 bg-border",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
