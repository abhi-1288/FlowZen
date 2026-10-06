"use client";

import { useEffect, type ReactNode } from "react";
import {
  X,
  Plus,
  Trash2,
  ChevronRight,
  Phone,
  Mail,
  Star,
  Minus,
  type LucideIcon,
} from "lucide-react";

// ── Modal shell ─────────────────────────────────────────────────────────────

/**
 * Wide, scroll-aware dialog shell: fixed header and footer, scrolling body.
 * The header stays put so the title and the close affordance are never scrolled
 * out of reach while the body runs long.
 */
export function ModalShell({
  onClose,
  title,
  description,
  icon: Icon,
  iconTone = "indigo",
  headerExtra,
  footer,
  children,
}: {
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconTone?: "indigo" | "emerald" | "amber";
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const toneBg = {
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-300",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-300",
  }[iconTone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full max-w-5xl animate-in fade-in-0 zoom-in-95 flex-col overflow-hidden rounded-2xl bg-[var(--c-bg-card)] shadow-modal duration-200 dark:border dark:border-zinc-800 dark:bg-[#000000]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start gap-4 border-b border-[var(--c-border-light)] px-6 py-5 dark:border-zinc-800">
          {Icon ? (
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneBg}`}
            >
              <Icon size={20} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="text-title text-ink">{title}</h3>
            {description ? (
              <p className="mt-1 text-body text-muted">{description}</p>
            ) : null}
          </div>
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-[var(--c-bg-muted)] hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {/* Footer */}
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--c-border-light)] bg-[var(--c-bg-card)] px-6 py-4 dark:border-zinc-800">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

export type TabDef<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
};

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="-mx-6 mb-6 flex gap-1.5 border-b border-[var(--c-border-light)] px-6 pb-3 pt-1 dark:border-zinc-800">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              isActive
                ? "neu-tab-pressed border-indigo-500 text-indigo-700 dark:text-indigo-300"
                : "border-transparent text-slate-500 hover:bg-[var(--c-bg-muted)] hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {Icon ? <Icon size={15} className="shrink-0" /> : null}
            {tab.label}
            {tab.count ? (
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
                  isActive
                    ? "bg-indigo-500 text-white"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function Panel({
  icon: Icon,
  title,
  description,
  action,
  tone = "default",
  className = "",
  children,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "warning" | "success" | "subtle";
  className?: string;
  children?: ReactNode;
}) {
  const tones = {
    default:
      "border-[var(--c-border-light)] bg-[var(--c-bg-card)] dark:border-zinc-800",
    subtle:
      "border-[var(--c-border-light)] bg-[var(--c-bg)] dark:border-zinc-800 dark:bg-zinc-950/40",
    warning:
      "border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/25",
    success:
      "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/25",
  }[tone];

  const iconTone = {
    default: "text-slate-400 dark:text-zinc-500",
    subtle: "text-slate-400 dark:text-zinc-500",
    warning: "text-amber-600 dark:text-amber-300",
    success: "text-emerald-600 dark:text-emerald-300",
  }[tone];

  return (
    <section
      className={`rounded-2xl border p-5 ${tones} ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className={`mt-0.5 shrink-0 ${iconTone}`}>
                <Icon size={17} />
              </span>
            ) : null}
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-ink">{title}</h4>
              {description ? (
                <p className="mt-0.5 text-caption text-muted">{description}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}

// ── Form controls ───────────────────────────────────────────────────────────

const controlBase =
  "neu-inset w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 dark:bg-[#000000] dark:text-zinc-100 dark:placeholder:text-zinc-600";

export function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-center gap-1 text-caption font-semibold uppercase tracking-wide text-muted"
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="text-rose-500">
          *
        </span>
      ) : null}
    </label>
  );
}

export function TextField({
  id,
  label,
  required,
  hint,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  className = "",
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  icon?: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative">
        {Icon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
            <Icon size={15} />
          </span>
        ) : null}
        <input
          id={id}
          type={type}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          aria-required={required || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${controlBase} ${Icon ? "pl-10" : ""} disabled:cursor-not-allowed disabled:opacity-60`}
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  required,
  hint,
  value,
  onChange,
  children,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative">
        <select
          id={id}
          value={value}
          aria-required={required || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${controlBase} cursor-pointer appearance-none pr-9`}
        >
          {children}
        </select>
        <ChevronRight
          size={15}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 dark:text-zinc-500"
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  min = 1,
  disabled,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  disabled?: boolean;
}) {
  const step = (delta: number) => {
    const current = Number(value);
    const base = Number.isFinite(current) && value !== "" ? current : min;
    onChange(String(Math.max(min, base + delta)));
  };

  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => step(-1)}
          aria-label={`Decrease ${typeof label === "string" ? label : "value"}`}
          className="neu-btn grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 disabled:opacity-40 dark:text-zinc-400"
        >
          <Minus size={15} />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`${controlBase} text-center disabled:cursor-not-allowed disabled:opacity-60`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => step(1)}
          aria-label={`Increase ${typeof label === "string" ? label : "value"}`}
          className="neu-btn grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 disabled:opacity-40 dark:text-zinc-400"
        >
          <Plus size={15} />
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-zinc-200"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
      />
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-caption text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

