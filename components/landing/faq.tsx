"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Is FlowZen free to use?",
    a: "Yes! FlowZen offers a free tier for small teams. Upgrade to a paid plan when you need more boards, advanced finance features, or priority support.",
  },
  {
    q: "Can I use FlowZen without creating a company?",
    a: "Absolutely. You can use kanban boards and basic features as an individual. Company features (HR, finance, recruitment) become available once you register or join a company.",
  },
  {
    q: "How does the recruitment pipeline work?",
    a: "HR and admins can create job postings, manage candidates through pipeline stages (new → screening → interview → offered → hired), schedule interviews with feedback, and generate offer letters with full CTC breakdowns.",
  },
  {
    q: "What kind of support do you offer?",
    a: "We provide 24/7 email support for all users, with priority live chat for paid plans. Our documentation covers everything from setup to advanced features.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted in transit (TLS) and at rest. We use MongoDB Atlas for database hosting with automated backups, and NextAuth for secure authentication with JWT-based sessions.",
  },
];

function FaqItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`rounded-xl border transition-all duration-200 cursor-pointer ${
        open
          ? "border-indigo-200 dark:border-indigo-800/40 bg-white dark:bg-[#111] shadow-sm"
          : "border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] hover:border-gray-300 dark:hover:border-[#3a3a3a]"
      }`}
      onClick={() => setOpen(!open)}
      role="button"
      aria-expanded={open}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(!open);
        }
      }}
    >
      <div className="flex items-center justify-between px-6 py-5">
        <h3
          className={`text-lg font-semibold transition-colors ${
            open ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"
          }`}
        >
          {question}
        </h3>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`shrink-0 ml-4 ${
            open ? "text-indigo-500 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          <ChevronDown size={20} />
        </motion.div>
      </div>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="px-6 pb-5 text-gray-500 dark:text-gray-400 leading-relaxed">
          {answer}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Faq() {
  return (
    <section className="py-32 px-6 border-t border-gray-100 dark:border-[#222] relative overflow-hidden bg-gray-50/50 dark:bg-[#0a0a0a]/50">
      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold tracking-widest uppercase text-indigo-600 dark:text-indigo-400 mb-3">
            Got questions?
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-50">
            Frequently Asked Questions
          </h2>
        </motion.div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FaqItem key={i} question={faq.q} answer={faq.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
