import type { ReactNode } from "react";

export type VarianteChip = "neutre" | "succes" | "erreur";

const VARIANTES: Record<VarianteChip, string> = {
  neutre: "bg-sureleve text-texte-secondaire",
  succes: "bg-succes-doux text-succes",
  erreur: "bg-erreur-doux text-erreur",
};

/* Pastille d'état */
export function Chip({ variante = "neutre", children }: { variante?: VarianteChip; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12.5px] font-medium whitespace-nowrap ${VARIANTES[variante]}`}
    >
      {children}
    </span>
  );
}
