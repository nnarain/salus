import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health Tracker",
  description: "Self hosted personal health tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
