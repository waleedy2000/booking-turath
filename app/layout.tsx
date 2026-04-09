import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-cairo",
});

import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#097834",
};

export const metadata: Metadata = {
  title: "حجز الغرف | جمعية إحياء التراث",
  description: "نظام حجز غرف الاجتماعات في جمعية إحياء التراث الإسلامي",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "الحجوزات",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

import ThemeProvider from "@/components/theme/ThemeProvider";

import SplashWrapper from "@/components/splash/SplashWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className={`${cairo.className} min-h-full flex flex-col bg-transparent dark:bg-[#0a0a0a] text-black dark:text-white transition-colors duration-300`}>
        <ThemeProvider>
          <SplashWrapper>{children}</SplashWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
