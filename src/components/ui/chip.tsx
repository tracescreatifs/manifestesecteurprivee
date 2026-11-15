import type { ReactNode } from "react";

export type VarianteChip = "neutre" | "succes" | "erreur" | "eau" | "ouvert" | "argile";

const VARIANTES: Record<VarianteChip, string> = {
  neutre: "bg-sureleve text-texte-secondaire",
  succes: "bg-succes-doux text-succes",
  erreur: "bg-erreur-doux text-erreur",
  /* Statuts d'envoi, en tons d'eau (prototype) */
  eau: "bg-[#E3ECEE] text-eau",
  ouvert: "bg-sureleve text-[#3F6874]",
  /* Réservé à « à vérifier » et aux informations à compléter */
  argile: "bg-argile-doux text-[#8a4724]",
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
