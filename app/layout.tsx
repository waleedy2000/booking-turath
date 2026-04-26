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
  title: "حجز قاعة صباح الناصر | جمعية إحياء التراث الإسلامي",
  description: "نظام حجز قاعة الاجتماعات في مبنى صباح الناصر",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "حجز قاعة صباح الناصر | جمعية إحياء التراث الإسلامي",
    description: "نظام حجز قاعة الاجتماعات في مبنى صباح الناصر",
    url: "https://booking-turath.vercel.app",
    siteName: "حجز القاعة",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "حجز القاعة - جمعية إحياء التراث الإسلامي",
      },
    ],
    locale: "ar_KW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "حجز قاعة صباح الناصر | جمعية إحياء التراث الإسلامي",
    description: "نظام حجز قاعة الاجتماعات في مبنى صباح الناصر",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "الحجوزات",
  },
};

import ThemeProvider from "@/components/theme/ThemeProvider";

import SplashWrapper from "@/components/splash/SplashWrapper";
import RegisterSW from "@/components/RegisterSW";

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
        <RegisterSW />
        <ThemeProvider>
          <SplashWrapper>{children}</SplashWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
