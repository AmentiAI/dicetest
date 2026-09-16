import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";
import "./globals.css";
import "./slow-roll-dice.css";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Roll the Block — whitelist",
  description:
    "Play is locked. 1,800 whitelist slots. Connect an ETH wallet and your X handle. Slow Roll dice revealed later.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
