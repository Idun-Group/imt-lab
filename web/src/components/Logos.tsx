/* eslint-disable @next/next/no-img-element */

export function LogosStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-8 opacity-80 ${className}`}>
      <img src="/logos/imt-bs.svg" alt="IMT-BS" className="h-12 w-auto" />
      <span className="h-10 w-px bg-rule" />
      <img src="/logos/idun.svg" alt="IDUN" className="h-10 w-auto" />
      <span className="h-10 w-px bg-rule" />
      <img src="/logos/eu.svg" alt="Union européenne" className="h-9 w-auto rounded-sm shadow-soft" />
    </div>
  );
}
