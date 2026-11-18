"use client";

import { BadgeCheck, CalendarClock, Download, FileDown, Printer, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { DocumentA4, type PartieDocument } from "@/components/document/document-a4";
import { Button, classesBouton } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { formaterDateHeureLongue } from "@/lib/dates";
import { peutGererSurPlace, peutReglerAnnexe } from "@/lib/document/regles";
import type { DonneesDocument } from "@/lib/document/serveur";
import {
  LIGNES_PAR_PAGE,
  LIGNES_VIDES,
  ORDRES_ANNEXE,
  type LigneAnnexeA4,
  type OrdreAnnexe,
  type ReglagesAnnexe,
} from "@/lib/signature/annexe";
import type { Bloc } from "@/types/database";

import { reglerAnnexe } from "./actions";
import { SignatairesSurPlace } from "./signataires-sur-place";

/*
  Rubrique Document A4 (prompt 08, prototype 1-admin.html) : exactement ce qui sera imprimé,
  le texte puis l'annexe complète (toutes les signatures visibles, D75). Réglages de l'annexe, trois impressions
  A4 (texte seul, annexe seule, document complet) à partir du gel, signataires sur place après la clôture.
  Mise à jour en continu (D117) : tant que l'onglet est visible, les données sont relues sur le serveur toutes les
  30 secondes (session d'admin, sans Supabase Realtime), sans faire sauter la position de lecture.
*/

const ORDRES: Record<OrdreAnnexe, string> = {
  entreprise: "Par entreprise (A à Z)",
  maillon: "Par maillon, puis entreprise",
  nom: "Par nom de famille (A à Z)",
  date: "Par ordre de signature",
};
const PAR_PAGE: Record<number, string> = { 8: "8 lignes (signatures plus grandes)", 10: "10 lignes", 15: "15 lignes (comme le document Word)" };
const VIDES: Record<number, string> = { 0: "Aucune", 5: "5 lignes vides", 10: "10 lignes vides" };
const SELECT =
  "min-h-11 w-full rounded-[10px] border border-filet-fort bg-surface px-3 text-[15px] focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none disabled:opacity-60";
const PANNEAU = "grid gap-3 rounded-[14px] border border-filet bg-surface p-5";

const IMPRESSIONS: [PartieDocument, string][] = [
  ["texte", "Imprimer le texte seul"],
  ["annexe", "Imprimer l'annexe seule"],
  ["complet", "Imprimer le document complet"],
];

const intervalle = (debut: number, fin: number) => (debut === fin ? `page ${debut}` : `pages ${debut} à ${fin}`);

const INTERVALLE_ACTUALISATION = 30_000;
/* Les liens signés des photos (une heure) sont gardés tels quels au plus 45 minutes entre deux mises à jour */
const DUREE_LIENS = 45 * 60_000;

/* « 9 h 12 », à l'heure de Dakar */
const formatHeure = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Dakar", hour: "numeric", minute: "2-digit", hourCycle: "h23" });
function heureDakar(iso: string): string {
  const parties = formatHeure.formatToParts(new Date(iso));
  return `${parties.find((p) => p.type === "hour")?.value ?? ""} h ${parties.find((p) => p.type === "minute")?.value ?? ""}`;
}

/* Lien signé sans son jeton : deux lectures successives de la même photo donnent la même clé */
const sansJeton = (url: string | null | undefined) => (url ? url.split("?")[0] : null);

/*
  Relecture périodique (router.refresh) : seulement quand l'onglet est visible ; reprise immédiate au retour.
  Les composants clients gardent leur état et la page garde sa position.
*/
function ActualisationAuto({ lueLe }: { lueLe: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const actualiser = () => demarrer(() => router.refresh());

  useEffect(() => {
    let minuterie: number | undefined;
    const arreter = () => window.clearInterval(minuterie);
    const lancer = () => {
      arreter();
      minuterie = window.setInterval(() => router.refresh(), INTERVALLE_ACTUALISATION);
    };
    const surVisibilite = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        lancer();
      } else arreter();
    };
    if (document.visibilityState === "visible") lancer();
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      arreter();
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [router]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-texte-secondaire">
      <p aria-live="polite">Mis à jour à {heureDakar(lueLe)}</p>
      <Button variante="discret" className="min-h-11 px-3 text-[14px]" onClick={actualiser} disabled={enCours}>
        <RefreshCw aria-hidden="true" strokeWidth={1.75} />
        Actualiser
      </Button>
    </div>
  );
}

export function EspaceDocument({ donnees, maillons }: { donnees: DonneesDocument; maillons: string[] }) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [reglages, setReglages] = useState<ReglagesAnnexe>(donnees.reglages);
  const [pages, setPages] = useState<{ texte: number; annexe: number } | null>(null);
  const modifiable = donnees.disponible && peutReglerAnnexe(donnees.statut);
  const modifie =
    reglages.ordre !== donnees.reglages.ordre ||
    reglages.parPage !== donnees.reglages.parPage ||
    reglages.lignesVides !== donnees.reglages.lignesVides;
  const version = donnees.version;
  /* À partir du gel : annexe dans l'aperçu et impressions (en rédaction, il n'y a encore aucune signature) */
  const avecAnnexe = donnees.statut !== "redaction";

  /*
    Données stables d'une mise à jour à l'autre : le texte n'est remis en pages que s'il a changé (sinon la page
    sauterait), et une photo garde son lien signé tant qu'il est valide (sinon elle serait rechargée à chaque fois).
  */
  const cleBlocs = JSON.stringify(version?.blocs ?? []);
  const blocs = useMemo(() => JSON.parse(cleBlocs) as Bloc[], [cleBlocs]);
  const periode = Math.floor(Date.parse(donnees.lueLe) / DUREE_LIENS);
  const cleLignes = `${periode}|${JSON.stringify(donnees.lignes.map((l) => ({ ...l, image: sansJeton(l.image) })))}`;
  const [lignes, setLignes] = useState<{ cle: string; valeur: LigneAnnexeA4[] }>({ cle: cleLignes, valeur: donnees.lignes });
  if (lignes.cle !== cleLignes) setLignes({ cle: cleLignes, valeur: donnees.lignes });

  const enregistrer = () =>
    demarrer(async () => {
      const r = await reglerAnnexe(reglages);
      afficher(r.ok ? "Réglages de l'annexe enregistrés" : r.erreur, !r.ok);
    });

  if (!version) {
    return (
      <p className="rounded-xl border border-filet bg-surface px-4 py-7 text-center text-texte-secondaire">
        Aucune version du texte : importez-la depuis la rubrique Texte.
      </p>
    );
  }

  return (
    <div className="grid items-start gap-5 min-[1180px]:grid-cols-[340px_minmax(0,1fr)]">
      <div className="grid gap-4 min-[1180px]:sticky min-[1180px]:top-24">
        {!donnees.disponible ? (
          <p role="alert" className="rounded-[10px] bg-erreur-doux px-4 py-3 text-[14px] text-[#7a2a1d]">
            Exécutez supabase/migrations/0010_document_final.sql : les réglages de l&apos;annexe, la clôture, les signataires
            sur place et la publication en dépendent.
          </p>
        ) : null}

        <section className={PANNEAU} aria-labelledby="titre-annexe">
          <h3 id="titre-annexe" className="font-titre text-xl font-normal">
            Annexe des signataires
          </h3>
          <div className="grid gap-2">
            <label htmlFor="annexe-ordre" className="text-[13px] font-medium text-texte-secondaire">
              Ordre des signataires
            </label>
            <select
              id="annexe-ordre"
              className={SELECT}
              disabled={!modifiable}
              value={reglages.ordre}
              onChange={(e) => setReglages((r) => ({ ...r, ordre: e.target.value as OrdreAnnexe }))}
            >
              {ORDRES_ANNEXE.map((o) => (
                <option key={o} value={o}>
                  {ORDRES[o]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="annexe-par-page" className="text-[13px] font-medium text-texte-secondaire">
              Signataires par page d&apos;annexe
            </label>
            <select
              id="annexe-par-page"
              className={SELECT}
              disabled={!modifiable}
              value={reglages.parPage}
              onChange={(e) => setReglages((r) => ({ ...r, parPage: Number(e.target.value) as ReglagesAnnexe["parPage"] }))}
            >
              {LIGNES_PAR_PAGE.map((n) => (
                <option key={n} value={n}>
                  {PAR_PAGE[n]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="annexe-vides" className="text-[13px] font-medium text-texte-secondaire">
              Lignes vides pour signer sur place à Abu Dhabi
            </label>
            <select
              id="annexe-vides"
              className={SELECT}
              disabled={!modifiable}
              value={reglages.lignesVides}
              onChange={(e) => setReglages((r) => ({ ...r, lignesVides: Number(e.target.value) as ReglagesAnnexe["lignesVides"] }))}
            >
              {LIGNES_VIDES.map((n) => (
                <option key={n} value={n}>
                  {VIDES[n]}
                </option>
              ))}
            </select>
          </div>
          {modifiable ? (
            <Button variante={modifie ? "principal" : "secondaire"} disabled={!modifie || enCours} onClick={enregistrer}>
              <Save aria-hidden="true" strokeWidth={1.75} />
              Enregistrer les réglages
            </Button>
          ) : donnees.statut === "publie" ? (
            <p className="text-[13px] text-texte-secondaire">Le document est publié : les réglages ne changent plus.</p>
          ) : null}

          <dl className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-filet pt-3 text-[14px]">
            <dt className="text-texte-secondaire">Format</dt>
            <dd>A4 portrait</dd>
            <dt className="text-texte-secondaire">Texte</dt>
            <dd className="tabular-nums">{pages ? intervalle(1, pages.texte) : "mise en page en cours"}</dd>
            <dt className="text-texte-secondaire">Annexe</dt>
            <dd className="tabular-nums">
              {!avecAnnexe ? "à partir du gel" : pages ? intervalle(pages.texte + 1, pages.texte + pages.annexe) : "mise en page en cours"}
            </dd>
            <dt className="text-texte-secondaire">Signataires</dt>
            <dd className="tabular-nums">{donnees.lignes.length}</dd>
            <dt className="text-texte-secondaire">Version</dt>
            <dd>
              {version.numero}
              {version.correction ? " (correction mineure)" : ""}
            </dd>
          </dl>
        </section>

        <section className={PANNEAU} aria-labelledby="titre-impression">
          <h3 id="titre-impression" className="flex items-center gap-2 font-titre text-xl font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
            <Printer aria-hidden="true" strokeWidth={1.75} />
            Impression A4
          </h3>
          {!avecAnnexe ? (
            <p className="text-[14px] text-texte-secondaire">L&apos;annexe et les impressions sont disponibles à partir du gel du texte.</p>
          ) : (
            <>
              {IMPRESSIONS.map(([partie, libelle]) =>
                modifie ? (
                  <Button key={partie} disabled>
                    <Printer aria-hidden="true" strokeWidth={1.75} />
                    {libelle}
                  </Button>
                ) : (
                  <a
                    key={partie}
                    href={`/impression/${partie}`}
                    target="_blank"
                    rel="noopener"
                    className={classesBouton(partie === "annexe" && donnees.statut === "clos" ? "principal" : "secondaire")}
                  >
                    <Printer aria-hidden="true" strokeWidth={1.75} />
                    {libelle}
                  </a>
                ),
              )}
              <p className="text-[13px] text-texte-secondaire">
                {modifie
                  ? "Enregistrez les réglages de l'annexe avant d'imprimer."
                  : "Dans la fenêtre d'impression, choisissez Enregistrer en PDF pour obtenir le fichier."}
              </p>
            </>
          )}
          {/* Sauvegarde du soir (D26) : le fichier des signatures, depuis la rubrique CEO */}
          <div className="grid gap-2 border-t border-filet pt-3">
            <p className="text-[13px] text-texte-secondaire">
              Pour la sauvegarde du soir, exportez aussi les signatures (fichier .zip pour Excel, avec chaque signature en image),
              comme dans la <Link href="/admin/ceo" className="text-eau underline underline-offset-2">rubrique CEO</Link>.
            </p>
            <a href="/admin/ceo/export" download className={classesBouton("discret", "w-fit")}>
              <Download aria-hidden="true" strokeWidth={1.75} />
              Exporter les signatures
            </a>
          </div>
        </section>

        {donnees.statut === "clos" ? (
          <section className={PANNEAU} aria-labelledby="titre-9-decembre">
            <h3 id="titre-9-decembre" className="flex items-center gap-2 font-titre text-xl font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
              <CalendarClock aria-hidden="true" strokeWidth={1.75} />
              Le 9 décembre, à Abu Dhabi
            </h3>
            <ol className="grid list-decimal gap-1.5 pl-5 text-[14.5px]">
              <li>Vérifiez l&apos;aperçu.</li>
              <li>« Imprimer l&apos;annexe seule ».</li>
              <li>Glissez les pages derrière le texte imprimé.</li>
            </ol>
          </section>
        ) : null}

        {donnees.statut === "publie" ? (
          <section className={PANNEAU} aria-labelledby="titre-publie">
            <h3 id="titre-publie" className="flex items-center gap-2 font-titre text-xl font-normal [&_svg]:size-[18px] [&_svg]:text-succes">
              <BadgeCheck aria-hidden="true" strokeWidth={1.75} />
              Document publié
            </h3>
            {donnees.publieLe ? <p className="text-[14px] text-texte-secondaire">Le {formaterDateHeureLongue(donnees.publieLe)} (heure de Dakar).</p> : null}
            <a href="/admin/document/pdf" className={classesBouton("secondaire")}>
              <FileDown aria-hidden="true" strokeWidth={1.75} />
              Télécharger le PDF publié
            </a>
          </section>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4">
        <ActualisationAuto lueLe={donnees.lueLe} />
        {donnees.disponible && peutGererSurPlace(donnees.statut) ? (
          <SignatairesSurPlace signataires={donnees.surPlace} maillons={maillons} onMessage={afficher} />
        ) : null}
        <DocumentA4
          titre={version.titre}
          sousTitre={version.sousTitre}
          blocs={blocs}
          brouillon={donnees.statut === "redaction"}
          libelle={`Version ${version.numero}`}
          annexe={avecAnnexe ? { lignes: lignes.valeur, ...reglages } : undefined}
          onPages={setPages}
        />
      </div>
      <Toast message={message} />
    </div>
  );
}
