"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ToolCall } from "@/lib/types";
import { extractChartPaths, stripChartPaths } from "@/lib/agui";

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

function prettyArgs(name: string, args: string): { code?: string; json?: any } {
  try {
    const parsed = JSON.parse(args);
    if (name === "execute_python" && typeof parsed.code === "string") {
      return { code: parsed.code };
    }
    return { json: parsed };
  } catch {
    return { json: args };
  }
}

function summary(name: string, args: string, done?: boolean): string {
  const pretty = prettyArgs(name, args);
  if (pretty.code) {
    const first = pretty.code.trim().split("\n").find((l) => l.trim() && !l.trim().startsWith("#")) || "";
    return first.length > 70 ? first.slice(0, 70) + "…" : first;
  }
  if (pretty.json && typeof pretty.json === "object") {
    const entries = Object.entries(pretty.json as Record<string, any>).slice(0, 2);
    return entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ").slice(0, 70);
  }
  return done ? "" : "…";
}

export default function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const pretty = prettyArgs(call.name, call.args || "");
  const charts = call.charts || (call.result ? extractChartPaths(call.result) : []);
  const resultText = call.result ? stripChartPaths(call.result) : "";
  const status = call.error ? "error" : call.done ? "ok" : "running";
  const statusColor =
    status === "error"
      ? "bg-rose-500"
      : status === "ok"
      ? "bg-emerald-500"
      : "bg-amber-400 animate-pulse";

  return (
    <div className="my-1.5 overflow-hidden rounded-md border border-rule bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-canvas"
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`} />
        <code className="shrink-0 font-mono text-[11px] text-muted">{call.name}</code>
        <span className="truncate font-mono text-[11px] text-ink/60">
          {summary(call.name, call.args, call.done)}
        </span>
        {charts.length > 0 && (
          <span className="ml-auto shrink-0 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] text-amber-700">
            {charts.length} chart{charts.length > 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-1 shrink-0 text-[10px] text-muted">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="border-t border-rule">
          {pretty.code !== undefined ? (
            pretty.code ? (
              <SyntaxHighlighter language="python" style={codeStyle as any} PreTag="div">
                {pretty.code}
              </SyntaxHighlighter>
            ) : (
              <div className="chat-code bg-ink px-4 py-2 text-muted">…</div>
            )
          ) : (
            <pre className="chat-code overflow-x-auto bg-canvas px-3 py-2 text-ink/80">
              <code>
                {typeof pretty.json === "string"
                  ? pretty.json
                  : JSON.stringify(pretty.json, null, 2)}
              </code>
            </pre>
          )}

          {(resultText || charts.length > 0 || call.error) && (
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
              {charts.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {charts.map((c) => (
                    <img
                      key={c}
                      src={`/api/chart/${c}`}
                      alt={c}
                      className="rounded border border-rule bg-white"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!open && charts.length > 0 && (
        <div className="border-t border-rule px-3 py-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {charts.map((c) => (
              <img
                key={c}
                src={`/api/chart/${c}`}
                alt={c}
                className="rounded border border-rule bg-white"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
