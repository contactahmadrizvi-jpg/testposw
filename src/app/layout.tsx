import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { SWRegister } from "@/components/sw-register";
import { Analytics } from "@vercel/analytics/next"
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: {
    default: "SOMO - Modern Restaurant & Food Ordering System",
    template: "%s | SOMO"
  },
  description: "Order premium, delicious pizza, burgers, and more online from SOMO. Fast home delivery and hot takeaway options with a modern dining experience.",
  keywords: [
    "somo",
    "somo restaurant",
    "restaurant pos",
    "food ordering system",
    "online food delivery",
    "pizza delivery",
    "burger delivery",
    "restaurant sheikhupura",
    "food delivery sheikhupura",
    "best restaurant",
    "order food online",
    "modern restaurant",
    "fast food delivery"
  ],
  metadataBase: new URL("https://www.somo.pk"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SOMO - Modern Restaurant & Food Ordering System",
    description: "Experience modern dining with SOMO. Premium food, swift delivery, and exceptional service.",
    url: "https://www.somo.pk",
    siteName: "SOMO",
    images: [
      {
        url: "/logo.jpeg",
        width: 800,
        height: 800,
        alt: "SOMO Logo",
      }
    ],
    locale: "en_PK",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "SOMO", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ff6b6b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} min-h-screen antialiased`}>
        <AppProviders>{children}</AppProviders>
        <SWRegister />
        <Analytics />
      </body>
    </html>
  );
}
