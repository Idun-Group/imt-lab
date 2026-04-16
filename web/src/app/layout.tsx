import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign AI Lab",
  description: "European Business Data Analyst — IMT BS demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
