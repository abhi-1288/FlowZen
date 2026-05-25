export function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="h-7 w-48 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 rounded bg-slate-200" />
      </div>

      {/* Cards */}
      <div className="grid gap-5 xl:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="rounded-xl bg-white p-6 shadow-sm">
            <div className="h-6 w-40 rounded bg-slate-200" />

            <div className="mt-6 space-y-4">
              {[1, 2, 3, 4].map((line) => (
                <div key={line} className="h-4 rounded bg-slate-200" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
