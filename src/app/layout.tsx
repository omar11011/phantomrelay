import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhantomRelay — Secure Node",
  description: "Secure relay node. End-to-end encrypted message routing.",
  keywords: ["relay", "node", "secure", "routing"],
  authors: [{ name: "PR-Node" }],
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
