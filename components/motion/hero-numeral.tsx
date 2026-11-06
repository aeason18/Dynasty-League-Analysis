"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect } from "react";

const OUTLINE = (color: string, width: number) =>
  ({ WebkitTextStroke: `${width}px ${color}`, color: "transparent" }) as const;

/**
 * Decorative hero: an oversized season numeral built from three depth layers
 * (magenta slab, sage outline, white outline). Digits slam in on a spring and
 * the whole stack tilts in 3D toward the pointer, swaying on its own until the
 * pointer moves. Static under prefers-reduced-motion.
 */
export function HeroNumeral({ text }: { text: string }) {
  const reduce = useReducedMotion();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 16 });
  const sy = useSpring(py, { stiffness: 60, damping: 16 });
  const rotateY = useTransform(sx, [-1, 1], [-16, 16]);
  const rotateX = useTransform(sy, [-1, 1], [12, -12]);

  useEffect(() => {
    if (reduce) return;
    const swayX = animate(px, [-0.5, 0.5, -0.5], { duration: 9, repeat: Infinity, ease: "easeInOut" });
    const swayY = animate(py, [0.25, -0.25, 0.25], { duration: 7, repeat: Infinity, ease: "easeInOut" });
    const onMove = (e: PointerEvent) => {
      swayX.stop();
      swayY.stop();
      px.set((e.clientX / window.innerWidth - 0.5) * 2);
      py.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      swayX.stop();
      swayY.stop();
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduce, px, py]);

  const digits = text.split("");

  const renderLayer = (style: React.CSSProperties, z: number, delay: number) => (
    <div
      className="absolute inset-0 flex items-center justify-center whitespace-nowrap font-heading font-black leading-none"
      style={{ ...style, transform: `translateZ(${z}px)`, fontSize: "40cqw" }}
    >
      {digits.map((d, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={reduce ? false : { y: "70%", opacity: 0, rotateX: -80 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 15, delay: delay + i * 0.09 }}
        >
          {d}
        </motion.span>
      ))}
    </div>
  );

  return (
    <div aria-hidden className="absolute inset-0 [container-type:inline-size]" style={{ perspective: 1200 }}>
      <motion.div
        className="absolute inset-0"
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      >
        {renderLayer({ color: "var(--pop)", opacity: 0.55 }, -90, 0)}
        {renderLayer(OUTLINE("var(--primary)", 3), 0, 0.12)}
        {renderLayer(OUTLINE("var(--foreground)", 1.5), 90, 0.24)}
      </motion.div>
    </div>
  );
}
