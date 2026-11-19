"use client";

import {
  FileDown,
  FileText,
  History,
  LayoutDashboard,
  ListTodo,
  MoreHorizontal,
  PanelLeft,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { MenuActions } from "@/components/ui/menu-actions";

import { basculerMenu, useMenuReduit } from "./etat-menu";
import { ouvrirRecherche } from "./recherche-admin";

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
/* Téléphone : quatre entrées et « Plus » (Document A4, Réglages, Journal, Rechercher) */
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

function nombrePour(href: string, c: Compteurs): number {
  return href === CEO.href ? c.aVerifier : href === DOLEANCES.href ? c.nonLues : 0;
}

/*
  Pastille à côté d'une rubrique : signatures à vérifier à côté de « CEO » (argile : réservée à « à vérifier »),
  doléances non lues à côté de « Doléances » (neutre, D92).
  forme « ligne » : à droite du libellé (menu déployé, disparaît en fondu quand le menu est réduit) ;
  « icone » : petite, sur l'icône (menu réduit seulement, et barre basse du téléphone).
*/
function Pastille({ href, compteurs, forme }: { href: string; compteurs: Compteurs; forme: "ligne" | "icone" | "basse" }) {
  const nombre = nombrePour(href, compteurs);
  if (!nombre) return null;
  const ceo = href === CEO.href;
  const couleur = ceo ? "bg-argile-doux text-[#8E4A27] " : "bg-[#E6E6E3] text-encre ";
  if (forme === "ligne") {
    return (
      <span className={"menu-texte ml-auto rounded-md px-1.5 text-[12.5px] font-semibold tabular-nums " + couleur}>
        <span className="sr-only">{ceo ? "À vérifier : " : "Non lues : "}</span>
        {nombre}
      </span>
    );
  }
  return (
    <span
      aria-hidden={forme === "icone" ? true : undefined}
      className={
        "rounded-md px-1 text-[10.5px] leading-4 font-semibold tabular-nums " +
        couleur +
        (forme === "icone" ? "menu-pastille-icone absolute -top-2 -right-3" : "absolute -top-0.5 right-1")
      }
    >
      {forme === "basse" ? <span className="sr-only">{ceo ? "À vérifier : " : "Non lues : "}</span> : null}
      {nombre}
    </span>
  );
}

/*
  Info-bulle des entrées du menu réduit : le libellé à droite de l'icône, au survol et au focus, dans un portail
  (jamais coupée par le panneau). Échap la masque. Le nom accessible reste celui de l'entrée (bulle masquée aux lecteurs d'écran).
*/
export function AvecBulle({ texte, children }: { texte: string; children: ReactNode }) {
  const reduit = useMenuReduit();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const montrer = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPosition({ x: r.right + 10, y: r.top + r.height / 2 });
  };
  return (
    <div
      className="min-w-0"
      onMouseEnter={(e) => montrer(e.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocus={(e) => montrer(e.currentTarget)}
      onBlur={() => setPosition(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setPosition(null);
      }}
    >
      {children}
      {reduit && position
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[70] -translate-y-1/2 rounded-md bg-encre px-2.5 py-1.5 text-[13px] whitespace-nowrap text-white shadow-douce"
              style={{ left: position.x, top: position.y }}
            >
              {texte}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/* Entrée du panneau : icône fixe (centrée dans le menu réduit), libellé qui disparaît en fondu */
const ENTREE = "relative flex min-h-11 items-center gap-3 overflow-hidden rounded-controle pr-3 pl-[21px] font-medium";
const ENTREE_COURANTE = "bg-surface text-encre shadow-douce";
const ENTREE_AUTRE = "text-texte-secondaire hover:bg-[rgba(20,33,43,0.05)] hover:text-encre";

/* Rang d'apparition (première ouverture de la session) : marque 0, recherche 1, rubriques 2 à 7, bas du panneau 8 à 10 */
const rang = (n: number) => ({ "--rang": n }) as CSSProperties;

export function NavLaterale(compteurs: Compteurs) {
  const courante = useCourante();
  return (
    <nav aria-label="Navigation" className="grid min-w-0 gap-0.5">
      {RUBRIQUES.map((r, i) => {
        const actif = courante(r);
        return (
          <AvecBulle key={r.href} texte={r.libelle}>
            <Link
              href={r.href}
              aria-current={actif ? "page" : undefined}
              style={rang(i + 2)}
              className={`entree-menu ${ENTREE} ${actif ? ENTREE_COURANTE : ENTREE_AUTRE}`}
            >
              <span className="relative shrink-0">
                <r.icone aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
                <Pastille href={r.href} compteurs={compteurs} forme="icone" />
              </span>
              <span className="menu-texte">{r.libelle}</span>
              <Pastille href={r.href} compteurs={compteurs} forme="ligne" />
            </Link>
          </AvecBulle>
        );
      })}
    </nav>
  );
}

/* Lien « Journal », en bas du panneau */
export function LienJournal() {
  const actif = useCourante()(JOURNAL);
  return (
    <AvecBulle texte="Journal">
      <Link
        href={JOURNAL.href}
        aria-current={actif ? "page" : undefined}
        style={rang(9)}
        className={`entree-menu ${ENTREE} ${actif ? ENTREE_COURANTE : ENTREE_AUTRE}`}
      >
        <History aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
        <span className="menu-texte">Journal</span>
      </Link>
    </AvecBulle>
  );
}

/* « Réduire le menu » ou « Déployer le menu » (44 px, aria-expanded) */
export function BoutonReduire() {
  const reduit = useMenuReduit();
  const libelle = reduit ? "Déployer le menu" : "Réduire le menu";
  return (
    <AvecBulle texte={libelle}>
      <button
        type="button"
        onClick={basculerMenu}
        aria-expanded={!reduit}
        aria-controls="panneau-admin"
        style={rang(8)}
        className={`entree-menu w-full ${ENTREE} ${ENTREE_AUTRE}`}
      >
        <PanelLeft aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
        <span className="menu-texte">{libelle}</span>
      </button>
    </AvecBulle>
  );
}

/* Raccourci affiché : ⌘ K sur Mac, Ctrl K ailleurs (lu après l'hydratation) */
const estMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/* Champ de recherche du panneau : ouvre la recherche (Ctrl ou Cmd + K) ; menu réduit : l'icône seule */
export function BoutonRecherche() {
  const mac = useSyncExternalStore(
    () => () => undefined,
    estMac,
    () => false,
  );
  return (
    <AvecBulle texte="Rechercher">
      <button
        type="button"
        onClick={ouvrirRecherche}
        aria-haspopup="dialog"
        aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
        style={rang(1)}
        className="entree-menu relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-controle border border-filet bg-surface pr-2.5 pl-[20px] text-[14.5px] text-texte-secondaire hover:border-filet-fort hover:text-encre"
      >
        <Search aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
        <span className="menu-texte">Rechercher</span>
        <kbd aria-hidden="true" className="menu-texte ml-auto rounded-md border border-filet bg-fond-admin px-1.5 font-interface text-[11.5px] text-texte-secondaire">
          {mac ? "⌘ K" : "Ctrl K"}
        </kbd>
      </button>
    </AvecBulle>
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
            <Pastille href={r.href} compteurs={compteurs} forme="basse" />
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
          elements={[
            ...PLUS.map((r) => ({
              genre: "action" as const,
              libelle: r.libelle,
              icone: r.icone,
              onSelect: () => router.push(r.href),
            })),
            { genre: "action" as const, libelle: "Rechercher", icone: Search, onSelect: ouvrirRecherche },
          ]}
        />
      </div>
    </nav>
  );
}
