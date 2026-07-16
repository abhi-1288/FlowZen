"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUp,
  Layout,
  Users,
  Zap,
  CheckCircle,
  Lock,
  MousePointer2,
  Clock,
  DollarSign,
  Building2,
  UserPlus,
  MessageCircle,
  ChevronDown,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  Variants,
  useInView,
} from "framer-motion";

export function LandingPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dashboardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: dashboardRef,
    offset: ["start end", "end center"],
  });

  const dragX = useTransform(scrollYProgress, [0.3, 0.6], [0, 270]);
  const dragY = useTransform(scrollYProgress, [0.3, 0.6], [0, 60]);
  const cursorScale = useTransform(
    scrollYProgress,
    [0.25, 0.3, 0.6, 0.65],
    [1, 0.8, 0.8, 1]
  );

  const card1Rotate = useTransform(scrollYProgress, [0.3, 0.45, 0.6], [0, 6, -2]);
  const card1Scale = useTransform(
    scrollYProgress,
    [0.28, 0.32, 0.58, 0.62],
    [1, 1.05, 1.05, 1]
  );
  const card1Shadow = useTransform(
    scrollYProgress,
    [0.28, 0.32, 0.58, 0.62],
    [
      "0px 4px 20px rgba(0,0,0,0.06)",
      "0px 20px 40px rgba(99,102,241,0.15)",
      "0px 20px 40px rgba(99,102,241,0.15)",
      "0px 4px 20px rgba(0,0,0,0.06)",
    ]
  );

  const card2Y = useTransform(scrollYProgress, [0.5, 0.6, 0.7], [0, 15, 0]);

  const chatRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: chatScrollProgress } = useScroll({
    target: chatRef,
    offset: ["start end", "end center"],
  });

  const chatMsg1X = useTransform(chatScrollProgress, [0.1, 0.3], [60, 0]);
  const chatMsg1Opacity = useTransform(chatScrollProgress, [0.1, 0.2], [0, 1]);
  const chatMsg2X = useTransform(chatScrollProgress, [0.25, 0.45], [-60, 0]);
  const chatMsg2Opacity = useTransform(chatScrollProgress, [0.25, 0.35], [0, 1]);
  const chatMsg3X = useTransform(chatScrollProgress, [0.4, 0.6], [60, 0]);
  const chatMsg3Opacity = useTransform(chatScrollProgress, [0.4, 0.5], [0, 1]);
  const chatMsg4X = useTransform(chatScrollProgress, [0.55, 0.75], [-60, 0]);
  const chatMsg4Opacity = useTransform(chatScrollProgress, [0.55, 0.65], [0, 1]);
  const chatMsg5X = useTransform(chatScrollProgress, [0.7, 0.9], [60, 0]);
  const chatMsg5Opacity = useTransform(chatScrollProgress, [0.7, 0.8], [0, 1]);
  const chatTypingY = useTransform(chatScrollProgress, [0.8, 0.95], [20, 0]);
  const chatTypingOpacity = useTransform(chatScrollProgress, [0.8, 0.85], [0, 1]);

  useEffect(() => {
    setIsLoaded(true);
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      desc: "Seven user roles with granular board-level permissions: Admin, HR, Finance, PM, QA, Employee, and more.",
      color: "cyan",
    },
    {
      icon: MessageCircle,
      title: "Chat & Messaging",
      desc: "Real-time messaging with read/delivery receipts, online presence indicators, member sidebar, and info modals.",
      color: "teal",
    },
  ] as const;

  const featureStyles = {
    indigo: { icon: "bg-indigo-50 text-indigo-600", border: "hover:border-indigo-300" },
    purple: { icon: "bg-purple-50 text-purple-600", border: "hover:border-purple-300" },
    emerald: { icon: "bg-emerald-50 text-emerald-600", border: "hover:border-emerald-300" },
    amber: { icon: "bg-amber-50 text-amber-600", border: "hover:border-amber-300" },
    rose: { icon: "bg-rose-50 text-rose-600", border: "hover:border-rose-300" },
    cyan: { icon: "bg-cyan-50 text-cyan-600", border: "hover:border-cyan-300" },
    violet: { icon: "bg-violet-50 text-violet-600", border: "hover:border-violet-300" },
    teal: { icon: "bg-teal-50 text-teal-600", border: "hover:border-teal-300" },
  } as const;

  const dropZoneOpacity = useTransform(scrollYProgress, [0.4, 0.5, 0.6], [0, 1, 0]);
  const readReceiptColor = useTransform(chatScrollProgress, [0.5, 0.7], ["#9ca3af", "#22c55e"]);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">

      {/* Navigation */}
      <motion.nav
        aria-label="Primary navigation"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 border-b border-gray-200 py-3 shadow-sm"
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
            <span className="font-bold text-lg sm:text-xl tracking-tight text-gray-900 group-hover:text-indigo-600 transition-colors">
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
              className="text-gray-400 hover:text-gray-900 transition-colors"
              aria-label="View source on GitHub"
            >
              <FaGithub size={18} />
            </motion.a>
            <Link
              href="/careers"
              className="hidden sm:inline text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Careers
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/signup"
                className="px-4 sm:px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                Sign up
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      <main className="relative z-10 pt-20 sm:pt-32">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto flex flex-col items-center text-center min-h-[70vh] sm:min-h-[85vh] justify-center">
          <AnimatePresence>
            {isLoaded && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="max-w-4xl w-full flex flex-col items-center"
              >
                <motion.div variants={itemVariants}>
                  <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-indigo-50 text-indigo-700 text-[10px] sm:text-sm font-medium mb-6 sm:mb-8 border border-indigo-100 hover:bg-indigo-100 transition-colors cursor-default max-w-[90vw]">
                    <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500 shrink-0" />
                    <span className="truncate">
                      Kanban &middot; Attendance &middot; Finance &middot; HR
                      &middot; Recruitment &middot; Chat
                    </span>
                  </div>
                </motion.div>

                <motion.h1
                  variants={itemVariants}
                  className="text-4xl sm:text-6xl md:text-8xl font-extrabold tracking-tight mb-6 sm:mb-8 leading-[1.1] text-gray-900"
                >
                  Find your team's <br className="hidden md:block" />
                  flow state
                </motion.h1>

                <motion.p
                  variants={itemVariants}
                  className="text-base sm:text-xl md:text-2xl text-gray-500 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-2 sm:px-0"
                >
                  FlowZen is the all-in-one workflow platform where teams
                  manage kanban boards, attendance, finance, HR, recruitment,
                  chat, approvals, and roles in one workspace.
                </motion.p>

                <motion.div
                  variants={itemVariants}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
                >
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full mb-10 sm:w-auto"
                  >
                    <Link
                      href="/signup"
                      className="px-8 py-4 rounded-lg bg-indigo-600 text-white font-semibold text-lg hover:bg-indigo-700 transition-colors flex items-center gap-3 group w-full sm:w-auto justify-center"
                    >
                      Get Started for Free
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactive Dashboard Mockup */}
          <motion.div
            ref={dashboardRef}
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 80 }}
            transition={{ duration: 0.8, delay: 0.4, type: "spring" }}
            className="w-full relative group mt-12"
          >
            <div className="relative rounded-2xl border border-gray-200 bg-white p-2 shadow-xl overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-gray-50 aspect-[16/9] border border-gray-100 flex flex-col relative">
                {/* Mock Header */}
                <div className="h-14 border-b border-gray-200 flex items-center px-6 gap-4 bg-white">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                  </div>
                  <div className="h-6 w-48 bg-gray-200 rounded-md ml-4"></div>
                  <div className="flex-1" />
                  <div className="flex -space-x-2">
                    {["bg-indigo-400", "bg-purple-400", "bg-emerald-400"].map(
                      (color, i) => (
                        <div
                          key={i}
                          className={`w-8 h-8 rounded-full border-2 border-white ${color}`}
                        />
                      )
                    )}
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Mock Sidebar */}
                  <div className="w-64 border-r border-gray-200 p-6 hidden md:block bg-white">
                    <div className="w-24 h-6 bg-gray-200 rounded mb-8"></div>
                    <div className="space-y-3">
                      <div className="w-full h-10 bg-indigo-50 rounded-lg border border-indigo-200 flex items-center px-3 gap-3">
                        <div className="w-4 h-4 rounded bg-indigo-500" />
                        <div className="h-3 w-16 bg-indigo-200 rounded" />
                      </div>
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-full h-10 bg-gray-50 rounded-lg flex items-center px-3 gap-3 hover:bg-gray-100 transition-colors"
                        >
                          <div className="w-4 h-4 rounded bg-gray-300" />
                          <div className="h-3 w-20 bg-gray-200 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mock Board */}
                  <div className="flex-1 p-8 flex gap-6 overflow-hidden bg-gray-50 relative">
                    {/* Simulated Mouse Cursor and Card 1 (Shared Drag Group) */}
                    <motion.div
                      style={{ x: dragX, y: dragY }}
                      className="absolute top-[76px] left-12 z-40 w-[calc((100%-7rem)/3)]"
                    >
                      <motion.div
                        style={{ scale: cursorScale }}
                        className="absolute -top-6 -left-6 w-8 h-8 pointer-events-none"
                      >
                        <MousePointer2 className="w-8 h-8 text-gray-800 fill-white -rotate-12 drop-shadow" />
                      </motion.div>

                      <motion.div
                        style={{
                          rotate: card1Rotate,
                          scale: card1Scale,
                          boxShadow: card1Shadow,
                        }}
                        className="w-full h-28 bg-white rounded-xl p-4 border border-indigo-200 cursor-grab active:cursor-grabbing"
                      >
                        <div className="w-3/4 h-4 bg-gray-200 rounded mb-3" />
                        <div className="w-1/2 h-3 bg-gray-100 rounded mb-4" />
                        <div className="flex justify-between items-center mt-auto">
                          <div className="flex -space-x-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-400 border-2 border-white" />
                          </div>
                          <div className="px-2 py-1 bg-rose-50 text-rose-600 text-[10px] font-semibold rounded">
                            High Priority
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>

                    {/* Col 1 */}
                    <div className="flex-1 bg-white rounded-xl p-4 border border-gray-200 flex flex-col gap-4 relative">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-24 h-5 bg-gray-200 rounded" />
                        <div className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold">
                          Todo
                        </div>
                      </div>

                      <div className="w-full h-24 bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-sm mt-4">
                        <div className="w-5/6 h-4 bg-gray-200 rounded mb-3" />
                        <div className="w-1/3 h-3 bg-gray-100 rounded" />
                      </div>
                    </div>

                    {/* Col 2 */}
                    <div className="flex-1 bg-white rounded-xl p-4 border border-gray-200 flex flex-col gap-4 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-5 bg-amber-100 rounded" />
                          <div className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-semibold">
                            In Progress
                          </div>
                        </div>
                      </div>

                      <motion.div
                        style={{ y: card2Y, zIndex: 20 }}
                        className="w-full h-24 bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
                      >
                        <div className="w-2/3 h-4 bg-gray-200 rounded mb-3" />
                        <div className="w-1/2 h-3 bg-gray-100 rounded mb-4" />
                        <div className="flex justify-between items-center">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="w-1/2 h-full bg-amber-400 rounded-full" />
                          </div>
                          <div className="w-6 h-6 rounded-full bg-pink-400 border-2 border-white"></div>
                        </div>
                      </motion.div>

                      <motion.div
                        style={{ opacity: dropZoneOpacity }}
                        className="w-full h-28 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/50"
                      />
                    </div>

                    {/* Col 3 */}
                    <div className="flex-1 bg-white rounded-xl p-4 border border-gray-200 flex flex-col gap-4 relative">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-20 h-5 bg-emerald-100 rounded" />
                        <div className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold">
                          Done
                        </div>
                      </div>

                      <div className="w-full h-28 bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-sm opacity-50 relative overflow-hidden">
                        <div className="absolute top-2 right-2 text-emerald-500">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div className="w-3/4 h-4 bg-gray-200 rounded mb-3" />
                        <div className="w-1/2 h-3 bg-gray-100 rounded mb-4" />
                        <div className="flex justify-between items-center mt-auto">
                          <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="py-28 px-6 relative z-10 border-t border-gray-100 bg-gray-50/50 mt-20">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="text-center mb-20"
            >
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900">
                Everything you need to ship faster
              </h2>
              <p className="text-gray-500 text-xl max-w-2xl mx-auto">
                We've obsessed over every detail to give your team the perfect
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
                  className={`bg-white border border-gray-200 rounded-2xl p-8 transition-all duration-200 group ${featureStyles[feature.color].border}`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200 ${featureStyles[feature.color].icon}`}
                  >
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed">
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Chat Messaging Mockup */}
        <section className="py-24 px-6 border-t border-gray-100 relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <motion.div
              ref={chatRef}
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, type: "spring" }}
              className="w-full relative group"
            >
              <div className="relative rounded-2xl border border-gray-200 bg-white p-2 shadow-xl overflow-hidden">
                <div className="rounded-xl overflow-hidden bg-gray-50 aspect-[16/9] border border-gray-100 flex flex-col relative">
                  {/* Chat Header */}
                  <div className="h-14 border-b border-gray-200 flex items-center px-6 gap-4 bg-white">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400" />
                      <div>
                        <div className="h-4 w-28 bg-gray-200 rounded mb-1" />
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <div className="h-2.5 w-12 bg-gray-100 rounded" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1" />
                    <motion.span
                      style={{ color: readReceiptColor }}
                      className="text-xs font-bold"
                    >
                      ✓✓
                    </motion.span>
                  </div>

                  {/* Chat Body */}
                  <div className="flex flex-1 overflow-hidden bg-gray-50">
                    {/* Conversations Sidebar */}
                    <div className="w-1/3 border-r border-gray-200 p-4 space-y-2 bg-white hidden md:block">
                      {[
                        { active: true, name: "Project Alpha" },
                        { active: false, name: "Design Team" },
                        { active: false, name: "Weekly Sync" },
                        { active: false, name: "General" },
                      ].map((conv, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-default ${
                            conv.active
                              ? "bg-indigo-50 border border-indigo-100"
                              : "hover:bg-gray-50 border border-transparent"
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-full shrink-0 ${
                              i === 0
                                ? "bg-gradient-to-br from-teal-400 to-cyan-400"
                                : i === 1
                                ? "bg-gradient-to-br from-indigo-400 to-purple-400"
                                : i === 2
                                ? "bg-gradient-to-br from-amber-400 to-orange-400"
                                : "bg-gradient-to-br from-rose-400 to-pink-400"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className={`h-3 rounded mb-1.5 ${
                                conv.active
                                  ? "w-20 bg-indigo-200"
                                  : "w-16 bg-gray-200"
                              }`}
                            />
                            <div className="h-2 w-24 bg-gray-100 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 flex flex-col gap-2.5 p-4 justify-end">
                      <motion.div
                        style={{ x: chatMsg1X, opacity: chatMsg1Opacity }}
                        className="self-end max-w-[75%] bg-indigo-600 rounded-2xl rounded-br-sm p-3"
                      >
                        <div className="h-3 w-32 bg-indigo-400/40 rounded mb-1.5" />
                        <div className="h-3 w-20 bg-indigo-400/40 rounded" />
                      </motion.div>

                      <motion.div
                        style={{ x: chatMsg2X, opacity: chatMsg2Opacity }}
                        className="self-start max-w-[75%] bg-white rounded-2xl rounded-bl-sm p-3 border border-gray-200"
                      >
                        <div className="h-3 w-36 bg-gray-200 rounded mb-1.5" />
                        <div className="h-3 w-24 bg-gray-200 rounded" />
                      </motion.div>

                      <motion.div
                        style={{ x: chatMsg3X, opacity: chatMsg3Opacity }}
                        className="self-end max-w-[75%] bg-indigo-600 rounded-2xl rounded-br-sm p-3"
                      >
                        <div className="h-3 w-28 bg-indigo-400/40 rounded mb-1.5" />
                        <div className="h-3 w-14 bg-indigo-400/40 rounded" />
                        <div className="flex justify-end mt-1.5">
                          <motion.span
                            style={{ color: readReceiptColor }}
                            className="text-[9px] font-bold"
                          >
                            ✓✓
                          </motion.span>
                        </div>
                      </motion.div>

                      <motion.div
                        style={{ x: chatMsg4X, opacity: chatMsg4Opacity }}
                        className="self-start max-w-[75%] bg-white rounded-2xl rounded-bl-sm p-3 border border-gray-200"
                      >
                        <div className="h-3 w-40 bg-gray-200 rounded mb-1.5" />
                        <div className="h-3 w-20 bg-gray-200 rounded" />
                      </motion.div>

                      <motion.div
                        style={{ x: chatMsg5X, opacity: chatMsg5Opacity }}
                        className="self-end max-w-[75%] bg-indigo-600 rounded-2xl rounded-br-sm p-3"
                      >
                        <div className="h-3 w-24 bg-indigo-400/40 rounded mb-1.5" />
                        <div className="h-3 w-28 bg-indigo-400/40 rounded" />
                        <div className="flex justify-end mt-1.5">
                          <span className="text-[9px] text-indigo-300 font-bold">
                            ✓
                          </span>
                        </div>
                      </motion.div>

                      <motion.div
                        style={{ y: chatTypingY, opacity: chatTypingOpacity }}
                        className="self-start flex items-center gap-1 bg-white rounded-full px-4 py-2.5 border border-gray-200"
                      >
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -5, 0] }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              delay: i * 0.18,
                              ease: "easeInOut",
                            }}
                            className="w-2 h-2 rounded-full bg-gray-400"
                          />
                        ))}
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24 px-6 border-t border-gray-100 relative overflow-hidden bg-gray-50/50">
          <div className="max-w-7xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p className="text-sm font-semibold tracking-widest uppercase text-indigo-600 mb-3">
                Trusted by high-performing teams
              </p>
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900">
                FlowZen by the numbers
              </h2>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {(
                [
                  { value: 15000, suffix: "+", label: "Tasks Completed", prefix: "" },
                  { value: 500, suffix: "+", label: "Active Teams", prefix: "" },
                  { value: 99.9, suffix: "%", label: "Uptime", prefix: "" },
                  { value: 24, suffix: "/7", label: "Support", prefix: "" },
                ] as const
              ).map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="text-center group"
                >
                  <div className="inline-flex items-baseline gap-0.5">
                    <span className="text-4xl md:text-5xl font-extrabold text-gray-900 group-hover:text-indigo-600 transition-colors duration-300">
                      {stat.prefix}
                      <Counter target={stat.value} />
                    </span>
                    <span className="text-2xl md:text-3xl font-bold text-indigo-600">
                      {stat.suffix}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400 font-medium uppercase tracking-wider">
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Highlight Section */}
        <section className="py-32 px-6 border-t border-gray-100 relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center gap-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex-1 space-y-8"
            >
              <h2 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900">
                The all-in-one workspace <br />
                <span className="text-indigo-600">for modern teams</span>.
              </h2>
              <p className="text-gray-500 text-xl leading-relaxed">
                Stop juggling multiple tools. FlowZen brings kanban boards,
                attendance tracking, finance, HR, and team communication into
                one unified workspace. Experience the speed of true real-time
                collaboration.
              </p>
              <ul className="space-y-4">
                {[
                  "Real-time kanban boards with drag-and-drop task management",
                  "Attendance check-in/check-out with location & WFH modes",
                  "Finance module: salaries, expenses, budgets, invoices, and automated payroll",
                  "Full recruitment pipeline: jobs, candidates, interviews, offers, and hiring",
                  "Multi-step approval workflows for joins, leaves, and quits",
                  "Seven user roles with granular board-level permissions",
                  "HR tools: policies, broadcasts, meeting invites, and role changes",
                  "Real-time chat with read receipts, online presence, and delivery tracking",
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-3 text-gray-600 text-lg"
                  >
                    <CheckCircle className="w-5 h-5 text-indigo-500 shrink-0" />
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
              <div className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
                <div className="space-y-8">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 relative z-10" />
                    <div>
                      <div className="h-5 w-40 bg-gray-200 rounded-md mb-3" />
                      <div className="h-4 w-24 bg-gray-100 rounded-md" />
                    </div>
                  </div>
                  <div className="h-32 w-full bg-gray-50 rounded-xl border border-gray-200 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    <div className="h-4 w-3/4 bg-gray-200 rounded-md mb-4" />
                    <div className="h-4 w-1/2 bg-gray-100 rounded-md mb-6" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 bg-indigo-100 text-indigo-600 rounded-full text-xs flex items-center justify-center font-medium">
                        Design
                      </div>
                      <div className="h-6 w-20 bg-purple-100 text-purple-600 rounded-full text-xs flex items-center justify-center font-medium">
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
                          className={`w-10 h-10 rounded-full border-2 border-white ${colorClass} relative z-${
                            40 - i * 10
                          }`}
                        />
                      ))}
                    </div>
                    <div className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-full border border-indigo-200">
                      In Progress
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-32 px-6 border-t border-gray-100 relative overflow-hidden bg-gray-50/50">
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p className="text-sm font-semibold tracking-widest uppercase text-indigo-600 mb-3">
                Got questions?
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
                Frequently Asked Questions
              </h2>
            </motion.div>
            <div className="space-y-3">
              {[
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
              ].map((faq, i) => (
                <FaqItem key={i} question={faq.q} answer={faq.a} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-6 text-center border-t border-gray-100 relative overflow-hidden">
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-5xl md:text-7xl font-extrabold mb-8 text-gray-900 tracking-tight">
                Ready to find your flow?
              </h2>
              <p className="text-2xl text-gray-500 mb-12 max-w-2xl mx-auto">
                Join the high-performing teams that are already managing
                boards, attendance, finance, HR, and recruitment with FlowZen.
              </p>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/signup"
                  className="inline-flex px-10 py-5 rounded-lg bg-indigo-600 text-white font-bold text-xl hover:bg-indigo-700 transition-colors"
                >
                  Start your free trial today
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200 bg-white text-center text-gray-500 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg overflow-hidden relative">
            <Image
              src="/Logos/logo.jpg"
              alt="FlowZen Logo"
              fill
              className="object-cover"
            />
          </div>
          <span className="font-semibold text-gray-900 text-lg tracking-tight">
            FlowZen
          </span>
        </div>
        <p className="text-sm font-medium text-gray-400">
          &copy; {new Date().getFullYear()} FlowZen. All rights reserved.
        </p>
        <p className="text-xs mt-3 flex items-center justify-center gap-4 text-gray-400">
          Built by
          <a
            href="https://github.com/abhi-1288"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 transition-colors font-medium"
          >
            GitHub
          </a>
          <span className="text-gray-300">&middot;</span>
          <a
            href="https://portfolio-abhijeet.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 transition-colors font-medium"
          >
            Portfolio
          </a>
          <span className="text-gray-300">&middot;</span>
          <Link
            href="/careers"
            className="text-indigo-600 hover:text-indigo-700 transition-colors font-medium"
          >
            Careers
          </Link>
        </p>
      </footer>

      {/* Back to Top */}
      <AnimatePresence>
        {scrolled && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-8 right-8 z-50 w-11 h-11 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Back to top"
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

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
    <span ref={ref}>{count.toLocaleString()}</span>
  );
}

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
          ? "border-indigo-200 bg-white shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between px-6 py-5">
        <h3
          className={`text-lg font-semibold transition-colors ${
            open ? "text-gray-900" : "text-gray-700"
          }`}
        >
          {question}
        </h3>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`shrink-0 ml-4 ${
            open ? "text-indigo-500" : "text-gray-400"
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
        <div className="px-6 pb-5 text-gray-500 leading-relaxed">
          {answer}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default LandingPage;
