"use client";

import { useEffect, useRef } from "react";

const PIP_CELLS: Record<number, string[]> = {
  1: ["2 / 2"],
  2: ["1 / 1", "3 / 3"],
  3: ["1 / 1", "2 / 2", "3 / 3"],
  4: ["1 / 1", "1 / 3", "3 / 1", "3 / 3"],
  5: ["1 / 1", "1 / 3", "2 / 2", "3 / 1", "3 / 3"],
  6: ["1 / 1", "1 / 3", "2 / 1", "2 / 3", "3 / 1", "3 / 3"],
};

/** Rotation that brings each pip face to the camera. Opposite faces sum to 7. */
const FACE_ROT: Record<number, [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

function continueTo(prev: number, target: number, extraTurns: number) {
  const tau = 360;
  const want = ((target % tau) + tau) % tau;
  const cur = ((prev % tau) + tau) % tau;
  const delta = (want - cur + tau) % tau;
  return prev + extraTurns * tau + delta;
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

export function CubeDie({
  tone,
  value = null,
  rolling = false,
  orbit = false,
}: {
  tone: "black" | "red";
  value?: number | null;
  rolling?: boolean;
  orbit?: boolean;
}) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const angles = useRef({ x: tone === "red" ? -28 : -22, y: tone === "red" ? -38 : 32 });
  const snapOnMount = useRef(value != null && value >= 1 && value <= 6);
  const landed = useRef<number | null>(null);

  useEffect(() => {
    if (orbit) return;
    const el = cubeRef.current;
    if (!el) return;

    if (value && value >= 1 && value <= 6) {
      if (landed.current === value) return;
      const [tx, ty] = FACE_ROT[value] ?? [0, 0];
      if (snapOnMount.current) {
        snapOnMount.current = false;
        landed.current = value;
        angles.current = { x: tx, y: ty };
        el.style.transition = "none";
        el.style.transform = `rotateX(${tx}deg) rotateY(${ty}deg)`;
        return;
      }
      const extraX = tone === "red" ? 4 : 3;
      const extraY = tone === "red" ? 6 : 5;
      const delay = tone === "red" ? 140 : 0;
      const timer = window.setTimeout(() => {
        landed.current = value;
        const x = continueTo(angles.current.x, tx, extraX);
        const y = continueTo(angles.current.y, ty, extraY);
        angles.current = { x, y };
        el.style.transition = "transform 1.55s cubic-bezier(0.12, 0.72, 0.18, 1)";
        el.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
      }, delay);
      return () => window.clearTimeout(timer);
    }

    landed.current = null;

    if (rolling) {
      el.style.transition = "none";
      let raf = 0;
      const t0 = performance.now();
      const x0 = angles.current.x;
      const y0 = angles.current.y;
      const speedX = tone === "red" ? 0.68 : 0.9;
      const speedY = tone === "red" ? 1.18 : 1.05;
      const tick = (now: number) => {
        const dt = now - t0;
        const x = x0 + dt * speedX;
        const y = y0 + dt * speedY;
        angles.current = { x, y };
        el.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    const idle = tone === "red" ? { x: -28, y: -38 } : { x: -22, y: 32 };
    angles.current = idle;
    el.style.transition = "transform 0.7s ease";
    el.style.transform = `rotateX(${idle.x}deg) rotateY(${idle.y}deg)`;
  }, [orbit, rolling, tone, value]);

  return (
    <div className={`cube-scene ${tone}${orbit ? " is-orbit" : ""}`}>
      <div
        className="cube"
        ref={orbit ? undefined : cubeRef}
        style={
          orbit
            ? undefined
            : {
                transform: `rotateX(${angles.current.x}deg) rotateY(${angles.current.y}deg)`,
              }
        }
      >
        <div className="cube-face front">
          <Pips n={1} />
        </div>
        <div className="cube-face back">
          <Pips n={6} />
        </div>
        <div className="cube-face right">
          <Pips n={3} />
        </div>
        <div className="cube-face left">
          <Pips n={4} />
        </div>
        <div className="cube-face top">
          <Pips n={2} />
        </div>
        <div className="cube-face bottom">
          <Pips n={5} />
        </div>
      </div>
    </div>
  );
}
