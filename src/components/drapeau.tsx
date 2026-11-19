import type { CSSProperties } from "react";

/*
  Drapeau du Sénégal (R2), dessiné en SVG, sans image : trois bandes verticales égales (vert #00853F, jaune #FDEF42,
  rouge #E31B23), étoile verte à cinq branches au centre de la bande jaune, proportions 2:3.
  On fixe toujours la largeur (la hauteur suit le ratio) : jamais déformé.
  Jamais sur la page A4, l'annexe, l'accusé ni les PDF (le document suit le modèle Word validé).
  Animations en CSS (globals.css), immobiles si l'utilisateur a demandé des animations réduites.
*/

const VERT = "#00853F";
const JAUNE = "#FDEF42";
const ROUGE = "#E31B23";

/* Étoile à cinq branches, pointe en haut, centrée sur la bande jaune (rayon extérieur : un tiers de la bande) */
const ETOILE = (() => {
  const cx = 450;
  const cy = 300;
  const R = 100;
  const r = R * 0.382;
  const points: string[] = [];
  for (let k = 0; k < 10; k++) {
    const rayon = k % 2 === 0 ? R : r;
    const angle = -Math.PI / 2 + (k * Math.PI) / 5;
    points.push(`${(cx + rayon * Math.cos(angle)).toFixed(2)},${(cy + rayon * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(" ");
})();

function Bandes() {
  return (
    <>
      <rect x="0" y="0" width="300" height="600" fill={VERT} />
      <rect x="300" y="0" width="300" height="600" fill={JAUNE} />
      <rect x="600" y="0" width="300" height="600" fill={ROUGE} />
      <polygon points={ETOILE} fill={VERT} />
    </>
  );
}

/* Drapeau fixe ; largeur en pixels, la hauteur suit (2:3) */
export function Drapeau({ largeur, className = "", flotte = false }: { largeur: number; className?: string; flotte?: boolean }) {
  return (
    <svg
      role="img"
      aria-label="Drapeau du Sénégal"
      viewBox="0 0 900 600"
      width={largeur}
      className={`block h-auto shrink-0 rounded-[2px] ${flotte ? "drapeau-flotte" : ""} ${className}`}
    >
      <Bandes />
    </svg>
  );
}

const TRANCHES = 14;

/*
  Grand drapeau qui ondule : découpé en tranches verticales qui montent et descendent avec un léger décalage,
  pour une vague de gauche à droite (3,2 s en boucle), avec une ombre douce.
  taille : « grande » (120 px sur ordinateur, 96 px sur téléphone) ; la hauteur suit le ratio.
*/
export function DrapeauOndulant({ className = "" }: { className?: string }) {
  return (
    <div role="img" aria-label="Drapeau du Sénégal" className={`drapeau-ondulant w-24 min-[820px]:w-[120px] ${className}`}>
      <div aria-hidden="true" className="drapeau-ondulant-cadre">
        {Array.from({ length: TRANCHES }, (_, i) => (
          <span key={i} className="drapeau-tranche" style={{ "--i": i } as CSSProperties}>
            {/* Chaque tranche montre sa part du drapeau (léger recouvrement : aucun filet entre deux tranches) */}
            <svg viewBox={`${(i * 900) / TRANCHES - 1} 0 ${900 / TRANCHES + 2} 600`} preserveAspectRatio="none" focusable="false">
              <Bandes />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
