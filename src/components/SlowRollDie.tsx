"use client";

import { dieVars, pipOn, type SlowRollNft } from "@/lib/slow-roll/die";

export function SlowRollDie({
  nft,
  size = 92,
  sync = false,
}: {
  nft: SlowRollNft;
  size?: number;
  sync?: boolean;
}) {
  const style = {
    ...dieVars(nft.s, size),
    ...(sync
      ? {
          "--dur": "24s",
          "--delay": "0s",
          "--sx": "-24deg",
          "--sy": "32deg",
          "--sz": "0deg",
          "--rx": "360deg",
          "--ry": "360deg",
          "--rz": "0deg",
        }
      : {}),
  };
  return (
    <div className={`slow-die bg-${nft.bg}`} data-bg={nft.bg}>
      <div className="scene" style={style}>
        <div className="shadow" />
        <div className={`cube tex-${nft.tex} fin-${nft.fin} pip-${nft.pip}`}>
          {Array.from({ length: 6 }, (_, face) => (
            <div key={face} className={`face f${face + 1}`}>
              <i className="tex" />
              <span className="pips">
                {Array.from({ length: 9 }, (_, cell) => (
                  <i key={cell} className={pipOn(face, cell) ? "p on" : "p"} />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
