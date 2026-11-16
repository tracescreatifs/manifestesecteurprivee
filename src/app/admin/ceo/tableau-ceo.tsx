"use client";

import {
  BellRing,
  Download,
  Link2,
  ListChecks,
  MessageCircle,
  Pencil,
  Phone,
  QrCode,
  Search,
  Trash2,
  Undo2,
  Upload,
  UserPlus,
} from "lucide-react";
import { useMemo, useState, useTransition, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import { SignatureSvg } from "@/components/document/signature";
import { BoutonAvecRaison } from "@/components/ui/bouton-raison";
import { Button, classesBouton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MenuActions, type ElementMenu } from "@/components/ui/menu-actions";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";
import { formaterDateHeure } from "@/lib/dates";
import { lienOuvert, lienPersonnel, remplirModele } from "@/lib/ceo/message";
import { formaterTelephone, normaliserTexte } from "@/lib/ceo/normaliser";
import type { LigneCeo, SignatureRecente } from "@/lib/ceo/serveur";
import type { StatutEnvoi, StatutManifeste } from "@/types/database";

import { annulerEnvoi, enregistrerEnvoi, retirerCeo } from "./actions";
import { FenetreWhatsApp } from "./fenetre-whatsapp";
import { FicheCeo } from "./fiche-ceo";
import { FileRelance } from "./file-relance";
import { FormulaireCeo } from "./formulaire-ceo";
import { ImportListe } from "./import-liste";
import { LienOuvert } from "./lien-ouvert";
import { ORIGINES_COURTES } from "./statuts";
import { LIBELLES_STATUTS as STATUTS } from "./statuts";

type Props = {
  lignes: LigneCeo[];
  recentes: SignatureRecente[];
  maillons: string[];
  statutManifeste: StatutManifeste;
  siteUrl: string | null;
  modele: string;
  dateLimite: string;
  /* Date limite brute, pour « Rétablir » dans la fiche (seulement tant que les signatures sont ouvertes) */
  dateLimiteIso: string;
  lienOuvertActif: boolean;
  /* Fiche ouverte à l'arrivée (?fiche=, depuis la rubrique Doléances) */
  ficheInitiale: string | null;
  /* Onglets de la rubrique (Liste et suivi, À vérifier, Commentaires), et contenu d'un autre onglet que la liste */
  onglets: ReactNode;
  contenu: ReactNode | null;
};

const FILTRES: { cle: "tous" | StatutEnvoi; libelle: string }[] = [
  { cle: "tous", libelle: "Tous" },
  { cle: "a_envoyer", libelle: "À envoyer" },
  { cle: "envoye", libelle: "Envoyés, pas ouverts" },
  { cle: "ouvert", libelle: "Ouverts, pas signés" },
  { cle: "signe", libelle: "Signés" },
];

function initiales(l: LigneCeo) {
  const t = `${l.prenom.charAt(0)}${l.nom.charAt(0)}`.toUpperCase();
  return t || l.entreprise.charAt(0).toUpperCase() || "?";
}

function Avatar({ ligne }: { ligne: LigneCeo }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#E6E0D3] text-[13px] font-semibold text-texte-secondaire">
      {ligne.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire du stockage privé
        <img src={ligne.photoUrl} alt="" className="size-full object-cover" />
      ) : (
        initiales(ligne)
      )}
    </span>
  );
}

export function derniereActivite(l: LigneCeo): string {
  if (l.statut === "signe" && l.signeLe) return `Signé le ${formaterDateHeure(l.signeLe)}`;
  if (l.statut === "ouvert" && l.ouvertLe) return `Ouvert le ${formaterDateHeure(l.ouvertLe)}`;
  if (l.statut === "envoye" || l.statut === "ouvert") {
    const date = l.derniereRelanceLe ?? l.envoyeLe;
    const relances = l.relances ? `, ${l.relances} relance${l.relances > 1 ? "s" : ""}` : "";
    return date ? `Envoyé le ${formaterDateHeure(date)}${relances}` : `Envoyé${relances}`;
  }
  return "Pas encore envoyé";
}

