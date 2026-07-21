"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { CheckCircle, MousePointer2 } from "lucide-react";

export function DashboardMockup() {
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
  const dropZoneOpacity = useTransform(scrollYProgress, [0.4, 0.5, 0.6], [0, 1, 0]);

  return (
    <motion.div
      ref={dashboardRef}
      initial={{ opacity: 0, y: 80 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
      className="w-full relative group mt-12"
    >
      <div className="relative rounded-2xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] p-2 shadow-xl overflow-hidden">
        <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-[#111] aspect-[16/9] border border-gray-100 dark:border-[#222] flex flex-col relative">
          {/* Mock Header */}
          <div className="h-14 border-b border-gray-200 dark:border-[#2a2a2a] flex items-center px-6 gap-4 bg-white dark:bg-[#0a0a0a]">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded-md ml-4" />
            <div className="flex-1" />
            <div className="flex -space-x-2">
              {["bg-indigo-400", "bg-purple-400", "bg-emerald-400"].map(
                (color, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full border-2 border-white dark:border-[#0a0a0a] ${color}`}
                  />
                )
              )}
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Mock Sidebar */}
            <div className="w-64 border-r border-gray-200 dark:border-[#2a2a2a] p-6 hidden md:block bg-white dark:bg-[#0a0a0a]">
              <div className="w-24 h-6 bg-gray-200 dark:bg-gray-700 rounded mb-8" />
              <div className="space-y-3">
                <div className="w-full h-10 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800/30 flex items-center px-3 gap-3">
                  <div className="w-4 h-4 rounded bg-indigo-500" />
                  <div className="h-3 w-16 bg-indigo-200 dark:bg-indigo-700 rounded" />
                </div>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-full h-10 bg-gray-50 dark:bg-[#161616] rounded-lg flex items-center px-3 gap-3 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors"
                  >
                    <div className="w-4 h-4 rounded bg-gray-300 dark:bg-gray-600" />
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Mock Board */}
            <div className="flex-1 p-8 flex gap-6 overflow-hidden bg-gray-50 dark:bg-[#111] relative">
              {/* Simulated Mouse Cursor and Card 1 (Shared Drag Group) */}
              <motion.div
                style={{ x: dragX, y: dragY }}
                className="absolute top-[76px] left-12 z-40 w-[calc((100%-7rem)/3)]"
              >
                <motion.div
                  style={{ scale: cursorScale }}
                  className="absolute -top-6 -left-6 w-8 h-8 pointer-events-none"
                >
                  <MousePointer2 className="w-8 h-8 text-gray-800 dark:text-gray-200 fill-white dark:fill-[#0a0a0a] -rotate-12 drop-shadow" />
                </motion.div>

                <motion.div
                  style={{
                    rotate: card1Rotate,
                    scale: card1Scale,
                    boxShadow: card1Shadow,
                  }}
                  className="w-full h-28 bg-white dark:bg-[#161616] rounded-xl p-4 border border-indigo-200 dark:border-indigo-800/40 cursor-grab active:cursor-grabbing"
                >
                  <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                  <div className="w-1/2 h-3 bg-gray-100 dark:bg-gray-800 rounded mb-4" />
                  <div className="flex justify-between items-center mt-auto">
                    <div className="flex -space-x-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-400 border-2 border-white dark:border-[#161616]" />
                    </div>
                    <div className="px-2 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[10px] font-semibold rounded">
                      High Priority
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Col 1 */}
              <div className="flex-1 bg-white dark:bg-[#161616] rounded-xl p-4 border border-gray-200 dark:border-[#2a2a2a] flex flex-col gap-4 relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-24 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-semibold">
                    Todo
                  </div>
                </div>
                <div className="w-full h-24 bg-gray-50 dark:bg-[#111] rounded-xl p-4 border border-gray-100 dark:border-[#222] shadow-sm mt-4">
                  <div className="w-5/6 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                  <div className="w-1/3 h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
              </div>

              {/* Col 2 */}
              <div className="flex-1 bg-white dark:bg-[#161616] rounded-xl p-4 border border-gray-200 dark:border-[#2a2a2a] flex flex-col gap-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-28 h-5 bg-amber-100 dark:bg-amber-950/30 rounded" />
                    <div className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                      In Progress
                    </div>
                  </div>
                </div>
                <motion.div
                  style={{ y: card2Y, zIndex: 20 }}
                  className="w-full h-24 bg-white dark:bg-[#161616] rounded-xl p-4 border border-gray-200 dark:border-[#2a2a2a] shadow-sm"
                >
                  <div className="w-2/3 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                  <div className="w-1/2 h-3 bg-gray-100 dark:bg-gray-800 rounded mb-4" />
                  <div className="flex justify-between items-center">
                    <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-amber-400 rounded-full" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-pink-400 border-2 border-white dark:border-[#161616]" />
                  </div>
                </motion.div>
                <motion.div
                  style={{ opacity: dropZoneOpacity }}
                  className="w-full h-28 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20"
                />
              </div>

              {/* Col 3 */}
              <div className="flex-1 bg-white dark:bg-[#161616] rounded-xl p-4 border border-gray-200 dark:border-[#2a2a2a] flex flex-col gap-4 relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-20 h-5 bg-emerald-100 dark:bg-emerald-950/30 rounded" />
                  <div className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                    Done
                  </div>
                </div>
                <div className="w-full h-28 bg-gray-50 dark:bg-[#111] rounded-xl p-4 border border-gray-100 dark:border-[#222] shadow-sm opacity-50 relative overflow-hidden">
                  <div className="absolute top-2 right-2 text-emerald-500">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                  <div className="w-1/2 h-3 bg-gray-100 dark:bg-gray-800 rounded mb-4" />
                  <div className="flex justify-between items-center mt-auto">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-[#111]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
