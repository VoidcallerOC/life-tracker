import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Life OS",
  description: "Personal life tracker — Forge clients, animals, content, personal.",
  applicationName: "Life OS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Life OS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${plex.className}`}>
      <body className="flex h-full flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
