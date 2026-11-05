export const TOKEN = {
  name: "Roll The Block",
  symbol: "RTB",
  mint: "5nESNJBnVi828ez3SDkVgsWF5PoRDrgLAULuxX5Qpump",
  decimals: 6,
  pumpUrl: "https://pump.fun/coin/5nESNJBnVi828ez3SDkVgsWF5PoRDrgLAULuxX5Qpump",
} as const;

export const TOKEN_UNITS = 10n ** BigInt(TOKEN.decimals);
