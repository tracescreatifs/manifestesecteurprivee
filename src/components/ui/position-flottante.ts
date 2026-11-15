"use client";

import { useLayoutEffect, type CSSProperties, type RefObject } from "react";

const MARGE = 8;
const ECART = 4;

/* Écrit la position calculée sur l'élément flottant (hors de React : aucun nouveau rendu) */
function appliquer(element: HTMLElement, top: number, left: number) {
  element.style.top = `${top}px`;
  element.style.left = `${left}px`;
  element.style.visibility = "visible";
}

/* Style de départ : invisible tant que la position n'est pas calculée */
const STYLE_INITIAL: CSSProperties = { position: "fixed", top: 0, left: 0, visibility: "hidden" };

/*
  Position d'un élément flottant (menu, infobulle) rendu dans un portail, en position fixe :
  il n'est donc coupé par aucun conteneur. Il s'ouvre sous le déclencheur, ou au-dessus
  s'il n'y a pas la place en dessous, et reste dans l'écran.
  La position est écrite directement sur l'élément, puis recalculée au défilement
  et au redimensionnement de la fenêtre.
*/
export function usePositionFlottante(
  ouvert: boolean,
  declencheur: RefObject<HTMLElement | null>,
  flottant: RefObject<HTMLElement | null>,
  alignement: "fin" | "centre" = "fin",
  preference: "dessous" | "dessus" = "dessous",
): CSSProperties {
  useLayoutEffect(() => {
    if (!ouvert) return;

    const placer = () => {
      const d = declencheur.current?.getBoundingClientRect();
      const f = flottant.current;
      if (!d || !f) return;
      const largeur = f.offsetWidth;
      const hauteur = f.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const placeDessous = vh - d.bottom - ECART - MARGE;
      const placeDessus = d.top - ECART - MARGE;
      const dessus =
        preference === "dessus"
          ? placeDessus >= hauteur || placeDessus > placeDessous
          : hauteur > placeDessous && placeDessus > placeDessous;

      let top = dessus ? d.top - ECART - hauteur : d.bottom + ECART;
      top = Math.max(MARGE, Math.min(top, vh - hauteur - MARGE));

      let left = alignement === "fin" ? d.right - largeur : d.left + d.width / 2 - largeur / 2;
      left = Math.max(MARGE, Math.min(left, vw - largeur - MARGE));

      appliquer(f, top, left);
    };

    placer();
    window.addEventListener("resize", placer);
    window.addEventListener("scroll", placer, true);
    return () => {
      window.removeEventListener("resize", placer);
      window.removeEventListener("scroll", placer, true);
    };
  }, [ouvert, declencheur, flottant, alignement, preference]);

  return STYLE_INITIAL;
}
