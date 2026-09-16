"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import type { Arena } from "@/lib/cosmetics";

export function ArenaTable({
  arena,
  hot = false,
  won = false,
  potLabel,
  children,
}: {
  arena: Arena;
  hot?: boolean;
  won?: boolean;
  potLabel?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={`arena-v2 env-${arena.id}${hot ? " is-hot" : ""}${won ? " is-won" : ""}`}
      style={
        {
          "--arena-accent": arena.accent,
          "--host-accent": arena.hostAccent,
          "--guest-accent": arena.guestAccent,
        } as CSSProperties
      }
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="arena-v2-backdrop" aria-hidden>
        <span className="arena-v2-scene" />
        <span className="arena-v2-canopy" />
        <span className="arena-v2-shafts" />
        <span className="arena-v2-ground" />
        <span className="arena-v2-weather" />
        <span className="arena-v2-vignette" />
      </div>

      <header className="arena-v2-head">
        <div className="arena-v2-title">
          <p className="arena-v2-name">{arena.name}</p>
          <p className="arena-v2-tag">{arena.tagline}</p>
        </div>
        {potLabel ? (
          <motion.div
            className="arena-v2-pot"
            animate={hot ? { scale: [1, 1.03, 1] } : { scale: 1 }}
            transition={hot ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
          >
            <span className="arena-v2-pot-label">Pot</span>
            <span className="arena-v2-pot-value">{potLabel}</span>
          </motion.div>
        ) : null}
      </header>

      <div className="arena-v2-table">
        <div className={`hash-pad arena-v2-pad${hot ? " is-pulsing" : ""}`} aria-hidden>
          <span className="hash-ring" />
          <span className="hash-glyph">Ξ</span>
        </div>
        {children}
      </div>
    </motion.div>
  );
}
