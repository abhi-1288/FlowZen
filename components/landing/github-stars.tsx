"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { FaGithub } from "react-icons/fa";

const GITHUB_OWNER = "abhi-1288";
const GITHUB_REPO = "FlowZen";
const CACHE_KEY = "flowzen_stars";
const CACHE_TTL = 5 * 60 * 1000;

function getCachedStars(): number | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { count, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return count;
  } catch {
    return null;
  }
}

function setCachedStars(count: number) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ count, timestamp: Date.now() })
    );
  } catch {}
}

function Counter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 1500;
    const steps = 45;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

function getInitialStars(): number | null {
  if (typeof window === "undefined") return null;
  return getCachedStars();
}

export function GitHubStars() {
  const [stars, setStars] = useState<number | null>(getInitialStars);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (stars !== null) return;

    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        const count = data.stargazers_count as number;
        setCachedStars(count);
        setStars(count);
      })
      .catch(() => setError(true));
  }, [stars]);

  if (error) return null;

  return (
    <section className="py-16 px-6 border-t border-gray-100 dark:border-[#222] relative overflow-hidden">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-6"
        >
          <motion.a
            href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-4 px-8 py-5 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] hover:border-gray-300 dark:hover:border-[#3a3a3a] transition-all group shadow-sm hover:shadow-md"
            aria-label="Star us on GitHub"
          >
            <FaGithub className="w-8 h-8 text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Star us on GitHub
              </p>
              <div className="flex items-baseline gap-1.5">
                {stars !== null ? (
                  <>
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-50">
                      <Counter target={stars} />
                    </span>
                    <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">
                      stars
                    </span>
                  </>
                ) : (
                  <div className="h-7 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                )}
              </div>
            </div>
          </motion.a>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Open source &middot; MIT License &middot; Contributions welcome
          </p>
        </motion.div>
      </div>
    </section>
  );
}
