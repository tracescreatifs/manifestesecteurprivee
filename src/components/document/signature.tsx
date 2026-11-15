import type { TraceSignature } from "@/types/database";

/*
  Signature vectorielle ({vb, d[]}) rendue en SVG, à l'encre du document.
  Seuls les tracés composés de commandes SVG et de nombres sont affichés.
*/
const TRACE_VALIDE = /^[MLCQSTHVZmlcqsthvz0-9eE.,\s-]+$/;
const VB_VALIDE = /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/;

export function traceSure(trace: TraceSignature): TraceSignature | null {
  if (!VB_VALIDE.test(trace.vb)) return null;
  const d = trace.d.filter((x) => TRACE_VALIDE.test(x));
  return d.length ? { vb: trace.vb, d } : null;
}

export function SignatureSvg({
  trace,
  ajustement = "xMidYMid meet",
  className = "",
  libelle = "Signature",
}: {
  trace: TraceSignature;
  ajustement?: string;
  className?: string;
  libelle?: string;
}) {
  const sure = traceSure(trace);
  if (!sure) return null;
  return (
    <svg className={`block w-full ${className}`} viewBox={sure.vb} preserveAspectRatio={ajustement} role="img" aria-label={libelle}>
      {sure.d.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#14212B" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
