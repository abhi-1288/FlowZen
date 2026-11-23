import { useId, type MouseEvent, type ReactNode } from "react";

export function MemberActionModal({
  title,
  icon,
  children,
  panelClassName = "max-w-sm",
  zIndexClass = "z-50",
  onBackdropClick,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  panelClassName?: string;
  zIndexClass?: string;
  onBackdropClick?: () => void;
}) {
  const titleId = useId();

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onBackdropClick?.();
  }

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center neu-overlay p-4`}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className={`w-full ${panelClassName} rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
            {icon}
          </span>
          <h3
            className="text-sm font-semibold text-slate-800 dark:text-zinc-100"
            id={titleId}
          >
            {title}
          </h3>
        </div>
        {children}
      </div>
    </div>
  );
}
