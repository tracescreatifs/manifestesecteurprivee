import { ArrowUpRight, Download, ListTodo, MailOpen, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { quandRelatif } from "@/lib/admin/calculs";
import type { AFaire } from "@/lib/admin/tableau-de-bord";

/*
  « À faire maintenant » (R1) : quatre raccourcis vers l'endroit où agir, avec des nombres réels.
  cartes : colonne du panneau (à partir de 1440 px) et tableau de bord sur téléphone ;
  compacte : lignes sous la navigation, de 820 à 1439 px (le panneau n'écrase jamais le contenu).
  L'argile foncée (#8E4A27 sur #F6E7DB) est réservée à « À vérifier », seulement quand il y a quelque chose à vérifier.
*/

type Raccourci = {
  cle: string;
  titre: string;
  icone: LucideIcon;
  href: string;
  /* Le lien télécharge un fichier (export des signatures) */
  telechargement?: boolean;
  valeur: string;
  /* Valeur courte, pour la forme compacte */
  court: string;
  detail: string;
  argile?: boolean;
};

function raccourcis(d: AFaire, maintenant: Date): Raccourci[] {
  const s = (n: number) => (n > 1 ? "s" : "");
  const exporte = d.dernierExport ? quandRelatif(d.dernierExport, maintenant) : null;
  return [
    {
      cle: "verifier",
      titre: "À vérifier",
      icone: ShieldCheck,
      href: "/admin/ceo?onglet=verifier",
      valeur: String(d.aVerifier),
      court: String(d.aVerifier),
      detail: d.aVerifier ? `signature${s(d.aVerifier)} en attente` : "Rien en attente",
      argile: d.aVerifier > 0,
    },
    {
      cle: "relancer",
      titre: "À relancer",
      icone: MailOpen,
      href: "/admin/ceo?filtre=ouvert",
      valeur: String(d.aRelancer),
      court: String(d.aRelancer),
      detail: d.aRelancer ? `lien${s(d.aRelancer)} ouvert${s(d.aRelancer)} sans signature` : "Aucun lien ouvert sans signature",
    },
    {
      cle: "doleances",
      titre: "Doléances",
      icone: ListTodo,
      href: "/admin/doleances?lecture=non_lues",
      valeur: String(d.nonLues),
      court: String(d.nonLues),
      detail: d.nonLues ? `non lue${s(d.nonLues)}` : "Toutes lues",
    },
    {
      cle: "export",
      titre: "Export du soir",
      icone: Download,
      href: "/admin/ceo/export",
      telechargement: true,
      valeur: exporte ?? "Aucun export",
      court: exporte ? exporte.replace(/^Aujourd'hui à /, "").replace(/^Hier à .*/, "Hier").replace(/ à .*$/, "") : "Aucun",
      detail: "Exporter les signatures",
    },
  ];
}

function Cible({ r, className, children }: { r: Raccourci; className: string; children: ReactNode }) {
  return r.telechargement ? (
    <a href={r.href} download className={className}>
      {children}
    </a>
  ) : (
    <Link href={r.href} className={className}>
      {children}
    </Link>
  );
}

/* id : identifiant unique du titre (la forme cartes peut figurer deux fois dans la page, l'une masquée) */
export function AFaireMaintenant({ donnees, forme, id }: { donnees: AFaire; forme: "cartes" | "compacte"; id: string }) {
  const liste = raccourcis(donnees, new Date());

  if (forme === "compacte") {
    return (
      <section aria-labelledby={id} className="grid gap-0.5">
        <h2 id={id} className="px-3 pb-1 text-[13px] font-medium text-texte-secondaire">
          À faire maintenant
        </h2>
        {liste.map((r) => (
          <Cible
            key={r.cle}
            r={r}
            className="flex min-h-11 items-center gap-2.5 rounded-controle px-3 text-[14px] text-texte-secondaire hover:bg-[rgba(20,33,43,0.05)] hover:text-encre"
          >
            <r.icone aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">{r.titre}</span>
            <span
              className={
                "shrink-0 rounded-md px-1.5 text-[12.5px] font-semibold tabular-nums " +
                (r.argile ? "bg-argile-doux text-[#8E4A27]" : "bg-[#E6E6E3] text-encre")
              }
            >
              {r.court}
            </span>
          </Cible>
        ))}
      </section>
    );
  }

  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="text-[13px] font-medium text-texte-secondaire">
        À faire maintenant
      </h2>
      <div className="grid grid-cols-2 gap-3 min-[820px]:grid-cols-1">
        {liste.map((r) => (
          <Cible
            key={r.cle}
            r={r}
            className={
              "group grid min-h-[116px] content-between gap-2 rounded-[22px] p-4 shadow-douce transition-shadow duration-300 ease-projet hover:shadow-panneau " +
              (r.argile ? "bg-argile-doux text-[#8E4A27]" : "bg-surface text-encre")
            }
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-[13.5px] font-medium">{r.titre}</span>
              <ArrowUpRight aria-hidden="true" className="size-[18px] shrink-0 opacity-60 group-hover:opacity-100" strokeWidth={1.75} />
            </span>
            <span className="grid gap-0.5">
              <span
                className={
                  "font-titre font-light tracking-[-0.01em] tabular-nums " +
                  (r.cle === "export" ? "text-[20px] leading-tight whitespace-pre-line" : "text-[34px] leading-none")
                }
              >
                {/* Export : le jour, puis l'heure à la ligne (« Aujourd'hui » / « à 19 h 59 ») */}
                {r.cle === "export" ? r.valeur.replace(" à ", "\nà ") : r.valeur}
              </span>
              <span className={"text-[12.5px] " + (r.argile ? "" : "text-texte-secondaire")}>{r.detail}</span>
            </span>
          </Cible>
        ))}
      </div>
    </section>
  );
}
