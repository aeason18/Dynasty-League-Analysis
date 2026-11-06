"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const COLS = 8;
const CELLS = COLS * COLS;
const POP_CELL = 21;
// Deterministic starting pattern so server and client markup match.
const INITIAL = [3, 10, 12, 17, 26, 29, 34, 40, 45, 51, 58, 61];

/**
 * Decorative hero: a flat grid of square cells, in the same hard-edged style as
 * the stat strip. A few cells fill with sage and hop around in steps; one stays
 * magenta. Static under prefers-reduced-motion.
 */
export function HeroBlocks() {
  const reduce = useReducedMotion();
  const [lit, setLit] = useState<number[]>(INITIAL);

  useEffect(() => {
    if (reduce) return;
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % CELLS;
    };
    const id = window.setInterval(() => {
      setLit((prev) => {
        const add = next();
        if (add === POP_CELL || prev.includes(add)) return prev;
        return [...prev.slice(1), add]; // drop oldest, light a new one
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div aria-hidden className="grid h-full w-full grid-cols-8 gap-2">
      {Array.from({ length: CELLS }, (_, i) => {
        const isPop = i === POP_CELL;
        const isLit = isPop || lit.includes(i);
        return (
          <div key={i} className="relative aspect-square border border-foreground/10">
            <motion.div
              className={isPop ? "absolute inset-0 bg-pop" : "absolute inset-0 bg-primary"}
              initial={false}
              animate={{ opacity: isLit ? (isPop ? 0.7 : 0.28) : 0 }}
              transition={{ duration: reduce ? 0 : 0.35, ease: "easeOut" }}
            />
          </div>
        );
      })}
    </div>
  );
}
