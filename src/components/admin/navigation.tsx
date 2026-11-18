"use client";

import { FileDown, FileText, ListTodo, Settings, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* Rubriques de l'espace admin (prototype 1-admin.html) */
const RUBRIQUES: { href: string; libelle: string; court: string; icone: LucideIcon }[] = [
  { href: "/admin/texte", libelle: "Texte", court: "Texte", icone: FileText },
  { href: "/admin/ceo", libelle: "CEO", court: "CEO", icone: Users },
  { href: "/admin/doleances", libelle: "Doléances", court: "Doléances", icone: ListTodo },
  { href: "/admin/document", libelle: "Document A4", court: "A4", icone: FileDown },
  { href: "/admin/reglages", libelle: "Réglages", court: "Réglages", icone: Settings },
];

type Compteurs = { aVerifier: number; nonLues: number };

/*
  Pastille à côté d'une rubrique : signatures à vérifier à côté de « CEO » (argile : réservée à « à vérifier »),
  doléances non lues à côté de « Doléances » (neutre, comme les nouveaux commentaires, D92)
*/
function Pastille({ href, compteurs, compacte = false }: { href: string; compteurs: Compteurs; compacte?: boolean }) {
  const ceo = href === "/admin/ceo";
  const nombre = ceo ? compteurs.aVerifier : href === "/admin/doleances" ? compteurs.nonLues : 0;
  if (!nombre) return null;
  return (
    <span
      className={
        "rounded-md font-semibold tabular-nums " +
        (ceo ? "bg-argile-doux text-[#8a4724] " : "bg-[#E6E6E3] text-encre ") +
        (compacte ? "absolute -top-0.5 right-1 px-1 text-[10.5px] leading-4" : "ml-auto px-1.5 text-[12.5px]")
      }
    >
      <span className="sr-only">{ceo ? "À vérifier : " : "Non lues : "}</span>
      {nombre}
    </span>
  );
}

/* Barre latérale (ordinateur) */
export function NavLaterale(compteurs: Compteurs) {
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
            <Pastille href={href} compteurs={compteurs} />
          </Link>
        );
      })}
    </nav>
  );
}

/* Barre basse (téléphone), en verre dépoli */
export function NavBasse(compteurs: Compteurs) {
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
              "relative grid min-h-11 min-w-16 justify-items-center gap-0.5 px-2 py-1 text-[11px] " +
              (courant ? "font-semibold text-encre" : "text-texte-secondaire")
            }
          >
            <Icone aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            <span>{court}</span>
            <Pastille href={href} compteurs={compteurs} compacte />
          </Link>
        );
      })}
    </nav>
  );
}
