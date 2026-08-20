"use client";

import { useEffect, useState } from "react";

export function useWeeklyCountdown() {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      const daysUntil = (7 - now.getUTCDay()) % 7 || 7;
      end.setUTCDate(now.getUTCDate() + daysUntil);
      end.setUTCHours(0, 0, 0, 0);
      const ms = Math.max(0, end.getTime() - now.getTime());
      setParts({
        d: Math.floor(ms / 86_400_000),
        h: Math.floor((ms % 86_400_000) / 3_600_000),
        m: Math.floor((ms % 3_600_000) / 60_000),
        s: Math.floor((ms % 60_000) / 1000),
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return parts;
}
