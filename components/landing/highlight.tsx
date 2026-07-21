"use client";

import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

const highlights = [
  "Real-time kanban boards with drag-and-drop task management",
  "Attendance check-in/check-out with location & WFH modes",
  "Finance module: salaries, expenses, budgets, invoices, and automated payroll",
  "Full recruitment pipeline: jobs, candidates, interviews, offers, and hiring",
  "Multi-step approval workflows for joins, leaves, and quits",
  "Eight user roles with granular board-level permissions",
  "HR tools: policies, broadcasts, meeting invites, and role changes",
  "Real-time chat with read receipts, online presence, and delivery tracking",
  "Security & visitor management with entry/exit scanning and QR passes",
];

export function Highlight() {
  return (
    <section className="py-32 px-6 border-t border-gray-100 dark:border-[#222] relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center gap-20">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex-1 space-y-8"
        >
          <h2 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900 dark:text-gray-50">
            The all-in-one workspace <br />
            <span className="text-indigo-600 dark:text-indigo-400">for modern teams</span>.
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-xl leading-relaxed">
            Stop juggling multiple tools. FlowZen brings kanban boards,
            attendance tracking, finance, HR, and team communication into
            one unified workspace. Experience the speed of true real-time
            collaboration.
          </p>
          <ul className="space-y-4">
            {highlights.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-3 text-gray-600 dark:text-gray-300 text-lg"
              >
                <CheckCircle className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span>{item}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
          whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, type: "spring" }}
          whileHover={{ scale: 1.02 }}
          className="flex-1 relative w-full"
        >
          <div className="relative rounded-2xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] p-8 shadow-xl">
            <div className="space-y-8">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 relative z-10" />
                <div>
                  <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded-md mb-3" />
                  <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded-md" />
                </div>
              </div>
              <div className="h-32 w-full bg-gray-50 dark:bg-[#0a0a0a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-md mb-4" />
                <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded-md mb-6" />
                <div className="flex gap-2">
                  <div className="h-6 w-16 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full text-xs flex items-center justify-center font-medium">
                    Design
                  </div>
                  <div className="h-6 w-20 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full text-xs flex items-center justify-center font-medium">
                    Priority
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="flex -space-x-3">
                  {[
                    "bg-indigo-300",
                    "bg-indigo-400",
                    "bg-purple-300",
                    "bg-purple-400",
                  ].map((colorClass, i) => (
                    <div
                      key={i}
                      className={`w-10 h-10 rounded-full border-2 border-white dark:border-[#111] ${colorClass} relative z-${
                        40 - i * 10
                      }`}
                    />
                  ))}
                </div>
                <div className="px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 rounded-full border border-indigo-200 dark:border-indigo-800/40">
                  In Progress
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
