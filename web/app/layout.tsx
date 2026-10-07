import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./AuthProvider";

const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SensLab | Dial In Your Aim",
  description: "Calibrate your mouse sensitivity, lock in your settings, and dominate in the practice arena.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
