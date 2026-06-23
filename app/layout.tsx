import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/lib/toast-context";
import { GlobalNotificationListener } from "@/components/global-notification-listener";
// @ts-ignore: Allow importing global CSS without type declarations
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "FlowZen",
    template: "FlowZen - %s",
  },
  icons: {
    icon: '/icon.jpg',
  },
  description: "A full-stack board-based task manager.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <ToastProvider>
            <GlobalNotificationListener />
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}