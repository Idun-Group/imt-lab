"use client";

import { useEffect, useState } from "react";

export default function ReportCard({
  reportPath,
  onOpen,
}: {
  reportPath: string;
  onOpen?: () => void;
}) {
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/report/${reportPath}`, { method: "HEAD" });
        const len = res.headers.get("Content-Length");
        if (!cancelled && len) setSize(Number(len));
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportPath]);

  const niceSize = size ? formatBytes(size) : null;

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-rule bg-surface px-3 py-2.5 transition hover:border-accent/40 hover:shadow-soft">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c96442" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-ink">
          {reportPath}
        </div>
        <div className="text-[11.5px] text-muted">
          Rapport PDF{niceSize ? ` · ${niceSize}` : ""}
        </div>
      </div>
      <button
        onClick={onOpen}
        className="shrink-0 rounded-md border border-rule bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/80 transition hover:bg-ink hover:text-canvas"
      >
        Ouvrir
      </button>
      <a
        href={`/api/report/${reportPath}`}
        download={reportPath}
        className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-[11.5px] font-medium text-canvas transition hover:bg-accent"
      >
        Télécharger
      </a>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
