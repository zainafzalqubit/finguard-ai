import { Inter } from "next/font/google";
import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import "@/ui/styles/tokens.css";
import "@/ui/styles/base.css";
import "@/ui/styles/layout.css";
import "@/ui/styles/timeline.css";
import "@/ui/styles/findings.css";
import "@/ui/styles/dialog.css";
import "@/ui/styles/folder.css";

// Self-hosted at build time; the design uses regular weight only.
const inter = Inter({ subsets: ["latin"], weight: "400", variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "FinGuard Audit",
  description: "Three AI agents audit invoices, purchase orders and payments at the same time. Code decides every finding.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
