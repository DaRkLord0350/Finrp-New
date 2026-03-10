import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "FinRP — AI Business Operating System",
    template: "%s | FinRP",
  },
  description:
    "FinRP is an AI-powered business operating system for SMEs. Manage customers, invoices, compliance, and get AI-driven financial insights.",
  keywords: ["fintech", "CRM", "invoicing", "AI", "business", "SME"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={`${inter.variable} font-sans antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
