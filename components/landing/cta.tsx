"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, CreditCard, Clock } from "lucide-react";
import { MagneticButton } from "./effects/magnetic-button";
import { AuroraGradient } from "./effects/aurora-gradient";
import { FloatingOrbs } from "./effects/floating-orbs";

const trustSignals = [
  { icon: CreditCard, text: "No credit card required" },
  { icon: Clock, text: "Free forever" },
  { icon: Shield, text: "SOC 2 ready" },
];

export function Cta() {
  return (
    <section className="py-32 px-6 text-center border-t border-gray-100 dark:border-[#222] relative overflow-hidden">
      <AuroraGradient />
      <FloatingOrbs />
      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-5xl md:text-7xl font-extrabold mb-8 text-gray-900 dark:text-gray-50 tracking-tight">
            Ready to find your flow?
          </h2>
          <p className="text-2xl text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Join the high-performing teams that are already managing
            boards, attendance, finance, HR, and recruitment with FlowZen.
          </p>
          <MagneticButton strength={0.3}>
            <Link
              href="/signup"
              className="inline-flex px-10 py-5 rounded-lg bg-indigo-600 text-white font-bold text-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25 dark:shadow-indigo-500/10"
            >
              Start your free trial today
            </Link>
          </MagneticButton>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
            {trustSignals.map((signal) => (
              <div
                key={signal.text}
                className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500"
              >
                <signal.icon className="w-4 h-4" />
                <span>{signal.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
