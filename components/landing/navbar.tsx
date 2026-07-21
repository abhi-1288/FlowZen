"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { FaGithub } from "react-icons/fa";

interface NavbarProps {
  scrolled: boolean;
}

export function Navbar({ scrolled }: NavbarProps) {
  return (
    <motion.nav
      aria-label="Primary navigation"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 dark:bg-[#1a1a1a]/95 border-b border-gray-200 dark:border-[#2a2a2a] py-3 shadow-sm backdrop-blur-md"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <motion.div
            whileHover={{ rotate: 90, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center overflow-hidden relative"
          >
            <Image
              src="/Logos/logo.jpg"
              alt="FlowZen Logo"
              fill
              className="object-cover"
            />
          </motion.div>
          <span className="font-bold text-lg sm:text-xl tracking-tight text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            FlowZen
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-5">
          <motion.a
            href="https://github.com/abhi-1288/FlowZen"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            aria-label="View source on GitHub"
          >
            <FaGithub size={18} />
          </motion.a>
          <Link
            href="/careers"
            className="hidden sm:inline text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Careers
          </Link>
          <Link
            href="/login"
            className="hidden sm:inline text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Log in
          </Link>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/signup"
              className="px-4 sm:px-5 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-800 dark:hover:bg-white transition-colors whitespace-nowrap"
            >
              Sign up
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.nav>
  );
}
