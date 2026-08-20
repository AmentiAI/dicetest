"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DieTone, DieSkin, HeroDieTone } from "@/lib/cosmetics";

const PIP_CELLS: Record<number, string[]> = {
  1: ["2 / 2"],
  2: ["1 / 1", "3 / 3"],
  3: ["1 / 1", "2 / 2", "3 / 3"],
  4: ["1 / 1", "1 / 3", "3 / 1", "3 / 3"],
  5: ["1 / 1", "1 / 3", "2 / 2", "3 / 1", "3 / 3"],
  6: ["1 / 1", "1 / 3", "2 / 1", "2 / 3", "3 / 1", "3 / 3"],
};

const FACE_ROT: Record<number, [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

const ORBIT_PHASE: Record<string, number> = {
  ice: 0,
  chain: 2.4,
  burn: 4.8,
  black: 0.8,
  red: 3.2,
  "black-red": 0,
  "green-purple": 2.4,
  "orange-blue": 4.8,
  "glass-purple": 0,
  "glass-green": 2.4,
  "glass-orange": 4.8,
};

function continueTo(prev: number, target: number, extraTurns: number) {
  const tau = 360;
  const want = ((target % tau) + tau) % tau;
  const cur = ((prev % tau) + tau) % tau;
  return prev + extraTurns * tau + ((want - cur + tau) % tau);
}

function Pips({ n }: { n: number }) {
  return (
    <div className="pips">
      {(PIP_CELLS[n] ?? []).map((area) => (
        <i key={area} style={{ gridArea: area }} />
      ))}
    </div>
  );
}

function toneClass(tone: DieTone): string {
  if (tone === "black") return "black";
  if (tone === "red") return "red";
  return tone;
}

function isAltSpin(tone: DieTone) {
  return (
    tone === "chain" ||
    tone === "red" ||
    tone === "burn" ||
    tone === "green-purple" ||
    tone === "glass-green"
  );
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function applyRot(
  el: HTMLDivElement,
  x: number,
  y: number,
  z: number,
  store: { x: number; y: number; z: number },
) {
  store.x = x;
  store.y = y;
  store.z = z;
  el.style.transform = `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
}

export function CubeDie({
  tone,
  value = null,
  rolling = false,
  orbit = false,
  slow = false,
  idle = false,
  onLand,
}: {
  tone: DieTone;
  value?: number | null;
  rolling?: boolean;
  orbit?: boolean;
  slow?: boolean;
  idle?: boolean;
  onLand?: () => void;
}) {
  const skin = toneClass(tone);
  const alt = isAltSpin(tone);
  const cubeRef = useRef<HTMLDivElement>(null);
  const angles = useRef({ x: -28, y: 24, z: 0 });
  const snapOnMount = useRef(value != null && value >= 1 && value <= 6);
  const landed = useRef<number | null>(null);
  const onLandRef = useRef(onLand);
  const [settled, setSettled] = useState(false);

  onLandRef.current = onLand;

  useEffect(() => {
    const el = cubeRef.current;
    if (!el) return;

    if (orbit) {
      setSettled(false);
      el.style.transition = "none";
      let raf = 0;
      const phase = ORBIT_PHASE[skin] ?? 0;
      const t0 = performance.now();
      const yaw = idle ? 12 : 28;
      const wobble = idle ? 0.35 : 0.7;
      const tick = (now: number) => {
        const t = (now - t0) / 1000 + phase;
        applyRot(
          el,
          -26 + Math.sin(t * wobble) * (idle ? 6 : 8),
          22 + t * yaw,
          Math.sin(t * wobble * 0.8) * (idle ? 4 : 5),
          angles.current,
        );
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    if (value && value >= 1 && value <= 6) {
      if (landed.current === value) return;
      const [tx, ty] = FACE_ROT[value] ?? [0, 0];
      if (snapOnMount.current) {
        snapOnMount.current = false;
        landed.current = value;
        applyRot(el, tx, ty, 0, angles.current);
        el.style.transition = "none";
        return;
      }

      setSettled(false);
      let raf = 0;
      const timer = window.setTimeout(() => {
        landed.current = value;
        const x0 = angles.current.x;
        const y0 = angles.current.y;
        const z0 = angles.current.z;
        const x1 = continueTo(x0, tx, alt ? 2 : 2);
        const y1 = continueTo(y0, ty, alt ? 3 : 2);
        const z1 = continueTo(z0, 0, 0);
        const t0 = performance.now();
        const duration = slow ? 1600 : 1400;
        el.style.transition = "none";
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / duration);
          const e = easeOutCubic(t);
          applyRot(
            el,
            x0 + (x1 - x0) * e,
            y0 + (y1 - y0) * e,
            z0 + (z1 - z0) * e,
            angles.current,
          );
          if (t < 1) {
            raf = requestAnimationFrame(tick);
          } else {
            setSettled(true);
            onLandRef.current?.();
            window.setTimeout(() => setSettled(false), 400);
          }
        };
        raf = requestAnimationFrame(tick);
      }, alt ? 60 : 0);
      return () => {
        window.clearTimeout(timer);
        cancelAnimationFrame(raf);
      };
    }

    landed.current = null;
    setSettled(false);

    if (rolling) {
      el.style.transition = "none";
      let raf = 0;
      const t0 = performance.now();
      const x0 = angles.current.x;
      const y0 = angles.current.y;
      const z0 = angles.current.z;
      const mul = slow ? 0.18 : 0.38;
      const tick = (now: number) => {
        const dt = now - t0;
        applyRot(
          el,
          x0 + dt * 0.09 * mul + Math.sin(dt * 0.003) * (slow ? 5 : 9),
          y0 + dt * 0.12 * mul,
          z0 + dt * 0.04 * mul,
          angles.current,
        );
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    applyRot(el, -28, 24, 0, angles.current);
    el.style.transition = "transform 0.45s ease";
  }, [alt, idle, orbit, rolling, skin, slow, value]);

  return (
    <div
      className={[
        "cube-scene",
        skin,
        orbit ? "is-orbit" : "",
        rolling && !value ? "is-tumbling" : "",
        rolling && slow ? "slow-tumble" : "",
        value != null && value >= 1 && value <= 6 ? "has-value" : "",
        settled ? "is-settled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--die-accent": skinAccent(tone) } as CSSProperties}
    >
      <div className="cube-cam">
        <div
          className="cube"
          ref={cubeRef}
          style={{
            transform: `rotateX(${angles.current.x}deg) rotateY(${angles.current.y}deg) rotateZ(${angles.current.z}deg)`,
          }}
        >
          <div className="cube-face front"><Pips n={1} /></div>
          <div className="cube-face back"><Pips n={6} /></div>
          <div className="cube-face right"><Pips n={3} /></div>
          <div className="cube-face left"><Pips n={4} /></div>
          <div className="cube-face top"><Pips n={2} /></div>
          <div className="cube-face bottom"><Pips n={5} /></div>
        </div>
      </div>
      <i className="cube-shadow" aria-hidden />
    </div>
  );
}

function skinAccent(tone: DieTone) {
  if (tone === "glass-purple" || tone === "burn") return "#a855f7";
  if (tone === "glass-green" || tone === "green-purple" || tone === "chain") return "#22c55e";
  if (tone === "glass-orange" || tone === "orange-blue") return "#f97316";
  if (tone === "black-red" || tone === "red") return "#ef4444";
  return "#22d3ee";
}
