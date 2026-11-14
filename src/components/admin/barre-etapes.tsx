import { Check } from "lucide-react";

import type { StatutManifeste } from "@/types/database";

import { MenuAdmin } from "./menu-admin";

const ETAPES = ["Rédaction", "Gel", "Signatures", "Publication"] as const;
const INDEX: Record<StatutManifeste, number> = { redaction: 0, gele: 2, clos: 2, publie: 3 };

/* État d'une étape, selon le statut du Manifeste (logique du prototype 1-admin.html) */
function etatEtape(statut: StatutManifeste, i: number): "fait" | "courant" | "a_venir" {
  const idx = INDEX[statut];
  const fait =
    statut === "publie" ||
    i < idx ||
    (i === 1 && statut !== "redaction") ||
    (i === 2 && statut === "clos");
  if (fait) return "fait";
  return i === idx ? "courant" : "a_venir";
}

type Props = {
  statut: StatutManifeste;
  admin: { prenom: string; nom: string; email: string };
};

/*
  Barre d'étapes : collante en haut sur ordinateur, en verre dépoli.
  Le bouton de l'action suivante (Geler, Clore, Publier) arrivera avec sa fonction.
*/
export function BarreEtapes({ statut, admin }: Props) {
  return (
    <div
      className={
        "z-20 mb-6 flex items-center justify-between gap-3 rounded-[14px] border border-filet bg-white/92 px-4 py-2 " +
        "min-[820px]:sticky min-[820px]:top-2 " +
        "supports-[backdrop-filter]:bg-white/68 supports-[backdrop-filter]:backdrop-blur-[16px] supports-[backdrop-filter]:backdrop-saturate-[1.6]"
      }
    >
      <ol aria-label="Étapes du Manifeste" className="flex min-w-0 flex-wrap items-center gap-1.5">
        {ETAPES.map((libelle, i) => {
          const etat = etatEtape(statut, i);
          return (
            <li key={libelle} className="flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden="true" className="h-px w-3 bg-filet-fort min-[820px]:w-7" /> : null}
              <span
                aria-current={etat === "courant" ? "step" : undefined}
                className={
                  "inline-flex items-center gap-2 text-[14px] " +
                  (etat === "courant" ? "font-medium text-encre" : "text-texte-secondaire")
                }
              >
                <span
                  className={
                    "grid size-6 place-items-center rounded-full border text-[12.5px] font-semibold " +
                    (etat === "courant"
                      ? "border-eau bg-eau text-white"
                      : etat === "fait"
                        ? "border-filet-fort bg-sureleve text-encre"
                        : "border-filet-fort bg-surface")
                  }
                >
                  {etat === "fait" ? (
                    <Check aria-hidden="true" className="size-3.5" strokeWidth={2} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={etat === "courant" ? "" : "sr-only min-[820px]:not-sr-only"}>
                  {libelle}
                  {etat === "fait" ? <span className="sr-only"> (terminée)</span> : null}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <MenuAdmin prenom={admin.prenom} nom={admin.nom} email={admin.email} />
    </div>
  );
}
