export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4">
      <section className="flex flex-col items-center gap-5 text-center">
        <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg">
          <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/30" />
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-slate-950">Loading FlowZen</h1>
          <p className="mt-1 text-sm text-slate-500">Getting your workspace ready...</p>
        </div>
      </section>
    </main>
  );
}
