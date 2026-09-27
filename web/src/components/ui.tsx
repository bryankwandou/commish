"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fades and lifts its children into view once. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Number that eases to its new value. */
export function Counter({ value, format = (n) => n.toLocaleString("en-US"), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const first = useRef(true);
  useEffect(() => {
    if (!inView) return;
    const from = first.current ? 0 : mv.get();
    first.current = false;
    const c = animate(from, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => mv.set(v) });
    return () => c.stop();
  }, [value, inView, mv]);
  return (
    <motion.span ref={ref} className={`tabular ${className ?? ""}`}>
      {text}
    </motion.span>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-paid">{children}</p>;
}

export function SectionTitle({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      {kicker && <Kicker>{kicker}</Kicker>}
      <h2 className="text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-pretty text-muted">{sub}</p>}
    </Reveal>
  );
}

/** Tracks the pointer for the `.spotlight` border effect. */
export function Spotlight({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty("--x", `${e.clientX - r.left}px`);
        ref.current!.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      className={`spotlight ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1400);
        } catch {}
      }}
      className="rounded-md border border-line px-2 py-1 text-xs text-muted transition hover:border-line-strong hover:text-text"
    >
      {ok ? done : label}
    </button>
  );
}
