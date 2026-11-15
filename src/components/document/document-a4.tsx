"use client";

import { FileText } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { htmlSur } from "@/lib/texte/html";
import { numerosDesPoints } from "@/lib/texte/comparer";
import type { Bloc } from "@/types/database";

/*
  Rendu du texte en pages A4, identique au prototype 1-admin.html.
  - Unités relatives à la largeur de la page (cqw) : le rendu est le même à toute taille.
  - Pagination : le texte est mesuré dans un conteneur caché de 800 px de large,
    puis réparti page par page ; un intertitre n'est jamais laissé seul en bas de page.
  Composant partagé : rubrique Texte (admin), espace CEO et document final.
  Ce composant ne rend que les pages de texte (l'annexe viendra avec les signatures).
*/

const PIED = "Manifeste du secteur privé sénégalais de l'eau et de l'assainissement";
const LARGEUR_MESURE = 800;
const HAUTEUR_MESURE = (LARGEUR_MESURE * 297) / 210;

type Props = {
  titre: string;
  sousTitre: string;
  blocs: Bloc[];
  /* En rédaction : mention « Proposition de texte » en tête et en pied de page */
  brouillon: boolean;
  /* Texte affiché avant le nombre de pages, par exemple « Version 3 » */
  libelle?: string;
};

type Zoom = "100" | "125" | "150";

function Entete({ titre, sousTitre, brouillon }: { titre: string; sousTitre: string; brouillon: boolean }) {
  const lignes = titre.split("\n");
  return (
    <>
      {brouillon ? <div className="d-kicker">Proposition de texte · À valider par les CEO</div> : null}
      <h2 className="d-title">
        {lignes.map((ligne, i) => (
          <span key={i}>
            {i > 0 ? <br /> : null}
            {ligne}
          </span>
        ))}
      </h2>
      <div className="d-sub">{sousTitre}</div>
      <div className="d-rule" />
    </>
  );
}

function BlocA4({ bloc, numero }: { bloc: Bloc; numero: number | null }) {
  return (
    <div className={`a4-blk ${bloc.type}`}>
      {bloc.type === "li" ? <span className="num">{numero}.</span> : null}
      <p className="txt" dangerouslySetInnerHTML={{ __html: htmlSur(bloc.html) }} />
    </div>
  );
}

