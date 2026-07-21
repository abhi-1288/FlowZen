"use client";

import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";

interface HeroProps {
  isLoaded: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

export function Hero({ isLoaded }: HeroProps) {
  return (
    <section className="px-4 sm:px-6 max-w-7xl mx-auto flex flex-col items-center text-center min-h-[70vh] sm:min-h-[85vh] justify-center relative">
      <AnimatePresence>
        {isLoaded && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="max-w-4xl w-full flex flex-col items-center"
          >
            <motion.div variants={itemVariants}>
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] sm:text-sm font-medium mb-6 sm:mb-8 border border-indigo-100 dark:border-indigo-800/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-colors cursor-default max-w-[90vw]">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span className="truncate">
                  Kanban &middot; Attendance &middot; Finance &middot; HR
                  &middot; Recruitment &middot; Chat
                </span>
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-6xl md:text-8xl font-extrabold tracking-tight mb-6 sm:mb-8 leading-[1.1] text-gray-900 dark:text-gray-50"
            >
              Find your team&apos;s <br className="hidden md:block" />
              flow state
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-base sm:text-xl md:text-2xl text-gray-500 dark:text-gray-400 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-2 sm:px-0"
            >
              FlowZen is the all-in-one workflow platform where teams
              manage kanban boards, attendance, finance, HR, recruitment,
              chat, approvals, and roles in one workspace.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
            >
              <div className="w-full mb-10 sm:w-auto">
                <Link
                  href="/signup"
                  className="px-8 py-4 rounded-lg bg-indigo-600 text-white font-semibold text-lg hover:bg-indigo-700 transition-colors flex items-center gap-3 group w-full sm:w-auto justify-center"
                >
                  Get Started for Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
