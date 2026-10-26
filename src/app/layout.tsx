import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Be Vietnam Pro is drawn for Vietnamese diacritics; JetBrains Mono is only for times and scores.
const body = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const num = JetBrains_Mono({ subsets: ["latin"], variable: "--font-num", display: "swap" });

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Bảng điều khiển cá nhân",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e11" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${body.variable} ${num.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
