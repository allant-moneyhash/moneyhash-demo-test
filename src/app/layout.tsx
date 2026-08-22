import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoneyHash Demo Tool",
  description: "Configure a checkout and watch every API call it makes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
