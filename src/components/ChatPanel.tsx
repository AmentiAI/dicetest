"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type Msg = {
  id: number;
  wallet: string;
  username: string;
  body: string;
  kind: string;
};

export function ChatPanel({ roomId }: { roomId: string }) {
  const { publicKey } = useWallet();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const res = await fetch(`/api/rooms/${roomId}/chat`);
      const json = await res.json();
      if (!stop) setMessages(json.messages ?? []);
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
    if (!publicKey || !text.trim()) return;
    const body = text.trim();
    setText("");
    await fetch(`/api/rooms/${roomId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: publicKey.toBase58(), body }),
    });
    const res = await fetch(`/api/rooms/${roomId}/chat`);
    const json = await res.json();
    setMessages(json.messages ?? []);
  }

  return (
    <aside className="chat">
      <p className="kicker">Circle log</p>
      <div className="chat-log" ref={scroller}>
        {messages.map((m) => (
          <p key={m.id} className={m.kind === "system" ? "sys" : ""}>
            <b>{m.username}</b> {m.body}
          </p>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
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
