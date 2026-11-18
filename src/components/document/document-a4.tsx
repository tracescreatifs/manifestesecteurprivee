"use client";

import { FileText } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { SignatureSvg } from "@/components/document/signature";
import { paginerAnnexe, REGLAGES_ANNEXE, type LigneAnnexeA4, type ReglagesAnnexe } from "@/lib/signature/annexe";
import { htmlSur } from "@/lib/texte/html";
import { numerosDesPoints } from "@/lib/texte/comparer";
import type { Bloc } from "@/types/database";

/*
  Rendu du texte en pages A4, identique au prototype 1-admin.html.
  - Unités relatives à la largeur de la page (cqw) : le rendu est le même à toute taille.
  - Pagination : le texte est mesuré dans un conteneur caché de 800 px de large,
    puis réparti page par page ; un intertitre n'est jamais laissé seul en bas de page.
  Composant partagé : rubrique Texte (admin), espace CEO et document final.
  Avec la prop annexe, l'annexe des signataires commence sur la page qui suit la dernière page de texte.
  Pied de page : le numéro seul, sans total (D118) : le texte imprimé à l'avance et l'annexe imprimée sur place
  ne peuvent pas porter le même total, qui dépend du nombre de signatures.
  partie (prompt 08) : « texte » ou « annexe » n'affiche que ces pages, avec la numérotation du document complet
  (l'annexe seule commence à la page qui suit la dernière page de texte, pour s'insérer derrière le texte imprimé).
  impression : sans barre d'outils, pour la page d'impression A4.
*/

export type PartieDocument = "complet" | "texte" | "annexe";

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
  /* Annexe des signataires : ordre, lignes par page et lignes vides réglables (par défaut : entreprise, 10, 0) */
  annexe?: { lignes: LigneAnnexeA4[] } & Partial<ReglagesAnnexe>;
  partie?: PartieDocument;
  impression?: boolean;
  /* Nombre de pages du texte et de l'annexe, dès que la mise en page est faite */
  onPages?: (pages: { texte: number; annexe: number }) => void;
};

const COLONNES = ["N°", "Entreprise", "Maillon", "Nom et fonction du signataire", "Signature"];

function PageAnnexe({
  lignes,
  premierNumero,
  parPage,
}: {
  lignes: (LigneAnnexeA4 | null)[];
  premierNumero: number;
  parPage: number;
}) {
  return (
    <>
      <div className="ann-title">Annexe · Les signataires</div>
      <div className="ann-table" style={{ gridTemplateRows: `auto repeat(${parPage}, 1fr)` }}>
        {COLONNES.map((c) => (
          <div key={c} className="th">
            {c}
          </div>
        ))}
        {lignes.map((l, k) => (
          <Fragment key={l?.cle ?? `vide-${k}`}>
            <div className="no">{premierNumero + k}</div>
            <div>{l?.entreprise}</div>
            <div>{l?.maillon}</div>
            <div className="nf">
              {l ? (
                <>
                  <strong>
                    {l.prenom} {l.nom}
                  </strong>
                  <span>{l.fonction}</span>
                </>
              ) : null}
            </div>
            <div className="sg">
              {l?.masquee ? (
                <span className="ann-signe">Signé</span>
              ) : l?.trace ? (
                <SignatureSvg trace={l.trace} className="h-full" libelle={`Signature de ${l.prenom} ${l.nom}`} />
              ) : l?.image ? (
                /* Signature manuscrite prise en photo sur place : lien signé de courte durée vers le bucket privé */
                // eslint-disable-next-line @next/next/no-img-element -- lien signé privé, rendu identique à l'impression
                <img src={l.image} alt={`Signature de ${l.prenom} ${l.nom}`} className="ann-image" />
              ) : null}
            </div>
          </Fragment>
        ))}
        {Array.from({ length: (parPage - lignes.length) * 5 }, (_, k) => (
          <div key={`g${k}`} className="ghost" aria-hidden="true" />
        ))}
      </div>
    </>
  );
}

/* Zoom : « Ajusté » (largeur de l'écran, 700 px au plus), ou de 50 % à 200 % par paliers de 25 % */
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_PAS = 25;
const LARGEUR_100 = 700;

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

