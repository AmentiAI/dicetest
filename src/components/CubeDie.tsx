"use client";

import { useEffect, useRef } from "react";
import type { DieSkin } from "@/lib/cosmetics";

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

function asSkin(tone: DieSkin | "black" | "red"): DieSkin {
  if (tone === "black") return "ice";
  if (tone === "red") return "chain";
  return tone;
}

function easeOutBack(t: number) {
  const c1 = 1.18;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function CubeDie({
  tone,
  value = null,
  rolling = false,
  orbit = false,
  slow = false,
}: {
  tone: DieSkin | "black" | "red";
  value?: number | null;
  rolling?: boolean;
  orbit?: boolean;
  slow?: boolean;
}) {
  const skin = asSkin(tone);
  const alt = skin !== "ice";
  const cubeRef = useRef<HTMLDivElement>(null);
  const angles = useRef({ x: 0, y: 0, z: 0 });
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
        angles.current = { x: tx, y: ty, z: 0 };
        el.style.transition = "none";
        el.style.transform = `rotateX(${tx}deg) rotateY(${ty}deg) rotateZ(0deg)`;
        return;
      }

      const extraX = alt ? 2 : 2;
      const extraY = alt ? 3 : 2;
      const delay = alt ? 90 : 0;
      let raf = 0;
      const timer = window.setTimeout(() => {
        landed.current = value;
        const x0 = angles.current.x;
        const y0 = angles.current.y;
        const z0 = angles.current.z;
        const x1 = continueTo(x0, tx, extraX);
        const y1 = continueTo(y0, ty, extraY);
        const z1 = continueTo(z0, 0, 1);
        const t0 = performance.now();
        const duration = 980;
        el.style.transition = "none";
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / duration);
          const e = easeOutBack(t);
          const x = x0 + (x1 - x0) * e;
          const y = y0 + (y1 - y0) * e;
          const z = z0 + (z1 - z0) * e;
          angles.current = { x, y, z };
          el.style.transform = `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, delay);
      return () => {
        window.clearTimeout(timer);
        cancelAnimationFrame(raf);
      };
    }

    landed.current = null;

    if (rolling) {
      el.style.transition = "none";
      let raf = 0;
      const t0 = performance.now();
      const x0 = angles.current.x;
      const y0 = angles.current.y;
      const z0 = angles.current.z;
      const speedX = slow ? (alt ? 0.068 : 0.08) : alt ? 0.46 : 0.52;
      const speedY = slow ? (alt ? 0.09 : 0.074) : alt ? 0.61 : 0.56;
      const speedZ = slow ? 0.038 : 0.27;
      const wobble = slow ? 5 : 14;
      const tick = (now: number) => {
        const dt = now - t0;
        const x = x0 + dt * speedX + Math.sin(dt * 0.007) * wobble;
        const y = y0 + dt * speedY + Math.cos(dt * 0.0055) * wobble * 0.6;
        const z = z0 + dt * speedZ;
        angles.current = { x, y, z };
        el.style.transform = `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    angles.current = { x: 0, y: 0, z: 0 };
    el.style.transition = "transform 0.55s cubic-bezier(0.22, 0.8, 0.28, 1)";
    el.style.transform = "rotateX(0deg) rotateY(0deg) rotateZ(0deg)";
  }, [alt, orbit, rolling, slow, value]);

  return (
    <div
      className={`cube-scene ${skin}${orbit ? " is-orbit" : ""}${rolling && !value ? " is-tumbling" : ""}${rolling && slow && !value ? " slow-tumble" : ""}`}
    >
      <div className="cube-cam">
        <div
          className="cube"
          ref={orbit ? undefined : cubeRef}
          style={
            orbit
              ? undefined
              : {
                  transform: `rotateX(${angles.current.x}deg) rotateY(${angles.current.y}deg) rotateZ(${angles.current.z}deg)`,
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
      <i className="cube-shadow" aria-hidden />
    </div>
  );
}
