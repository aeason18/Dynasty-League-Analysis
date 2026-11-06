"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

// A route that breaks off the line of scrimmage, cuts, and runs to the end zone.
const ROUTE = "M60 520 C60 400 60 330 150 300 S300 330 330 220 S360 90 450 70";
const YARD_LINES = [60, 150, 240, 330, 420, 510];

/**
 * Decorative hero: a gridiron "play diagram" that draws itself, with a ball
 * that runs the route on a loop and a field that drifts toward the pointer.
 * Renders fully drawn (no motion) under prefers-reduced-motion.
 */
export function HeroField() {
  const reduce = useReducedMotion();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 20 });
  const sy = useSpring(py, { stiffness: 60, damping: 20 });
  const fieldX = useTransform(sx, [-1, 1], [-18, 18]);
  const fieldY = useTransform(sy, [-1, 1], [-18, 18]);
  const routeX = useTransform(sx, [-1, 1], [10, -10]);
  const routeY = useTransform(sy, [-1, 1], [10, -10]);

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth - 0.5) * 2);
      py.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, px, py]);

  const draw = (delay: number, duration = 1.4) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { duration, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <svg
      viewBox="0 0 520 600"
      className="h-full w-full"
      fill="none"
      aria-hidden
      preserveAspectRatio="xMaxYMid meet"
    >
      <motion.g style={{ x: fieldX, y: fieldY }} className="text-foreground">
        {YARD_LINES.map((x, i) => (
          <motion.path
            key={x}
            d={`M${x} 20 V580`}
            stroke="currentColor"
            strokeOpacity={0.14}
            strokeWidth={1}
            {...draw(0.08 * i, 1.1)}
          />
        ))}
        {/* hash marks */}
        {YARD_LINES.flatMap((x) =>
          [140, 300, 460].map((y) => (
            <motion.path
              key={`${x}-${y}`}
              d={`M${x - 6} ${y} H${x + 6}`}
              stroke="currentColor"
              strokeOpacity={0.22}
              strokeWidth={1}
              {...draw(0.6, 0.6)}
            />
          )),
        )}
      </motion.g>

      <motion.g style={{ x: routeX, y: routeY }}>
        <motion.path
          d={ROUTE}
          stroke="var(--primary)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="1 0"
          {...draw(0.5, 1.8)}
        />
        {/* route start marker */}
        <circle cx={60} cy={520} r={6} fill="var(--primary)" />
        <circle cx={60} cy={520} r={14} stroke="var(--primary)" strokeOpacity={0.35} />
        {/* end-zone target */}
        <motion.g
          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.1, type: "spring", stiffness: 200, damping: 14 }}
          style={{ transformOrigin: "450px 70px" }}
        >
          <path d="M438 58 L462 82 M462 58 L438 82" stroke="var(--pop)" strokeWidth={3} strokeLinecap="round" />
        </motion.g>
        {/* the ball, running the route on a loop */}
        {!reduce && (
          <motion.circle
            r={7}
            fill="var(--pop)"
            style={{ offsetPath: `path("${ROUTE}")`, offsetRotate: "0deg" } as React.CSSProperties}
            initial={{ offsetDistance: "0%", opacity: 0 }}
            animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 3.2,
              delay: 2.4,
              repeat: Infinity,
              repeatDelay: 1.6,
              ease: "easeInOut",
              times: [0, 0.08, 0.92, 1],
            }}
          />
        )}
      </motion.g>
    </svg>
  );
}
