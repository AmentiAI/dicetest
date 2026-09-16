export function explainChainError(e: unknown): string {
  const any = e as {
    message?: string;
    shortMessage?: string;
    cause?: { message?: string; shortMessage?: string };
  };
  const parts = [
    any?.shortMessage,
    any?.message,
    any?.cause?.shortMessage,
    any?.cause?.message,
  ]
    .filter(Boolean)
    .join(" ");

  if (/user rejected|rejected the request|denied/i.test(parts)) {
    return "Wallet rejected the transaction.";
  }
  if (/insufficient funds|exceeds the balance/i.test(parts)) {
    return "Not enough ETH for the wager plus gas.";
  }
  if (/BadNft|not token owner|not owner/i.test(parts)) {
    return "That dice NFT is not in this wallet, or it is not approved.";
  }
  if (/BadWager|wager/i.test(parts)) {
    return "Wager must match the circle, within the ETH limits.";
  }
  if (/TooEarly/i.test(parts)) {
    return "Reveal block is not in yet. Wait a few blocks.";
  }
  if (/Expired|HashMissing/i.test(parts)) {
    return "The reveal hash aged off. Refund both wagers.";
  }
  if (/SelfJoin/i.test(parts)) {
    return "You cannot join your own circle.";
  }
  if (/BadStatus/i.test(parts)) {
    return "This duel is not in the right state for that action.";
  }
  return any?.shortMessage || any?.message || String(e);
}
