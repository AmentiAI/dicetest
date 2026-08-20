"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CubeDie } from "./CubeDie";
import type { DieTone } from "@/lib/cosmetics";

export function DiceFace({
  value,
  rolling = false,
  highlight = false,
  label,
  tone = "black-red",
  slow = false,
  winner = false,
  large = false,
  idle = false,
}: {
  value: number | null;
  rolling?: boolean;
  highlight?: boolean;
  label?: string;
  tone?: DieTone;
  slow?: boolean;
  winner?: boolean;
  large?: boolean;
  idle?: boolean;
}) {
  const reduce = useReducedMotion();
  const skin =
    tone === "black"
      ? "black"
      : tone === "red"
        ? "red"
        : tone;
  const showValue = value != null && !rolling;

  return (
    <div
      className={[
        "die-wrap",
        large ? "die-wrap-lg" : "",
        `skin-${skin}`,
        highlight ? "is-you" : "",
        winner ? "is-winner" : "",
        rolling ? "is-rolling" : "",
        showValue ? "has-value" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CubeDie
        tone={tone}
        value={value}
        rolling={rolling}
        slow={slow}
        orbit={idle && !rolling && value == null}
        idle={idle}
      />
      {label ? <div className="die-label">{label}</div> : null}
      {showValue ? (
        <motion.div
          className="roll-result"
          initial={reduce ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.34, 1.5, 0.64, 1] }}
        >
          {value}
        </motion.div>
      ) : null}
    </div>
  );
}
