"use client";

export default function ChartsGallery({ charts }: { charts: string[] }) {
  if (charts.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {charts.map((c) => (
        <figure
          key={c}
          className="overflow-hidden rounded-lg border border-rule bg-white shadow-soft"
        >
          <img src={`/api/chart/${c}`} alt={c} className="w-full" />
        </figure>
      ))}
    </div>
  );
}