export function DocumentA4({ titre, sousTitre, blocs, brouillon, libelle }: Props) {
  const mesure = useRef<HTMLDivElement>(null);
  /* Pagination, liée aux blocs pour lesquels elle a été calculée */
  const [mise, setMise] = useState<{ pour: Bloc[]; pages: number[][] } | null>(null);
  const [zoom, setZoom] = useState<Zoom>("100");
  const numeros = useMemo(() => numerosDesPoints(blocs), [blocs]);
  const pied = `${PIED}${brouillon ? " · Proposition" : ""}`;

  /* Répartition des blocs dans les pages (algorithme du prototype) */
  const paginer = useCallback(() => {
    const hote = mesure.current;
    if (!hote) return;
    const corps = hote.querySelector<HTMLElement>(".a4-body");
    const colonne = hote.querySelector<HTMLElement>("[data-colonne]");
    if (!corps || !colonne) return;

    const capacite = corps.clientHeight;
    const haut = corps.getBoundingClientRect().top;
    const hauteurEntete = colonne.getBoundingClientRect().top - haut;
    const tops = Array.from(colonne.children).map((e) => e.getBoundingClientRect().top);
    const hauteurs = blocs.map((_, i) => tops[i + 1] - tops[i]);

    const resultat: number[][] = [[]];
    let utilise = hauteurEntete;
    blocs.forEach((_, i) => {
      if (utilise + hauteurs[i] > capacite + 0.5 && resultat[resultat.length - 1].length) {
        resultat.push([]);
        utilise = 0;
      }
      resultat[resultat.length - 1].push(i);
      utilise += hauteurs[i];
    });
    /* Aucun intertitre seul en bas de page : il passe en tête de la page suivante */
    for (let p = 0; p < resultat.length - 1; p++) {
      const page = resultat[p];
      while (page.length > 1 && blocs[page[page.length - 1]].type === "h") {
        resultat[p + 1].unshift(page.pop() as number);
      }
    }
    setMise({ pour: blocs, pages: resultat });
  }, [blocs]);

  useLayoutEffect(() => {
    paginer();
    /* Nouvelle mesure quand les polices du document sont chargées */
    const polices = document.fonts;
    let actif = true;
    polices?.ready.then(() => actif && paginer());
    const surChargement = () => paginer();
    polices?.addEventListener?.("loadingdone", surChargement);
    return () => {
      actif = false;
      polices?.removeEventListener?.("loadingdone", surChargement);
    };
  }, [paginer, titre, sousTitre, brouillon]);

  /* Tant que la nouvelle mesure n'est pas faite, l'ancienne pagination n'est pas réutilisée */
  const pages = mise && mise.pour === blocs ? mise.pages : null;
  const total = pages?.length ?? 0;

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-texte-secondaire">
        <p className="flex min-w-0 items-start gap-1.5">
          <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>
            {libelle ? `${libelle} : ` : ""}
            {pages ? (
              <>
                <strong className="font-semibold text-encre">
                  {total} page{total > 1 ? "s" : ""} A4
                </strong>{" "}
                de texte. L&apos;annexe des signataires commencera page {total + 1}.
              </>
            ) : (
              "mise en page en cours"
            )}
          </span>
        </p>
        <div role="group" aria-label="Zoom" className="inline-flex overflow-hidden rounded-[10px] border border-filet-fort">
          {(["100", "125", "150"] as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              aria-pressed={zoom === z}
              onClick={() => setZoom(z)}
              className={
                "min-h-11 border-r border-filet px-3 text-[13px] last:border-r-0 " +
                (zoom === z ? "bg-encre text-white" : "bg-surface text-texte-secondaire hover:text-encre")
              }
            >
              {z === "100" ? "Ajusté" : `${z} %`}
            </button>
          ))}
        </div>
      </div>

      <div className="a4-stack" data-zoom={zoom}>
        {pages ? (
          pages.map((indices, p) => (
            <div className="a4-wrap" key={p}>
              <div className="a4-page" role="region" aria-label={`Page ${p + 1} sur ${total}`}>
                <div className="a4-body">
                  <div className="a4-flow">
                    {p === 0 ? <Entete titre={titre} sousTitre={sousTitre} brouillon={brouillon} /> : null}
                    {indices.map((i) => (
                      <BlocA4 key={blocs[i].id} bloc={blocs[i]} numero={numeros[i]} />
                    ))}
                  </div>
                </div>
                <div className="a4-foot">
                  <span>{pied}</span>
                  <span>
                    {p + 1} / {total}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="a4-wrap">
            <div className="a4-page" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Conteneur de mesure, invisible : une page de 800 px de large */}
      <div
        ref={mesure}
        aria-hidden="true"
        className="a4-wrap"
        style={{
          position: "absolute",
          left: -10000,
          top: 0,
          width: LARGEUR_MESURE,
          maxWidth: "none",
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <div className="a4-page" style={{ height: HAUTEUR_MESURE, aspectRatio: "auto", overflow: "hidden" }}>
          <div className="a4-body" style={{ overflow: "hidden" }}>
            <div className="a4-flow">
              <div>
                <Entete titre={titre} sousTitre={sousTitre} brouillon={brouillon} />
              </div>
              <div data-colonne="">
                {blocs.map((b, i) => (
                  <BlocA4 key={b.id} bloc={b} numero={numeros[i]} />
                ))}
                <div />
              </div>
            </div>
          </div>
          <div className="a4-foot">
            <span>{pied}</span>
            <span>1 / 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
