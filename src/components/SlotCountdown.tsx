"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function SlotCountdown({
  slotsLeft,
  total = 150,
}: {
  slotsLeft: number;
  total?: number;
  hot?: boolean;
}) {
  const reduce = useReducedMotion();
  const [prev, setPrev] = useState(slotsLeft);
  const pct = Math.max(0, Math.min(100, ((total - slotsLeft) / total) * 100));

  useEffect(() => {
    setPrev(slotsLeft);
  }, [slotsLeft]);

  const ticked = slotsLeft < prev;

  return (
    <div className="slot-countdown slot-countdown-pro">
      <svg viewBox="0 0 120 120" className="slot-ring" aria-hidden>
        <circle cx="60" cy="60" r="52" className="slot-ring-bg" />
        <circle
          cx="60"
          cy="60"
          r="52"
          className="slot-ring-fill"
          strokeDasharray={326.7}
          strokeDashoffset={326.7 - (326.7 * pct) / 100}
          style={{ transition: reduce ? "none" : "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <motion.div
        className="slot-count-num"
        key={slotsLeft}
        initial={ticked && !reduce ? { scale: 1.08 } : false}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {slotsLeft}
      </motion.div>
      <p className="slot-count-label">slots until roll</p>
    </div>
  );
}
