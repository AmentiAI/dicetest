export default function HowToPlayPage() {
  return (
    <div className="doc-page">
      <p className="kicker">Tables</p>
      <h1>How to play</h1>
      <p className="muted">
        Host a 1v1 or a free-for-all up to 10. Stake ETH, a Slow Roll NFT, or
        both. The host starts whenever they confirm. Winner takes the pot. No
        house cut.
      </p>
      <ol>
        <li>Connect an ETH or Robinhood wallet and pick a username.</li>
        <li>Open a table (2–10 seats) or join one by matching the stake.</li>
        <li>
          Host starts with any number of seated players (at least two). Wait
          three blocks. Highest roll wins.
        </li>
        <li>
          Six or more players: the five highest rolls advance, then they roll
          again for the whole pot.
        </li>
      </ol>
    </div>
  );
}
