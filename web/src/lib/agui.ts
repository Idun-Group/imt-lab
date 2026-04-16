import type { AguiEvent } from "./types";

export async function* runAgent(params: {
  threadId: string;
  runId: string;
  messages: Array<{ id: string; role: string; content: string }>;
  signal?: AbortSignal;
}): AsyncGenerator<AguiEvent, void, void> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      threadId: params.threadId,
      runId: params.runId,
      state: {},
      messages: params.messages,
      tools: [],
      context: [],
      forwardedProps: {},
    }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Agent error: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        yield JSON.parse(payload) as AguiEvent;
      } catch {
        // ignore malformed lines
      }
    }
  }
}

export function extractChartPaths(text: string): string[] {
  const re = /(?:output\/|\/[^\s]*output\/)chart_[a-f0-9]+\.png/g;
  const matches = text.match(re) || [];
  return matches.map((m) => m.split("/").pop()!);
}

export function stripChartPaths(text: string): string {
  return text
    .replace(/\[saved charts\][^\[]*/g, "")
    .replace(/(?:output\/|\/[^\s]*output\/)chart_[a-f0-9]+\.png/g, "")
    .trim();
}
