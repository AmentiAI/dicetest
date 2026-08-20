type IconName =
  | "dice"
  | "shield"
  | "pot"
  | "circles"
  | "receipt"
  | "sound"
  | "mute"
  | "dashboard"
  | "play"
  | "trophy"
  | "history"
  | "stats"
  | "affiliates"
  | "rewards"
  | "bell"
  | "chart"
  | "help"
  | "settings"
  | "sol"
  | "users";

export function GameIcon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "dice":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <polygon points="8,5 19,12 8,19" fill="currentColor" stroke="none" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 4h8v3a4 4 0 01-8 0V4z" />
          <path d="M6 4H4v2a2 2 0 002 2M18 4h2v2a2 2 0 01-2 2" />
          <path d="M12 11v3M9 20h6M10 14h4v3H10z" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case "stats":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 17V11M12 17V7M16 17v-5" />
        </svg>
      );
    case "affiliates":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M3 19c0-3 2.5-5 6-5M14 19c0-2.5 2-4.5 4.5-4.5" />
        </svg>
      );
    case "rewards":
      return (
        <svg {...common}>
          <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16l-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3z" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M12 4a4 4 0 00-4 4v3l-1.5 2.5h11L16 11V8a4 4 0 00-4-4z" />
          <path d="M10 18a2 2 0 004 0" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 20V4M4 20h16" />
          <path d="M8 16l3-4 3 2 4-6" />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 014.8 1c0 2-3 2-3 4" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      );
    case "sol":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <circle cx="12" cy="12" r="9" opacity="0.25" />
          <path d="M7 15.5l5-9 5 9H7z" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v6c0 4.5-3.2 7.4-7 9-3.8-1.6-7-4.5-7-9V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "pot":
      return (
        <svg {...common}>
          <path d="M6 10h12v8H6z" />
          <path d="M8 10V7h8v3" />
          <path d="M12 14v2" />
        </svg>
      );
    case "circles":
      return (
        <svg {...common}>
          <circle cx="8" cy="12" r="3" />
          <circle cx="16" cy="12" r="3" />
          <path d="M11 12h2" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M7 4h10v16l-2-1-2 1-2-1-2 1-2-1V4z" />
          <path d="M10 9h4M10 13h4" />
        </svg>
      );
    case "sound":
      return (
        <svg {...common}>
          <path d="M11 5L6 9H4v6h2l5 4V5z" />
          <path d="M16 9a3 3 0 010 6M18 7a6 6 0 010 10" />
        </svg>
      );
    case "mute":
      return (
        <svg {...common}>
          <path d="M11 5L6 9H4v6h2l5 4V5z" />
          <path d="M18 9l-6 6M12 9l6 6" />
        </svg>
      );
  }
}
