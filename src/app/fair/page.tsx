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
        The website cannot pick a winner. After the host starts the table, a
        future Ethereum block — a public number nobody has seen yet — becomes
        every player&apos;s die. Anyone can check it later.
      </p>

      <ol className="fair-steps">
        <li>
          <strong>You sit, then the host starts</strong>
          <span>
            ETH or an NFT goes into the table contract. 1v1 up to 10 seats.
            The host can start with any number of players once at least two
            are in. Nothing is rolled until they confirm.
          </span>
        </li>
        <li>
          <strong>Wait {REVEAL_DELAY_BLOCKS} new blocks</strong>
          <span>
            Ethereum keeps adding blocks. The result is hidden during this wait,
            so nobody can peek and leave.
          </span>
        </li>
        <li>
          <strong>That later block is every roll</strong>
          <span>
            Every block has a fingerprint (a hash). We turn that fingerprint
            into a die 1 through 6 for each player. Highest roll wins the pot.
          </span>
        </li>
        <li>
          <strong>Six or more players: top 5 go to a final</strong>
          <span>
            The five highest rolls advance. They wait three more blocks and
            roll again. Winner takes the whole pot. Ties on a face use extra
            bits of the same hash — no extra luck from the server.
          </span>
        </li>
      </ol>

      <div className="fair-callouts">
        <article>
          <h2>Why you can&apos;t cheat</h2>
          <p>
            When the host starts, the winning block does not exist yet. You
            cannot pick a lucky number, and neither can we. If that block gets
            too old (past {HASH_WINDOW} blocks), everyone at the table gets
            their money back.
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
          Mix the block hash with the table id, your wallet, the wager, the
          round, your seat, and a counter. Take the first byte as a die (1–6).
          Remaining bits break ties. Same inputs always make the same ranking.
        </p>
        <pre className="hash-box">{`hash = keccak256(block + table + you + bet + round + seat + counter)
your die   = 1–6 from the first byte
if 6+ sit  = top 5 advance, mix a later block for the final
winner     = highest die, hash bits break ties`}</pre>
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
