"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const testimonials = [
  {
    quote: "FlowZen replaced 4 separate tools for our engineering team. The real-time kanban boards alone saved us hours every sprint.",
    name: "Sarah Chen",
    role: "VP of Engineering",
    company: "Acme Corp",
    avatar: "SC",
    color: "from-indigo-400 to-purple-400",
  },
  {
    quote: "We went from spreadsheets to a full project management suite overnight. The onboarding was that smooth.",
    name: "Marcus Rodriguez",
    role: "Product Manager",
    company: "Globex",
    avatar: "MR",
    color: "from-emerald-400 to-teal-400",
  },
  {
    quote: "The best all-in-one platform I've used for startups. Kanban, HR, and finance in one place is a game changer.",
    name: "Priya Sharma",
    role: "CEO & Founder",
    company: "Initech",
    avatar: "PS",
    color: "from-amber-400 to-orange-400",
  },
  {
    quote: "The finance module alone saves our team 20+ hours per week. Automated payroll and invoicing is incredible.",
    name: "James O'Brien",
    role: "Chief Financial Officer",
    company: "Umbrella",
    avatar: "JO",
    color: "from-rose-400 to-pink-400",
  },
  {
    quote: "The recruitment pipeline is chef's kiss. From job posting to offer letter, everything flows seamlessly.",
    name: "Lisa Park",
    role: "HR Director",
    company: "Stark Industries",
    avatar: "LP",
    color: "from-violet-400 to-indigo-400",
  },
  {
    quote: "Chat plus boards is the perfect combo. Our team finally communicates and executes in the same tool.",
    name: "David Kim",
    role: "Engineering Team Lead",
    company: "Wayne Enterprises",
    avatar: "DK",
    color: "from-cyan-400 to-blue-400",
  },
];

export function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  const paginate = useCallback((newDirection: number) => {
    setDirection(newDirection);
    setCurrent((prev) => {
      const next = prev + newDirection;
      if (next < 0) return testimonials.length - 1;
      if (next >= testimonials.length) return 0;
      return next;
    });
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = setInterval(() => paginate(1), 5000);
    return () => clearInterval(timer);
  }, [paginate, prefersReducedMotion]);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
      x: direction < 0 ? 200 : -200,
      opacity: 0,
    }),
  };

  if (prefersReducedMotion) {
    return (
      <section className="py-24 px-6 border-t border-gray-100 dark:border-[#222] relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest uppercase text-indigo-600 dark:text-indigo-400 mb-3">
              What our users say
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-50">
              Loved by teams everywhere
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-8"
              >
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 text-sm">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-xs font-bold`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t.role}, {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 px-6 border-t border-gray-100 dark:border-[#222] relative overflow-hidden">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold tracking-widest uppercase text-indigo-600 dark:text-indigo-400 mb-3">
            What our users say
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-50">
            Loved by teams everywhere
          </h2>
        </div>

        <div
          className="relative overflow-hidden min-h-[280px]"
          onMouseEnter={() => clearInterval(0)}
        >
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-10 md:p-14 text-center"
            >
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-8 max-w-2xl mx-auto">
                &ldquo;{testimonials[current].quote}&rdquo;
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${testimonials[current].color} flex items-center justify-center text-white text-sm font-bold`}>
                  {testimonials[current].avatar}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {testimonials[current].name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {testimonials[current].role}, {testimonials[current].company}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > current ? 1 : -1);
                setCurrent(i);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? "bg-indigo-600 dark:bg-indigo-400 w-6"
                  : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
              }`}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
