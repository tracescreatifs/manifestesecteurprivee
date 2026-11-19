import { Droplets } from "lucide-react";

import { Drapeau } from "./drapeau";

/*
  Marque de la plateforme (admin et espace CEO) : pavé du logo aligné en haut, « Manifeste » en Fraunces
  suivi du petit drapeau du Sénégal qui flotte (R2), et dessous le nom complet, jamais tronqué ni raccourci.
  La coupure se fait toujours au même endroit : « Secteur privé sénégalais » / « de l'eau et de l'assainissement ».
  deuxLignes : coupure imposée (panneau de l'admin) ; sinon, coupure seulement si la largeur l'exige.
  classeTexte : classe du bloc de texte (le menu réduit de l'admin le fait disparaître en fondu, le pavé reste).
*/
export function Marque({
  deuxLignes = false,
  taille = "normale",
  classeTexte = "",
}: {
  deuxLignes?: boolean;
  taille?: "normale" | "compacte";
  classeTexte?: string;
}) {
  const morceau = deuxLignes ? "block whitespace-nowrap" : "inline-block";
  return (
    <span className="flex min-w-0 items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-eau text-white">
        <Droplets aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </span>
      <span className={"min-w-0 font-titre leading-[1.1] " + (taille === "compacte" ? "text-[16px] " : "text-[18px] ") + classeTexte}>
        <span className="flex items-center gap-2">
          Manifeste
          <Drapeau largeur={27} flotte />
        </span>
        <span className="mt-0.5 block font-interface text-[12px] leading-[1.3] text-texte-secondaire">
          <span className={morceau}>Secteur privé sénégalais</span> <span className={morceau}>de l&apos;eau et de l&apos;assainissement</span>
        </span>
      </span>
    </span>
  );
}
