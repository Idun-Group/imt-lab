"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runAgent, extractChartPaths, stripChartPaths } from "@/lib/agui";
import type { Message, StepBadge, ToolCall } from "@/lib/types";
import MessageView from "./MessageView";
import ArtifactPanel from "./ArtifactPanel";
import { LogosStrip } from "./Logos";

const SUGGESTIONS: { icon: string; label: string; prompt: string }[] = [
  {
    icon: "🇪🇺",
    label: "Adoption de l'IA",
    prompt: "Quels sont les pays européens leaders en adoption de l'IA ?",
  },
  {
    icon: "🧑‍💻",
    label: "Compétences numériques",
    prompt: "Compare les compétences numériques entre la France, l'Allemagne et les pays nordiques",
  },
  {
    icon: "☁️",
    label: "Cloud en Europe",
    prompt: "L'adoption du cloud progresse-t-elle plus vite au nord ou au sud de l'Europe ?",
  },
  {
    icon: "🔬",
    label: "R&D et emploi tech",
    prompt: "Quel lien entre les dépenses R&D et l'emploi dans la tech ?",
  },
];

const REPORT_MARKER_RE = /<!--REPORT:(report_[0-9_]+\.pdf)-->/;
const REPORT_LINK_RE = /\/api\/report\/(report_[0-9_]+\.pdf)|(report_[0-9_]+\.pdf)/;

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractReportPath(text: string): string | undefined {
  const marker = text.match(REPORT_MARKER_RE);
  if (marker) return marker[1];
  const link = text.match(REPORT_LINK_RE);
  return link ? link[1] || link[2] : undefined;
}

function stripReportLink(text: string): string {
  return text
    .replace(/<!--REPORT:[^>]+-->/g, "")
    .replace(/\n?\s*📄?\s*\*\*[^\n]*?\*\*\s*\[[^\]]+\]\(\/api\/report\/[^)]+\)\s*/g, "")
    .replace(/\[report_[0-9_]+\.pdf\]\(\/api\/report\/report_[0-9_]+\.pdf\)/g, "")
    .trim();
}

