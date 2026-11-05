export function solscanTx(signature: string) {
  return `https://solscan.io/tx/${signature}`;
}

export function solscanAccount(address: string) {
  return `https://solscan.io/account/${address}`;
}