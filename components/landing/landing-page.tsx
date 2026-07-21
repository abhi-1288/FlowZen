"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

import { LazyMotion, domAnimation } from "framer-motion";
import { Navbar } from "./navbar";
import { Hero } from "./hero";
import { DashboardMockup } from "./dashboard-mockup";
import { Features } from "./features";
import { ChatMockup } from "./chat-mockup";
import { Stats } from "./stats";
import { Highlight } from "./highlight";
import { Faq } from "./faq";
import { Cta } from "./cta";
import { Footer } from "./footer";

import { CompanyLogos } from "./company-logos";
import { Testimonials } from "./testimonials";
import { GitHubStars } from "./github-stars";
import { ScrollProgress } from "./effects/scroll-progress";
import { AuroraGradient } from "./effects/aurora-gradient";
import { FloatingOrbs } from "./effects/floating-orbs";
import { NoiseOverlay } from "./effects/noise-overlay";
import { CursorSpotlight } from "./effects/cursor-spotlight";

function useBrowserMounted() {
  const [mounted, setMounted] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    raf.current = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf.current);
  }, []);
  return mounted;
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FlowZen",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "All-in-one workflow platform for managing kanban boards, attendance, finance, HR, recruitment, and chat.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available with optional paid plans",
  },
  url: "https://flowzen.app",
  logo: "https://flowzen.app/Logos/logo.jpg",
  screenshot: "https://flowzen.app/screenshot.png",
  featureList: [
    "Kanban Boards",
    "Real-time Sync",
    "Attendance Tracking",
    "Finance & Invoicing",
    "HR Module",
    "Recruitment Pipeline",
    "Team Chat",
    "Role-based Access Control",
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "150",
  },
};

export function LandingPage() {
  const isLoaded = useBrowserMounted();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 overflow-x-hidden font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/40 selection:text-indigo-900 dark:selection:text-indigo-100">
        {/* Global Effects */}
        <ScrollProgress />
        <NoiseOverlay />
        <CursorSpotlight />

        {/* Navigation */}
        <Navbar scrolled={scrolled} />

        <main className="relative z-10 pt-20 sm:pt-32" role="main">
          {/* Hero Section */}
          <section aria-label="Hero">
            <AuroraGradient />
            <FloatingOrbs />
            <Hero isLoaded={isLoaded} />
            <DashboardMockup />
          </section>

          {/* Features Section */}
          <section aria-label="Features">
            <Features />
          </section>

          {/* Chat Messaging Mockup */}
          <section aria-label="Chat demo">
            <ChatMockup />
          </section>

          {/* Stats Section */}
          <section aria-label="Statistics">
            <Stats />
          </section>

          {/* Company Logos */}
          <section aria-label="Trusted companies">
            <CompanyLogos />
          </section>

          {/* Highlight Section */}
          <section aria-label="Why FlowZen">
            <Highlight />
          </section>

          {/* Testimonials */}
          <section aria-label="Testimonials">
            <Testimonials />
          </section>

          {/* GitHub Stars */}
          <section aria-label="GitHub stars">
            <GitHubStars />
          </section>

          {/* FAQ Section */}
          <section aria-label="Frequently asked questions">
            <Faq />
          </section>

          {/* CTA Section */}
          <section aria-label="Call to action">
            <Cta />
          </section>
        </main>

        {/* Footer */}
        <Footer />

        {/* Back to Top */}
        <AnimatePresence>
          {scrolled && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-8 right-8 z-50 w-11 h-11 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-lg hover:bg-gray-800 dark:hover:bg-white transition-colors flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Back to top"
            >
              <ArrowUp size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}

export default LandingPage;
