/** Shared motion tokens — keep UI animation consistent and restrained. */
export const motion = {
  fast: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as const },
  base: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as const },
  spring: { type: "spring" as const, stiffness: 380, damping: 28 },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: motion.base },
};

export const stagger = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.04 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: motion.base },
  },
};