function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^<think>[\s\S]*$/, "")
    .replace(/^\s*\n+/, "");
}

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [artifactsCollapsed, setArtifactsCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages]
  );
  const charts = useMemo(
    () => (latestAssistant?.toolCalls || []).flatMap((tc) => tc.charts || []),
    [latestAssistant]
  );
  const reportPath = latestAssistant?.reportPath;
  const hasArtifacts = charts.length > 0 || !!reportPath;
  const empty = messages.length === 0;

  useEffect(() => {
    if (!empty) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, running, empty]);

  async function send(prompt: string) {
    if (!prompt.trim() || running) return;
    setInput("");
    const userMsg: Message = { id: uid(), role: "user", content: prompt };
    const assistantMsg: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      toolCalls: [],
      steps: [],
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setRunning(true);

    const threadId = uid();
    const runId = uid();
    let currentStep = "";
    const KNOWN_STEPS = new Set([
      "router", "chat", "acknowledge", "planner", "analyst", "tools",
      "report_writer", "responder",
    ]);

    const update = (fn: (m: Message) => Message) => {
      setMessages((prev) => prev.map((x) => (x.id === assistantMsg.id ? fn(x) : x)));
    };

    try {
      for await (const ev of runAgent({
        threadId,
        runId,
        messages: [{ id: userMsg.id, role: "user", content: prompt }],
      })) {
        switch (ev.type) {
          case "STEP_STARTED": {
            const name = ev.stepName || ev.step_name;
            if (KNOWN_STEPS.has(name)) {
              currentStep = name;
              const step: StepBadge = { id: uid(), name };
              update((m) => ({
                ...m,
                steps: [...(m.steps || []), step],
                ...(name === "responder" ? { content: "" } : {}),
              }));
            }
            break;
          }
          case "STEP_FINISHED": {
            const name = ev.stepName || ev.step_name;
            if (KNOWN_STEPS.has(name)) {
              update((m) => ({
                ...m,
                steps: (m.steps || []).map((s) =>
                  s.name === name && !s.finished ? { ...s, finished: true } : s
                ),
              }));
            }
            break;
          }
          case "TEXT_MESSAGE_CONTENT": {
            const delta = ev.delta || "";
            const planSteps = ["planner", "analyst"];
            const chatSteps = ["responder", "chat"];
            update((m) => {
              if (currentStep === "acknowledge") {
                return { ...m, opener: stripThink((m.opener || "") + delta) };
              }
              if (planSteps.includes(currentStep)) {
                return { ...m, plan: stripThink((m.plan || "") + delta) };
              }
              // responder, chat, or any unknown step → main content
              const newContent = stripThink((m.content || "") + delta);
              const rp = extractReportPath(newContent) || m.reportPath;
              return { ...m, content: newContent, reportPath: rp };
            });
            break;
          }
          case "TEXT_MESSAGE_END": {
            update((m) => {
              const rp = extractReportPath(m.content || "") || m.reportPath;
              const cleaned = m.content ? stripReportLink(m.content) : "";
              return { ...m, content: cleaned, reportPath: rp };
            });
            break;
          }
          case "TOOL_CALL_START": {
            const tc: ToolCall = {
              id: ev.toolCallId || ev.tool_call_id,
              name: ev.toolCallName || ev.tool_call_name || "tool",
              args: "",
            };
            update((m) => ({ ...m, toolCalls: [...(m.toolCalls || []), tc] }));
            break;
          }
          case "TOOL_CALL_ARGS": {
            const id = ev.toolCallId || ev.tool_call_id;
            const delta = ev.delta || "";
            update((m) => ({
              ...m,
              toolCalls: (m.toolCalls || []).map((t) =>
                t.id === id ? { ...t, args: (t.args || "") + delta } : t
              ),
            }));
            break;
          }
          case "TOOL_CALL_END": {
            const id = ev.toolCallId || ev.tool_call_id;
            update((m) => ({
              ...m,
              toolCalls: (m.toolCalls || []).map((t) => (t.id === id ? { ...t, done: true } : t)),
            }));
            break;
          }
          case "TOOL_CALL_RESULT": {
            const id = ev.toolCallId || ev.tool_call_id;
            const content = ev.content || "";
            const c = extractChartPaths(content);
            const text = stripChartPaths(content);
            update((m) => ({
              ...m,
              toolCalls: (m.toolCalls || []).map((t) =>
                t.id === id
                  ? { ...t, result: text, charts: [...(t.charts || []), ...c], done: true }
                  : t
              ),
            }));
            break;
          }
          case "MESSAGES_SNAPSHOT": {
            const snap: any[] = ev.messages || [];
            const toolResults = snap.filter((x) => x.role === "tool");
            if (toolResults.length === 0) break;
            update((m) => {
              const map = new Map((m.toolCalls || []).map((t) => [t.id, t]));
              for (const tr of toolResults) {
                const existing = map.get(tr.toolCallId);
                if (existing && !existing.result) {
                  const c = extractChartPaths(tr.content || "");
                  const text = stripChartPaths(tr.content || "");
                  map.set(tr.toolCallId, { ...existing, result: text, charts: c, done: true });
                }
              }
              return { ...m, toolCalls: Array.from(map.values()) };
            });
            break;
          }
          case "RAW": {
            const inner = ev.event;
            if (inner?.event === "on_tool_end" && inner.data?.output) {
              const output =
                typeof inner.data.output === "string"
                  ? inner.data.output
                  : inner.data.output?.content || JSON.stringify(inner.data.output);
              update((m) => {
                const c = extractChartPaths(output);
                const text = stripChartPaths(output);
                return {
                  ...m,
                  toolCalls: (m.toolCalls || []).map((t) =>
                    !t.result && t.done !== true
                      ? { ...t, result: text, charts: [...(t.charts || []), ...c], done: true }
                      : t
                  ),
                };
              });
              const rp = extractReportPath(output);
              if (rp) update((m) => ({ ...m, reportPath: rp }));
            }
            break;
          }
          case "RUN_ERROR": {
            update((m) => ({ ...m, content: (m.content || "") + `\n\n⚠️ ${ev.message}` }));
            break;
          }
        }
      }
    } catch (err: any) {
      update((m) => ({ ...m, content: (m.content || "") + `\n\n⚠️ ${err.message}` }));
    } finally {
      update((m) => ({ ...m, streaming: false }));
      setRunning(false);
    }
  }

  const contentWidth = hasArtifacts ? "max-w-2xl" : "max-w-3xl";

  return (
    <div className="flex h-screen bg-canvas">
      <section className={`flex min-w-0 flex-col transition-all ${hasArtifacts ? "flex-[1.1]" : "flex-1"}`}>
        {empty ? (
          <div className="flex flex-1 items-center justify-center px-6 pb-10">
            <div className={`w-full ${contentWidth}`}>
              <Welcome
                onPick={(p) => { setInput(p); setTimeout(() => send(p), 0); }}
                input={input}
                setInput={setInput}
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                running={running}
              />
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="scroll-fade flex-1 overflow-y-auto">
              <div className={`mx-auto px-6 py-8 ${contentWidth}`}>
                <div className="space-y-6">
                  {messages.map((m) => (
                    <MessageView
                      key={m.id}
                      m={m}
                      onOpenReport={() => setArtifactsCollapsed(false)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-t from-canvas via-canvas/90 to-canvas/0 pb-6 pt-3">
              <div className={`mx-auto px-6 ${contentWidth}`}>
                <ChatInput
                  input={input}
                  setInput={setInput}
                  onSubmit={(e) => { e.preventDefault(); send(input); }}
                  running={running}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {hasArtifacts && (
        <section
          className={`transition-all ${
            artifactsCollapsed ? "w-12" : "w-[46%] min-w-[380px] max-w-[760px]"
          }`}
        >
          <ArtifactPanel
            charts={charts}
            reportPath={reportPath}
            collapsed={artifactsCollapsed}
            onToggle={() => setArtifactsCollapsed((v) => !v)}
          />
        </section>
      )}
    </div>
  );
}

function Welcome({
  onPick,
  input,
  setInput,
  onSubmit,
  running,
}: {
  onPick: (q: string) => void;
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  running: boolean;
}) {
  return (
    <div className="text-center">
      <div className="mb-10 flex items-center justify-center">
        <LogosStrip />
      </div>
      <h1 className="mb-3 font-serif text-[36px] leading-tight font-semibold text-ink">
        Agent d'analyse — données européennes
      </h1>
      <p className="mx-auto mb-6 max-w-md text-[14.5px] leading-relaxed text-muted">
        Démonstration pour IMT-BS. Pose une question, l'agent consulte les données
        publiques d'Eurostat et produit une réponse argumentée.
      </p>
      <div className="mx-auto mb-4 max-w-2xl">
        <ChatInput input={input} setInput={setInput} onSubmit={onSubmit} running={running} />
      </div>
      <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onPick(s.prompt)}
            className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface px-3.5 py-1.5 text-[13px] text-ink/85 transition hover:border-ink/25 hover:bg-canvas hover:text-ink"
          >
            <span className="text-[14px]">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatInput({
  input,
  setInput,
  onSubmit,
  running,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  running: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="relative rounded-2xl border border-rule bg-surface shadow-soft transition focus-within:border-accent/40 focus-within:shadow-[0_4px_24px_rgba(201,100,66,0.08)]"
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e);
          }
        }}
        placeholder="Pose ta question…"
        rows={2}
        className="w-full resize-none rounded-2xl bg-transparent px-5 py-3.5 pr-14 text-[16px] leading-6 text-ink placeholder:text-muted focus:outline-none"
        style={{ minHeight: "72px" }}
        disabled={running}
      />
      <button
        type="submit"
        disabled={!input.trim() || running}
        className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-canvas transition hover:bg-accent disabled:opacity-40"
        aria-label="Envoyer"
      >
        {running ? <span className="pulse-dot" /> : <ArrowUp />}
      </button>
    </form>
  );
}

function ArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}
