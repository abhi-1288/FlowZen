"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Cookie } from "lucide-react";

const CONSENT_KEY = "flowzen_cookie_consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CONSENT_KEY) !== "accepted") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {}
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4 pointer-events-none"
        >
          <div className="mx-auto max-w-3xl pointer-events-auto neu-card rounded-2xl p-5 dark:bg-[#000000] dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <Cookie size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                  We use cookies to enhance your experience, remember your preferences, and improve our services. By clicking &quot;Accept&quot;, you agree to our use of cookies.
                </p>
                <Link
                  href="/privacy"
                  className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Privacy Policy
                </Link>
              </div>
              <button
                onClick={accept}
                className="shrink-0 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