export function TableauCeo({
  lignes,
  recentes,
  maillons,
  statutManifeste,
  siteUrl,
  modele,
  dateLimite,
  dateLimiteIso,
  lienOuvertActif,
  ficheInitiale,
  onglets,
  contenu,
}: Props) {
  const { message: toast, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [filtre, setFiltre] = useState<"tous" | StatutEnvoi>("tous");
  const [maillon, setMaillon] = useState("");
  const [recherche, setRecherche] = useState("");
  /* Fiche ouverte : identifiant de l'invitation (la ligne est relue à chaque mise à jour) */
  const [fiche, setFiche] = useState<string | null>(ficheInitiale);
  const [envoi, setEnvoi] = useState<{ ceo: LigneCeo; relance: boolean } | null>(null);
  const [fileOuverte, setFileOuverte] = useState(false);
  const [formulaire, setFormulaire] = useState<{ ceo: LigneCeo | null } | null>(null);
  const [aRetirer, setARetirer] = useState<LigneCeo | null>(null);
  const [importOuvert, setImportOuvert] = useState(false);
  const [lienOuvertVisible, setLienOuvertVisible] = useState(false);

  const gele = statutManifeste === "gele";

  const compte = useMemo(() => {
    const c: Record<StatutEnvoi, number> = { a_envoyer: 0, envoye: 0, ouvert: 0, signe: 0 };
    lignes.forEach((l) => c[l.statut]++);
    return c;
  }, [lignes]);
  const total = lignes.length;

  const visibles = useMemo(() => {
    const q = normaliserTexte(recherche);
    const qTel = recherche.replace(/\D/g, "");
    return lignes.filter((l) => {
      if (filtre !== "tous" && l.statut !== filtre) return false;
      if (maillon === "__aucun" ? l.maillon !== "" : maillon && l.maillon !== maillon) return false;
      if (!q) return true;
      const texte = normaliserTexte(`${l.prenom} ${l.nom} ${l.entreprise} ${l.fonction}`);
      return texte.includes(q) || (qTel.length >= 3 && l.telephone.replace(/\D/g, "").includes(qTel));
    });
  }, [lignes, filtre, maillon, recherche]);

  const aRelancer = useMemo(
    () => lignes.filter((l) => (l.statut === "envoye" || l.statut === "ouvert") && l.telephone),
    [lignes],
  );

  const messagePour = (ceo: LigneCeo, relance: boolean) =>
    siteUrl
      ? remplirModele(modele, { prenom: ceo.prenom || ceo.nom, lien: lienPersonnel(siteUrl, ceo.jeton), dateLimite }, relance)
      : "";

  const noterEnvoi = (ceo: LigneCeo, relance: boolean) =>
    demarrer(async () => {
      const r = await enregistrerEnvoi({ invitationId: ceo.invitationId, relance });
      if (!r.ok) return afficher(r.erreur, true);
      afficher(relance ? `Relance notée : ${ceo.prenom} ${ceo.nom}` : `Envoi noté : ${ceo.prenom} ${ceo.nom}`);
    });

  const copierLien = async (ceo: LigneCeo) => {
    if (!siteUrl) return afficher("Adresse du site non configurée (NEXT_PUBLIC_SITE_URL).", true);
    try {
      await navigator.clipboard.writeText(lienPersonnel(siteUrl, ceo.jeton));
      afficher(gele ? "Lien personnel copié" : "Lien personnel copié. Il ne s'ouvrira qu'après le gel du texte.");
    } catch {
      afficher("Copie impossible ici.", true);
    }
  };

  const nonEnvoye = (ceo: LigneCeo) => {
    demarrer(async () => {
      const r = await annulerEnvoi({ invitationId: ceo.invitationId });
      afficher(r.ok ? "Marqué comme non envoyé" : r.erreur, !r.ok);
    });
  };

  const confirmerRetrait = () => {
    if (!aRetirer) return;
    const ceo = aRetirer;
    demarrer(async () => {
      const r = await retirerCeo({ invitationId: ceo.invitationId });
      setARetirer(null);
      if (r.ok) setFiche(null);
      afficher(r.ok ? "Retiré de la liste" : r.erreur, !r.ok);
    });
  };

  const pct = (n: number) => `${((n / Math.max(1, total)) * 100).toFixed(1)}%`;
  const fige = statutManifeste === "clos" || statutManifeste === "publie";

  /* Raison pour laquelle l'envoi est impossible ; undefined : aucune action d'envoi (signé, signatures closes) */
  const raisonEnvoi = (l: LigneCeo): string | null | undefined => {
    if (l.statut === "signe" || fige) return undefined;
    if (!gele) return "Gelez le texte avant d'envoyer les liens";
    if (!siteUrl) return "Adresse du site non configurée (NEXT_PUBLIC_SITE_URL)";
    if (!l.telephone) return "Ajoutez un numéro WhatsApp";
    return null;
  };

  /* Action principale d'une ligne */
  const actionPrincipale = (l: LigneCeo) => {
    const raison = raisonEnvoi(l);
    if (raison === undefined) return null;
    const relance = l.statut === "envoye" || l.statut === "ouvert";
    return (
      <BoutonAvecRaison raison={raison} onClick={() => setEnvoi({ ceo: l, relance })} occupe={enCours} className="px-3 text-[14px]">
        {relance ? <BellRing aria-hidden="true" strokeWidth={1.75} /> : <MessageCircle aria-hidden="true" strokeWidth={1.75} />}
        {relance ? "Relancer" : "Envoyer"}
      </BoutonAvecRaison>
    );
  };

  /* Menu d'une ligne */
  const elementsMenu = (l: LigneCeo): ElementMenu[] => [
    { genre: "action", libelle: "Copier le lien personnel", icone: Link2, onSelect: () => void copierLien(l) },
    { genre: "action", libelle: "Modifier", icone: Pencil, onSelect: () => setFormulaire({ ceo: l }) },
    ...(l.statut === "envoye"
      ? [{ genre: "action" as const, libelle: "Marquer comme non envoyé", icone: Undo2, onSelect: () => nonEnvoye(l) }]
      : []),
    l.statut === "signe"
      ? { genre: "note" as const, texte: "Ce CEO a signé : il ne peut pas être retiré de la liste." }
      : { genre: "action" as const, libelle: "Retirer de la liste", icone: Trash2, danger: true, onSelect: () => setARetirer(l) },
  ];

  /* Un clic sur la ligne (hors boutons et liens) ou Entrée ouvre la fiche */
  const surClicLigne = (e: MouseEvent<HTMLLIElement>, l: LigneCeo) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    setFiche(l.invitationId);
  };
  const surToucheLigne = (e: KeyboardEvent<HTMLLIElement>, l: LigneCeo) => {
    if (e.key === "Enter" && e.target === e.currentTarget) {
      e.preventDefault();
      setFiche(l.invitationId);
    }
  };
  const ceoFiche = fiche ? (lignes.find((l) => l.invitationId === fiche) ?? null) : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-titre text-[22px] font-normal tracking-[-0.01em]">CEO</h2>
          <p className="mt-1 max-w-[64ch] text-texte-secondaire">
            Chaque CEO reçoit un lien personnel, impossible à deviner et sans compte.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setLienOuvertVisible(true)} disabled={!siteUrl}>
            <QrCode aria-hidden="true" strokeWidth={1.75} />
            Lien ouvert{lienOuvertActif ? "" : " (en pause)"}
          </Button>
          <Button onClick={() => setImportOuvert(true)}>
            <Upload aria-hidden="true" strokeWidth={1.75} />
            Importer la liste
          </Button>
          <Button variante="principal" onClick={() => setFormulaire({ ceo: null })}>
            <UserPlus aria-hidden="true" strokeWidth={1.75} />
            Ajouter
          </Button>
        </div>
      </div>

      {onglets}

      {!siteUrl ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-erreur-doux px-4 py-3 text-[14.5px] text-[#7a2a1d]">
          L&apos;adresse du site n&apos;est pas configurée : ajoutez NEXT_PUBLIC_SITE_URL dans Vercel, puis redéployez.
          Les liens ne peuvent pas être construits sans elle.
        </p>
      ) : null}

      {contenu ?? (
        <>
      {statutManifeste === "redaction" ? (
        <p className="mb-4 rounded-[10px] bg-eau-doux px-4 py-3 text-[14.5px] text-[#173e49]">
          Préparez la liste dès maintenant. Les liens deviennent actifs et envoyables au gel du texte : gelez le texte avant
          d&apos;envoyer les liens.
        </p>
      ) : (
        /* Compteur et extrait de l'annexe côte à côte seulement à partir de 1200 px : en dessous, l'un sous l'autre (aucun chevauchement) */
        <section
          aria-label="Avancement des signatures"
          className="mb-4 grid items-center gap-6 rounded-[14px] border border-filet bg-surface px-6 py-5 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,360px)]"
        >
          <div className="grid min-w-0 gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-titre text-[40px] leading-none tabular-nums">
                {compte.signe}{" "}
                <span className="font-interface text-[15px] text-texte-secondaire">
                  signature{compte.signe > 1 ? "s" : ""} sur {total}
                </span>
              </p>
              {gele ? (
                <Button onClick={() => setFileOuverte(true)} disabled={!aRelancer.length || !siteUrl}>
                  <ListChecks aria-hidden="true" strokeWidth={1.75} />
                  Relancer un par un ({aRelancer.length})
                </Button>
              ) : null}
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-[#ECECEA]" role="img" aria-label={`${compte.signe} signés sur ${total}`}>
              <span style={{ width: pct(compte.signe) }} className="bg-eau" />
              <span style={{ width: pct(compte.ouvert) }} className="bg-[#7FA3AD]" />
              <span style={{ width: pct(compte.envoye) }} className="bg-[#C9D6DA]" />
            </div>
            <div className="flex flex-wrap gap-4 text-[13px] text-texte-secondaire">
              {[
                ["bg-eau", "Signés", compte.signe],
                ["bg-[#7FA3AD]", "Ouverts", compte.ouvert],
                ["bg-[#C9D6DA]", "Envoyés", compte.envoye],
                ["bg-[#ECECEA]", "À envoyer", compte.a_envoyer],
              ].map(([couleur, libelle, n]) => (
                <span key={libelle as string} className="inline-flex items-center gap-1.5">
                  <i className={`inline-block size-2.5 rounded-[3px] ${couleur}`} />
                  {libelle} {n}
                </span>
              ))}
            </div>
          </div>
          {recentes.length ? (
            <div
              aria-label="Dernières signatures dans l'annexe"
              className="rounded-md bg-white px-5 pt-4 pb-2 font-doc-sans text-doc-texte shadow-[0_1px_2px_rgba(20,33,43,0.06),0_12px_32px_rgba(20,33,43,0.10)]"
            >
              <div className="flex items-baseline justify-between border-b-2 border-doc-or pb-2 font-doc-serif text-[15px] text-doc-vert">
                <span>Annexe · Les signataires</span>
                <span className="font-doc-sans text-[12px] text-doc-gris tabular-nums">{compte.signe}</span>
              </div>
              {recentes.map((s, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 border-b border-doc-filet py-2 last:border-b-0">
                  <div className="min-w-0">
                    <b className="block truncate text-[12.5px] font-bold text-[#14201B]">{s.entreprise}</b>
                    <span className="block truncate text-[11.5px] text-doc-gris">
                      {s.prenom} {s.nom}
                    </span>
                  </div>
                  <div className="h-9">{s.trace ? <SignatureSvg trace={s.trace} className="h-full" /> : null}</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par statut">
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              type="button"
              aria-pressed={filtre === f.cle}
              onClick={() => setFiltre(f.cle)}
              className={
                "min-h-11 rounded-full border px-3 text-[13.5px] font-medium " +
                (filtre === f.cle ? "border-encre bg-encre text-white" : "border-filet-fort bg-surface text-texte-secondaire")
              }
            >
              {f.libelle} <span className="tabular-nums">{f.cle === "tous" ? total : compte[f.cle]}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap gap-2 min-[820px]:w-auto">
          <select
            value={maillon}
            onChange={(e) => setMaillon(e.target.value)}
            aria-label="Filtrer par maillon"
            className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-filet-fort bg-surface px-3 text-[14px] min-[820px]:flex-none"
          >
            <option value="">Tous les maillons</option>
            {maillons.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="__aucun">Maillon à préciser</option>
          </select>
          <label className="relative min-w-0 flex-1 min-[820px]:w-64 min-[820px]:flex-none">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texte-secondaire" strokeWidth={1.75} />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, entreprise, téléphone"
              aria-label="Rechercher un CEO"
              className="min-h-11 w-full rounded-[10px] border border-filet-fort bg-surface pr-3 pl-9 text-base focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-filet bg-surface">
        <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_150px_minmax(0,1.2fr)_auto] gap-3.5 bg-sureleve px-4 py-3 text-[13px] font-medium text-texte-secondaire min-[1200px]:grid">
          <div>CEO</div>
          <div>Entreprise</div>
          <div>Statut</div>
          <div>Dernière activité</div>
          <div className="w-[190px]" />
        </div>
        {visibles.length ? (
          <ul>
            {visibles.map((l) => {
              const nomComplet = `${l.prenom} ${l.nom}`.trim() || "Dirigeant à préciser";
              return (
                <li
                  key={l.invitationId}
                  tabIndex={0}
                  aria-label={`${nomComplet}, ${l.entreprise}. Entrée pour ouvrir la fiche`}
                  onClick={(e) => surClicLigne(e, l)}
                  onKeyDown={(e) => surToucheLigne(e, l)}
                  className="cursor-pointer hover:bg-[#FAFAF9] focus-visible:bg-[#FAFAF9] focus-visible:outline-offset-[-2px] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-filet px-4 py-3 first:border-t-0 min-[1200px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_150px_minmax(0,1.2fr)_auto] min-[1200px]:gap-3.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar ligne={l} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{nomComplet}</div>
                      <div className="truncate text-[13px] text-texte-secondaire">
                        {l.fonction || " "}
                        {l.origine !== "liste" ? ` · ${ORIGINES_COURTES[l.origine]}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 row-start-2 min-w-0 min-[1200px]:col-span-1 min-[1200px]:row-start-auto">
                    <div className="truncate">{l.entreprise}</div>
                    <div className="truncate text-[13px] text-texte-secondaire">{l.maillon || "Maillon à préciser"}</div>
                    {/* Numéro entier, jamais tronqué : il passe à la ligne entre deux groupes de chiffres si la colonne est étroite */}
                    <div className="flex items-start gap-1.5 text-[13px] text-texte-secondaire">
                      <Phone aria-hidden="true" className="mt-px size-[18px] shrink-0" strokeWidth={1.75} />
                      {l.telephone ? (
                        <span className="min-w-0 tabular-nums">{formaterTelephone(l.telephone)}</span>
                      ) : (
                        <span className="min-w-0">Sans téléphone</span>
                      )}
                    </div>
                  </div>
                  <div className="col-start-1 row-start-3 flex min-w-0 flex-wrap items-center gap-x-2 min-[1200px]:col-start-auto min-[1200px]:row-start-auto">
                    <Chip variante={STATUTS[l.statut].variante}>
                      <span className="size-[7px] rounded-full bg-current" />
                      {STATUTS[l.statut].libelle}
                    </Chip>
                    {l.verification === "a_verifier" && l.signature ? (
                      <Chip variante="argile">{l.signature.validee ? "À vérifier" : "À valider"}</Chip>
                    ) : l.verification === "rejete" ? (
                      <Chip variante="erreur">{l.decision === "refusee" ? "Refusée" : "Retirée par un admin"}</Chip>
                    ) : null}
                    <span className="text-[12.5px] text-texte-secondaire min-[1200px]:hidden">{derniereActivite(l)}</span>
                  </div>
                  <div className="hidden text-[13px] text-texte-secondaire min-[1200px]:block">{derniereActivite(l)}</div>
                  {/* Téléphone : menu en haut à droite, action principale en bas à droite. Ordinateur : côte à côte. */}
                  <div className="contents min-[1200px]:flex min-[1200px]:w-[190px] min-[1200px]:items-start min-[1200px]:justify-end min-[1200px]:gap-1">
                    <div className="col-start-2 row-start-3 justify-self-end">{actionPrincipale(l)}</div>
                    <div className="col-start-2 row-start-1 justify-self-end">
                      <MenuActions libelle={`Plus d'actions pour ${nomComplet}`} elements={elementsMenu(l)} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-7 text-center text-texte-secondaire">
            {total ? "Personne dans cette catégorie." : "Aucun CEO pour l'instant : importez la liste du déjeuner ou ajoutez un CEO."}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[60ch] text-[13px] text-texte-secondaire">
          Sauvegarde : téléchargez les signatures chaque soir pendant la campagne (fichier .zip avec un tableau Excel, la
          sauvegarde complète et chaque signature en image).
        </p>
        <a href="/admin/ceo/export" download className={classesBouton("secondaire")}>
          <Download aria-hidden="true" strokeWidth={1.75} />
          Exporter les signatures
        </a>
      </div>
        </>
      )}

      {envoi ? (
        <FenetreWhatsApp
          ceo={envoi.ceo}
          relance={envoi.relance}
          messageInitial={messagePour(envoi.ceo, envoi.relance)}
          onFermer={() => setEnvoi(null)}
          onOuvert={() => {
            noterEnvoi(envoi.ceo, envoi.relance);
            /* Laisser le navigateur ouvrir WhatsApp avant de fermer la fenêtre */
            setTimeout(() => setEnvoi(null), 50);
          }}
          onCopie={(ok) => afficher(ok ? "Message copié" : "Copie impossible ici.", !ok)}
        />
      ) : null}

      {fileOuverte ? (
        <FileRelance
          file={aRelancer}
          message={(c) => messagePour(c, true)}
          derniereAction={derniereActivite}
          onFermer={() => setFileOuverte(false)}
          onRelance={(c) => noterEnvoi(c, true)}
        />
      ) : null}

      <FormulaireCeo
        ouvert={formulaire !== null}
        ceo={formulaire?.ceo ?? null}
        lignes={lignes}
        maillons={maillons}
        onFermer={() => setFormulaire(null)}
        onEnregistre={(m) => afficher(m)}
      />

      <ImportListe
        ouvert={importOuvert}
        onFermer={() => setImportOuvert(false)}
        maillons={maillons}
        existants={{ entreprises: lignes.map((l) => l.entreprise), telephones: lignes.map((l) => l.telephone) }}
        onImporte={(n) => {
          setImportOuvert(false);
          afficher(`${n} CEO importé${n > 1 ? "s" : ""}`);
        }}
      />

      {lienOuvertVisible && siteUrl ? (
        <LienOuvert
          adresse={lienOuvert(siteUrl)}
          dateLimite={dateLimite}
          actif={lienOuvertActif}
          onFermer={() => setLienOuvertVisible(false)}
          onMessage={(t, e) => afficher(t, e)}
        />
      ) : null}

      <Modal
        ouvert={aRetirer !== null}
        titre="Retirer de la liste"
        onFermer={() => setARetirer(null)}
        pied={
          <>
            <Button variante="discret" onClick={() => setARetirer(null)}>
              Annuler
            </Button>
            <Button variante="danger" onClick={confirmerRetrait} disabled={enCours}>
              <Trash2 aria-hidden="true" strokeWidth={1.75} />
              Retirer
            </Button>
          </>
        }
      >
        {aRetirer ? (
          <p>
            Retirer <strong>{`${aRetirer.prenom} ${aRetirer.nom}`.trim() || "ce CEO"}</strong> ({aRetirer.entreprise}) ?
            Son lien personnel ne fonctionnera plus.
          </p>
        ) : null}
      </Modal>

      <FicheCeo
        ceo={ceoFiche}
        onFermer={() => setFiche(null)}
        raisonEnvoi={ceoFiche ? raisonEnvoi(ceoFiche) : undefined}
        occupe={enCours}
        onEnvoyer={(relance) => ceoFiche && setEnvoi({ ceo: ceoFiche, relance })}
        onCopier={() => ceoFiche && void copierLien(ceoFiche)}
        onModifier={() => ceoFiche && setFormulaire({ ceo: ceoFiche })}
        onNonEnvoye={() => ceoFiche && nonEnvoye(ceoFiche)}
        onRetirer={() => ceoFiche && setARetirer(ceoFiche)}
        manifeste={{ statut: statutManifeste, dateLimite: dateLimiteIso }}
        onSignale={afficher}
      />

      <Toast message={toast} />
    </>
  );
}
