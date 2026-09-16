import {
  CHAIN,
  DUEL_ADDRESS,
  HASH_WINDOW,
  REVEAL_DELAY_BLOCKS,
  explorerAccount,
  zeroAddress,
} from "@/lib/eth/constants";

export default function FairPage() {
  const deployed = DUEL_ADDRESS !== zeroAddress;

  return (
    <div className="dash-page doc-page fair-page">
      <p className="dash-eyebrow">Provably fair</p>
      <h1>We don&apos;t roll the dice. Ethereum does.</h1>
      <p className="fair-lead">
        The website cannot pick a winner. After both players lock their bets, a
        future Ethereum block — a public number nobody has seen yet — becomes
        the two dice. Anyone can check it later.
      </p>

      <ol className="fair-steps">
        <li>
          <strong>You both lock in</strong>
          <span>
            ETH or an NFT goes into the match contract. Until both sides are in,
            nothing is rolled.
          </span>
        </li>
        <li>
          <strong>Wait {REVEAL_DELAY_BLOCKS} new blocks</strong>
          <span>
            Ethereum keeps adding blocks. The result is hidden during this wait,
            so nobody can peek and cancel.
          </span>
        </li>
        <li>
          <strong>That later block is the roll</strong>
          <span>
            Every block has a fingerprint (a hash). We turn that fingerprint
            into two dice, 1 through 6. Higher roll takes the pot.
          </span>
        </li>
        <li>
          <strong>Ties try again from the same hash</strong>
          <span>
            If both dice match, we mix the hash one more time until someone
            wins. No extra luck from the server.
          </span>
        </li>
      </ol>

      <div className="fair-callouts">
        <article>
          <h2>Why you can&apos;t cheat</h2>
          <p>
            When you lock, the winning block does not exist yet. You cannot
            pick a lucky number, and neither can we. If that block gets too old
            (past {HASH_WINDOW} blocks), both players get their money back.
          </p>
        </article>
        <article>
          <h2>No house fee</h2>
          <p>
            The pot pays out in full. We don&apos;t take a cut of games. Mint
            and creator-fee revenue goes back into the platform.
          </p>
        </article>
        <article>
          <h2>How you can check</h2>
          <p>
            After a match, copy the reveal block from a block explorer. Plug it
            into the same recipe the contract uses. If the dice match what you
            saw in-game, the roll was honest.
          </p>
        </article>
      </div>

      <details className="fair-recipe">
        <summary>The exact recipe (optional)</summary>
        <p className="muted">
          Mix the block hash with the match id, both wallets, the wager, and a
          counter. Take the first two bytes. Each byte becomes a die (1–6).
          Bytes that would bias the die are skipped. Same inputs always make
          the same dice.
        </p>
        <pre className="hash-box">{`hash = keccak256(block + match + both players + bet + counter)
your die      = 1–6 from the first byte
their die     = 1–6 from the second byte
if tied       = add 1 to counter and mix again`}</pre>
      </details>

      <p className="fair-meta muted">
        Chain: {CHAIN.name}. Match contract:{" "}
        {deployed ? (
          <a href={explorerAccount(DUEL_ADDRESS)} target="_blank" rel="noreferrer">
            {DUEL_ADDRESS}
          </a>
        ) : (
          <code>not deployed yet</code>
        )}
        .
      </p>
    </div>
  );
}
