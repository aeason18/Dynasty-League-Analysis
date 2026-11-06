"use client";

import { motion, useReducedMotion } from "motion/react";

/** A line that draws itself across the section header when scrolled into view. */
export function PlayRule() {
  const reduce = useReducedMotion();
  return (
    <svg className="absolute inset-x-0 bottom-0 h-3 w-full" aria-hidden preserveAspectRatio="none" viewBox="0 0 100 4">
      <motion.path
        d="M0 2 H100"
        vectorEffect="non-scaling-stroke"
        stroke="var(--primary)"
        strokeWidth={2}
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
