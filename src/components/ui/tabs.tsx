import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export type Onglet = { cle: string; libelle: string; href: string; icone: LucideIcon };

/* Onglets de navigation : chaque onglet est une adresse, l'onglet courant est souligné */
export function Tabs({ onglets, actif, libelle }: { onglets: Onglet[]; actif: string; libelle: string }) {
  return (
    <nav aria-label={libelle} className="mb-4 flex gap-1 overflow-x-auto border-b border-filet [scrollbar-width:none]">
      {onglets.map(({ cle, libelle: texte, href, icone: Icone }) => {
        const courant = cle === actif;
        return (
          <Link
            key={cle}
            href={href}
            aria-current={courant ? "page" : undefined}
            className={
              "inline-flex min-h-11 items-center gap-2 px-3.5 font-medium whitespace-nowrap [&_svg]:size-[18px] " +
              (courant
                ? "text-encre shadow-[inset_0_-2px_0_var(--color-eau)]"
                : "text-texte-secondaire hover:text-encre")
            }
          >
            <Icone aria-hidden="true" strokeWidth={1.75} />
            {texte}
          </Link>
        );
      })}
    </nav>
  );
}
