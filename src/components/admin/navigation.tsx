"use client";

import { FileText, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* Rubriques de l'espace admin. CEO, Doléances et Document A4 arriveront avec leurs prompts. */
const RUBRIQUES: { href: string; libelle: string; court: string; icone: LucideIcon }[] = [
  { href: "/admin/texte", libelle: "Texte", court: "Texte", icone: FileText },
  { href: "/admin/reglages", libelle: "Réglages", court: "Réglages", icone: Settings },
];

/* Barre latérale (ordinateur) */
export function NavLaterale() {
  const chemin = usePathname();
  return (
    <nav aria-label="Navigation" className="grid gap-0.5">
      {RUBRIQUES.map(({ href, libelle, icone: Icone }) => {
        const courant = chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={courant ? "page" : undefined}
            className={
              "flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 font-medium " +
              (courant
                ? "bg-surface text-encre shadow-[0_0_0_1px_var(--color-filet)]"
                : "text-texte-secondaire hover:bg-[rgba(20,33,43,0.05)] hover:text-encre")
            }
          >
            <Icone aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}

/* Barre basse (téléphone), en verre dépoli */
export function NavBasse() {
  const chemin = usePathname();
  return (
    <nav
      aria-label="Navigation"
      className={
        "fixed inset-x-0 bottom-0 z-25 flex justify-around border-t border-filet bg-white/92 px-1 pt-1.5 " +
        "pb-[calc(6px+env(safe-area-inset-bottom))] min-[820px]:hidden " +
        "supports-[backdrop-filter]:bg-white/68 supports-[backdrop-filter]:backdrop-blur-[16px] supports-[backdrop-filter]:backdrop-saturate-[1.6]"
      }
    >
      {RUBRIQUES.map(({ href, court, icone: Icone }) => {
        const courant = chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={courant ? "page" : undefined}
            className={
              "grid min-h-11 min-w-16 justify-items-center gap-0.5 px-2 py-1 text-[11px] " +
              (courant ? "font-semibold text-encre" : "text-texte-secondaire")
            }
          >
            <Icone aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            <span>{court}</span>
          </Link>
        );
      })}
    </nav>
  );
}
