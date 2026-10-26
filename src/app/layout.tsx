import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Be_Vietnam_Pro, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { Ambient } from "@/components/ambient";
import { AppChrome } from "@/components/app-chrome";
import { GlobalFx } from "@/components/global-fx";
import { RevealObserver } from "@/components/reveal";
import { SwRegister } from "@/components/sw-register";
import { ToastHost } from "@/components/toast";
import "./globals.css";

// Be Vietnam Pro is drawn for Vietnamese diacritics; Bricolage Grotesque gives headlines and big numbers character
// (it ships a vietnamese subset); JetBrains Mono is only for times and scores.
const body = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const display = Bricolage_Grotesque({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});
const num = JetBrains_Mono({ subsets: ["latin"], variable: "--font-num", display: "swap" });

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Bảng điều khiển cá nhân",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Dashboard" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

const THEME_COLOR = { light: "#FFF6D6", dark: "#0C0814" } as const;

/** Theme cookie: "light" | "dark" | "system" (absent = system). */
async function readTheme(): Promise<"light" | "dark" | undefined> {
  const value = (await cookies()).get("theme")?.value;
  return value === "light" || value === "dark" ? value : undefined;
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await readTheme();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    colorScheme: theme ?? "light dark",
    themeColor: theme
      ? THEME_COLOR[theme]
      : [
          { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
          { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
        ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await readTheme();
  return (
    <html
      lang="vi"
      data-theme={theme}
      className={`${body.variable} ${display.variable} ${num.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Ambient />
        <AppChrome />
        <div id="app" className="relative z-[var(--z-content)] flex flex-1 flex-col">
          {children}
        </div>
        <ToastHost />
        <GlobalFx />
        <RevealObserver />
        <SwRegister />
      </body>
    </html>
  );
}
