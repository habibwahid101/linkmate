import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/utils";

const AUTO_MS = 5500;
const SWIPE_PX = 48;

const SLIDES = [
  {
    id: "layout",
    caption: "Project Plot Layout",
    alt: "Full project plot layout map showing Blocks A through F and marked plot sizes",
    fit: "contain" as const,
    width: 882,
    height: 1193,
    lightbox: true,
    srcJpg: "/hero/project-plot-layout.jpg",
    srcWebp: "/hero/project-plot-layout.webp",
    srcSetJpg: "/hero/project-plot-layout-640.jpg 640w, /hero/project-plot-layout.jpg 882w",
    srcSetWebp: "/hero/project-plot-layout-640.webp 640w, /hero/project-plot-layout.webp 882w",
  },
  {
    id: "development",
    caption: "Illustrative Development View",
    alt: "Illustrative development view of roads and plots — conceptual render, not a photograph of a completed site",
    fit: "cover" as const,
    width: 1080,
    height: 962,
    lightbox: false,
    note: "Conceptual render — not a photograph of a completed site.",
    srcJpg: "/hero/illustrative-development-view.jpg",
    srcWebp: "/hero/illustrative-development-view.webp",
    srcSetJpg:
      "/hero/illustrative-development-view-640.jpg 640w, /hero/illustrative-development-view.jpg 1080w",
    srcSetWebp:
      "/hero/illustrative-development-view-640.webp 640w, /hero/illustrative-development-view.webp 1080w",
  },
] as const;

const SIZES = "(min-width: 1024px) 32rem, (min-width: 640px) 36rem, 100vw";

export function HeroProjectVisual() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [loadSecond, setLoadSecond] = useState(false);
  const [lightbox, setLightbox] = useState(false);
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
    const t = window.setTimeout(() => setLoadSecond(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (paused || hover || reduced || lightbox) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [paused, hover, reduced, lightbox]);

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
            if (i > 0 && !loadSecond && index !== i) return null;
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
                    className={cn(
                      "h-full w-full max-w-none",
                      item.fit === "contain" ? "object-contain object-center" : "object-cover object-center",
                    )}
                  />
                </picture>
                {item.id === "development" ? (
                  <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium text-muted shadow-[var(--shadow-card)]">
                    Illustrative
                  </span>
                ) : null}
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

      <div className="mt-3 flex flex-col items-start gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p data-hero-slide-caption className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            {slide.caption}
          </p>
          {"note" in slide && slide.note ? (
            <p className="mt-1 text-xs leading-relaxed text-muted">{slide.note}</p>
          ) : null}
        </div>
        {slide.lightbox ? (
          <button
            type="button"
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[12px] px-2.5 text-sm font-medium text-accent hover:bg-accent-soft"
            onClick={() => {
              setLightbox(true);
              setPaused(true);
            }}
          >
            <Maximize2 className="size-4" strokeWidth={1.75} />
            View Full Layout
          </button>
        ) : null}
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

      <Modal open={lightbox} onClose={() => setLightbox(false)} title="Project Plot Layout" size="xl">
        <div className="flex max-h-[min(70dvh,46rem)] items-center justify-center overflow-hidden rounded-xl bg-bg">
          <picture>
            <source type="image/webp" srcSet="/hero/project-plot-layout.webp" />
            <img
              src="/hero/project-plot-layout.jpg"
              alt="Full project plot layout map showing Blocks A through F and marked plot sizes"
              width={882}
              height={1193}
              className="h-auto w-auto max-h-[min(70dvh,46rem)] max-w-full object-contain"
            />
          </picture>
        </div>
      </Modal>
    </div>
  );
}
