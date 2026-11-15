"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Copy,
  FileDown,
  Hourglass,
  MessageCircle,
  PenTool,
  Pencil,
  Smartphone,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { SignatureSvg } from "@/components/document/signature";
import { Button, classesBouton } from "@/components/ui/button";
import { formaterDateHeure } from "@/lib/dates";
import type { LigneAnnexeA4 } from "@/lib/signature/annexe";
import { CHAMPS, champsModifies, type Champ, type Saisie, type SignatureEnregistree } from "@/lib/signature/regles";
import { schemaSaisie, schemaTrace } from "@/lib/signature/saisie";
import type { TraceSignature } from "@/types/database";

import { inscrireCeo } from "../../rejoindre/actions";
import { preparerTelephone, signerManifeste, verifierSignature } from "./actions";
import { BarreReseau, copier, Feuille } from "./commun";
import { MomentAnnexe } from "./moment-annexe";
import { PaveSignature } from "./pave-signature";

/*
  Signature en trois étapes (prototype 2-ceo.html) : vos informations, votre signature, vérifiez et signez.
  Puis le moment de l'annexe et les remerciements (fiche, invitation d'un confrère, lien personnel).
  Sur /rejoindre (inscription), l'étape 1 crée la fiche du CEO, puis la suite se fait sur son lien personnel.
*/

type Etape = "infos" | "signature" | "confirmer";

export type Signee = { signature: SignatureEnregistree; trace: TraceSignature | null; modifies: Champ[] };
export type EnvoiSignature = { cle: string; saisie: Saisie; trace: TraceSignature };

type Props = {
  ouvert: boolean;
  onFermer: () => void;
  /* null sur /rejoindre, avant l'inscription */
  jeton: string | null;
  etapeInitiale: Etape;
  saisieInitiale: Saisie;
  saisieListe: Partial<Record<Champ, string>> | null;
  maillons: { libelle: string; description: string }[];
  version: number;
  texteConsentement: string;
  annexe: LigneAnnexeA4[];
  siteUrl: string | null;
  codeParrainage: string | null;
  /* Nouvel inscrit (lien ouvert ou parrainage) : « Gardez votre lien personnel » après la signature */
  nouvelInscrit: boolean;
  /* Inscription par le lien ouvert : « Qui vous a invité ? », prérempli avec le parrain */
  inscription: { parrain: string | null; codeParrain: string } | null;
  /* Signature enregistrée (ici, après une coupure, ou sur le téléphone) : écran de remerciement */
  signee: Signee | null;
  onSignee: (s: Signee) => void;
  onRefus: () => void;
  /* Réseau coupé : la signature est confiée à la page, qui la garde sur l'appareil et la renvoie */
  onHorsLigne: (envoi: EnvoiSignature) => void;
  envoiEnAttente: boolean;
  barreReseau: "perdue" | "retablie" | null;
  onFiche: () => void;
};

const LIBELLES: Record<Champ, string> = {
  prenom: "Prénom",
  nom: "Nom",
  fonction: "Fonction",
  entreprise: "Entreprise (nom officiel)",
  maillon: "Maillon de la chaîne de valeur",
  telephone: "Téléphone WhatsApp",
};

const AUTOCOMPLETE: Partial<Record<Champ, string>> = {
  prenom: "given-name",
  nom: "family-name",
  entreprise: "organization",
  telephone: "tel",
};

const CHAMP_CLASSES =
  "min-h-11 w-full rounded-[10px] border bg-surface px-3 py-3 text-[16px] text-encre outline-none focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)]";

const CARTE = "grid gap-3 rounded-2xl border border-filet bg-surface p-5 text-left";

/* Clé anti-doublon : tirée une fois, renvoyée telle quelle à chaque nouvel essai */
function nouvelleCle(): string {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}

function erreursDe(issues: { path: PropertyKey[]; message: string }[]): Partial<Record<Champ, string>> {
  const e: Partial<Record<Champ, string>> = {};
  issues.forEach((i) => {
    const champ = i.path[0] as Champ;
    if (!e[champ]) e[champ] = i.message;
  });
  return e;
}

