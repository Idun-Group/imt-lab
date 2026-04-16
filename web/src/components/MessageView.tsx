"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/types";
import ReasoningPanel from "./ReasoningPanel";
import ReportCard from "./ReportCard";

export default function MessageView({
  m,
  onOpenReport,
}: {
  m: Message;
  onOpenReport?: () => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-ink px-4 py-2.5 text-[15px] text-canvas shadow-soft">
          {m.content}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3.5">
      {m.opener && (
        <div className="text-[15px] leading-relaxed text-ink">
          {m.opener}
        </div>
      )}

      <ReasoningPanel
        plan={m.plan}
        toolCalls={m.toolCalls || []}
        streaming={m.streaming}
      />

      {m.content && (
        <div className="prose-chat max-w-none text-[15px] leading-relaxed text-ink">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
          {m.streaming && (
            <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-ink/60 align-middle" />
          )}
        </div>
      )}

      {m.reportPath && (
        <ReportCard reportPath={m.reportPath} onOpen={onOpenReport} />
      )}
    </div>
  );
}
