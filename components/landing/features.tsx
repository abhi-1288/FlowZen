"use client";

import { motion } from "framer-motion";
import {
  Layout,
  Users,
  Clock,
  DollarSign,
  UserPlus,
  Building2,
  Lock,
  MessageCircle,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: Layout,
    title: "Intuitive Boards",
    desc: "Drag-and-drop your way to productivity. Kanban boards that are fast, responsive, and easy to use.",
    color: "indigo",
  },
  {
    icon: Users,
    title: "Real-time Sync",
    desc: "Watch tasks move across the board instantly. Powered by SSE and WebSockets so you never need to refresh.",
    color: "purple",
  },
  {
    icon: Clock,
    title: "Attendance & Leaves",
    desc: "Check-in/check-out with location tracking, WFH modes, holiday management, and multi-step leave approvals.",
    color: "amber",
  },
  {
    icon: DollarSign,
    title: "Finance & Invoicing",
    desc: "Manage salaries, expenses, project budgets, resource requests, automated payroll, and printable invoices.",
    color: "emerald",
  },
  {
    icon: UserPlus,
    title: "Recruitment & Hiring",
    desc: "Full recruitment lifecycle: job postings, candidates, interview scheduling, pipeline funnel, offer letters with CTC breakdown, and convert-to-employee.",
    color: "violet",
  },
  {
    icon: Building2,
    title: "Company & HR Tools",
    desc: "Role-based onboarding, team invite codes, HR broadcasts, meeting invites, policy management, and more.",
    color: "rose",
  },
  {
    icon: Lock,
    title: "Role-based Access",
    desc: "Eight user roles with granular board-level permissions: Admin, HR, Finance, PM, QA, Security, Employee, and more.",
    color: "cyan",
  },
  {
    icon: MessageCircle,
    title: "Chat & Messaging",
    desc: "Real-time messaging with read/delivery receipts, online presence indicators, member sidebar, and info modals.",
    color: "teal",
  },
  {
    icon: Shield,
    title: "Security & Visitor Management",
    desc: "Entry/exit scanning, QR-based visitor passes, lost card workflows, emergency contacts, and building access logs.",
    color: "orange",
  },
] as const;

const featureStyles = {
  indigo: { icon: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400", border: "hover:border-indigo-300 dark:hover:border-indigo-700" },
  purple: { icon: "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400", border: "hover:border-purple-300 dark:hover:border-purple-700" },
  emerald: { icon: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400", border: "hover:border-emerald-300 dark:hover:border-emerald-700" },
  amber: { icon: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400", border: "hover:border-amber-300 dark:hover:border-amber-700" },
  rose: { icon: "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400", border: "hover:border-rose-300 dark:hover:border-rose-700" },
  cyan: { icon: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400", border: "hover:border-cyan-300 dark:hover:border-cyan-700" },
  violet: { icon: "bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400", border: "hover:border-violet-300 dark:hover:border-violet-700" },
  teal: { icon: "bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400", border: "hover:border-teal-300 dark:hover:border-teal-700" },
  orange: { icon: "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400", border: "hover:border-orange-300 dark:hover:border-orange-700" },
} as const;

export function Features() {
  return (
    <section className="py-28 px-6 relative z-10 border-t border-gray-100 dark:border-[#222] bg-gray-50/50 dark:bg-[#0a0a0a]/50 mt-20">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-gray-50">
            Everything you need to ship faster
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-xl max-w-2xl mx-auto">
            We&apos;ve obsessed over every detail to give your team the perfect
            environment to manage projects with zero friction.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className={`bg-white dark:bg-[#111] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-8 transition-all duration-200 group ${featureStyles[feature.color].border}`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200 ${featureStyles[feature.color].icon}`}
              >
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                {feature.title}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
