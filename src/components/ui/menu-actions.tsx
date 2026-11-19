"use client";

import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePositionFlottante } from "./position-flottante";

export type ElementMenu =
  | { genre: "action"; libelle: string; icone: LucideIcon; onSelect: () => void; danger?: boolean }
  | { genre: "note"; texte: string };

type Props = {
  /* Nom accessible du bouton qui ouvre le menu */
  libelle: string;
  elements: ElementMenu[];
  /* Contenu du bouton (par défaut, trois points) */
  declencheur?: ReactNode;
  classeDeclencheur?: string;
  /* Contenu affiché en tête du menu (par exemple le nom de l'admin) */
  entete?: ReactNode;
  /* Éléments sous forme de formulaire (Server Action), rendus après les actions */
  pied?: ReactNode;
};

/*
  Menu d'actions rendu dans un portail, en position fixe : jamais coupé par un conteneur,
  ouvert vers le haut s'il manque de place en dessous.
  Clavier : flèches haut et bas, Début, Fin, Échap (retour au bouton), Tab (fermeture).
*/
export function MenuActions({ libelle, elements, declencheur, classeDeclencheur, entete, pied }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const style = usePositionFlottante(ouvert, bouton, menu);

  const fermer = useCallback((rendreFocus: boolean) => {
    setOuvert(false);
    if (rendreFocus) bouton.current?.focus();
  }, []);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!ouvert) return;
    /* Le premier élément reçoit le focus à l'ouverture */
    const premier = requestAnimationFrame(() => items()[0]?.focus());
    const surClic = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (!menu.current?.contains(cible) && !bouton.current?.contains(cible)) fermer(false);
    };
    document.addEventListener("mousedown", surClic);
    return () => {
      cancelAnimationFrame(premier);
      document.removeEventListener("mousedown", surClic);
    };
  }, [ouvert, fermer]);

  const surTouche = (e: KeyboardEvent<HTMLDivElement>) => {
    const liste = items();
    const i = liste.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      fermer(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      liste[(i + 1) % liste.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      liste[(i - 1 + liste.length) % liste.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      liste[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      liste[liste.length - 1]?.focus();
    } else if (e.key === "Tab") {
      fermer(false);
    }
  };

  return (
    <>
      <button
        ref={bouton}
        type="button"
        aria-label={libelle}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOuvert((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !ouvert) {
            e.preventDefault();
            setOuvert(true);
          }
        }}
        className={
          classeDeclencheur ??
          "grid size-11 place-items-center rounded-controle text-texte-secondaire hover:bg-[rgba(20,33,43,0.06)] hover:text-encre"
        }
      >
        {declencheur ?? <MoreHorizontal aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
      </button>
      {ouvert
        ? createPortal(
            <div
              ref={menu}
              id={id}
              role="menu"
              aria-label={libelle}
              style={style}
              onKeyDown={surTouche}
              onClick={(e) => e.stopPropagation()}
              className="z-[70] grid w-[250px] gap-0.5 rounded-controle border border-filet bg-surface p-1.5 shadow-[0_10px_30px_rgba(20,33,43,0.15)]"
            >
              {entete}
              {elements.map((el, k) =>
                el.genre === "note" ? (
                  <p key={k} className="px-2.5 py-2 text-[13px] text-texte-secondaire">
                    {el.texte}
                  </p>
                ) : (
                  <button
                    key={k}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      fermer(false);
                      el.onSelect();
                    }}
                    className={
                      "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-left text-[14px] hover:bg-sureleve focus:bg-sureleve focus:outline-none " +
                      (el.danger ? "text-erreur" : "")
                    }
                  >
                    <el.icone aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
                    {el.libelle}
                  </button>
                ),
              )}
              {pied}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