export function DocumentA4({
  titre,
  sousTitre,
  blocs,
  brouillon,
  libelle,
  annexe,
  partie = "complet",
  impression = false,
  onPages,
}: Props) {
  const mesure = useRef<HTMLDivElement>(null);
  /* Pagination, liée aux blocs pour lesquels elle a été calculée */
  const [mise, setMise] = useState<{ pour: Bloc[]; pages: number[][] } | null>(null);
  /* null : ajusté à la largeur disponible */
  const [zoom, setZoom] = useState<number | null>(null);
  /* Pourcentage réel de la page en mode ajusté (largeur affichée / 700 px) */
  const pile = useRef<HTMLDivElement>(null);
  const [ajuste, setAjuste] = useState(100);
  const zoomEffectif = zoom ?? ajuste;

  useLayoutEffect(() => {
    const page = pile.current?.querySelector<HTMLElement>(".a4-wrap");
    if (!page) return;
    const mesurer = () => {
      const largeur = page.getBoundingClientRect().width;
      if (largeur) setAjuste(Math.round((largeur / LARGEUR_100) * 100));
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(page);
    return () => observateur.disconnect();
  }, [zoom, mise]);
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
  const reglages: ReglagesAnnexe = {
    ordre: annexe?.ordre ?? REGLAGES_ANNEXE.ordre,
    parPage: annexe?.parPage ?? REGLAGES_ANNEXE.parPage,
    lignesVides: annexe?.lignesVides ?? REGLAGES_ANNEXE.lignesVides,
  };
  const lignesAnnexe = annexe?.lignes;
  const pagesAnnexe = useMemo(
    () => (lignesAnnexe ? paginerAnnexe(lignesAnnexe, { ordre: reglages.ordre, parPage: reglages.parPage, lignesVides: reglages.lignesVides }) : []),
    [lignesAnnexe, reglages.ordre, reglages.parPage, reglages.lignesVides],
  );
  const pagesTexte = pages?.length ?? 0;
  const avecTexte = partie !== "annexe";
  const avecAnnexe = partie !== "texte";

  const signaler = useRef(onPages);
  useEffect(() => {
    signaler.current = onPages;
  }, [onPages]);
  useEffect(() => {
    if (pages) signaler.current?.({ texte: pagesTexte, annexe: pagesAnnexe.length });
  }, [pages, pagesTexte, pagesAnnexe.length]);

  const barreOutils = (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-texte-secondaire">
      <p className="flex min-w-0 items-start gap-1.5">
        <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <span>
          {libelle ? `${libelle} : ` : ""}
          {pages ? (
            <>
              <strong className="font-semibold text-encre">
                {pagesTexte} page{pagesTexte > 1 ? "s" : ""} A4
              </strong>{" "}
              de texte.{" "}
              {annexe
                ? `L'annexe des signataires commence page ${pagesTexte + 1}.`
                : `L'annexe des signataires commencera page ${pagesTexte + 1}.`}
            </>
          ) : (
            "mise en page en cours"
          )}
        </span>
      </p>
      <div role="group" aria-label="Zoom" className="inline-flex items-stretch overflow-hidden rounded-[10px] border border-filet-fort">
        <button
          type="button"
          aria-pressed={zoom === null}
          onClick={() => setZoom(null)}
          className={
            "min-h-11 border-r border-filet px-3 text-[13px] " +
            (zoom === null ? "bg-encre text-white" : "bg-surface text-texte-secondaire hover:text-encre")
          }
        >
          Ajusté
        </button>
        <button
          type="button"
          aria-label="Réduire"
          onClick={() => setZoom(Math.max(ZOOM_MIN, Math.ceil(zoomEffectif / ZOOM_PAS) * ZOOM_PAS - ZOOM_PAS))}
          disabled={zoomEffectif <= ZOOM_MIN}
          className="min-h-11 min-w-11 border-r border-filet bg-surface text-[17px] text-texte-secondaire hover:text-encre disabled:opacity-40"
        >
          −
        </button>
        <span aria-live="polite" className="grid min-w-16 place-items-center border-r border-filet bg-surface px-2 text-[13px] tabular-nums">
          {zoomEffectif} %
        </span>
        <button
          type="button"
          aria-label="Agrandir"
          onClick={() => setZoom(Math.min(ZOOM_MAX, Math.floor(zoomEffectif / ZOOM_PAS) * ZOOM_PAS + ZOOM_PAS))}
          disabled={zoomEffectif >= ZOOM_MAX}
          className="min-h-11 min-w-11 bg-surface text-[17px] text-texte-secondaire hover:text-encre disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="grid min-w-0 gap-2">
      {impression ? null : barreOutils}

      <div
        ref={pile}
        className={impression ? "a4-stack a4-impression" : "a4-stack"}
        data-pret={pages ? "" : undefined}
        data-zoom={zoom === null ? undefined : ""}
        style={zoom === null ? undefined : ({ "--largeur-page": `${(LARGEUR_100 * zoom) / 100}px` } as CSSProperties)}
      >
        {pages ? (
          (avecTexte ? pages : []).map((indices, p) => (
            <div className="a4-wrap" key={p}>
              <div className="a4-page" role="region" aria-label={`Page ${p + 1}`}>
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
                    {p + 1}
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
        {pages && avecAnnexe
          ? pagesAnnexe.map((lignes, p) => (
              <div className="a4-wrap" key={`annexe-${p}`}>
                <div className="a4-page" role="region" aria-label={`Page ${pagesTexte + p + 1}, annexe des signataires`}>
                  <div className="a4-body">
                    <PageAnnexe lignes={lignes} premierNumero={p * reglages.parPage + 1} parPage={reglages.parPage} />
                  </div>
                  <div className="a4-foot">
                    <span>{pied}</span>
                    <span>
                      {pagesTexte + p + 1}
                    </span>
                  </div>
                </div>
              </div>
            ))
          : null}
      </div>

      {/* Conteneur de mesure, invisible : une page de 800 px de large */}
      <div
        ref={mesure}
        aria-hidden="true"
        className="a4-wrap a4-mesure"
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
            <span>1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
