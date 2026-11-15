"use client";

import {
  BookOpen,
  Calendar,
  CheckCircle2,
  CircleSlash,
  Droplets,
  FileCheck,
  FileDown,
  FileText,
  Hourglass,
  MessageSquare,
  PenTool,
  RotateCcw,
  Send,
  UserPlus,
  UserRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DocumentA4 } from "@/components/document/document-a4";
import { Button, classesBouton } from "@/components/ui/button";
import { formaterDateHeure, formaterJourLong } from "@/lib/dates";
import type { LigneAnnexeA4 } from "@/lib/signature/annexe";
import { garderEnAttente, INTERVALLE_RENVOI, lireEnAttente, oublierEnAttente, type EnvoiEnAttente } from "@/lib/signature/attente";
import { debutParcours } from "@/lib/signature/parcours";
import { schemaSaisie } from "@/lib/signature/saisie";
import type { CommentaireCeo, EspaceCeo } from "@/lib/signature/serveur";
import { numerosDesPoints } from "@/lib/texte/comparer";
import { htmlSur, texteBrut } from "@/lib/texte/html";

import { commenter, marquerOuvert, retirerMaSignature, signerManifeste } from "./actions";
import { BarreReseau, EXPEDITEUR, Feuille, LiensPied } from "./commun";
import { FicheCeo } from "./fiche";
import { InviterConfrere, ParcoursSignature, type EnvoiSignature, type Signee } from "./parcours-signature";

/*
  Espace CEO (prototype 2-ceo.html) : lecture, page A4 avec l'annexe, commentaires,
  signature en trois étapes, puis carte « Votre signature » au retour sur le lien
  (accusé, fiche, refaire ou retirer, invitation d'un confrère).
  Sur /rejoindre (lien ouvert), le même écran sert à l'inscription, sans jeton.
  Mise en page téléphone sous 760 px, ordinateur au-dessus.
*/

type Vue = "lecture" | "a4";

const extrait = (t: string, n = 110) => (t.length > n ? `${t.slice(0, n).trim()}…` : t);

const stockage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

type Props = {
  jeton: string | null;
  espace: EspaceCeo;
  siteUrl: string | null;
  /* ?etape=2 : arrivée depuis le QR code ou après l'inscription, la signature reprend à l'étape 2 */
  reprendreSignature: boolean;
  /* Page /rejoindre : inscription par le lien ouvert ou par parrainage */
  rejoindre: { parrain: string | null; codeParrain: string } | null;
};

