import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
        <div className="docs-container">
          {children}
        </div>
      </body>
    </html>
  );
}
