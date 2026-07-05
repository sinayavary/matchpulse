import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MatchPulse Intelligence",
  description: "Public-safe match intelligence focused on data availability, freshness, and quality."
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
              <Link href="/">Home</Link>
              <Link href="/matches">Matches</Link>
              <Link href="/demo">Demo</Link>
              <Link href="/agent">Agent</Link>
              <Link href="/replay">Replay</Link>
            </div>
          </nav>
        </div>
        {children}
        <div className="container footer">
          Informational match intelligence only. No wagering mechanics, payments, or financial guidance.
        </div>
      </body>
    </html>
  );
}
