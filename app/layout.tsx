import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@/app/globals.css";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

// next/font/google self-hosts + subsets these at build time (no runtime
// Google Fonts request, no layout-shift flash) - the idiomatic Next.js
// replacement for the <link> tags in design-proposal-v2.html. Inter feeds
// `fontFamily.sans` (tailwind.config.ts), JetBrains Mono feeds the new
// `fontFamily.mono`, applied to technical data (emails, MCP tokens,
// IMAP/SMTP hosts:ports) via `font-mono` in the settings pages.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return {
    title: dict.meta.title,
    description: dict.meta.description,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}