export function ParcoursSignature(props: Props) {
  const { ouvert, onFermer, saisieListe, maillons, version, signee } = props;
  const router = useRouter();
  const dialogue = useRef<HTMLDialogElement>(null);
  const fermer = useRef(onFermer);
  const cle = useRef<string | null>(null);
  const [etape, setEtape] = useState<Etape>(props.etapeInitiale);
  const [saisie, setSaisie] = useState<Saisie>(props.saisieInitiale);
  const [invitePar, setInvitePar] = useState(props.inscription?.parrain ?? "");
  const [piege, setPiege] = useState("");
  const [erreurs, setErreurs] = useState<Partial<Record<Champ, string>>>({});
  const [trace, setTrace] = useState<TraceSignature | null>(null);
  const [erreurTrace, setErreurTrace] = useState<string>();
  const [consentement, setConsentement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [annonce, setAnnonce] = useState<string>();
  /* Signer sur son téléphone (ordinateur) : QR code, puis vérification toutes les 5 secondes */
  const [telephone, setTelephone] = useState<{ lien: string; qr: string } | null>(null);
  const [qrOuvert, setQrOuvert] = useState(false);
  const titre = useRef<HTMLHeadingElement>(null);
  const onSignee = useRef(props.onSignee);

  useEffect(() => {
    fermer.current = onFermer;
    onSignee.current = props.onSignee;
  }, [onFermer, props.onSignee]);

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  /* À chaque étape, le focus va au titre (lecteurs d'écran, clavier) */
  useEffect(() => {
    if (ouvert) titre.current?.focus();
  }, [etape, ouvert, signee]);

  /* La page de l'ordinateur se met à jour dès que la signature est faite sur le téléphone */
  const jeton = props.jeton;
  useEffect(() => {
    if (!telephone || signee || !jeton) return;
    const minuterie = window.setInterval(async () => {
      try {
        const r = await verifierSignature({ jeton });
        if (r) {
          setQrOuvert(false);
          onSignee.current({ signature: r.signature, trace: (r.trace as TraceSignature | null) ?? null, modifies: r.modifies });
        }
      } catch {
        /* réseau : nouvel essai dans 5 secondes */
      }
    }, 5000);
    return () => window.clearInterval(minuterie);
  }, [telephone, signee, jeton]);

  useEffect(() => {
    if (!annonce) return;
    const t = window.setTimeout(() => setAnnonce(undefined), 2600);
    return () => window.clearTimeout(t);
  }, [annonce]);

  const modifies = champsModifies(saisieListe, saisie);
  const libellesMaillons = maillons.map((m) => m.libelle);
  const site = () => props.siteUrl ?? window.location.origin;

  const changer = (champ: Champ, valeur: string) => {
    setSaisie((s) => ({ ...s, [champ]: valeur }));
    if (erreurs[champ]) setErreurs((e) => ({ ...e, [champ]: undefined }));
  };

  const validerInfos = async () => {
    const r = schemaSaisie(libellesMaillons).safeParse(saisie);
    if (!r.success) {
      const e = erreursDe(r.error.issues);
      setErreurs(e);
      const premier = CHAMPS.find((c) => e[c]);
      if (premier) document.getElementById(`champ-${premier}`)?.focus();
      return;
    }
    setErreurs({});
    setSaisie(r.data);
    setErreur(undefined);

    /* Lien ouvert : la fiche est créée maintenant, puis la suite se fait sur le lien personnel (D17) */
    if (props.inscription) {
      setEnvoi(true);
      try {
        const res = await inscrireCeo({ saisie: r.data, invitePar, codeParrain: props.inscription.codeParrain, piege });
        if (res.ok) {
          router.push(`/s/${res.jeton}?etape=2`);
          return;
        }
        if (res.champs) setErreurs(res.champs);
        setErreur(res.erreur);
      } catch {
        setErreur("La connexion a échoué. Vérifiez votre connexion Internet, puis réessayez.");
      } finally {
        setEnvoi(false);
      }
      return;
    }
    setEtape("signature");
  };

  const validerTrace = () => {
    const r = schemaTrace.safeParse(trace);
    if (!r.success) {
      setErreurTrace(trace ? (r.error.issues[0]?.message ?? "Votre signature est trop courte.") : "Signez dans le cadre.");
      return;
    }
    setErreurTrace(undefined);
    setConsentement(false);
    setErreur(undefined);
    setEtape("confirmer");
  };

  const signerSurTelephone = async () => {
    if (!jeton) return;
    setErreurTrace(undefined);
    try {
      const r = await preparerTelephone({ jeton, saisie });
      if (!r.ok) return setErreurTrace(r.erreur);
      setTelephone({ lien: r.lien, qr: r.qr });
      setQrOuvert(true);
    } catch {
      setErreurTrace("La connexion a échoué. Vérifiez votre connexion Internet, puis réessayez.");
    }
  };

  const signer = async () => {
    if (!consentement || !trace || envoi || !jeton || props.envoiEnAttente) return;
    if (!cle.current) cle.current = nouvelleCle();
    setEnvoi(true);
    setErreur(undefined);
    try {
      const r = await signerManifeste({ jeton, cle: cle.current, saisie, trace });
      if (r.ok) {
        props.onSignee({ signature: r.signature, trace, modifies: r.modifies });
        return;
      }
      if (r.champs) {
        setErreurs(r.champs);
        setEtape("infos");
        return;
      }
      setErreur(r.erreur);
      if (r.code === "deja_signe" || r.code === "signatures_closes" || r.code === "pas_ouvert") props.onRefus();
    } catch {
      /* Réseau coupé : la signature est gardée sur l'appareil et renvoyée avec la même clé */
      props.onHorsLigne({ cle: cle.current, saisie, trace });
    } finally {
      setEnvoi(false);
    }
  };

  const retour = () => {
    if (etape === "confirmer") setEtape("signature");
    else if (etape === "signature") setEtape("infos");
    else onFermer();
  };

  const numero = signee ? 0 : etape === "infos" ? 1 : etape === "signature" ? 2 : 3;
  const descriptionMaillon = maillons.find((m) => m.libelle === saisie.maillon)?.description;

  let corps: ReactNode = null;
  let pied: ReactNode = null;

  if (signee) {
    const s = signee.signature;
    const moi: LigneAnnexeA4 = {
      cle: "moi",
      prenom: s.prenom,
      nom: s.nom,
      fonction: s.fonction,
      entreprise: s.entreprise,
      maillon: s.maillon,
      trace: signee.trace,
      signeLe: s.signeLe,
    };
    const lienPerso = jeton ? `${site()}/s/${jeton}` : "";
    const lienInvitation = props.codeParrainage ? `${site()}/rejoindre?par=${props.codeParrainage}` : "";
    const telephoneCeo = (props.saisieInitiale.telephone || saisie.telephone).replace(/\D/g, "");
    corps = (
      <>
        <div className="grid justify-items-center gap-3 text-center">
          <MomentAnnexe autres={props.annexe} moi={moi} enAttente={!s.validee} />
          <h2 ref={titre} tabIndex={-1} className="font-titre text-[28px] font-normal outline-none">
            Merci, {s.prenom}
          </h2>
          <p className="text-texte-secondaire">
            {s.validee ? "Votre signature est inscrite dans l'annexe du Manifeste" : "Votre signature est enregistrée"}, sur la version{" "}
            {s.version} du texte, le {formaterDateHeure(s.signeLe)}.
          </p>
          {!s.validee ? (
            <Notice>
              <Hourglass aria-hidden="true" strokeWidth={1.75} />
              <div>
                En attente de vérification. L&apos;équipe vérifie votre inscription ; votre signature sera ensuite ajoutée à
                l&apos;annexe.
              </div>
            </Notice>
          ) : signee.modifies.length ? (
            <Notice>
              <Pencil aria-hidden="true" strokeWidth={1.75} />
              <div>Vous avez modifié vos informations : l&apos;équipe les vérifie avant l&apos;impression. Votre version est retenue.</div>
            </Notice>
          ) : null}
        </div>
        {jeton ? (
          <a className={classesBouton("secondaire")} href={`/s/${jeton}/accuse/pdf`} download={`Accuse-${s.reference}.pdf`}>
            <FileDown aria-hidden="true" strokeWidth={1.75} />
            Télécharger mon accusé
          </a>
        ) : null}
        {props.nouvelInscrit && jeton ? (
          <div className={CARTE}>
            <h3 className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
              <Smartphone aria-hidden="true" strokeWidth={1.75} />
              Gardez votre lien personnel
            </h3>
            <p className="text-texte-secondaire">
              Il vous permet de retrouver votre signature et votre accusé, puis le document final après Abu Dhabi.
            </p>
            {telephoneCeo ? (
              <a
                className={classesBouton("secondaire")}
                href={`https://wa.me/${telephoneCeo}?text=${encodeURIComponent(
                  `Mon lien personnel pour le Manifeste du secteur privé sénégalais de l'eau et de l'assainissement : ${lienPerso}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" strokeWidth={1.75} />
                M&apos;envoyer mon lien sur WhatsApp
              </a>
            ) : null}
            <Button
              variante="discret"
              onClick={async () => setAnnonce((await copier(lienPerso)) ? "Lien copié" : "Copie impossible ici")}
            >
              <Copy aria-hidden="true" strokeWidth={1.75} />
              Copier le lien
            </Button>
          </div>
        ) : null}
        <div className={CARTE}>
          <h3 className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
            <UserRound aria-hidden="true" strokeWidth={1.75} />
            Complétez votre fiche
          </h3>
          <p className="text-texte-secondaire">Facultatif. Ajoutez votre photo et choisissez comment rester en contact.</p>
          <Button onClick={props.onFiche}>
            <UserRound aria-hidden="true" strokeWidth={1.75} />
            Compléter ma fiche
          </Button>
        </div>
        {lienInvitation ? (
          <div className={CARTE}>
            <h3 className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
              <UserPlus aria-hidden="true" strokeWidth={1.75} />
              Invitez un confrère
            </h3>
            <InviterConfrere lien={lienInvitation} onCopie={setAnnonce} />
          </div>
        ) : null}
        <p className="text-center text-[13px] text-texte-secondaire">
          Gardez ce lien : vous y retrouverez le document final après Abu Dhabi.
        </p>
        <Button variante="discret" onClick={onFermer}>
          <BookOpen aria-hidden="true" strokeWidth={1.75} />
          Relire le texte
        </Button>
      </>
    );
  } else if (etape === "infos") {
    corps = (
      <>
        <h2 ref={titre} tabIndex={-1} className="font-titre text-[23px] font-normal outline-none">
          Vos informations
        </h2>
        <p className="text-texte-secondaire">
          {saisieListe ? (
            <>
              Nous avons prérempli à partir de la liste. <strong className="text-encre">Vérifiez et corrigez si besoin</strong> :
              ces informations seront imprimées telles quelles dans l&apos;annexe.
            </>
          ) : (
            "Ces informations seront imprimées telles quelles dans l'annexe du Manifeste."
          )}
        </p>
        <div className="grid gap-4 min-[760px]:grid-cols-2">
          {CHAMPS.map((c) => {
            const modifie = modifies.includes(c);
            const classes = `${CHAMP_CLASSES} ${erreurs[c] ? "border-erreur" : modifie ? "border-argile bg-[#FFFBF7]" : "border-filet-fort"}`;
            const aide = c === "maillon" ? descriptionMaillon : undefined;
            return (
              <div key={c} className="grid content-start gap-2">
                <label htmlFor={`champ-${c}`} className="text-[13.5px] font-medium text-texte-secondaire">
                  {LIBELLES[c]}
                  {modifie ? <span className="sr-only"> (modifié)</span> : null}
                </label>
                {c === "maillon" ? (
                  <select
                    id="champ-maillon"
                    value={saisie.maillon}
                    onChange={(e) => changer("maillon", e.target.value)}
                    aria-invalid={Boolean(erreurs.maillon)}
                    aria-describedby={erreurs.maillon ? "erreur-maillon" : aide ? "aide-maillon" : undefined}
                    className={classes}
                  >
                    <option value="">Choisissez</option>
                    {maillons.map((m) => (
                      <option key={m.libelle} value={m.libelle}>
                        {m.libelle}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`champ-${c}`}
                    value={saisie[c]}
                    onChange={(e) => changer(c, e.target.value)}
                    autoComplete={AUTOCOMPLETE[c]}
                    inputMode={c === "telephone" ? "tel" : undefined}
                    type={c === "telephone" ? "tel" : "text"}
                    placeholder={c === "telephone" ? "+221 …" : c === "fonction" ? "Directeur général, gérante…" : undefined}
                    aria-invalid={Boolean(erreurs[c])}
                    aria-describedby={erreurs[c] ? `erreur-${c}` : undefined}
                    className={classes}
                  />
                )}
                {aide && !erreurs[c] ? (
                  <span id="aide-maillon" className="text-[12.5px] text-texte-secondaire">
                    {aide}
                  </span>
                ) : null}
                {erreurs[c] ? (
                  <span id={`erreur-${c}`} className="text-[13.5px] text-erreur">
                    {erreurs[c]}
                  </span>
                ) : null}
              </div>
            );
          })}
          {props.inscription ? (
            <div className="grid content-start gap-2 min-[760px]:col-span-2">
              <label htmlFor="champ-invite" className="text-[13.5px] font-medium text-texte-secondaire">
                Qui vous a invité ? (facultatif)
              </label>
              <input
                id="champ-invite"
                value={invitePar}
                maxLength={160}
                onChange={(e) => setInvitePar(e.target.value)}
                placeholder="Nom de la personne ou de l'entreprise"
                aria-describedby="aide-invite"
                className={`${CHAMP_CLASSES} border-filet-fort`}
              />
              <span id="aide-invite" className="text-[12.5px] text-texte-secondaire">
                Ça aide l&apos;équipe à vérifier votre inscription.
              </span>
              {/* Champ piège : invisible et hors du parcours au clavier ; seul un robot le remplit */}
              <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
                <label htmlFor="champ-site">Site web</label>
                <input id="champ-site" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
              </div>
            </div>
          ) : null}
        </div>
        {modifies.length ? (
          <Notice>
            <Pencil aria-hidden="true" strokeWidth={1.75} />
            <div>Vous avez modifié certaines informations. C&apos;est votre version qui sera retenue.</div>
          </Notice>
        ) : null}
        {erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreur}
          </p>
        ) : null}
      </>
    );
    pied = (
      <Button variante="principal" onClick={validerInfos} disabled={envoi} aria-busy={envoi}>
        {envoi ? "Enregistrement en cours" : "Continuer"}
        <ArrowRight aria-hidden="true" strokeWidth={1.75} />
      </Button>
    );
  } else if (etape === "signature") {
    corps = (
      <>
        <h2 ref={titre} tabIndex={-1} className="font-titre text-[23px] font-normal outline-none">
          Votre signature
        </h2>
        <p className="text-texte-secondaire min-[760px]:hidden">Signez avec le doigt dans le cadre.</p>
        <p className="hidden text-texte-secondaire min-[760px]:block">Signez avec la souris, le pavé tactile ou un stylet.</p>
        <PaveSignature
          initiale={trace}
          onChange={(t) => {
            setTrace(t);
            setErreurTrace(undefined);
          }}
        />
        {erreurTrace ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreurTrace}
          </p>
        ) : null}
        {jeton ? (
          <div className="hidden items-start gap-2.5 rounded-[10px] bg-[#EDE8DE] px-4 py-3 text-[14px] min-[760px]:flex [&>svg]:mt-0.5 [&>svg]:size-[18px] [&>svg]:shrink-0">
            <Smartphone aria-hidden="true" strokeWidth={1.75} />
            <div className="grid gap-2">
              <p>
                <strong>Plus simple au doigt ?</strong> Continuez sur votre téléphone : vos informations sont gardées, il ne reste
                que la signature.
              </p>
              <div>
                <Button onClick={signerSurTelephone} className="min-h-10 px-3 text-[14px]">
                  <Smartphone aria-hidden="true" strokeWidth={1.75} />
                  Signer sur mon téléphone
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
    pied = (
      <Button variante="principal" onClick={validerTrace} disabled={!trace}>
        Continuer
        <ArrowRight aria-hidden="true" strokeWidth={1.75} />
      </Button>
    );
  } else if (etape === "confirmer" && trace) {
    corps = (
      <>
        <h2 ref={titre} tabIndex={-1} className="font-titre text-[23px] font-normal outline-none">
          Vérifiez et signez
        </h2>
        <p className="text-texte-secondaire">Voici votre ligne dans l&apos;annexe, telle qu&apos;elle sera imprimée.</p>
        <div className="overflow-hidden rounded-md bg-white font-doc-sans shadow-[0_1px_2px_rgba(20,33,43,0.06),0_8px_24px_rgba(20,33,43,0.07)]">
          <div className="grid grid-cols-[28px_1.1fr_0.9fr_1.2fr_1.3fr] text-[8.5px] font-bold tracking-[0.08em] text-doc-gris uppercase">
            {["N°", "Entreprise", "Maillon", "Nom et fonction", "Signature"].map((t) => (
              <div key={t} className="border-b border-doc-filet px-[5px] py-[7px]">
                {t}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[28px_1.1fr_0.9fr_1.2fr_1.3fr] text-[11px] text-doc-texte [&>div]:flex [&>div]:min-w-0 [&>div]:items-center [&>div]:border-r [&>div]:border-doc-filet [&>div]:px-[5px] [&>div]:py-2 [&>div]:[overflow-wrap:anywhere] [&>div:last-child]:border-r-0">
            <div>…</div>
            <div>{saisie.entreprise}</div>
            <div>{saisie.maillon}</div>
            <div className="!block">
              <b className="block">
                {saisie.prenom} {saisie.nom}
              </b>
              <span className="text-[10px] text-doc-gris">{saisie.fonction}</span>
            </div>
            <div className="h-[54px] !p-0.5">
              <SignatureSvg trace={trace} className="h-full" libelle="Votre signature" />
            </div>
          </div>
          <div className="border-t border-[#E3DCCD] bg-[#FBF9F4] px-2.5 py-2 text-[12px] text-texte-secondaire">
            Les signataires sont classés par entreprise. Le numéro est attribué à l&apos;impression.
          </div>
        </div>
        <label className="flex items-start gap-2.5 text-[14.5px]">
          <input
            type="checkbox"
            checked={consentement}
            onChange={(e) => setConsentement(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-eau"
          />
          <span>{props.texteConsentement}</span>
        </label>
        <p className="text-[13px] text-texte-secondaire">
          Vous signez la version {version} du texte. Vous pourrez refaire ou retirer votre signature jusqu&apos;à la clôture.
        </p>
        {erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreur}
          </p>
        ) : null}
      </>
    );
    pied = (
      <Button
        variante="principal"
        onClick={signer}
        disabled={!consentement || envoi || props.envoiEnAttente}
        aria-busy={envoi || props.envoiEnAttente}
      >
        <PenTool aria-hidden="true" strokeWidth={1.75} />
        {props.envoiEnAttente ? "Envoi dès le retour de la connexion" : envoi ? "Enregistrement en cours" : "Je signe le Manifeste"}
      </Button>
    );
  }

  return (
    <dialog
      ref={dialogue}
      aria-label={numero ? `Signature, étape ${numero} sur 3` : "Merci"}
      onCancel={(e) => {
        /* Échap pendant l'enregistrement : on attend la réponse du serveur */
        if (envoi && e.target === e.currentTarget) e.preventDefault();
      }}
      onClose={(e) => {
        /* L'événement d'une fenêtre imbriquée remonte dans React : seule la fermeture de celle-ci compte */
        if (e.target === e.currentTarget) fermer.current();
      }}
      style={{ maxHeight: "none" }}
      className={
        "fixed inset-0 m-0 h-dvh w-full max-w-none bg-papier p-0 text-encre backdrop:bg-[rgba(20,33,43,0.45)] " +
        "min-[760px]:m-auto min-[760px]:h-fit min-[760px]:max-w-[660px] min-[760px]:rounded-[18px] min-[760px]:shadow-[0_24px_70px_rgba(20,33,43,0.3)]"
      }
    >
      {ouvert ? (
        <div className="flex h-full max-h-dvh flex-col min-[760px]:max-h-[85vh]">
          <BarreReseau etat={props.barreReseau} />
          {numero ? (
            <div className="flex shrink-0 items-center gap-2 border-b border-filet bg-surface px-4 py-3">
              <button
                type="button"
                onClick={retour}
                aria-label={etape === "infos" ? "Fermer" : "Étape précédente"}
                className="grid size-11 place-items-center rounded-[10px] text-texte-secondaire hover:bg-[rgba(20,33,43,0.06)] [&_svg]:size-[18px]"
              >
                <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
              </button>
              <span className="flex-1 font-medium">Étape {numero} sur 3</span>
              <span className="flex gap-[5px]" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <span key={i} className={`h-1 w-5 rounded-[2px] ${i <= numero ? "bg-eau" : "bg-filet-fort"}`} />
                ))}
              </span>
            </div>
          ) : null}
          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-5 py-6 min-[760px]:px-8 min-[760px]:py-7">
            {corps}
          </div>
          {pied ? (
            <div className="grid shrink-0 border-t border-filet bg-surface px-4 py-3 min-[760px]:justify-items-end min-[760px]:px-8 min-[760px]:py-4 min-[760px]:[&>button]:min-w-60">
              {pied}
            </div>
          ) : null}
          <div role="status" aria-live="polite" className="sr-only">
            {annonce}
          </div>
          {annonce ? (
            <div className="pointer-events-none fixed inset-x-3.5 bottom-20 mx-auto max-w-[460px] rounded-xl bg-encre px-3.5 py-3 text-[14px] text-white">
              {annonce}
            </div>
          ) : null}
        </div>
      ) : null}

      <Feuille
        ouverte={qrOuvert}
        titre="Signer sur votre téléphone"
        onFermer={() => setQrOuvert(false)}
        pied={<Button onClick={() => setQrOuvert(false)}>Fermer</Button>}
      >
        <h3 className="font-titre text-xl font-normal">Signer sur votre téléphone</h3>
        <p className="text-texte-secondaire">
          Scannez ce code avec l&apos;appareil photo de votre téléphone. Vous arrivez directement à la signature.
        </p>
        {telephone ? (
          <>
            <div
              role="img"
              aria-label="QR code de votre lien personnel"
              className="mx-auto grid size-[212px] place-items-center rounded-xl border border-filet bg-white p-3.5 [&_svg]:size-[184px]"
              dangerouslySetInnerHTML={{ __html: telephone.qr }}
            />
            <p className="text-center text-[13px] break-all text-texte-secondaire">{telephone.lien}</p>
          </>
        ) : null}
        <p className="text-[13px] text-texte-secondaire">Cette page se met à jour dès que vous avez signé sur le téléphone.</p>
      </Feuille>
    </dialog>
  );
}

export function InviterConfrere({ lien, onCopie }: { lien: string; onCopie: (message: string) => void }) {
  const message = `Je viens de signer le Manifeste du secteur privé sénégalais de l'eau et de l'assainissement, qui sera présenté à Abu Dhabi. Vous pouvez le lire et le signer ici : ${lien}`;
  return (
    <>
      <p className="text-texte-secondaire">
        Transférez ce lien à un dirigeant d&apos;une entreprise sénégalaise de l&apos;eau ou de l&apos;assainissement. Il pourra
        signer à son tour.
      </p>
      <a
        className={classesBouton("secondaire")}
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle aria-hidden="true" strokeWidth={1.75} />
        Partager sur WhatsApp
      </a>
      <Button variante="discret" onClick={async () => onCopie((await copier(lien)) ? "Lien d'invitation copié" : "Copie impossible ici")}>
        <Copy aria-hidden="true" strokeWidth={1.75} />
        Copier le lien d&apos;invitation
      </Button>
    </>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] bg-argile-doux px-4 py-3 text-left text-[14px] text-[#6d3818] [&_svg]:mt-0.5 [&_svg]:size-[18px] [&_svg]:shrink-0">
      {children}
    </div>
  );
}
