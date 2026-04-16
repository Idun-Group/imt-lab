"use client";

import { useEffect, useState } from "react";

export default function ArtifactPanel({
  charts,
  reportPath,
  collapsed,
  onToggle,
}: {
  charts: string[];
  reportPath?: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const hasCharts = charts.length > 0;
  const hasReport = !!reportPath;
  const [zoom, setZoom] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportPath) {
      setPdfUrl(null);
      return;
    }
    let cancelled = false;
    let created: string | null = null;
    setPdfError(null);
    (async () => {
      try {
        const res = await fetch(`/api/report/${reportPath}`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const blob = await res.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setPdfUrl(created);
      } catch (e: any) {
        if (!cancelled) setPdfError(e.message || "Erreur de chargement du PDF");
      }
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [reportPath]);

  if (!hasCharts && !hasReport) return null;

  if (collapsed) {
    return (
      <aside className="flex h-full w-12 flex-col items-center border-l border-rule bg-surface/60">
        <button
          onClick={onToggle}
          className="mt-4 flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
          aria-label="Ouvrir les artefacts"
          title="Ouvrir"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="mt-2 rotate-180 [writing-mode:vertical-rl] px-1 font-mono text-[10px] uppercase tracking-wider text-muted">
          Artefacts
        </div>
        <div className="mt-3 flex flex-col items-center gap-2">
          {hasReport && (
            <span className="rounded bg-accent/10 px-1.5 py-1 text-[10px] font-semibold text-accent">PDF</span>
          )}
          {hasCharts && (
            <span className="rounded bg-ink/10 px-1.5 py-1 text-[10px] font-semibold text-ink/70">{charts.length}</span>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full flex-col border-l border-rule bg-surface">
      <div className="flex items-center justify-between border-b border-rule px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
            aria-label="Replier les artefacts"
            title="Replier"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <div className="text-[13px] font-medium text-ink">Artefacts</div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          {hasReport && <span>1 rapport</span>}
          {hasReport && hasCharts && <span className="text-rule">·</span>}
          {hasCharts && <span>{charts.length} graphique{charts.length > 1 ? "s" : ""}</span>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {hasReport && (
          <section className="border-b border-rule">
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <PdfIcon />
                <span className="text-[13px] font-medium text-ink">Rapport PDF</span>
              </div>
              <a
                href={pdfUrl ?? `/api/report/${reportPath}`}
                download={reportPath}
                className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-surface px-2.5 py-1 text-[11px] font-medium text-ink transition hover:bg-canvas"
              >
                <DownloadIcon />
                Télécharger
              </a>
            </div>
            <div className="h-[520px] bg-canvas">
              {pdfError ? (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-rose-700">
                  {pdfError}
                </div>
              ) : !pdfUrl ? (
                <div className="flex h-full items-center justify-center">
                  <span className="shimmer inline-block h-5 w-40 rounded" />
                </div>
              ) : (
                <object
                  data={`${pdfUrl}#toolbar=1&navpanes=0&zoom=page-width`}
                  type="application/pdf"
                  className="h-full w-full"
                  aria-label="Rapport PDF"
                >
                  <iframe src={pdfUrl} className="h-full w-full border-0" title="Rapport PDF" />
                </object>
              )}
            </div>
          </section>
        )}

        {hasCharts && (
          <section className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <ChartIcon />
              <span className="text-[13px] font-medium text-ink">Graphiques</span>
            </div>
            <div className="space-y-3">
              {charts.map((c) => (
                <figure key={c} className="overflow-hidden rounded-lg border border-rule bg-white">
                  <button onClick={() => setZoom(c)} className="block w-full" aria-label="Agrandir">
                    <img src={`/api/chart/${c}`} alt={c} className="w-full" />
                  </button>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-8"
          onClick={() => setZoom(null)}
        >
          <img
            src={`/api/chart/${zoom}`}
            alt="chart"
            className="max-h-full max-w-full rounded-lg bg-white"
          />
        </div>
      )}
    </aside>
  );
}

function PdfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-eu-blue">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
