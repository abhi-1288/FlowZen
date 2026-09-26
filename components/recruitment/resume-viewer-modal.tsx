"use client";

import { useEffect } from "react";
import { Download, ExternalLink, X } from "lucide-react";

/**
 * Previews a candidate resume without leaving the page.
 *
 * The PDF is rendered by the browser's own viewer in an iframe, which is a
 * plugin the parent page cannot introspect: there is no API to reach its zoom,
 * download or page state. There is therefore no app-level zoom here — driving it
 * meant rewriting the `#zoom` open parameter and remounting the iframe with a
 * matching `key`, because a bare hash change does not reliably re-navigate the
 * viewer, and Safari's viewer ignored the parameter regardless. The viewer's own
 * toolbar does the zooming instead.
 */

function extensionOf(url: string) {
  return /\.([a-z0-9]+)$/i.exec(url.split(/[?#]/)[0] ?? "")?.[1]?.toLowerCase() ?? "";
}

function baseNameOf(url: string) {
  const base = (url.split(/[?#]/)[0] ?? "").split("/").filter(Boolean).pop() ?? "";
  return decodeURIComponent(base);
}

/** A human-facing download name, falling back to whatever the URL gave us. */
function downloadName(url: string, candidateName: string) {
  const ext = extensionOf(url);
  const slug = candidateName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return baseNameOf(url) || "resume";
  return `${slug}-resume${ext ? `.${ext}` : ""}`;
}

export function ResumeViewerModal({
  url,
  candidateName,
  onClose,
}: {
  url: string;
  candidateName: string;
  onClose: () => void;
}) {
  const ext = extensionOf(url);
  const canPreview = ext === "pdf";
  const fileName = downloadName(url, candidateName);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center neu-overlay px-4"
      // Only a press that both starts and ends on the backdrop dismisses, so a
      // drag that began inside the document does not close the modal.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg neu-card">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--c-border-light)] px-5 py-3">
          <h2 className="min-w-0 truncate text-base font-semibold">
            {candidateName} · Resume
          </h2>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-light)] px-2.5 py-1.5 text-xs font-semibold transition hover:bg-[var(--c-bg-muted)]"
            >
              <Download size={14} /> Download
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the resume in a new tab"
              title="Open in a new tab"
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-[var(--c-bg-muted)]"
            >
              <ExternalLink size={14} />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the resume"
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-[var(--c-bg-muted)]"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {canPreview ? (
          <div className="min-h-0 flex-1 bg-slate-100 p-2 dark:bg-black/40">
            <iframe
              src={`${url}#page=1`}
              title={`${candidateName} resume`}
              className="h-full min-h-[60vh] w-full rounded-lg border-0"
            />
          </div>
        ) : (
          <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <p className="text-sm font-semibold">
              This file type can&apos;t be previewed in the browser
            </p>
            <p className="text-xs text-slate-500">
              {fileName}
              {ext ? ` · .${ext}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <a
                href={url}
                download={fileName}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-bg-muted)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--c-bg-hover)]"
              >
                <Download size={14} /> Download
              </a>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--c-bg-muted)]"
              >
                <ExternalLink size={14} /> Open in a new tab
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
