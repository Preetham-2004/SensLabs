import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SensLab Shooting Range",
  description: "Basic mouse sensitivity setup range.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
