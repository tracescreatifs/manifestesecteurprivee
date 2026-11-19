/*
  Recherche de l'admin (R2) : CEO par nom, entreprise ou téléphone ; doléances par thème ou texte.
  Comparaison sans accents ni majuscules (comme la recherche de la liste des CEO) ; téléphone par les chiffres seuls,
  à partir de 3 chiffres. Fonctions pures, testées ; la lecture des données se fait côté serveur, avec la session.
*/

import { formaterTelephone, normaliserTexte } from "@/lib/ceo/normaliser";

export type CeoCherche = { invitationId: string; prenom: string; nom: string; entreprise: string; telephone: string };
export type DoleanceCherchee = { id: string; theme: string; texte: string };

export type ResultatRecherche = {
  ceo: { id: string; titre: string; detail: string }[];
  doleances: { id: string; titre: string; detail: string }[];
  /* Nombre total de correspondances (seules les premières sont listées) */
  totalCeo: number;
  totalDoleances: number;
};

export const RECHERCHE_MIN = 2;
export const RESULTATS_MAX = 6;

export function rechercherDans(q: string, ceo: CeoCherche[], doleances: DoleanceCherchee[]): ResultatRecherche {
  const terme = normaliserTexte(q);
  const chiffres = q.replace(/\D/g, "");
  if (terme.length < RECHERCHE_MIN) return { ceo: [], doleances: [], totalCeo: 0, totalDoleances: 0 };

  const ceoTrouves = ceo.filter((c) => {
    const texte = normaliserTexte(`${c.prenom} ${c.nom} ${c.entreprise}`);
    return texte.includes(terme) || (chiffres.length >= 3 && c.telephone.replace(/\D/g, "").includes(chiffres));
  });
  const doleancesTrouvees = doleances.filter((d) => normaliserTexte(`${d.theme} ${d.texte}`).includes(terme));

  return {
    ceo: ceoTrouves.slice(0, RESULTATS_MAX).map((c) => ({
      id: c.invitationId,
      titre: `${c.prenom} ${c.nom}`.trim() || "CEO sans nom",
      detail: [c.entreprise, c.telephone ? formaterTelephone(c.telephone) : ""].filter(Boolean).join(", "),
    })),
    doleances: doleancesTrouvees.slice(0, RESULTATS_MAX).map((d) => ({
      id: d.id,
      titre: d.theme,
      detail: d.texte.length > 90 ? `${d.texte.slice(0, 90).trimEnd()}…` : d.texte,
    })),
    totalCeo: ceoTrouves.length,
    totalDoleances: doleancesTrouvees.length,
  };
}
