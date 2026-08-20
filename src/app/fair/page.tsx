import { PROGRAM_ID } from "@/lib/solana/constants";

export default function FairPage() {
  return (
    <div className="dash-page doc-page">
      <p className="dash-eyebrow">Proof</p>
      <h1>Provably fair</h1>
      <p className="muted">
        Rolls are not picked by the server. After both wagers lock, the program
        waits for a future slot, then reads Solana’s SlotHashes sysvar.
      </p>
      <pre className="hash-box">{`digest = SHA-256(
  slot_hash
  || duel_pda
  || host
  || challenger
  || wager_u64_le
  || reveal_slot_u64_le
  || counter_u64_le
)
host_die       = unbiased d6 from digest[0]  (byte >= 252 rejected)
challenger_die = unbiased d6 from digest[1]
if tied: counter += 1 and re-hash`}</pre>
      <ul>
        <li>
          Sysvar: <code>SysvarS1otHashes111111111111111111111111111</code>
        </li>
        <li>
          Program: <code>{PROGRAM_ID.toBase58()}</code>
        </li>
        <li>
          Client mirror: <code>src/lib/solana/dice.ts</code> — recompute any
          settle from the explorer hash.
        </li>
      </ul>
      <p className="muted">
        Players cannot grind: the hash is unknown at lock time. Slot leaders can
        theoretically bias a hash; that is the tradeoff of using slot hashes
        instead of a VRF. Open a circle, then use Match History → Proof to
        inspect a finished PDA.
      </p>
    </div>
  );
}
