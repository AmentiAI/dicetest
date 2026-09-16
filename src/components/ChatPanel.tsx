"use client";

import { useEffect, useRef, useState } from "react";
import { chatAuthMessage } from "@/lib/auth";
import { getJson, postJson } from "@/lib/http";
import { useEthWallet } from "@/lib/eth/wallet";

type Msg = {
  id: number;
  wallet: string;
  username: string;
  body: string;
  kind: string;
};

export function ChatPanel({ roomId }: { roomId: string }) {
  const { address, signMessage } = useEthWallet();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const json = await getJson<{ messages: Msg[] }>(`/api/rooms/${roomId}/chat`);
      if (!stop) setMessages(json?.messages ?? []);
    };
    void tick();
    const t = setInterval(() => void tick(), 2500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [roomId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    if (!address || !text.trim()) return;
    const body = text.trim();
    const ts = Date.now();
    setText("");
    setError(null);
    try {
      const message = chatAuthMessage(roomId, address, body, ts);
      const sig = await signMessage(message);
      await postJson(`/api/rooms/${roomId}/chat`, {
        wallet: address,
        body,
        ts,
        signatureBase64: sig,
      });
      const json = await getJson<{ messages: Msg[] }>(`/api/rooms/${roomId}/chat`);
      setMessages(json?.messages ?? []);
    } catch (e) {
      setText(body);
      setError(e instanceof Error ? e.message : "Message was not sent.");
    }
  }

  const sys = messages.filter((m) => m.kind === "system");
  const chat = messages.filter((m) => m.kind !== "system");
  const online = new Set(chat.map((m) => m.wallet)).size || (address ? 1 : 0);

  return (
    <aside className="bd-chat">
      <p className="bd-chat-kicker">Circle log</p>
      <div className="bd-log">
        {(sys.length ? sys : messages.slice(0, 4)).map((m) => (
          <p key={m.id}>
            <b>SYS</b> {m.body}
          </p>
        ))}
        {messages.length === 0 ? (
          <>
            <p>
              <b>SYS</b> Circle opened…
            </p>
            <p>
              <b>SYS</b> Waiting for challenger…
            </p>
          </>
        ) : null}
      </div>

      <div className="bd-chat-head">
        <strong>CHAT</strong>
        <span className="bd-online">
          <i /> {online} online
        </span>
      </div>
      <div className="chat-log" ref={scroller}>
        {chat.length === 0 ? (
          <p className="sys">
            <b>Block Dice</b> Provably fair 1v1. Winner takes the pot.
          </p>
        ) : (
          chat.map((m) => (
            <p key={m.id} className={m.kind === "system" ? "sys" : ""}>
              <b>{m.username}</b> {m.body}
            </p>
          ))
        )}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {error ? <p className="sys">{error}</p> : null}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={240}
        />
        <button type="submit" className="send" aria-label="Send">
          ➤
        </button>
      </form>
    </aside>
  );
}
