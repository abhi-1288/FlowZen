import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^###?\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const proseStyles = {
  root: "text-sm leading-relaxed text-slate-600 dark:text-zinc-400",
};

export function JobDescription({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={`${proseStyles.root} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children }) => (
            <span className="mt-5 block text-base font-bold text-slate-900 first:mt-0 dark:text-zinc-100">{children}</span>
          ),
          h2: ({ children }) => (
            <span className="mt-5 block text-base font-bold text-slate-900 first:mt-0 dark:text-zinc-100">{children}</span>
          ),
          h3: ({ children }) => (
            <span className="mt-4 block text-sm font-bold text-slate-900 first:mt-0 dark:text-zinc-100">{children}</span>
          ),
          h4: ({ children }) => (
            <span className="mt-4 block text-sm font-bold text-slate-900 first:mt-0 dark:text-zinc-100">{children}</span>
          ),
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5 marker:text-slate-400 dark:marker:text-zinc-500">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5 marker:text-slate-400 dark:marker:text-zinc-500">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-[var(--c-border-light)] bg-[var(--c-bg-muted)] p-3 text-sm italic text-slate-500">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-zinc-100">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="text-slate-400 dark:text-zinc-500">{children}</del>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 decoration-slate-300 hover:decoration-slate-400 dark:decoration-zinc-600"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className?.includes("language-")) || Boolean(className);
            if (!isBlock) {
              return (
                <code className="rounded-md bg-[var(--c-bg-muted)] px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800 dark:bg-zinc-700 dark:text-zinc-200">
                  {children}
                </code>
              );
            }
            return (
              <code className={`font-mono ${className ?? ""}`}>{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg border border-[var(--c-border-light)] bg-[var(--c-bg-muted)] p-3 font-mono text-xs leading-relaxed text-slate-800 dark:text-zinc-200">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-[var(--c-border-light)]">
              <table className="w-full min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[var(--c-bg-muted)]">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-[var(--c-border-light)] px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-zinc-300">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[var(--c-border-light)] px-3 py-2 text-slate-600 dark:text-zinc-400 last:border-b-0">
              {children}
            </td>
          ),
          hr: () => <hr className="my-4 border-[var(--c-border-light)]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}