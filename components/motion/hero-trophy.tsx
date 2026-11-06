"use client";

import { motion, useReducedMotion } from "motion/react";

// 16 x 18 cells. X = sage, P = magenta, . = empty.
const BITMAP = [
  "..XXXXXXXXXXXX..",
  "XXX.XXXXXXXX.XXX",
  "X.X.XXXPPXXX.X.X",
  "X.X.XXXPPXXX.X.X",
  "XXX.XXXXXXXX.XXX",
  "..X.XXXXXXXX.X..",
  "...XXXXXXXXXX...",
  "....XXXXXXXX....",
  ".....XXXXXX.....",
  "......XXXX......",
  ".......XX.......",
  ".......XX.......",
  ".......XX.......",
  "......XXXX......",
  "....XXXXXXXX....",
  "....XXXXXXXX....",
  "...XXXXXXXXXX...",
  "...XXXXXXXXXX...",
];

const CELL = 10;
const ROWS = BITMAP.length;
const COLS = BITMAP[0].length;

const CELLS = BITMAP.flatMap((line, r) =>
  line.split("").flatMap((ch, c) => (ch === "." ? [] : [{ r, c, pop: ch === "P" }])),
);

/**
 * Decorative hero object: a flat, blocky trophy. Builds up block by block from
 * the base, floats gently, and a highlight sweeps across it on a loop. Drawn
 * already assembled and still under prefers-reduced-motion.
 */
export function HeroTrophy() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="absolute right-[6%] top-[8%] w-[56%]">
      <motion.svg
        viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
        className="h-auto w-full"
        shapeRendering="crispEdges"
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2.2 }}
      >
        {CELLS.map(({ r, c, pop }) => (
          <motion.rect
            key={`${r}-${c}`}
            x={c * CELL}
            y={r * CELL}
            width={CELL}
            height={CELL}
            style={{ fill: pop ? "var(--pop)" : "var(--primary)" }}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: pop ? 1 : 0.9 }}
            transition={{ duration: 0.2, delay: (ROWS - r) * 0.06 + c * 0.012 }}
          />
        ))}
        {!reduce &&
          CELLS.map(({ r, c }) => (
            <motion.rect
              key={`s-${r}-${c}`}
              x={c * CELL}
              y={r * CELL}
              width={CELL}
              height={CELL}
              style={{ fill: "var(--foreground)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.75, 0] }}
              transition={{
                duration: 0.5,
                delay: 2.6 + (r + c) * 0.05,
                repeat: Infinity,
                repeatDelay: 3.5,
                times: [0, 0.3, 1],
              }}
            />
          ))}
      </motion.svg>
    </div>
  );
}
