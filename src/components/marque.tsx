import { Droplets } from "lucide-react";

/*
  Marque de la plateforme (admin et espace CEO) : pavé du logo aligné en haut, « Manifeste » en Fraunces,
  et dessous le nom complet, jamais tronqué ni raccourci. La coupure se fait toujours au même endroit :
  « Secteur privé sénégalais » / « de l'eau et de l'assainissement ».
  deuxLignes : coupure imposée (barre latérale de l'admin) ; sinon, coupure seulement si la largeur l'exige.
*/
export function Marque({ deuxLignes = false, taille = "normale" }: { deuxLignes?: boolean; taille?: "normale" | "compacte" }) {
  const morceau = deuxLignes ? "block whitespace-nowrap" : "inline-block";
  return (
    <span className="flex min-w-0 items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-eau text-white">
        <Droplets aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </span>
      <span className={"min-w-0 font-titre leading-[1.1] " + (taille === "compacte" ? "text-[16px]" : "text-[18px]")}>
        Manifeste
        <span className="mt-0.5 block font-interface text-[12px] leading-[1.3] text-texte-secondaire">
          <span className={morceau}>Secteur privé sénégalais</span> <span className={morceau}>de l&apos;eau et de l&apos;assainissement</span>
        </span>
      </span>
    </span>
  );
}
