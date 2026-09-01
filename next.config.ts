import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Disable SW in dev — it intercepts Firebase auth/Firestore requests.
  // SW is only active in production (Vercel) where HTTPS is available.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  // Precache the key app pages so they work offline immediately after
  // the first online visit — no extra cache-warming step required.
  additionalPrecacheEntries: [
    { url: "/offline.html", revision: null },
    { url: "/pos-kitchen", revision: null },
    { url: "/pos", revision: null },
    { url: "/kitchen", revision: null },
    { url: "/login", revision: null },
  ],
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "i.imgbb.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default withSerwist(nextConfig);
