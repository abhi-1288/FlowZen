export default function RecruitmentLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-zinc-700" />
      <div className="mt-6 grid gap-5">
        <div className="h-32 rounded-2xl bg-slate-100 dark:bg-zinc-700" />
        <div className="h-32 rounded-2xl bg-slate-100 dark:bg-zinc-700" />
      </div>
    </div>
  );
}
