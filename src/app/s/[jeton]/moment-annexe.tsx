"use client";

import { useLayoutEffect, useRef } from "react";

import { SignatureSvg, traceSure } from "@/components/document/signature";
import { trierAnnexe, type LigneAnnexeA4 } from "@/lib/signature/annexe";
import type { TraceSignature } from "@/types/database";

/*
  Le moment fort : la ligne du CEO s'inscrit dans l'annexe, entre ses voisins (ordre de l'annexe),
  puis sa signature se trace à l'encre en une seconde environ, avec la courbe du projet.
  Animations réduites : la ligne et la signature sont affichées tout de suite (globals.css).
*/

function TraceEncre({ trace }: { trace: TraceSignature }) {
  const svg = useRef<SVGSVGElement>(null);
  const sure = traceSure(trace);

  useLayoutEffect(() => {
    const chemins = svg.current?.querySelectorAll("path") ?? [];
    const total = Array.from(chemins).reduce((n, p) => n + p.getTotalLength(), 0) || 1;
    let debut = 0.45;
    chemins.forEach((p) => {
      const longueur = Math.ceil(p.getTotalLength());
      const duree = Math.max(0.15, (longueur / total) * 1);
      p.style.setProperty("--longueur", String(longueur));
      p.style.animationDelay = `${debut}s`;
      p.style.animationDuration = `${duree}s`;
      debut += duree;
    });
  }, []);

  if (!sure) return null;
  return (
    <svg ref={svg} className="trace-encre block h-full w-full" viewBox={sure.vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Votre signature">
      {sure.d.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#14212B" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export function MomentAnnexe({
  autres,
  moi,
  enAttente,
}: {
  autres: LigneAnnexeA4[];
  moi: LigneAnnexeA4;
  enAttente: boolean;
}) {
  const liste = trierAnnexe([...autres, moi], "entreprise");
  const i = liste.indexOf(moi);
  const lignes = [liste[i - 1], moi, liste[i + 1]].filter((l): l is LigneAnnexeA4 => Boolean(l));

  return (
    <div
      aria-label="Votre ligne dans l'annexe du Manifeste"
      role="group"
      className="w-full rounded-md bg-white px-4 pt-4 pb-2 text-left font-doc-sans text-doc-texte shadow-[0_1px_2px_rgba(20,33,43,0.06),0_12px_32px_rgba(20,33,43,0.10)] min-[760px]:px-6 min-[760px]:pt-5 min-[760px]:pb-3"
    >
      <div className="flex items-baseline justify-between gap-2 border-b-2 border-doc-or pb-3 font-doc-serif text-[15px] text-doc-vert">
        <span>Annexe · Les signataires</span>
        {enAttente ? <span className="font-doc-sans text-[11px] text-[#8a4724]">En attente de vérification</span> : null}
      </div>
      {lignes.map((l) => {
        const estMoi = l === moi;
        const contenu = (
          <div className={"grid grid-cols-[1fr_1fr_1.1fr] items-center gap-2 py-2 " + (estMoi ? "" : "opacity-40")}>
            <div className="min-w-0">
              <b className="block text-[12px] font-bold [overflow-wrap:anywhere] text-[#14201B] min-[760px]:text-[13px]">{l.entreprise}</b>
              <span className="block text-[11px] text-doc-gris">{l.maillon}</span>
            </div>
            <div className="min-w-0">
              <b className="block text-[12px] font-bold [overflow-wrap:anywhere] text-[#14201B] min-[760px]:text-[13px]">
                {l.prenom} {l.nom}
              </b>
              <span className="block text-[11px] text-doc-gris">{l.fonction}</span>
            </div>
            <div className="h-11 min-[760px]:h-[52px]">
              {l.trace ? estMoi ? <TraceEncre trace={l.trace} /> : <SignatureSvg trace={l.trace} className="h-full" /> : null}
            </div>
          </div>
        );
        return estMoi ? (
          <div key={l.cle} className="ligne-inscrite border-b border-doc-filet last:border-b-0">
            {contenu}
          </div>
        ) : (
          <div key={l.cle} className="border-b border-doc-filet last:border-b-0">
            {contenu}
          </div>
        );
      })}
    </div>
  );
}
