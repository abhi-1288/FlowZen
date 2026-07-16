import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=localStorage.getItem('flowzen_theme');if(p!=='light'&&p!=='dark'&&p!=='system')p=localStorage.getItem('flowzen_darkMode')==='true'?'dark':'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <ThemeProvider>
            <ToastProvider>
              <GlobalNotificationListener />
              {children}
            </ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
