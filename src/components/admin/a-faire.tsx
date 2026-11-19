import { Download } from "lucide-react";
import Link from "next/link";

import { quandRelatif } from "@/lib/admin/calculs";
import type { AFaire } from "@/lib/admin/tableau-de-bord";

/*
  « À faire maintenant » (R2) : une seule ligne sur le tableau de bord, sous la ligne d'état, sur ordinateur comme sur
  téléphone. Des pastilles arrondies cliquables, seulement pour ce qui est supérieur à zéro, puis le dernier export.
  « À vérifier » en argile (réservée à « à vérifier ») ; les autres en blanc.
  « À relancer » seulement tant que les signatures sont ouvertes : la file « Relancer un par un » n'existe qu'alors.
*/

const PASTILLE = "inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-medium shadow-douce transition-shadow duration-300 ease-projet hover:shadow-panneau";

export function AFaireMaintenant({ donnees, relanceOuverte }: { donnees: AFaire; relanceOuverte: boolean }) {
  const s = (n: number) => (n > 1 ? "s" : "");
  const pastilles = [
    donnees.aVerifier > 0 && {
      cle: "verifier",
      href: "/admin/ceo?onglet=verifier",
      texte: `${donnees.aVerifier} à vérifier`,
      classe: "bg-argile-doux text-[#8E4A27]",
    },
    relanceOuverte &&
      donnees.aRelancer > 0 && {
        cle: "relancer",
        href: "/admin/ceo?file=relance",
        texte: `${donnees.aRelancer} à relancer`,
        classe: "bg-surface text-encre",
      },
    donnees.nonLues > 0 && {
      cle: "doleances",
      href: "/admin/doleances?lecture=non_lues",
      texte: `${donnees.nonLues} doléance${s(donnees.nonLues)} non lue${s(donnees.nonLues)}`,
      classe: "bg-surface text-encre",
    },
  ].filter((p): p is { cle: string; href: string; texte: string; classe: string } => Boolean(p));

  return (
    <section aria-labelledby="titre-a-faire" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 id="titre-a-faire" className="sr-only">
        À faire maintenant
      </h2>
      {pastilles.length ? (
        <ul className="flex flex-wrap gap-2">
          {pastilles.map((p) => (
            <li key={p.cle}>
              <Link href={p.href} className={`${PASTILLE} ${p.classe}`}>
                {p.texte}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-texte-secondaire">
        <span>{donnees.dernierExport ? `Dernier export : ${quandRelatif(donnees.dernierExport, new Date()).replace(/^(Aujourd|Hier)/, (m) => m.toLowerCase())}` : "Aucun export"}</span>
        <a
          href="/admin/ceo/export"
          download
          className="inline-flex min-h-11 items-center gap-1.5 rounded-controle px-1 font-medium text-eau underline-offset-4 hover:underline"
        >
          <Download aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Exporter les signatures
        </a>
      </p>
    </section>
  );
}
