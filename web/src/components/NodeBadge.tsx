const NODE_META: Record<string, { label: string; emoji: string; color: string }> = {
  planner: { label: "Planner", emoji: "🧭", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  analyst: { label: "Analyst", emoji: "🔬", color: "bg-sky-50 text-sky-700 border-sky-200" },
  tools: { label: "Tools", emoji: "🛠", color: "bg-amber-50 text-amber-800 border-amber-200" },
  list_datasets: { label: "list_datasets", emoji: "📚", color: "bg-amber-50 text-amber-800 border-amber-200" },
  execute_python: { label: "execute_python", emoji: "🐍", color: "bg-amber-50 text-amber-800 border-amber-200" },
  web_search: { label: "web_search", emoji: "🔎", color: "bg-amber-50 text-amber-800 border-amber-200" },
  report_writer: { label: "Report writer", emoji: "📝", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  responder: { label: "Responder", emoji: "💬", color: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function NodeBadge({ name, active }: { name: string; active?: boolean }) {
  const meta = NODE_META[name] || { label: name, emoji: "●", color: "bg-stone-50 text-stone-700 border-stone-200" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.color} ${
        active ? "ring-2 ring-offset-1 ring-accent/40" : ""
      }`}
    >
      <span>{meta.emoji}</span>
      <span className="font-mono">{meta.label}</span>
      {active && <span className="pulse-dot ml-1" />}
    </span>
  );
}