// ── Contact repeater ────────────────────────────────────────────────────────

export type ContactDraft = {
  name: string;
  phone: string;
  email: string;
  isPrimary: boolean;
};

const MAX_CONTACTS = 5;

export function ContactEditor({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: ContactDraft[];
  onChange: (next: ContactDraft[]) => void;
}) {
  const addContact = () =>
    onChange([
      ...value,
      { name: "", phone: "", email: "", isPrimary: value.length === 0 },
    ]);

  const patch = (index: number, part: keyof ContactDraft, next: string | boolean) => {
    const copy = [...value];
    copy[index] = { ...copy[index], [part]: next } as ContactDraft;
    onChange(copy);
  };

  const togglePrimary = (index: number, checked: boolean) =>
    onChange(
      value.map((c, i) => ({ ...c, isPrimary: i === index ? checked : false })),
    );

  const remove = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-caption font-semibold uppercase tracking-wide text-muted">
            Office Contacts
          </span>
          <span className="rounded-full bg-[var(--c-bg-muted)] px-2 py-0.5 text-[11px] font-semibold text-muted">
            {value.length} of {MAX_CONTACTS}
          </span>
        </div>
        <button
          type="button"
          disabled={value.length >= MAX_CONTACTS}
          onClick={addContact}
          className="neu-btn inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300"
        >
          <Plus size={13} /> Add Contact
        </button>
      </div>

      <div className="space-y-3">
        {value.map((contact, index) => (
          <div
            key={`${idPrefix}-contact-${index}`}
            className="rounded-xl border border-[var(--c-border-light)] bg-[var(--c-bg)] p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-ink">
                  Contact {index + 1}
                </span>
                {contact.isPrimary ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <Star size={10} className="fill-current" /> Primary
                  </span>
                ) : null}
              </div>
              {value.length > 1 ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove contact ${index + 1}`}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 size={13} /> Remove
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={`${idPrefix}-contact-${index}-name`}
                label="Contact Name"
                required
                className="sm:col-span-2"
                value={contact.name}
                onChange={(v) => patch(index, "name", v)}
                placeholder="Contact person name"
              />
              <TextField
                id={`${idPrefix}-contact-${index}-phone`}
                label="Phone"
                icon={Phone}
                value={contact.phone}
                onChange={(v) => patch(index, "phone", v)}
                placeholder="+91 98765 43210"
              />
              <TextField
                id={`${idPrefix}-contact-${index}-email`}
                label="Email"
                icon={Mail}
                type="email"
                value={contact.email}
                onChange={(v) => patch(index, "email", v)}
                placeholder="contact@company.com"
              />
            </div>

            <div className="mt-3 border-t border-[var(--c-border-light)] pt-3 dark:border-zinc-800">
              <Checkbox
                id={`${idPrefix}-contact-${index}-primary`}
                checked={contact.isPrimary}
                onChange={(checked) => togglePrimary(index, checked)}
                label="Primary contact"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-caption text-muted">
        Minimum 1, maximum {MAX_CONTACTS} contacts. The primary contact is shown on
        ID cards.
      </p>
    </div>
  );
}

// ── Small display pieces ────────────────────────────────────────────────────

export function StatPill({
  icon: Icon,
  label,
  value,
  counter,
  tone = "slate",
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  counter?: ReactNode;
  tone?: "slate" | "emerald" | "indigo";
}) {
  const tones = {
    slate:
      "border-[var(--c-border-light)] bg-[var(--c-bg)] dark:border-zinc-800 dark:bg-zinc-950/40",
    emerald:
      "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/25",
    indigo:
      "border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-indigo-950/25",
  }[tone];

  const iconTones = {
    slate: "text-indigo-500",
    emerald: "text-emerald-500",
    indigo: "text-indigo-500",
  }[tone];

  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 ${tones}`}
    >
      {Icon ? (
        <span className={`shrink-0 ${iconTones}`}>
          <Icon size={15} />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
          {label}
        </span>
        <span className="block truncate text-sm font-medium text-ink">
          {value}
          {counter ? (
            <span className="ml-1 text-xs font-normal text-muted">{counter}</span>
          ) : null}
        </span>
      </span>
    </div>
  );
}

export function StatusBadge({
  tone,
  icon: Icon,
  children,
}: {
  tone: "success" | "warning" | "neutral";
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const tones = {
    success:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    neutral: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
  }[tone];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones}`}
    >
      {Icon ? <Icon size={11} /> : null}
      {children}
    </span>
  );
}

export function EmptyBlock({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--c-border-light)] px-6 py-12 text-center dark:border-zinc-800">
      {Icon ? (
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--c-bg-muted)] text-slate-400 dark:text-zinc-600">
          <Icon size={19} />
        </span>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-caption text-muted">{description}</p>
      ) : null}
    </div>
  );
}