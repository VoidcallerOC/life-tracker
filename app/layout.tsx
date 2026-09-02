import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life OS",
  description: "Personal life tracker — tasks, projects, animals, content.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
