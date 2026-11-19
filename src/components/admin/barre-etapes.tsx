import { Check } from "lucide-react";

import { formaterDateLimite } from "@/lib/ceo/message";
import type { StatutManifeste } from "@/types/database";

import { BoutonClore, BoutonPublier, BoutonRouvrir } from "./actions-etapes";
import { AideEtape } from "./aide-etape";
import { BoutonGel } from "./bouton-gel";
import { MenuAdmin } from "./menu-admin";

const ETAPES = ["Rédaction", "Gel", "Signatures", "Publication"] as const;
const INDEX: Record<StatutManifeste, number> = { redaction: 0, gele: 2, clos: 3, publie: 3 };

/* État d'une étape, selon le statut du Manifeste (logique du prototype 1-admin.html) */
function etatEtape(statut: StatutManifeste, i: number): "fait" | "courant" | "a_venir" {
  const idx = INDEX[statut];
  const fait = statut === "publie" || i < idx || (i === 1 && statut !== "redaction") || (i === 2 && statut === "clos");
  if (fait) return "fait";
  return i === idx ? "courant" : "a_venir";
}

type Props = {
  statut: StatutManifeste;
  /* Numéro de la version courante (null : aucune version importée) */
  versionCourante: number | null;
  admin: { prenom: string; nom: string; email: string };
  /* Prompt 08 : date limite, date passée (signatures closes sans clic), et nombres affichés avant la clôture */
  dateLimite: string | null;
  datePassee: boolean;
  annexe: number;
  aVerifier: number;
};

/* Identifiant du texte d'aide de l'étape, relié au bouton d'action par aria-describedby */
const AIDE_ID = "aide-etape";

/*
  Barre d'étapes : flottante et collante en haut sur ordinateur, en verre dépoli (R1 : rayon 22, ombre douce).
  Elle propose toujours l'action suivante : « Geler le texte » en rédaction, « Clore les signatures » une fois gelé
  (aussi quand la date limite est passée sans clic, pour enregistrer l'état), « Rouvrir » et « Publier » une fois clos.
  L'aide de l'étape : bouton d'information et bulle sur ordinateur (la barre tient sur une ligne),
  petit texte sous l'action sur téléphone.
*/
export function BarreEtapes({ statut, versionCourante, admin, dateLimite, datePassee, annexe, aVerifier }: Props) {
  const action =
    statut === "redaction" && versionCourante !== null ? (
      <BoutonGel numero={versionCourante} aideId={AIDE_ID} />
    ) : statut === "gele" ? (
      <BoutonClore annexe={annexe} aVerifier={aVerifier} aideId={AIDE_ID} />
    ) : statut === "clos" ? (
      <>
        <BoutonRouvrir aideId={AIDE_ID} />
        <BoutonPublier aideId={AIDE_ID} />
      </>
    ) : null;
  const indication =
    statut === "redaction"
      ? versionCourante === null
        ? "Importez une première version du texte depuis la rubrique Texte."
        : "Quand le texte est validé, gelez-le pour activer les liens des CEO."
      : statut === "gele"
        ? datePassee
          ? "La date limite est passée : les signatures sont closes. Enregistrez la clôture."
          : `Les CEO signent jusqu'au ${dateLimite ? formaterDateLimite(dateLimite) : "à la date limite"}. Vous pouvez clore avant.`
        : statut === "clos"
          ? "Signatures closes. Ajoutez les signataires sur place dans Document A4, puis publiez le document final."
          : "Document final publié.";

  return (
    <div
      className={
        "z-20 mb-6 grid gap-2 rounded-[22px] border border-white/70 bg-white/92 px-4 py-2 shadow-douce " +
        "min-[820px]:sticky min-[820px]:top-5 " +
        "supports-[backdrop-filter]:bg-white/68 supports-[backdrop-filter]:backdrop-blur-[16px] supports-[backdrop-filter]:backdrop-saturate-[1.6]"
      }
    >
      <div className="flex items-center justify-between gap-x-3 gap-y-2 min-[820px]:flex-wrap">
        <ol aria-label="Étapes du Manifeste" className="flex min-w-0 flex-nowrap items-center gap-1 min-[400px]:gap-1.5">
          {ETAPES.map((libelle, i) => {
            const etat = etatEtape(statut, i);
            return (
              <li key={libelle} className="flex shrink-0 items-center gap-1 min-[400px]:gap-1.5">
                {i > 0 ? <span aria-hidden="true" className="h-px w-2 bg-filet-fort min-[400px]:w-3 min-[1080px]:w-7" /> : null}
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
                    {etat === "fait" ? <Check aria-hidden="true" className="size-3.5" strokeWidth={2} /> : i + 1}
                  </span>
                  {/* Libellés : l'étape courante sur téléphone, aucun de 820 à 1079 px (la barre tient sur une ligne), tous au-delà */}
                  <span className={etat === "courant" ? "min-[820px]:sr-only min-[1080px]:not-sr-only" : "sr-only min-[1080px]:not-sr-only"}>
                    {libelle}
                    {etat === "fait" ? <span className="sr-only"> (terminée)</span> : null}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {indication ? (
            <span className="hidden min-[820px]:inline-grid">
              <AideEtape texte={indication} idDescription={AIDE_ID} />
            </span>
          ) : null}
          {action ? <span className="hidden gap-2 min-[820px]:inline-flex">{action}</span> : null}
          {/* Sur ordinateur, le compte est en bas du panneau latéral (R1) */}
          <span className="inline-grid min-[820px]:hidden">
            <MenuAdmin prenom={admin.prenom} nom={admin.nom} email={admin.email} />
          </span>
        </div>
      </div>
      {indication ? (
        <span id={AIDE_ID} className="sr-only">
          {indication}
        </span>
      ) : null}
      {/* Sur téléphone, l'action suivante occupe sa propre ligne, avec l'aide juste dessous (lue une seule fois : par le texte masqué ci-dessus) */}
      {action || indication ? (
        <div className="grid gap-1.5 pb-1 min-[820px]:hidden">
          {action ? <div className="grid auto-cols-fr grid-flow-col gap-2">{action}</div> : null}
          {indication ? (
            <p aria-hidden="true" className="text-[13px] text-texte-secondaire">
              {indication}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