export function EspaceCeoClient({ jeton, espace, siteUrl, reprendreSignature, rejoindre }: Props) {
  const router = useRouter();
  const version = espace.version;
  const ouvert = espace.etat === "ouvert";
  const saisieComplete = useMemo(
    () => schemaSaisie(espace.maillons.map((m) => m.libelle)).safeParse(espace.saisieInitiale).success,
    [espace.maillons, espace.saisieInitiale],
  );
  const [vue, setVue] = useState<Vue>("lecture");
  const [focus, setFocus] = useState<string | null>(null);
  const [feuille, setFeuille] = useState<{ blocId: string | null } | null>(null);
  const [texteCommentaire, setTexteCommentaire] = useState("");
  const [erreurCommentaire, setErreurCommentaire] = useState<string>();
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);
  const [commentaires, setCommentaires] = useState<CommentaireCeo[]>(espace.commentaires);
  const debut = debutParcours({
    jeton,
    reprendre: reprendreSignature,
    saisieComplete,
    etat: espace.etat,
    signe: espace.signature !== null,
  });
  const [parcours, setParcours] = useState(debut.ouvert);
  /* Chaque nouvelle signature (après un retrait) repart d'un parcours neuf, avec une nouvelle clé */
  const [numeroParcours, setNumeroParcours] = useState(0);
  const [etapeInitiale, setEtapeInitiale] = useState<"infos" | "signature">(debut.etape);
  const [signeeLocale, setSigneeLocale] = useState<Signee | null>(null);
  const [annonce, setAnnonce] = useState<string | null>(null);
  const [fiche, setFiche] = useState(false);
  const [confirmation, setConfirmation] = useState<"retirer" | "refaire" | null>(null);
  const [retrait, setRetrait] = useState<{ occupe: boolean; erreur?: string }>({ occupe: false });
  const [attente, setAttente] = useState<EnvoiEnAttente | null>(null);
  const [barre, setBarre] = useState<"perdue" | "retablie" | null>(null);

  /* « Ouvert » : noté par le navigateur après l'affichage, jamais par un aperçu de lien (D65) */
  useEffect(() => {
    if (jeton) marquerOuvert({ jeton }).catch(() => undefined);
  }, [jeton]);

  /* ?etape=2 n'est lu qu'une fois : l'adresse redevient le lien personnel */
  useEffect(() => {
    if (reprendreSignature) window.history.replaceState(null, "", window.location.pathname);
  }, [reprendreSignature]);

  /* Signature gardée sur l'appareil lors d'une coupure : reprise automatique au chargement */
  const signatureServeur = espace.signature !== null;
  useEffect(() => {
    if (!jeton) return;
    const t = window.setTimeout(() => {
      if (signatureServeur) return oublierEnAttente(stockage(), jeton);
      const gardee = lireEnAttente(stockage(), jeton, new Date());
      if (gardee) {
        setAttente(gardee);
        setBarre("perdue");
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [jeton, signatureServeur]);

  /* Renvoi au retour du réseau et toutes les 15 secondes, avec la même clé anti-doublon */
  useEffect(() => {
    if (!attente || !jeton) return;
    let actif = true;
    let enCours = false;
    const tenter = async () => {
      if (enCours || !actif || navigator.onLine === false) return;
      enCours = true;
      try {
        const r = await signerManifeste({ jeton, cle: attente.cle, saisie: attente.saisie, trace: attente.trace });
        if (!actif) return;
        oublierEnAttente(stockage(), jeton);
        setAttente(null);
        if (r.ok) {
          setSigneeLocale({ signature: r.signature, trace: attente.trace, modifies: r.modifies });
          setBarre("retablie");
          setParcours(true);
        } else {
          setBarre(null);
          setAnnonce(r.erreur);
        }
        router.refresh();
      } catch {
        /* toujours hors ligne : nouvel essai plus tard */
      } finally {
        enCours = false;
      }
    };
    const premier = window.setTimeout(tenter, 0);
    const minuterie = window.setInterval(tenter, INTERVALLE_RENVOI);
    window.addEventListener("online", tenter);
    return () => {
      actif = false;
      window.clearTimeout(premier);
      window.clearInterval(minuterie);
      window.removeEventListener("online", tenter);
    };
  }, [attente, jeton, router]);

  /* Message bref, effacé après quelques secondes */
  useEffect(() => {
    if (!annonce) return;
    const t = window.setTimeout(() => setAnnonce(null), 2600);
    return () => window.clearTimeout(t);
  }, [annonce]);
  useEffect(() => {
    if (barre !== "retablie") return;
    const t = window.setTimeout(() => setBarre(null), 3000);
    return () => window.clearTimeout(t);
  }, [barre]);

  const signature = espace.signature
    ? espace.signature
    : signeeLocale
      ? {
          reference: signeeLocale.signature.reference,
          signeLe: signeeLocale.signature.signeLe,
          validee: signeeLocale.signature.validee,
        }
      : null;

  /* Signature retirée ou refusée par un admin : ni signature, ni commentaire, ni fiche sur ce lien */
  const refus = espace.refus;
  const peutCommenter = ouvert && espace.identifie && jeton !== null && !refus;
  const prenom = espace.signature?.prenom || signeeLocale?.signature.prenom || espace.saisieInitiale.prenom;
  const dateLimite = formaterJourLong(espace.dateLimite);
  const blocs = useMemo(() => version?.blocs ?? [], [version]);
  const numeros = useMemo(() => numerosDesPoints(blocs), [blocs]);
  const site = siteUrl ?? (typeof window === "undefined" ? "" : window.location.origin);
  const lienInvitation = espace.codeParrainage ? `${site}/rejoindre?par=${espace.codeParrainage}` : null;

  /* Annexe : signatures validées, et la sienne même en attente (les images des autres sont masquées, D75) */
  const lignesAnnexe: LigneAnnexeA4[] = useMemo(() => {
    const lignes = espace.annexe.map((l) => ({ ...l }));
    if (signeeLocale && !espace.annexe.some((l) => l.moi)) {
      const s = signeeLocale.signature;
      lignes.push({
        cle: "moi",
        prenom: s.prenom,
        nom: s.nom,
        fonction: s.fonction,
        entreprise: s.entreprise,
        maillon: s.maillon,
        trace: signeeLocale.trace,
        signeLe: s.signeLe,
        moi: true,
      });
    }
    return lignes;
  }, [espace.annexe, signeeLocale]);
  const autresLignes = useMemo(() => espace.annexe.filter((l) => !l.moi), [espace.annexe]);

  const ouvrirCommentaire = (blocId: string | null) => {
    setTexteCommentaire("");
    setErreurCommentaire(undefined);
    setFeuille({ blocId });
  };

  const envoyerCommentaire = async () => {
    if (!feuille || envoiCommentaire || !jeton) return;
    const texte = texteCommentaire.trim();
    if (texte.length < 2) return setErreurCommentaire("Écrivez au moins deux caractères.");
    setEnvoiCommentaire(true);
    try {
      const r = await commenter({ jeton, texte, blocId: feuille.blocId });
      if (!r.ok) return setErreurCommentaire(r.erreur);
      setCommentaires((c) => [...c, r.commentaire]);
      setFeuille(null);
      setFocus(null);
      setAnnonce("Commentaire transmis à l'équipe de rédaction");
    } catch {
      setErreurCommentaire("La connexion a échoué. Vérifiez votre connexion Internet, puis réessayez.");
    } finally {
      setEnvoiCommentaire(false);
    }
  };

  const horsLigne = (envoi: EnvoiSignature) => {
    if (!jeton) return;
    garderEnAttente(stockage(), jeton, envoi, new Date());
    setAttente({ ...envoi, garde: new Date().toISOString() });
    setBarre("perdue");
  };

  const confirmerRetrait = async () => {
    if (!jeton || !confirmation) return;
    const refaire = confirmation === "refaire";
    setRetrait({ occupe: true });
    try {
      const r = await retirerMaSignature({ jeton });
      if (!r.ok) return setRetrait({ occupe: false, erreur: r.erreur });
      setRetrait({ occupe: false });
      setConfirmation(null);
      setSigneeLocale(null);
      setNumeroParcours((n) => n + 1);
      setEtapeInitiale("infos");
      router.refresh();
      if (refaire) setParcours(true);
      else setAnnonce("Signature retirée");
    } catch {
      setRetrait({ occupe: false, erreur: "La connexion a échoué. Vérifiez votre connexion Internet, puis réessayez." });
    }
  };

  const blocCommente = feuille?.blocId ? blocs.find((b) => b.id === feuille.blocId) : null;

  /* ----- Morceaux de l'écran ----- */

  const bascule = (
    <div role="group" aria-label="Affichage" className="inline-grid w-fit grid-cols-2 overflow-hidden rounded-[10px] border border-filet-fort bg-surface">
      {(
        [
          ["lecture", "Lecture", BookOpen],
          ["a4", "Page A4", FileText],
        ] as const
      ).map(([cle, libelle, Icone]) => (
        <button
          key={cle}
          type="button"
          aria-pressed={vue === cle}
          onClick={() => setVue(cle)}
          className={
            "inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-[14px] font-medium [&_svg]:size-[18px] " +
            (vue === cle ? "bg-eau text-white" : "text-texte-secondaire hover:text-encre")
          }
        >
          <Icone aria-hidden="true" strokeWidth={1.75} />
          {libelle}
        </button>
      ))}
    </div>
  );

  const lecture = version ? (
    <div className="lecture">
      {/* En lecture, le retour à la ligne du Word est ignoré : les lignes s'équilibrent selon l'écran */}
      <h2 className="l-titre">{version.titre.replace(/\s*\n\s*/g, " ")}</h2>
      <div className="l-sous">{version.sousTitre}</div>
      <div className="l-filet" />
      {blocs.map((b, i) => {
        const choisi = focus === b.id;
        const contenu = (
          <>
            {b.type === "li" ? <span className="num">{numeros[i]}.</span> : null}
            <span dangerouslySetInnerHTML={{ __html: htmlSur(b.html) }} />
          </>
        );
        return (
          <div key={b.id} className={`rb ${b.type} ${choisi ? "sel" : ""}`} data-commentable={peutCommenter ? "" : undefined}>
            {peutCommenter ? (
              <div
                role="button"
                tabIndex={0}
                aria-expanded={choisi}
                aria-label={`${texteBrut(b.html).slice(0, 80)} : choisir ce passage pour le commenter`}
                className="rb-texte"
                onClick={() => setFocus(choisi ? null : b.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFocus(choisi ? null : b.id);
                  }
                }}
              >
                {contenu}
              </div>
            ) : (
              <div className="rb-texte">{contenu}</div>
            )}
            {choisi && peutCommenter ? (
              <div className="rb-action">
                <button
                  type="button"
                  onClick={() => ouvrirCommentaire(b.id)}
                  className="inline-flex min-h-11 items-center gap-1.5 font-interface text-[14px] font-medium text-eau [&_svg]:size-[18px]"
                >
                  <MessageSquare aria-hidden="true" strokeWidth={1.75} />
                  Commenter ce passage
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  ) : (
    <p className="text-texte-secondaire">Le texte n&apos;est pas disponible pour l&apos;instant.</p>
  );

  const pageA4 = version ? (
    <DocumentA4
      titre={version.titre}
      sousTitre={version.sousTitre}
      blocs={blocs}
      brouillon={false}
      libelle={`Version ${version.numero}`}
      annexe={rejoindre ? undefined : { lignes: lignesAnnexe }}
    />
  ) : null;

  const carteSignature =
    signature && jeton ? (
      <div className="grid gap-3 rounded-2xl border border-filet bg-surface p-5">
        <h2 className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
          <PenTool aria-hidden="true" strokeWidth={1.75} />
          Votre signature
        </h2>
        <p className="text-[14.5px]">
          Signée le {formaterDateHeure(signature.signeLe)}.
          <br />
          Référence <span className="tabular-nums">{signature.reference}</span>.
        </p>
        {!signature.validee ? (
          <p className="flex items-center gap-2 text-[13.5px] text-[#8a4724] [&_svg]:size-4">
            <Hourglass aria-hidden="true" strokeWidth={1.75} />
            En attente de vérification
          </p>
        ) : null}
        <a className={classesBouton("secondaire")} href={`/s/${jeton}/accuse/pdf`} download={`Accuse-${signature.reference}.pdf`}>
          <FileDown aria-hidden="true" strokeWidth={1.75} />
          Télécharger mon accusé
        </a>
        <Link href={`/s/${jeton}/accuse`} className="inline-flex min-h-11 items-center justify-center text-[13.5px] text-eau">
          Voir l&apos;aperçu de l&apos;accusé
        </Link>
        <Button onClick={() => setFiche(true)}>
          <UserRound aria-hidden="true" strokeWidth={1.75} />
          {espace.photoUrl || Object.values(espace.choix).some(Boolean) ? "Modifier ma fiche" : "Compléter ma fiche"}
        </Button>
        {ouvert ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button className="min-h-11 px-3 text-[14px]" onClick={() => setConfirmation("refaire")}>
                <RotateCcw aria-hidden="true" strokeWidth={1.75} />
                Refaire
              </Button>
              <Button className="min-h-11 px-3 text-[14px]" onClick={() => setConfirmation("retirer")}>
                <XCircle aria-hidden="true" strokeWidth={1.75} />
                Retirer
              </Button>
            </div>
            <p className="text-[13px] text-texte-secondaire">Possible jusqu&apos;à la clôture, le {dateLimite}.</p>
          </>
        ) : null}
      </div>
    ) : null;

  const carteInvitation =
    signature && ouvert && lienInvitation ? (
      <div className="grid gap-3 rounded-2xl border border-filet bg-surface p-5">
        <h2 className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
          <UserPlus aria-hidden="true" strokeWidth={1.75} />
          Invitez un confrère
        </h2>
        <InviterConfrere lien={lienInvitation} onCopie={setAnnonce} />
      </div>
    ) : null;

  const listeCommentaires = commentaires.length ? (
    <div className="grid gap-3 rounded-2xl border border-filet bg-surface p-5">
      <h2 className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
        <MessageSquare aria-hidden="true" strokeWidth={1.75} />
        Vos commentaires
      </h2>
      <ul className="grid gap-3">
        {commentaires.map((c) => {
          const bloc = c.blocId ? blocs.find((b) => b.id === c.blocId) : null;
          return (
            <li key={c.id} className="grid gap-1 border-t border-filet pt-3 first:border-t-0 first:pt-0">
              <span className="text-[12.5px] text-texte-secondaire">
                {bloc ? `« ${extrait(texteBrut(bloc.html), 70)} »` : "Sur l'ensemble du texte"}, le {formaterDateHeure(c.creeLe)}
              </span>
              <p className="text-[14.5px] whitespace-pre-line [overflow-wrap:anywhere]">{c.texte}</p>
            </li>
          );
        })}
      </ul>
      <p className="text-[12.5px] text-texte-secondaire">Lus uniquement par l&apos;équipe de rédaction.</p>
    </div>
  ) : null;

  /* ----- En-tête fixe (ordinateur) ----- */
  const entete = (
    <header className="barre-fixe fixed inset-x-0 top-0 z-20 hidden h-16 items-center gap-3 border-b border-filet px-10 min-[760px]:flex">
      <span className="grid size-8 place-items-center rounded-lg bg-eau text-white [&_svg]:size-[18px]">
        <Droplets aria-hidden="true" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 font-titre text-[16px] leading-tight">
        Manifeste du secteur privé sénégalais de l&apos;eau et de l&apos;assainissement
        {version?.sousTitre ? <span className="block font-interface text-[12.5px] text-texte-secondaire">{version.sousTitre}</span> : null}
      </div>
      {ouvert && !signature && !refus ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-texte-secondaire [&_svg]:size-4">
          <Calendar aria-hidden="true" strokeWidth={1.75} />
          Signature avant le {dateLimite}
        </span>
      ) : null}
    </header>
  );

  /* ----- Écran principal ----- */
  let colonne;
  if (refus && jeton) {
    colonne = (
      <>
        <div className="grid gap-3 rounded-2xl border border-filet bg-surface p-5">
          <span className="grid size-12 place-items-center rounded-full bg-[#EDE8DE] text-texte-secondaire [&_svg]:size-6">
            <CircleSlash aria-hidden="true" strokeWidth={1.75} />
          </span>
          <h1 className="font-titre text-[24px] leading-tight font-normal">Votre signature n&apos;a pas été retenue</h1>
          {espace.whatsappTaskForce ? (
            <p className="text-[15px] text-texte-secondaire">
              Pour toute question, écrivez à {EXPEDITEUR} avec le bouton « Une question ? », en bas de la page.
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 rounded-2xl border border-filet bg-surface p-5">
          <h2 className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
            <PenTool aria-hidden="true" strokeWidth={1.75} />
            Votre signature
          </h2>
          <p className="text-[14.5px]">
            Signée le {formaterDateHeure(refus.signeLe)}.
            <br />
            Référence <span className="tabular-nums">{refus.reference}</span>.
            <br />
            Signature retirée le {formaterDateHeure(refus.retireeLe)}.
          </p>
          <a className={classesBouton("secondaire")} href={`/s/${jeton}/accuse/pdf`} download={`Accuse-${refus.reference}.pdf`}>
            <FileDown aria-hidden="true" strokeWidth={1.75} />
            Télécharger mon accusé
          </a>
        </div>
      </>
    );
  } else if (ouvert) {
    colonne = (
      <>
        {signature ? (
          <div className="flex items-start gap-2.5 rounded-[10px] bg-succes-doux px-4 py-3 text-[14px] text-[#214d39] [&_svg]:mt-0.5 [&_svg]:size-[18px] [&_svg]:shrink-0">
            <CheckCircle2 aria-hidden="true" strokeWidth={1.75} />
            <div>
              Vous avez signé le {formaterDateHeure(signature.signeLe)}.
              {signature.validee ? "" : " Votre signature sera ajoutée à l'annexe après vérification."}
            </div>
          </div>
        ) : null}
        {prenom ? (
          <>
            <h1 className="font-titre text-[28px] leading-[1.15] font-normal min-[760px]:text-[32px]">Bonjour {prenom},</h1>
            <p className="text-[16px] leading-[1.55] text-texte-secondaire">
              {signature
                ? "Merci pour votre signature. Vous pouvez relire le texte, retrouver votre accusé et compléter votre fiche."
                : "Voici le Manifeste qui sera présenté à Abu Dhabi. Lisez-le, puis signez-le. Vous pouvez aussi laisser un commentaire à l'équipe de rédaction."}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-titre text-[28px] leading-[1.15] font-normal">
              Le Manifeste du secteur privé sénégalais de l&apos;eau et de l&apos;assainissement
            </h1>
            <p className="text-[16px] leading-[1.55] text-texte-secondaire">
              Vous dirigez une entreprise sénégalaise de l&apos;eau ou de l&apos;assainissement ? Lisez ce Manifeste, présenté à
              Abu Dhabi, et signez-le au nom de votre entreprise.
            </p>
          </>
        )}
        <p className="flex items-center gap-2 text-[13px] text-texte-secondaire [&_svg]:size-4 [&_svg]:shrink-0">
          <Send aria-hidden="true" strokeWidth={1.75} />
          <span>Envoyé par {EXPEDITEUR}</span>
        </p>
        <div className="flex flex-wrap gap-4 text-[13px] text-texte-secondaire [&_svg]:size-4">
          {version ? (
            <span className="inline-flex items-center gap-1.5">
              <FileCheck aria-hidden="true" strokeWidth={1.75} />
              Version {version.numero}
            </span>
          ) : null}
          {!signature ? (
            <span className="inline-flex items-center gap-1.5 min-[760px]:hidden">
              <Calendar aria-hidden="true" strokeWidth={1.75} />
              Signature avant le {dateLimite}
            </span>
          ) : null}
        </div>
        {!signature ? (
          <div className="hidden gap-2 min-[760px]:grid">
            <Button variante="principal" className="min-h-[52px] text-[16px]" onClick={() => setParcours(true)}>
              <PenTool aria-hidden="true" strokeWidth={1.75} />
              Signer le Manifeste
            </Button>
            <p className="text-[13px] text-texte-secondaire">
              Trois étapes : vos informations, votre signature, la vérification. Environ deux minutes.
            </p>
          </div>
        ) : null}
        {carteSignature}
        {peutCommenter ? (
          <div className="hidden min-[760px]:grid">
            <Button onClick={() => ouvrirCommentaire(null)}>
              <MessageSquare aria-hidden="true" strokeWidth={1.75} />
              Laisser un commentaire
            </Button>
          </div>
        ) : null}
        {carteInvitation}
        {listeCommentaires}
      </>
    );
  } else {
    /* Signatures closes (date limite ou clôture) et document publié : lecture seule */
    colonne = (
      <>
        {espace.etat === "clos" ? (
          <div className="grid justify-items-center gap-3 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-[#EDE8DE] text-texte-secondaire [&_svg]:size-[30px]">
              <CircleSlash aria-hidden="true" strokeWidth={1.75} />
            </span>
            <h1 className="font-titre text-[22px] font-normal">Les signatures sont closes</h1>
            <p className="text-texte-secondaire">La période de signature est terminée. Vous pouvez encore lire le texte.</p>
          </div>
        ) : (
          <>
            <h1 className="font-titre text-[28px] leading-[1.15] font-normal">{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</h1>
            <p className="text-[16px] leading-[1.55] text-texte-secondaire">Le Manifeste a été présenté à Abu Dhabi. Vous pouvez relire le texte.</p>
          </>
        )}
        {carteSignature}
        {listeCommentaires}
      </>
    );
  }

  return (
    <div data-ambiance="ceo" className="min-h-dvh bg-papier text-encre">
      {entete}
      {!parcours ? (
        <div className="fixed inset-x-0 top-0 z-30 min-[760px]:top-16">
          <BarreReseau etat={barre} />
        </div>
      ) : null}
      <main className="mx-auto grid w-full max-w-[1160px] content-start gap-4 px-5 pt-6 pb-[104px] min-[760px]:grid-cols-[minmax(0,1fr)_340px] min-[760px]:items-start min-[760px]:gap-12 min-[760px]:px-10 min-[760px]:pt-24 min-[760px]:pb-16">
        <aside className="grid min-w-0 content-start gap-4 min-[760px]:sticky min-[760px]:top-24 min-[760px]:order-2">
          <p className="text-[13px] text-texte-secondaire min-[760px]:hidden">Manifeste</p>
          {colonne}
        </aside>
        <div className="grid min-w-0 content-start gap-4 min-[760px]:order-1">
          {bascule}
          {vue === "lecture" ? lecture : pageA4}
          {vue === "lecture" && version ? (
            peutCommenter ? (
              <p className="text-[13px] text-texte-secondaire">
                <span className="min-[760px]:hidden">Touchez un paragraphe pour le commenter.</span>
                <span className="hidden min-[760px]:inline">Cliquez sur un paragraphe pour le commenter.</span>
              </p>
            ) : ouvert && !espace.identifie ? (
              <p className="text-[13px] text-texte-secondaire">
                Vous pourrez commenter le texte dès que vous aurez indiqué votre nom, à la première étape de la signature.
              </p>
            ) : null
          ) : null}
          <LiensPied whatsapp={espace.whatsappTaskForce} />
        </div>
      </main>

      {/* Barre fixe du bas (téléphone) */}
      {ouvert && !refus ? (
        <div
          className={
            "barre-fixe fixed inset-x-0 bottom-0 z-20 grid gap-2.5 border-t border-filet px-4 py-3 min-[760px]:hidden " +
            (signature || !peutCommenter ? "grid-cols-1" : "grid-cols-[auto_1fr]")
          }
        >
          {signature ? (
            peutCommenter ? (
              <Button onClick={() => ouvrirCommentaire(null)}>
                <MessageSquare aria-hidden="true" strokeWidth={1.75} />
                Laisser un commentaire
              </Button>
            ) : null
          ) : (
            <>
              {peutCommenter ? (
                <Button onClick={() => ouvrirCommentaire(null)} aria-label="Laisser un commentaire">
                  <MessageSquare aria-hidden="true" strokeWidth={1.75} />
                </Button>
              ) : null}
              <Button variante="principal" onClick={() => setParcours(true)}>
                <PenTool aria-hidden="true" strokeWidth={1.75} />
                Signer le Manifeste
              </Button>
            </>
          )}
        </div>
      ) : null}

      <Feuille
        ouverte={feuille !== null}
        titre="Votre commentaire"
        onFermer={() => setFeuille(null)}
        pied={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setFeuille(null)}>Annuler</Button>
            <Button variante="principal" onClick={envoyerCommentaire} disabled={envoiCommentaire}>
              <Send aria-hidden="true" strokeWidth={1.75} />
              Envoyer
            </Button>
          </div>
        }
      >
        {blocCommente ? (
          <p className="rounded-lg bg-[#F6F2E8] px-3 py-2 text-[14px] text-texte-secondaire italic">
            « {extrait(texteBrut(blocCommente.html))} »
          </p>
        ) : (
          <p className="text-[13px] text-texte-secondaire">Commentaire général sur le texte.</p>
        )}
        <label htmlFor="commentaire" className="sr-only">
          Votre remarque
        </label>
        <textarea
          id="commentaire"
          autoFocus
          maxLength={1000}
          value={texteCommentaire}
          onChange={(e) => {
            setTexteCommentaire(e.target.value);
            setErreurCommentaire(undefined);
          }}
          placeholder="Écrivez votre remarque"
          aria-invalid={Boolean(erreurCommentaire)}
          aria-describedby="commentaire-aide"
          className="min-h-[100px] w-full resize-y rounded-[10px] border border-filet-fort bg-surface p-3 text-[16px] outline-none focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)]"
        />
        <div id="commentaire-aide" className="flex justify-between gap-3 text-[13px] text-texte-secondaire">
          <span>Lu uniquement par l&apos;équipe de rédaction, pas par les autres signataires.</span>
          <span className="shrink-0 tabular-nums">{texteCommentaire.length} / 1000</span>
        </div>
        {erreurCommentaire ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreurCommentaire}
          </p>
        ) : null}
      </Feuille>

      <Feuille
        ouverte={confirmation !== null}
        titre={confirmation === "refaire" ? "Refaire votre signature ?" : "Retirer votre signature ?"}
        onFermer={() => {
          setConfirmation(null);
          setRetrait({ occupe: false });
        }}
        pied={
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                setConfirmation(null);
                setRetrait({ occupe: false });
              }}
            >
              Garder
            </Button>
            <Button variante={confirmation === "refaire" ? "principal" : "danger"} onClick={confirmerRetrait} disabled={retrait.occupe}>
              {confirmation === "refaire" ? "Refaire" : "Retirer"}
            </Button>
          </div>
        }
      >
        <p className="text-texte-secondaire">
          {confirmation === "refaire"
            ? "Votre signature actuelle est retirée, puis vous signez de nouveau. Vous recevrez une nouvelle référence et un nouvel accusé."
            : `Votre nom et celui de votre entreprise n'apparaîtront pas dans l'annexe. Vous pourrez signer à nouveau jusqu'au ${dateLimite}.`}
        </p>
        {retrait.erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {retrait.erreur}
          </p>
        ) : null}
      </Feuille>

      {jeton && signature ? (
        <FicheCeo
          ouverte={fiche}
          onFermer={() => setFiche(false)}
          jeton={jeton}
          photoInitiale={espace.photoUrl}
          choixInitiaux={espace.choix}
          onEnregistree={(message) => {
            setFiche(false);
            setAnnonce(message);
            router.refresh();
          }}
        />
      ) : null}

      {ouvert && version && !refus && (!espace.signature || signeeLocale) ? (
        <ParcoursSignature
          key={numeroParcours}
          ouvert={parcours}
          onFermer={() => setParcours(false)}
          jeton={jeton}
          etapeInitiale={etapeInitiale}
          saisieInitiale={espace.saisieInitiale}
          saisieListe={espace.origine === "liste" ? espace.saisieListe : null}
          maillons={espace.maillons}
          version={version.numero}
          texteConsentement={espace.texteConsentement}
          annexe={autresLignes}
          siteUrl={siteUrl}
          codeParrainage={espace.codeParrainage}
          nouvelInscrit={espace.origine !== "liste"}
          inscription={rejoindre}
          signee={signeeLocale}
          onSignee={(s) => {
            setSigneeLocale(s);
            setParcours(true);
            router.refresh();
          }}
          onRefus={() => router.refresh()}
          onHorsLigne={horsLigne}
          envoiEnAttente={attente !== null}
          barreReseau={barre}
          onFiche={() => setFiche(true)}
        />
      ) : null}

      <div
        role="status"
        aria-live="polite"
        className={
          "pointer-events-none fixed inset-x-3.5 bottom-[84px] z-30 mx-auto w-auto max-w-[460px] min-[760px]:top-[84px] min-[760px]:bottom-auto " +
          (annonce ? "" : "sr-only")
        }
      >
        {annonce ? (
          <div className="flex items-center gap-2 rounded-xl bg-encre px-3.5 py-3 text-[14px] text-white">{annonce}</div>
        ) : null}
      </div>
    </div>
  );
}
