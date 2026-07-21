"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";

export function ChatMockup() {
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
  const readReceiptColor = useTransform(chatScrollProgress, [0.5, 0.7], ["#9ca3af", "#22c55e"]);

  return (
    <section className="py-24 px-6 border-t border-gray-100 dark:border-[#222] relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          ref={chatRef}
          initial={{ opacity: 0, y: 80 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, type: "spring" }}
          className="w-full relative group"
        >
          <div className="relative rounded-2xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] p-2 shadow-xl overflow-hidden">
            <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-[#111] aspect-[16/9] border border-gray-100 dark:border-[#222] flex flex-col relative">
              {/* Chat Header */}
              <div className="h-14 border-b border-gray-200 dark:border-[#2a2a2a] flex items-center px-6 gap-4 bg-white dark:bg-[#0a0a0a]">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>
                <div className="flex items-center gap-3 ml-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400" />
                  <div>
                    <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <div className="h-2.5 w-12 bg-gray-100 dark:bg-gray-800 rounded" />
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
              <div className="flex flex-1 overflow-hidden bg-gray-50 dark:bg-[#111]">
                {/* Conversations Sidebar */}
                <div className="w-1/3 border-r border-gray-200 dark:border-[#2a2a2a] p-4 space-y-2 bg-white dark:bg-[#0a0a0a] hidden md:block">
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
                          ? "bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/30"
                          : "hover:bg-gray-50 dark:hover:bg-[#161616] border border-transparent"
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
                              ? "w-20 bg-indigo-200 dark:bg-indigo-700"
                              : "w-16 bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                        <div className="h-2 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
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
                    className="self-start max-w-[75%] bg-white dark:bg-[#161616] rounded-2xl rounded-bl-sm p-3 border border-gray-200 dark:border-[#2a2a2a]"
                  >
                    <div className="h-3 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
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
                    className="self-start max-w-[75%] bg-white dark:bg-[#161616] rounded-2xl rounded-bl-sm p-3 border border-gray-200 dark:border-[#2a2a2a]"
                  >
                    <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
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
                    className="self-start flex items-center gap-1 bg-white dark:bg-[#161616] rounded-full px-4 py-2.5 border border-gray-200 dark:border-[#2a2a2a]"
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
                        className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
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
  );
}
