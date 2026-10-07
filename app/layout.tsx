import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/lib/toast-context";
import { GlobalNotificationListener } from "@/components/global-notification-listener";
import { PushNotificationSetup } from "@/components/push-notification-setup";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { DevCronProvider } from "@/components/providers/DevCronProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "FlowZen — All-in-One HRMS Platform for HR, Recruitment & Workflow",
    template: "FlowZen - %s",
  },
  icons: {
    icon: "/Logos/logo.jpg",
  },
  description:
    "FlowZen is an all-in-one HRMS platform: manage HR, recruitment, attendance, payroll finance, kanban boards, IT helpdesk, and team chat in one workspace.",
  keywords: [
    "all-in-one HRMS platform",
    "HRMS software",
    "HR software for small business",
    "recruitment management software",
    "employee management platform",
    "attendance tracking",
    "kanban board software",
    "team chat",
    "IT helpdesk",
    "FlowZen",
  ],
  alternates: {
    canonical: "https://flowzen.app",
  },
  authors: [{ name: "FlowZen", url: "https://github.com/abhi-1288" }],
  creator: "FlowZen",
  publisher: "FlowZen",
  metadataBase: new URL("https://flowzen.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://flowzen.app",
    siteName: "FlowZen",
    title: "FlowZen — All-in-One HRMS Platform",
    description:
      "Manage HR, recruitment, attendance, finance, kanban boards, and team chat in one unified workspace.",
    images: [
      {
        url: "/Logos/logo-text.jpg",
        width: 1200,
        height: 630,
        alt: "FlowZen — All-in-One HRMS Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlowZen — All-in-One HRMS Platform",
    description:
      "Manage HR, recruitment, attendance, finance, kanban boards, and team chat in one unified workspace.",
    images: ["/Logos/logo-text.jpg"],
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=localStorage.getItem('flowzen_theme');if(!['light','dark','system','light-neumorphism','dark-neumorphism'].includes(p))p=localStorage.getItem('flowzen_darkMode')==='true'?'dark':'system';var d=p==='dark'||p==='dark-neumorphism'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('theme-neu',p==='light-neumorphism'||p==='dark-neumorphism');r.classList.toggle('theme-neu-light',p==='light-neumorphism');r.classList.toggle('theme-neu-dark',p==='dark-neumorphism');r.style.colorScheme=d?'dark':'light'}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <ThemeProvider>
            <ToastProvider>
              <DevCronProvider />
              <GlobalNotificationListener />
              <PushNotificationSetup />
              {children}
              <CookieConsentBanner />
            </ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
