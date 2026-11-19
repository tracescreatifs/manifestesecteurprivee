"use client";

import type { CSSProperties } from "react";

import { Marque } from "@/components/marque";

import { useAppliquerMenu } from "./etat-menu";
import { MenuAdmin } from "./menu-admin";
import { BoutonRecherche, BoutonReduire, LienJournal, NavLaterale } from "./navigation";

/*
  Panneau de l'admin sur ordinateur (R2) : une colonne de 260 px (marque, recherche, navigation avec pastilles,
  puis « Réduire le menu », Journal et compte), réductible en barre d'icônes de 92 px.
  La largeur suit <html data-menu> (globals.css) ; les libellés disparaissent en fondu, les icônes ne bougent pas.
*/
export function PanneauAdmin({
  aVerifier,
  nonLues,
  compte,
}: {
  aVerifier: number;
  nonLues: number;
  compte: { prenom: string; nom: string; email: string };
}) {
  useAppliquerMenu();
  return (
    <div id="panneau-admin" className="flex h-full w-full min-w-0 flex-col gap-3 overflow-x-hidden overflow-y-auto p-4">
      <div className="entree-menu min-w-0 overflow-hidden pt-1 pb-2 pl-[14px]" style={{ "--rang": 0 } as CSSProperties}>
        <Marque deuxLignes classeTexte="menu-texte" />
      </div>
      <BoutonRecherche />
      <NavLaterale aVerifier={aVerifier} nonLues={nonLues} />
      <div className="mt-auto grid min-w-0 gap-1 border-t border-filet pt-3">
        <BoutonReduire />
        <LienJournal />
        <div className="entree-menu" style={{ "--rang": 10 } as CSSProperties}>
          <MenuAdmin {...compte} bloc />
        </div>
      </div>
    </div>
  );
}
