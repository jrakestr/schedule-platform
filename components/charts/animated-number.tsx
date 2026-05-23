"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}

// Subtle count-up. Animates from 0 to the target value once per mount when the
// element enters the viewport. Honors prefers-reduced-motion (Framer Motion
// pauses tween animations automatically when the user has set it). The
// formatter prop lets the caller render a percentage, a comma-grouped integer,
// etc. without leaking framer-motion into the call sites.
export function AnimatedNumber({
  value,
  format,
  duration = 0.4,
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px" });
  const motionValue = useMotionValue(0);
  const displayed = useTransform(motionValue, (v) =>
    format ? format(v) : v.toFixed(0),
  );

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.32, 0.72, 0, 1],
    });
    return () => controls.stop();
  }, [inView, value, duration, motionValue]);

  return (
    <motion.span ref={ref} className={className}>
      {displayed}
    </motion.span>
  );
}
