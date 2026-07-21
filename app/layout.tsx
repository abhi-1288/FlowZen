import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/lib/toast-context";
import { GlobalNotificationListener } from "@/components/global-notification-listener";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "FlowZen — All-in-one workflow platform for modern teams",
    template: "FlowZen - %s",
  },
  icons: {
    icon: "/icon.jpg",
  },
  description:
    "Manage kanban boards, attendance, finance, HR, recruitment, and team chat in one unified workspace. Real-time collaboration for modern teams.",
  keywords: [
    "kanban",
    "project management",
    "HR software",
    "attendance tracking",
    "finance management",
    "recruitment",
    "team collaboration",
    "workflow platform",
    "task management",
    "real-time boards",
  ],
  authors: [{ name: "FlowZen", url: "https://github.com/abhi-1288" }],
  creator: "FlowZen",
  publisher: "FlowZen",
  metadataBase: new URL("https://flowzen.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://flowzen.app",
    siteName: "FlowZen",
    title: "FlowZen — All-in-one workflow platform for modern teams",
    description:
      "Manage kanban boards, attendance, finance, HR, recruitment, and team chat in one unified workspace.",
    images: [
      {
        url: "/screenshot.png",
        width: 1200,
        height: 630,
        alt: "FlowZen — Kanban boards, attendance, finance, HR, recruitment in one platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlowZen — All-in-one workflow platform",
    description:
      "Manage kanban boards, attendance, finance, HR, recruitment, and team chat in one unified workspace.",
    images: ["/screenshot.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
