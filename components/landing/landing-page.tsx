"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUp, Layout, Users, Zap, CheckCircle, Lock, MousePointer2, Clock, DollarSign, Building2, UserPlus, ChevronDown } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { motion, useScroll, useTransform, AnimatePresence, Variants, useInView } from "framer-motion";

export function LandingPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Dashboard Scroll Animation
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: dashboardRef,
    offset: ["start end", "end center"]
  });

  // Shared Drag Animation
  const dragX = useTransform(scrollYProgress, [0.3, 0.6], [0, 270]);
  const dragY = useTransform(scrollYProgress, [0.3, 0.6], [0, 60]);
  const cursorScale = useTransform(scrollYProgress, [0.25, 0.3, 0.6, 0.65], [1, 0.8, 0.8, 1]);

  // Card 1 Animation (Picked up and moved)

  const card1Rotate = useTransform(scrollYProgress, [0.3, 0.45, 0.6], [0, 6, -2]);
  const card1Scale = useTransform(scrollYProgress, [0.28, 0.32, 0.58, 0.62], [1, 1.05, 1.05, 1]);
  const card1Shadow = useTransform(
    scrollYProgress,
    [0.28, 0.32, 0.58, 0.62],
    ["0px 4px 20px rgba(0,0,0,0.1)", "0px 20px 40px rgba(99,102,241,0.3)", "0px 20px 40px rgba(99,102,241,0.3)", "0px 4px 20px rgba(0,0,0,0.1)"]
  );

  // Card 2 Animation (Slight bump when dropped near)
  const card2Y = useTransform(scrollYProgress, [0.5, 0.6, 0.7], [0, 15, 0]);

  useEffect(() => {
    setIsLoaded(true);
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const features = [
    {
      icon: Layout,
      title: "Intuitive Boards",
      desc: "Drag-and-drop your way to productivity. Our kanban boards are fast, responsive, and beautifully animated.",
      color: "indigo"
    },
    {
      icon: Users,
      title: "Real-time Sync",
      desc: "Watch tasks move across the board instantly. Powered by SSE and WebSockets so you never need to refresh.",
      color: "purple"
    },
    {
      icon: Clock,
      title: "Attendance & Leaves",
      desc: "Check-in/check-out with location tracking, WFH modes, holiday management, and multi-step leave approvals.",
      color: "amber"
    },
    {
      icon: DollarSign,
      title: "Finance & Invoicing",
      desc: "Manage salaries, expenses, project budgets, resource requests, automated monthly payroll, and generate printable client invoices.",
      color: "emerald"
    },
    {
      icon: UserPlus,
      title: "Recruitment & Hiring",
      desc: "Full recruitment lifecycle — job postings, candidate applications, interview scheduling & feedback, offer letters with CTC breakdown, and convert-to-employee with welcome emails.",
      color: "violet"
    },
    {
      icon: Building2,
      title: "Company & HR Tools",
      desc: "Role-based onboarding, team invite codes, HR broadcasts, meeting invites, policy management, and more.",
      color: "rose"
    },
    {
      icon: Lock,
      title: "Role-based Access",
      desc: "Seven user roles with granular board-level permissions — Admin, HR, Finance, PM, QA, Employee, and more.",
      color: "cyan"
    }
  ] as const;

  const featureStyles = {
    indigo: {
      card: "hover:border-indigo-500/40",
      icon: "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.4)]",
    },
    purple: {
      card: "hover:border-purple-500/40",
      icon: "bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 group-hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)]",
    },
    emerald: {
      card: "hover:border-emerald-500/40",
      icon: "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]",
    },
    amber: {
      card: "hover:border-amber-500/40",
      icon: "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 group-hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.4)]",
    },
    rose: {
      card: "hover:border-rose-500/40",
      icon: "bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20 group-hover:shadow-[0_0_30px_-5px_rgba(244,63,94,0.4)]",
    },
    cyan: {
      card: "hover:border-cyan-500/40",
      icon: "bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)]",
    },
    violet: {
      card: "hover:border-violet-500/40",
      icon: "bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 group-hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.4)]",
    },
  } as const;

  return (
    <div className="min-h-screen bg-ink text-slate-50 overflow-x-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-200">

      {/* Dynamic Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            x: [0, 50, 0, -50, 0],
            y: [0, 30, 60, 30, 0],
            scale: [1, 1.1, 1, 0.9, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen"
        />
        <motion.div
          animate={{
            x: [0, -40, 0, 40, 0],
            y: [0, -50, 0, 50, 0],
            scale: [1, 0.9, 1.1, 1, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen"
        />
      </div>

      {/* Navigation */}
      <motion.nav
        aria-label="Primary navigation"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-500 ${scrolled ? "bg-ink/80 backdrop-blur-md border-b border-white/10 py-4 shadow-lg" : "bg-transparent py-6"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <motion.div
              whileHover={{ rotate: 90, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 overflow-hidden relative"
            >
              <Image src="/Logos/logo.jpg" alt="FlowZen Logo" fill className="object-cover" />
            </motion.div>
            <span className="font-bold text-lg sm:text-2xl tracking-tight text-white group-hover:text-indigo-200 transition-colors">FlowZen</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-6">
            <motion.a
              href="https://github.com/abhi-1288/FlowZen"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="View source on GitHub"
            >
              <FaGithub size={18} />
            </motion.a>
            <Link href="/careers" className="hidden sm:inline text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Careers
            </Link>
            <Link href="/login" className="hidden sm:inline text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Log in
            </Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/signup"
                className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-white text-ink text-xs sm:text-sm font-semibold hover:bg-slate-200 transition-colors shadow-lg shadow-white/10 whitespace-nowrap"
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
                  <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] sm:text-sm font-medium mb-6 sm:mb-8 border border-indigo-500/20 backdrop-blur-sm hover:bg-indigo-500/20 transition-colors cursor-default max-w-[90vw]">
                    <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-400 animate-pulse shrink-0" />
                    <span className="truncate">Kanban · Attendance · Finance · HR · Recruitment</span>
                  </div>
                </motion.div>

                <motion.h1 variants={itemVariants} className="text-4xl sm:text-6xl md:text-8xl font-extrabold tracking-tight mb-6 sm:mb-8 leading-[1.1] text-white">
                  Find your team's <br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 animate-gradient-x inline-block">flow state</span>
                </motion.h1>

                <motion.p variants={itemVariants} className="text-base sm:text-xl md:text-2xl text-slate-400 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-2 sm:px-0">
                  FlowZen is the all-in-one workflow platform where teams manage kanban boards, attendance, finance, HR, recruitment, approvals, and roles in one beautifully animated workspace.
                </motion.p>

                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                    <Link
                      href="/signup"
                      className="px-8 py-4 rounded-full bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-500 transition-all shadow-[0_0_40px_-10px_rgba(99,102,241,0.6)] hover:shadow-[0_0_60px_-15px_rgba(99,102,241,0.8)] flex items-center gap-3 group w-full sm:w-auto justify-center"
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
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 100 }}
            transition={{ duration: 1, delay: 0.4, type: "spring" }}
            className="mt-28 w-full relative"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 animate-pulse"></div>
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-2 shadow-2xl overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-ink aspect-[16/9] border border-white/5 flex flex-col relative">
                {/* Mock Header */}
                <div className="h-14 border-b border-white/10 flex items-center px-6 gap-4 bg-slate-900/50">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="h-6 w-48 bg-white/5 rounded-md ml-4"></div>
                  <div className="flex-1" />
                  <div className="flex -space-x-2">
                    {['bg-indigo-500', 'bg-purple-500', 'bg-emerald-500'].map((color, i) => (
                      <div key={i} className={`w-8 h-8 rounded-full border-2 border-slate-900 ${color}`} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Mock Sidebar */}
                  <div className="w-64 border-r border-white/10 p-6 hidden md:block bg-slate-900/30">
                    <div className="w-24 h-6 bg-white/10 rounded mb-8" />
                    <div className="space-y-4">
                      <div className="w-full h-10 bg-indigo-500/20 rounded-lg border border-indigo-500/30 flex items-center px-3 gap-3">
                        <div className="w-4 h-4 rounded bg-indigo-400" />
                        <div className="h-3 w-16 bg-white/20 rounded" />
                      </div>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-full h-10 bg-white/5 rounded-lg flex items-center px-3 gap-3 hover:bg-white/10 transition-colors">
                          <div className="w-4 h-4 rounded bg-slate-600" />
                          <div className="h-3 w-20 bg-white/10 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Mock Board */}
                  <div className="flex-1 p-8 flex gap-6 overflow-hidden bg-slate-900/20 relative">
                    {/* Simulated Mouse Cursor and Card 1 (Shared Drag Group) */}
                    <motion.div
                      style={{ x: dragX, y: dragY }}
                      className="absolute top-[76px] left-12 z-40 w-[calc((100%-7rem)/3)]"
                    >
                      {/* Cursor */}
                      <motion.div
                        style={{ scale: cursorScale }}
                        className="absolute -top-6 -left-6 w-8 h-8 pointer-events-none drop-shadow-xl"
                      >
                        <MousePointer2 className="w-8 h-8 text-white fill-slate-900 -rotate-12" />
                      </motion.div>

                      {/* Animated Card 1 */}
                      <motion.div
                        style={{
                          rotate: card1Rotate,
                          scale: card1Scale,
                          boxShadow: card1Shadow,
                        }}
                        className="w-full h-28 bg-slate-800 rounded-xl p-4 border border-indigo-500/40 cursor-grab active:cursor-grabbing backdrop-blur-md"
                      >
                        <div className="w-3/4 h-4 bg-white/20 rounded mb-3" />
                        <div className="w-1/2 h-3 bg-white/10 rounded mb-4" />
                        <div className="flex justify-between items-center mt-auto">
                          <div className="flex -space-x-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-500 border-2 border-slate-800" />
                          </div>
                          <div className="px-2 py-1 bg-rose-500/20 text-rose-300 text-[10px] font-bold rounded">
                            High Priority
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                    {/* End Shared Drag Group */}

                    {/* Col 1 */}
                    <div className="flex-1 bg-slate-900/50 rounded-xl p-4 border border-white/5 flex flex-col gap-4 relative">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-24 h-5 bg-white/10 rounded" />
                        <div className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold">Todo</div>
                      </div>




                      {/* Static Card below it */}
                      <div className="w-full h-24 bg-slate-800/60 rounded-xl p-4 border border-white/5 shadow-sm mt-4">
                        <div className="w-5/6 h-4 bg-white/10 rounded mb-3" />
                        <div className="w-1/3 h-3 bg-white/5 rounded" />
                      </div>
                    </div>

                    {/* Col 2 */}
                    <div className="flex-1 bg-slate-900/50 rounded-xl p-4 border border-white/5 flex flex-col gap-4 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-5 bg-yellow-500/20 rounded" />
                          <div className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500/70 text-[10px] font-bold">In Progress</div>
                        </div>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-yellow-500/50 border-t-transparent rounded-full" />
                      </div>

                      {/* Animated Card 2 */}
                      <motion.div
                        style={{ y: card2Y, zIndex: 20 }}
                        className="w-full h-24 bg-slate-800/80 rounded-xl p-4 border border-white/10 shadow-md"
                      >
                        <div className="w-2/3 h-4 bg-white/10 rounded mb-3" />
                        <div className="w-1/2 h-3 bg-white/5 rounded mb-4" />
                        <div className="flex justify-between items-center">
                          <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="w-1/2 h-full bg-yellow-500" />
                          </div>
                          <div className="w-6 h-6 rounded-full bg-pink-500 border border-slate-800"></div>
                        </div>
                      </motion.div>

                      {/* Empty Drop Zone indicator */}
                      <motion.div
                        style={{ opacity: useTransform(scrollYProgress, [0.4, 0.5, 0.6], [0, 1, 0]) }}
                        className="w-full h-28 border-2 border-dashed border-indigo-500/50 rounded-xl bg-indigo-500/5"
                      />
                    </div>

                    {/* Col 3 */}
                    <div className="flex-1 bg-slate-900/50 rounded-xl p-4 border border-white/5 flex flex-col gap-4 relative">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-20 h-5 bg-green-500/20 rounded" />
                        <div className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500/70 text-[10px] font-bold">Done</div>
                      </div>

                      <div className="w-full h-28 bg-slate-800/40 rounded-xl p-4 border border-white/5 shadow-sm opacity-50 relative overflow-hidden">
                        <div className="absolute top-2 right-2 text-green-500">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div className="w-3/4 h-4 bg-white/5 rounded mb-3 line-through" />
                        <div className="w-1/2 h-3 bg-white/5 rounded mb-4" />
                        <div className="flex justify-between items-center mt-auto">
                          <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-slate-600/50 border border-slate-800"></div>
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
        <section className="py-32 px-6 relative z-10 border-t border-white/5 bg-slate-900/20 mt-20">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="text-center mb-24"
            >
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white">Everything you need to ship faster</h2>
              <p className="text-slate-400 text-xl max-w-2xl mx-auto">
                We've obsessed over every detail to give your team the perfect environment to manage projects with zero friction.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.2 }}
                  whileHover={{ y: -10, scale: 1.02 }}
                  className={`bg-slate-900/40 backdrop-blur-sm border border-white/5 rounded-3xl p-8 hover:bg-slate-800/80 transition-all duration-300 shadow-xl group ${featureStyles[feature.color].card}`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-all duration-300 ${featureStyles[feature.color].icon}`}>
                    <feature.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-white transition-colors">{feature.title}</h3>
                  <p className="text-slate-400 leading-relaxed text-lg group-hover:text-slate-300 transition-colors">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24 px-6 border-t border-white/5 relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p className="text-sm font-semibold tracking-widest uppercase text-indigo-400 mb-3">Trusted by high-performing teams</p>
              <h2 className="text-3xl md:text-5xl font-bold text-white">FlowZen by the numbers</h2>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {([
                { value: 15000, suffix: "+", label: "Tasks Completed", prefix: "" },
                { value: 500, suffix: "+", label: "Active Teams", prefix: "" },
                { value: 99.9, suffix: "%", label: "Uptime", prefix: "" },
                { value: 24, suffix: "/7", label: "Support", prefix: "" },
              ] as const).map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="text-center group"
                >
                  <div className="inline-flex items-baseline gap-0.5">
                    <span className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-300 group-hover:from-indigo-300 group-hover:to-purple-300 transition-all duration-700">
                      {stat.prefix}
                      <Counter target={stat.value} />
                    </span>
                    <span className="text-2xl md:text-3xl font-bold text-indigo-400">{stat.suffix}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 font-medium uppercase tracking-wider">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Highlight Section */}
        <section className="py-32 px-6 border-t border-white/5 relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center gap-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex-1 space-y-8"
            >
              <h2 className="text-4xl md:text-5xl font-bold leading-tight text-white">
                The all-in-one workspace <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">for modern teams</span>.
              </h2>
              <p className="text-slate-400 text-xl leading-relaxed">
                Stop juggling multiple tools. FlowZen brings kanban boards, attendance tracking, finance, HR, and team communication into one unified, beautiful workspace. Experience the speed of true real-time collaboration.
              </p>
              <ul className="space-y-5">
                {[
                  "Real-time kanban boards with drag-and-drop task management",
                  "Attendance check-in/check-out with location & WFH modes",
                  "Finance module: salaries, expenses, budgets, invoices, and automated payroll",
                  "Full recruitment pipeline: jobs, candidates, interviews, offers, and hiring",
                  "Multi-step approval workflows for joins, leaves, and quits",
                  "Seven user roles with granular board-level permissions",
                  "HR tools: policies, broadcasts, meeting invites, recruitment, and role changes"
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + (i * 0.1) }}
                    className="flex items-center gap-4 text-slate-300 text-lg"
                  >
                    <div className="bg-indigo-500/10 rounded-full p-1 border border-indigo-500/20">
                      <CheckCircle className="w-5 h-5 text-indigo-400" />
                    </div>
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
              whileHover={{ scale: 1.02, rotate: -1 }}
              className="flex-1 relative w-full group cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/30 to-purple-500/30 blur-3xl rounded-full group-hover:blur-[100px] transition-all duration-700"></div>
              <div className="relative rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <div className="space-y-8">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/40 relative z-10" />
                      <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-50 animate-pulse" />
                    </div>
                    <div>
                      <div className="h-5 w-40 bg-white/10 rounded-md mb-3" />
                      <div className="h-4 w-24 bg-white/5 rounded-md" />
                    </div>
                  </div>
                  <div className="h-32 w-full bg-slate-800/80 rounded-xl border border-white/10 p-6 shadow-inner relative overflow-hidden group-hover:border-indigo-500/30 transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    <div className="h-4 w-3/4 bg-white/10 rounded-md mb-4" />
                    <div className="h-4 w-1/2 bg-white/5 rounded-md mb-6" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 bg-indigo-500/20 rounded-full" />
                      <div className="h-6 w-20 bg-purple-500/20 rounded-full" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex -space-x-3">
                      {['bg-indigo-400', 'bg-indigo-500', 'bg-purple-400', 'bg-purple-500'].map((colorClass, i) => (
                        <motion.div
                          key={i}
                          whileHover={{ y: -5 }}
                          className={`w-12 h-12 rounded-full border-2 border-slate-900 ${colorClass} shadow-lg relative z-${40 - i * 10}`}
                        />
                      ))}
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="px-5 py-2.5 text-sm font-bold text-indigo-200 bg-indigo-500/20 rounded-full border border-indigo-500/40 shadow-[0_0_15px_-3px_rgba(99,102,241,0.4)]"
                    >
                      In Progress
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-32 px-6 border-t border-white/5 relative overflow-hidden bg-slate-900/20">
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p className="text-sm font-semibold tracking-widest uppercase text-indigo-400 mb-3">Got questions?</p>
              <h2 className="text-4xl md:text-5xl font-bold text-white">Frequently Asked Questions</h2>
            </motion.div>
            <div className="space-y-4">
              {[
                {
                  q: "Is FlowZen free to use?",
                  a: "Yes! FlowZen offers a free tier for small teams. Upgrade to a paid plan when you need more boards, advanced finance features, or priority support."
                },
                {
                  q: "Can I use FlowZen without creating a company?",
                  a: "Absolutely. You can use kanban boards and basic features as an individual. Company features (HR, finance, recruitment) become available once you register or join a company."
                },
                {
                  q: "How does the recruitment pipeline work?",
                  a: "HR and admins can create job postings, manage candidates through pipeline stages (new → screening → interview → offered → hired), schedule interviews with feedback, and generate offer letters with full CTC breakdowns."
                },
                {
                  q: "What kind of support do you offer?",
                  a: "We provide 24/7 email support for all users, with priority live chat for paid plans. Our documentation covers everything from setup to advanced features."
                },
                {
                  q: "Is my data secure?",
                  a: "Yes. All data is encrypted in transit (TLS) and at rest. We use MongoDB Atlas for database hosting with automated backups, and NextAuth for secure authentication with JWT-based sessions."
                },
              ].map((faq, i) => (
                <FaqItem key={i} question={faq.q} answer={faq.a} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-40 px-6 text-center border-t border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-indigo-900/40 pointer-events-none"></div>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto relative z-10"
          >
            <h2 className="text-5xl md:text-7xl font-extrabold mb-8 text-white tracking-tight">Ready to find your flow?</h2>
            <p className="text-2xl text-slate-300 mb-12 max-w-2xl mx-auto">
              Join the high-performing teams that are already managing boards, attendance, finance, HR, and recruitment with FlowZen.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/signup"
                className="inline-flex px-12 py-6 rounded-full bg-white text-ink font-bold text-xl hover:bg-indigo-50 transition-all shadow-[0_0_50px_-10px_rgba(255,255,255,0.4)] hover:shadow-[0_0_80px_-15px_rgba(255,255,255,0.6)]"
              >
                Start your free trial today
              </Link>
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-slate-950/80 text-center text-slate-500 relative z-10 backdrop-blur-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg shadow-lg shadow-indigo-500/20 overflow-hidden relative">
            <Image src="/Logos/logo.jpg" alt="FlowZen Logo" fill className="object-cover" />
          </div>
          <span className="font-semibold text-slate-300 text-lg tracking-tight">FlowZen</span>
        </div>
        <p className="text-sm font-medium">© {new Date().getFullYear()} FlowZen. All rights reserved.</p>
        <p className="text-xs mt-3 flex items-center justify-center gap-4">
          Build By:-
          <a
            href="https://github.com/abhi-1288"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            GitHub
          </a>
          <span className="text-slate-600">·</span>
          <a
            href="https://portfolio-abhijeet.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            Portfolio
          </a>
          <span className="text-slate-600">·</span>
          <Link href="/careers" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
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
            className="fixed bottom-8 right-8 z-50 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors flex items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Back to top"
          >
            <ArrowUp size={20} />
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

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

function FaqItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`rounded-2xl border transition-all duration-300 cursor-pointer ${open ? "border-indigo-500/40 bg-indigo-500/5" : "border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-800/60"}`}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between px-6 py-5">
        <h3 className={`text-lg font-semibold transition-colors ${open ? "text-white" : "text-slate-300"}`}>{question}</h3>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`shrink-0 ml-4 ${open ? "text-indigo-400" : "text-slate-500"}`}
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
        <div className="px-6 pb-5 text-slate-400 leading-relaxed">{answer}</div>
      </motion.div>
    </motion.div>
  );
}

export default LandingPage;
