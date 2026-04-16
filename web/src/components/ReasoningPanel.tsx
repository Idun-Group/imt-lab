"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ToolCall } from "@/lib/types";
import { stripChartPaths } from "@/lib/agui";

const codeStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...(oneDark as any)['pre[class*="language-"]'],
    margin: 0,
    padding: "10px 14px",
    background: "#1d1c1a",
    fontSize: "0.76rem",
    lineHeight: 1.5,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
};

const TOOL_VERBS: Record<string, string> = {
  list_datasets: "Exploration des jeux de données",
  execute_python: "Exécution de code Python",
  web_search: "Recherche sur le web",
};

function parseArgs(name: string, args: string): { code?: string; obj?: any } {
  try {
    const p = JSON.parse(args);
    if (name === "execute_python" && typeof p.code === "string") return { code: p.code };
    return { obj: p };
  } catch {
    return { obj: args };
  }
}

function oneLiner(name: string, args: string): string {
  const p = parseArgs(name, args);
  if (p.code) {
    const firstReal = p.code
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#") && !l.startsWith('"""') && !l.startsWith("'''"));
    return firstReal ? (firstReal.length > 80 ? firstReal.slice(0, 80) + "…" : firstReal) : "preparing…";
  }
  if (typeof p.obj === "object" && p.obj !== null) {
    const first = Object.entries(p.obj)[0];
    if (first) return `${first[0]}: ${JSON.stringify(first[1]).slice(0, 60)}`;
  }
  return "…";
}

export default function ReasoningPanel({
  plan,
  toolCalls,
  streaming,
}: {
  plan?: string;
  toolCalls: ToolCall[];
  streaming?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const hasContent = plan || toolCalls.length > 0;
  if (!hasContent) return null;

  const current = toolCalls[toolCalls.length - 1];
  const totalSteps = toolCalls.length;
  const headerLabel = streaming && current
    ? TOOL_VERBS[current.name] || current.name
    : totalSteps > 0
    ? `Raisonnement · ${totalSteps} étape${totalSteps === 1 ? "" : "s"}`
    : "Raisonnement";

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2.5 rounded-lg border border-rule bg-surface/60 px-3 py-2 text-left transition hover:bg-surface"
      >
        {streaming ? (
          <span className="pulse-dot shrink-0" />
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="shrink-0 text-emerald-600"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}

        <span className="shrink-0 text-[14px] font-medium text-ink/85">
          {headerLabel}
        </span>

        {streaming && current && (
          <span
            key={current.id}
            className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink/50 animate-[fadeIn_.35s_ease]"
          >
            {oneLiner(current.name, current.args)}
          </span>
        )}

        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`ml-auto shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-4 border-l-2 border-rule pl-4">
          {plan && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Plan
              </div>
              <div className="prose-chat text-[13.5px] text-ink/80">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan}</ReactMarkdown>
              </div>
            </div>
          )}
          {toolCalls.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Actions
              </div>
              {toolCalls.map((tc, i) => (
                <ToolCallRow key={tc.id} n={i + 1} call={tc} />
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ToolCallRow({ n, call }: { n: number; call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const p = parseArgs(call.name, call.args || "");
  const resultText = call.result ? stripChartPaths(call.result) : "";
  const status = call.error ? "error" : call.done ? "ok" : "running";
  const statusColor =
    status === "error" ? "bg-rose-500" : status === "ok" ? "bg-emerald-500" : "bg-amber-400 animate-pulse";

  return (
    <div className="overflow-hidden rounded-md border border-rule bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-canvas"
      >
        <span className="shrink-0 font-mono text-[10px] text-muted">{n}</span>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`} />
        <code className="shrink-0 font-mono text-[11px] text-ink/80">{call.name}</code>
        <span className="truncate font-mono text-[11px] text-ink/50">
          {oneLiner(call.name, call.args)}
        </span>
        {call.charts && call.charts.length > 0 && (
          <span className="ml-auto shrink-0 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] text-amber-700">
            {call.charts.length} chart{call.charts.length > 1 ? "s" : ""}
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-rule">
          {p.code !== undefined ? (
            p.code ? (
              <SyntaxHighlighter language="python" style={codeStyle as any} PreTag="div">
                {p.code}
              </SyntaxHighlighter>
            ) : (
              <div className="bg-ink px-4 py-2 font-mono text-[11px] text-muted">…</div>
            )
          ) : (
            <pre className="chat-code overflow-x-auto bg-canvas px-3 py-2 text-ink/80">
              <code>
                {typeof p.obj === "string" ? p.obj : JSON.stringify(p.obj, null, 2)}
              </code>
            </pre>
          )}
          {(resultText || call.error) && (
            <div className="border-t border-rule px-3 py-2">
              {call.error && (
                <pre className="chat-code mb-2 overflow-x-auto rounded bg-rose-50 px-2 py-1.5 text-rose-800">
                  {call.error}
                </pre>
              )}
              {resultText && (
                <pre className="chat-code max-h-56 overflow-auto rounded bg-canvas px-2 py-1.5 text-ink/80">
                  {resultText}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
