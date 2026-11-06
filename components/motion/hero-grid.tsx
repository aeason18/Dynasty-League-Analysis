"use client";

import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef } from "react";

const DOTS = (color: string) =>
  `radial-gradient(circle, ${color} 1.6px, transparent 1.8px)`;

/**
 * Decorative hero: a dot grid that fades in, with a sage glow that follows
 * the pointer (and a magenta one opposite it). Drifts on its own until the
 * pointer moves. Static under prefers-reduced-motion.
 */
export function HeroGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(62);
  const y = useMotionValue(38);
  const sx = useSpring(x, { stiffness: 70, damping: 20 });
  const sy = useSpring(y, { stiffness: 70, damping: 20 });
  const ox = useTransform(sx, [-50, 150], [150, -50]);
  const oy = useTransform(sy, [-50, 150], [150, -50]);

  const sage = useMotionTemplate`radial-gradient(circle 240px at ${sx}% ${sy}%, black, transparent)`;
  const pop = useMotionTemplate`radial-gradient(circle 150px at ${ox}% ${oy}%, black, transparent)`;

  useEffect(() => {
    if (reduce) return;
    const idleX = animate(x, [62, 38, 70, 50, 62], {
      duration: 14,
      repeat: Infinity,
      ease: "easeInOut",
    });
    const idleY = animate(y, [38, 62, 55, 25, 38], {
      duration: 14,
      repeat: Infinity,
      ease: "easeInOut",
    });

    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      idleX.stop();
      idleY.stop();
      const r = el.getBoundingClientRect();
      x.set(((e.clientX - r.left) / r.width) * 100);
      y.set(((e.clientY - r.top) / r.height) * 100);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      idleX.stop();
      idleY.stop();
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduce, x, y]);

  const layer = "absolute inset-0 [background-size:30px_30px]";

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className="absolute inset-0"
      style={{
        maskImage: "radial-gradient(closest-side, black 45%, transparent)",
        WebkitMaskImage: "radial-gradient(closest-side, black 45%, transparent)",
      }}
      initial={reduce ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={`${layer} opacity-[0.16]`}
        style={{ backgroundImage: DOTS("var(--foreground)") }}
      />
      <motion.div
        className={layer}
        style={{
          backgroundImage: DOTS("var(--primary)"),
          maskImage: sage,
          WebkitMaskImage: sage,
        }}
      />
      <motion.div
        className={layer}
        style={{
          backgroundImage: DOTS("var(--pop)"),
          maskImage: pop,
          WebkitMaskImage: pop,
        }}
      />
    </motion.div>
  );
}
