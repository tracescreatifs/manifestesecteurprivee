"use client";

import {
  FileDown,
  FileText,
  History,
  LayoutDashboard,
  ListTodo,
  MoreHorizontal,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MenuActions } from "@/components/ui/menu-actions";

/* Rubriques de l'espace admin (prototype 1-admin.html), précédées du tableau de bord (R1) */
type Rubrique = { href: string; libelle: string; court: string; icone: LucideIcon };

const TABLEAU: Rubrique = { href: "/admin", libelle: "Tableau de bord", court: "Accueil", icone: LayoutDashboard };
const TEXTE: Rubrique = { href: "/admin/texte", libelle: "Texte", court: "Texte", icone: FileText };
const CEO: Rubrique = { href: "/admin/ceo", libelle: "CEO", court: "CEO", icone: Users };
const DOLEANCES: Rubrique = { href: "/admin/doleances", libelle: "Doléances", court: "Doléances", icone: ListTodo };
const DOCUMENT: Rubrique = { href: "/admin/document", libelle: "Document A4", court: "Document A4", icone: FileDown };
const REGLAGES: Rubrique = { href: "/admin/reglages", libelle: "Réglages", court: "Réglages", icone: Settings };
const JOURNAL: Rubrique = { href: "/admin/reglages?onglet=journal", libelle: "Journal", court: "Journal", icone: History };

const RUBRIQUES = [TABLEAU, TEXTE, CEO, DOLEANCES, DOCUMENT, REGLAGES];
/* Téléphone : quatre entrées et « Plus » (Document A4, Réglages, Journal) */
const BASSES = [TABLEAU, TEXTE, CEO, DOLEANCES];
const PLUS = [DOCUMENT, REGLAGES, JOURNAL];

type Compteurs = { aVerifier: number; nonLues: number };

/* Rubrique courante : le tableau de bord seulement sur /admin ; le journal est un onglet des Réglages */
function useCourante(): (r: Rubrique) => boolean {
  const chemin = usePathname();
  const onglet = useSearchParams().get("onglet");
  const journal = chemin.startsWith("/admin/reglages") && onglet === "journal";
  return (r) => {
    if (r === TABLEAU) return chemin === "/admin";
    if (r === JOURNAL) return journal;
    if (r === REGLAGES) return chemin.startsWith(r.href) && !journal;
    return chemin.startsWith(r.href);
  };
}

/*
  Pastille à côté d'une rubrique : signatures à vérifier à côté de « CEO » (argile : réservée à « à vérifier »),
  doléances non lues à côté de « Doléances » (neutre, comme les nouveaux commentaires, D92)
*/
function Pastille({ href, compteurs, compacte = false }: { href: string; compteurs: Compteurs; compacte?: boolean }) {
  const ceo = href === CEO.href;
  const nombre = ceo ? compteurs.aVerifier : href === DOLEANCES.href ? compteurs.nonLues : 0;
  if (!nombre) return null;
  return (
    <span
      className={
        "rounded-md font-semibold tabular-nums " +
        (ceo ? "bg-argile-doux text-[#8E4A27] " : "bg-[#E6E6E3] text-encre ") +
        (compacte ? "absolute -top-0.5 right-1 px-1 text-[10.5px] leading-4" : "ml-auto px-1.5 text-[12.5px]")
      }
    >
      <span className="sr-only">{ceo ? "À vérifier : " : "Non lues : "}</span>
      {nombre}
    </span>
  );
}

const ENTREE = "flex min-h-11 items-center gap-2.5 rounded-controle px-3 font-medium";
const ENTREE_COURANTE = "bg-surface text-encre shadow-douce";
const ENTREE_AUTRE = "text-texte-secondaire hover:bg-[rgba(20,33,43,0.05)] hover:text-encre";

/* Panneau latéral (ordinateur) : rubriques, l'entrée courante en carte blanche */
export function NavLaterale(compteurs: Compteurs) {
  const courante = useCourante();
  return (
    <nav aria-label="Navigation" className="grid gap-0.5">
      {RUBRIQUES.map((r) => {
        const actif = courante(r);
        return (
          <Link
            key={r.href}
            href={r.href}
            aria-current={actif ? "page" : undefined}
            className={`${ENTREE} ${actif ? ENTREE_COURANTE : ENTREE_AUTRE}`}
          >
            <r.icone aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
            {r.libelle}
            <Pastille href={r.href} compteurs={compteurs} />
          </Link>
        );
      })}
    </nav>
  );
}

/* Lien « Journal », en bas du panneau latéral */
export function LienJournal() {
  const actif = useCourante()(JOURNAL);
  return (
    <Link href={JOURNAL.href} aria-current={actif ? "page" : undefined} className={`${ENTREE} ${actif ? ENTREE_COURANTE : ENTREE_AUTRE}`}>
      <History aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
      Journal
    </Link>
  );
}

const BASSE = "relative grid min-h-11 min-w-0 flex-1 justify-items-center gap-0.5 rounded-rangee px-1 py-1.5 text-[11px]";

/* Barre basse (téléphone) : flottante, arrondie, en verre dépoli, au-dessus de la zone sûre */
export function NavBasse(compteurs: Compteurs) {
  const courante = useCourante();
  const router = useRouter();
  const plusActif = PLUS.some(courante);
  return (
    <nav
      aria-label="Navigation"
      className={
        "fixed inset-x-3 bottom-[calc(8px+env(safe-area-inset-bottom))] z-25 flex gap-0.5 rounded-[22px] border border-white/70 bg-white/92 p-1 shadow-panneau min-[820px]:hidden " +
        "supports-[backdrop-filter]:bg-white/70 supports-[backdrop-filter]:backdrop-blur-[16px] supports-[backdrop-filter]:backdrop-saturate-[1.6]"
      }
    >
      {BASSES.map((r) => {
        const actif = courante(r);
        return (
          <Link
            key={r.href}
            href={r.href}
            aria-current={actif ? "page" : undefined}
            className={`${BASSE} ${actif ? "bg-surface font-semibold text-encre shadow-douce" : "text-texte-secondaire"}`}
          >
            <r.icone aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            <span className="max-w-full truncate">{r.court}</span>
            <Pastille href={r.href} compteurs={compteurs} compacte />
          </Link>
        );
      })}
      <div className="flex min-w-0 flex-1">
        <MenuActions
          libelle="Plus de rubriques"
          classeDeclencheur={`${BASSE} w-full ${plusActif ? "bg-surface font-semibold text-encre shadow-douce" : "text-texte-secondaire"}`}
          declencheur={
            <>
              <MoreHorizontal aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              <span>Plus</span>
            </>
          }
          elements={PLUS.map((r) => ({
            genre: "action" as const,
            libelle: r.libelle,
            icone: r.icone,
            onSelect: () => router.push(r.href),
          }))}
        />
      </div>
    </nav>
  );
}
