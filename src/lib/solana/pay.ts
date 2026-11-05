"use client";

import { TOKEN } from "@/lib/token";
import { solanaConnection } from "@/lib/solana/rpc";
import { solanaPubkey } from "@/lib/solana/keys";

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: { toBase58(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toBase58(): string };
  }>;
  signAndSendTransaction?: (tx: unknown) => Promise<{ signature: string }>;
  signTransaction?: (tx: unknown) => Promise<{ serialize: () => Uint8Array }>;
};

function getProvider(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
  };
  return w.phantom?.solana ?? w.solana ?? null;
}

export function hasSolanaWallet() {
  return Boolean(getProvider());
}

export async function connectSolanaWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("Install Phantom (or another Solana wallet) to pay with $RTB");
  }
  const { publicKey } = await provider.connect();
  return publicKey.toBase58();
}

export async function payRtbToDev(dest: string, amount: bigint) {
  const provider = getProvider();
  if (!provider) {
    throw new Error("Install Phantom (or another Solana wallet) to pay with $RTB");
  }

  const [
    { PublicKey, Transaction },
    {
      TOKEN_PROGRAM_ID,
      TOKEN_2022_PROGRAM_ID,
      getAssociatedTokenAddress,
      createAssociatedTokenAccountInstruction,
      createTransferCheckedInstruction,
    },
  ] = await Promise.all([import("@solana/web3.js"), import("@solana/spl-token")]);

  const { publicKey } = await provider.connect();
  const owner = new PublicKey(publicKey.toBase58());
  const mint = solanaPubkey(TOKEN.mint);
  const destination = solanaPubkey(dest);
  const connection = solanaConnection("client");

  const mintInfo = await connection.getAccountInfo(mint);
  if (!mintInfo) throw new Error("$RTB mint not found on Solana");
  const tokenProgram = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;

  const sourceAta = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    tokenProgram,
  );
  const destAta = await getAssociatedTokenAddress(
    mint,
    destination,
    false,
    tokenProgram,
  );

  const sourceInfo = await connection.getAccountInfo(sourceAta);
  if (!sourceInfo) {
    throw new Error(`This wallet has no $${TOKEN.symbol}. Buy some on pump.fun first.`);
  }

  const destInfo = await connection.getAccountInfo(destAta);
  const tx = new Transaction();
  if (!destInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        owner,
        destAta,
        destination,
        mint,
        tokenProgram,
      ),
    );
  }
  tx.add(
    createTransferCheckedInstruction(
      sourceAta,
      mint,
      destAta,
      owner,
      amount,
      TOKEN.decimals,
      [],
      tokenProgram,
    ),
  );

  const latest = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = owner;
  tx.recentBlockhash = latest.blockhash;

  let signature: string;
  if (provider.signAndSendTransaction) {
    ({ signature } = await provider.signAndSendTransaction(tx));
  } else if (provider.signTransaction) {
    const signed = await provider.signTransaction(tx);
    signature = await connection.sendRawTransaction(signed.serialize());
  } else {
    throw new Error("This Solana wallet cannot send transactions");
  }

  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error("Solana rejected the $RTB transfer");
  }

  return { signature, wallet: owner.toBase58() };
}
