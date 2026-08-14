export default function HowToPlayPage() {
  return (
    <div className="doc-page">
      <p className="kicker">Rules</p>
      <h1>How to play</h1>
      <p className="muted">
        BLOCK DICE is 1v1 SOL. Two players lock the same wager. A future Solana
        slot hash rolls both dice. Higher roll takes the full pot. No rake.
      </p>
      <ol>
        <li>
          Connect a Solana wallet on this cluster and bind a call sign
          (signed message, stored in Neon).
        </li>
        <li>
          Open a circle with a wager, or enter someone else’s. Your SOL moves
          into the duel PDA — not a house wallet.
        </li>
        <li>
          Join commits <code>reveal_slot = current_slot + 4</code>. Wait until
          that slot exists in SlotHashes.
        </li>
        <li>
          Anyone can settle. The program derives two dice from the hash. Winner
          receives 2× wager in the same transaction.
        </li>
      </ol>
      <p className="muted">
        If the committed slot ages off SlotHashes, both players can refund.
        Host can cancel before a challenger joins.
      </p>
    </div>
  );
}
