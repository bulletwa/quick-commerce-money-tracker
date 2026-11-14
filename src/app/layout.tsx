import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Heartbeat } from "@/components/Heartbeat";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quick Commerce Money Tracker",
  description: "Local-only insights across Zomato and Swiggy",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-card">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 text-sm">
            <span className="font-semibold">₹ Money Tracker</span>
            <Link href="/" className="text-muted hover:text-foreground">Dashboard</Link>
            <Link href="/connect" className="text-muted hover:text-foreground">Setup</Link>
            <span className="ml-auto text-xs text-muted">Local only · data never leaves this machine</span>
          </nav>
        </header>
        <Heartbeat />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
