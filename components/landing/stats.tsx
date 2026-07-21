"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const stats = [
  { value: 15000, suffix: "+", label: "Tasks Completed", prefix: "" },
  { value: 500, suffix: "+", label: "Active Teams", prefix: "" },
  { value: 99.9, suffix: "%", label: "Uptime", prefix: "" },
  { value: 24, suffix: "/7", label: "Support", prefix: "" },
] as const;

function Counter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const steps = 60;
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

  return (
    <span ref={ref}>
      {target % 1 !== 0 ? count.toFixed(1) : count.toLocaleString()}
    </span>
  );
}

export function Stats() {
  return (
    <section className="py-24 px-6 border-t border-gray-100 dark:border-[#222] relative overflow-hidden bg-gray-50/50 dark:bg-[#0a0a0a]/50">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold tracking-widest uppercase text-indigo-600 dark:text-indigo-400 mb-3">
            Trusted by high-performing teams
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-50">
            FlowZen by the numbers
          </h2>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="text-center group"
            >
              <div className="inline-flex items-baseline gap-0.5">
                <span className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-gray-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">
                  {stat.prefix}
                  <Counter target={stat.value} />
                </span>
                <span className="text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  {stat.suffix}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
