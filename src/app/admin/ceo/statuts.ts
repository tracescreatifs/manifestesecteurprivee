import type { VarianteChip } from "@/components/ui/chip";
import type { StatutEnvoi } from "@/types/database";

/* Libellé et couleur de chaque statut d'envoi (tons d'eau, prototype) */
export const LIBELLES_STATUTS: Record<StatutEnvoi, { libelle: string; variante: VarianteChip }> = {
  a_envoyer: { libelle: "À envoyer", variante: "neutre" },
  envoye: { libelle: "Envoyé", variante: "neutre" },
  ouvert: { libelle: "Ouvert, non signé", variante: "ouvert" },
  signe: { libelle: "Signé", variante: "eau" },
};
