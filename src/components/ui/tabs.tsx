import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export type Onglet = {
  cle: string;
  libelle: string;
  href: string;
  icone: LucideIcon;
  /* Nombre affiché à côté du libellé ; « argile » est réservée à « à vérifier » */
  pastille?: { nombre: number; variante: "argile" | "neutre"; titre: string };
};

/* Onglets de navigation : chaque onglet est une adresse, l'onglet courant est souligné */
export function Tabs({ onglets, actif, libelle }: { onglets: Onglet[]; actif: string; libelle: string }) {
  return (
    <nav aria-label={libelle} className="mb-4 flex gap-1 overflow-x-auto border-b border-filet [scrollbar-width:none]">
      {onglets.map(({ cle, libelle: texte, href, icone: Icone, pastille }) => {
        const courant = cle === actif;
        return (
          <Link
            key={cle}
            href={href}
            aria-current={courant ? "page" : undefined}
            className={
              "relative inline-flex min-h-11 items-center gap-2 px-3.5 font-medium whitespace-nowrap [&_svg]:size-[18px] " +
              (courant
                ? "text-encre shadow-[inset_0_-2px_0_var(--color-eau)]"
                : "text-texte-secondaire hover:text-encre")
            }
          >
            <Icone aria-hidden="true" strokeWidth={1.75} />
            {texte}
            {pastille && pastille.nombre > 0 ? (
              <span
                className={
                  "rounded-md px-1.5 text-[12.5px] font-semibold tabular-nums " +
                  (pastille.variante === "argile" ? "bg-argile-doux text-[#8a4724]" : "bg-[#ECECEA] text-encre")
                }
              >
                <span className="sr-only">{pastille.titre} : </span>
                {pastille.nombre}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
