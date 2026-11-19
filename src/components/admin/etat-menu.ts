"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

import { CLE_APPARITION, CLE_MENU } from "@/lib/menu-admin";

/*
  Menu de l'admin réductible (R2). L'état vit sur <html data-menu="reduit"> : le CSS règle la largeur du panneau,
  sans attendre React. Un petit script du layout racine l'applique avant le premier affichage (aucun saut au chargement) ;
  après une navigation côté client (connexion), useAppliquerMenu le rattrape avant l'affichage.
  Choix mémorisé dans le navigateur (localStorage), lecture et écriture protégées. Par défaut : déployé.
  Apparition douce une fois par session de navigation : <html data-apparition>, retiré après l'animation.
*/

const EVENEMENT = "manifeste-menu-admin";

function lireReduit(): boolean {
  return document.documentElement.dataset.menu === "reduit";
}

function abonner(rappel: () => void): () => void {
  window.addEventListener(EVENEMENT, rappel);
  return () => window.removeEventListener(EVENEMENT, rappel);
}

export function useMenuReduit(): boolean {
  return useSyncExternalStore(abonner, lireReduit, () => false);
}

export function basculerMenu(): void {
  const reduit = !lireReduit();
  if (reduit) document.documentElement.dataset.menu = "reduit";
  else delete document.documentElement.dataset.menu;
  try {
    localStorage.setItem(CLE_MENU, reduit ? "reduit" : "deploye");
  } catch {
    /* Stockage indisponible (navigation privée) : le choix vaut pour cette page seulement */
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

/* À l'arrivée dans l'admin : état mémorisé et apparition, avant l'affichage ; l'apparition ne joue qu'une fois par session */
export function useAppliquerMenu(): void {
  useLayoutEffect(() => {
    const racine = document.documentElement;
    let premiere = false;
    try {
      if (localStorage.getItem(CLE_MENU) === "reduit") racine.dataset.menu = "reduit";
      premiere = !sessionStorage.getItem(CLE_APPARITION);
      sessionStorage.setItem(CLE_APPARITION, "1");
    } catch {
      premiere = false;
    }
    window.dispatchEvent(new Event(EVENEMENT));
    if (!premiere) {
      delete racine.dataset.apparition;
      return;
    }
    racine.dataset.apparition = "1";
    const fin = window.setTimeout(() => delete racine.dataset.apparition, 1600);
    return () => window.clearTimeout(fin);
  }, []);
}
