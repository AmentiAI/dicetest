"use client";

import { useEffect, useState, type MouseEventHandler, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

type Props = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "ghost" | "join";
  className?: string;
  pulse?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  title?: string;
};

export function CoolBtn({
  children,
  href,
  variant = "primary",
  className = "",
  pulse = false,
  fullWidth = false,
  disabled,
  type = "button",
  onClick,
  title,
}: Props) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    setLive(true);
  }, []);

  const isBlock =
    fullWidth ||
    variant === "join" ||
    className.includes("w-full") ||
    className.includes("btn-roll");

  const cls = [
    "cool-btn",
    `cool-btn-${variant}`,
    pulse ? "is-pulse" : "",
    isBlock ? "is-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className="cool-btn-glow" aria-hidden />
      <span className="cool-btn-sheen" aria-hidden />
      <span className="cool-btn-body">{children}</span>
    </>
  );

  const wrapCls = ["cool-btn-wrap", isBlock ? "is-block" : ""].filter(Boolean).join(" ");

  if (href) {
    const link = (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
    if (!live) return <span className={wrapCls}>{link}</span>;
    return (
      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className={wrapCls}>
        {link}
      </motion.div>
    );
  }

  if (!live) {
    return (
      <button type={type} className={cls} disabled={disabled} onClick={onClick} title={title}>
        {inner}
      </button>
    );
  }

  return (
    <motion.button
      type={type}
      className={cls}
      disabled={disabled}
      onClick={onClick}
      title={title}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
    >
      {inner}
    </motion.button>
  );
}
