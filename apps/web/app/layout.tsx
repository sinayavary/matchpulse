import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MatchPulse Intelligence",
  description: "TxLINE-powered sports intelligence and Solana/Web3 market insight app."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <nav className="nav">
            <Link className="brand" href="/">
              <span className="logo" />
              <span>MatchPulse</span>
            </Link>
            <div className="navlinks">
              <Link href="/matches">Matches</Link>
              <Link href="/agent">SignalCore</Link>
              <Link href="/replay">Replay</Link>
            </div>
          </nav>
        </div>
        {children}
        <div className="container footer">
          Informational sports intelligence only. No bets, wagers, betting execution, or financial advice.
        </div>
      </body>
    </html>
  );
}
