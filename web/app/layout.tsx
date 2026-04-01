import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAGnosis - AI-Powered RAG Intelligence",
  description:
    "Smart decisions about RAG technology. Get market intelligence and expert troubleshooting for RAG engineers, startup CEOs, architects, and hiring managers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
