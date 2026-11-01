import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { AD_LOADER_SRC } from "@/lib/ads";
import "./docs.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlowZen API Documentation",
  description: "Complete API reference for FlowZen mobile app integration",
};

export default function DocsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* This layout renders its own document, so it carries the loader as
            well — next/script dedupes scripts sharing the same id. */}
        <Script
          id="google-adsense"
          async
          src={AD_LOADER_SRC}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <div className="docs-container">
          {children}
        </div>
      </body>
    </html>
  );
}
