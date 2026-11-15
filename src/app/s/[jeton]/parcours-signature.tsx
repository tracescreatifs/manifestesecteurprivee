"use client";

import { ArrowLeft, ArrowRight, BookOpen, FileDown, Hourglass, PenTool, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { SignatureSvg } from "@/components/document/signature";
import { Button, classesBouton } from "@/components/ui/button";
import { formaterDateHeure } from "@/lib/dates";
import type { LigneAnnexeA4 } from "@/lib/signature/annexe";
import { CHAMPS, champsModifies, type Champ, type Saisie, type SignatureEnregistree } from "@/lib/signature/regles";
import { schemaSaisie, schemaTrace } from "@/lib/signature/saisie";
import type { TraceSignature } from "@/types/database";

import { signerManifeste } from "./actions";
import { MomentAnnexe } from "./moment-annexe";
import { PaveSignature } from "./pave-signature";

/*
  Signature en trois étapes (prototype 2-ceo.html) : vos informations, votre signature, vérifiez et signez.
  Puis le moment de l'annexe et les remerciements.
*/

type Etape = "infos" | "signature" | "confirmer" | "merci";

export type Signee = { signature: SignatureEnregistree; trace: TraceSignature; modifies: Champ[] };

type Props = {
  ouvert: boolean;
  onFermer: () => void;
  jeton: string;
  saisieInitiale: Saisie;
  saisieListe: Partial<Record<Champ, string>> | null;
  maillons: { libelle: string; description: string }[];
  version: number;
  texteConsentement: string;
  annexe: LigneAnnexeA4[];
  onSignee: (s: Signee) => void;
  onRefus: () => void;
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

/* Clé anti-doublon : tirée une fois, renvoyée telle quelle à chaque nouvel essai */
function nouvelleCle(): string {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}

export function ParcoursSignature(props: Props) {
  const { ouvert, onFermer, saisieInitiale, saisieListe, maillons, version } = props;
  const dialogue = useRef<HTMLDialogElement>(null);
  const fermer = useRef(onFermer);
  const cle = useRef<string | null>(null);
  const [etape, setEtape] = useState<Etape>("infos");
  const [saisie, setSaisie] = useState<Saisie>(saisieInitiale);
  const [erreurs, setErreurs] = useState<Partial<Record<Champ, string>>>({});
  const [trace, setTrace] = useState<TraceSignature | null>(null);
  const [erreurTrace, setErreurTrace] = useState<string>();
  const [consentement, setConsentement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [signee, setSignee] = useState<Signee | null>(null);
  const titre = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    fermer.current = onFermer;
  }, [onFermer]);

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  /* À chaque étape, le focus va au titre (lecteurs d'écran, clavier) */
  useEffect(() => {
    if (ouvert) titre.current?.focus();
  }, [etape, ouvert]);

  const modifies = champsModifies(saisieListe, saisie);
  const libellesMaillons = maillons.map((m) => m.libelle);

  const changer = (champ: Champ, valeur: string) => {
    setSaisie((s) => ({ ...s, [champ]: valeur }));
    if (erreurs[champ]) setErreurs((e) => ({ ...e, [champ]: undefined }));
  };

  const validerInfos = () => {
    const r = schemaSaisie(libellesMaillons).safeParse(saisie);
    if (!r.success) {
      const e: Partial<Record<Champ, string>> = {};
      r.error.issues.forEach((i) => {
        const champ = i.path[0] as Champ;
        if (!e[champ]) e[champ] = i.message;
      });
      setErreurs(e);
      const premier = CHAMPS.find((c) => e[c]);
      if (premier) document.getElementById(`champ-${premier}`)?.focus();
      return;
    }
    setErreurs({});
    setSaisie(r.data);
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

  const signer = async () => {
    if (!consentement || !trace || envoi) return;
    if (!cle.current) cle.current = nouvelleCle();
    setEnvoi(true);
    setErreur(undefined);
    try {
      const r = await signerManifeste({ jeton: props.jeton, cle: cle.current, saisie, trace });
      if (r.ok) {
        const resultat = { signature: r.signature, trace, modifies: r.modifies };
        setSignee(resultat);
        setEtape("merci");
        props.onSignee(resultat);
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
      setErreur(
        "La connexion a échoué. Vérifiez votre connexion Internet, puis appuyez de nouveau sur « Je signe le Manifeste » : votre signature ne sera jamais enregistrée deux fois.",
      );
    } finally {
      setEnvoi(false);
    }
  };

  const retour = () => {
    if (etape === "confirmer") setEtape("signature");
    else if (etape === "signature") setEtape("infos");
    else onFermer();
  };

  const numero = etape === "infos" ? 1 : etape === "signature" ? 2 : etape === "confirmer" ? 3 : 0;
  const descriptionMaillon = maillons.find((m) => m.libelle === saisie.maillon)?.description;

  let corps: ReactNode = null;
  let pied: ReactNode = null;

  if (etape === "infos") {
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
        </div>
        {modifies.length ? (
          <div className="flex items-start gap-2.5 rounded-[10px] bg-argile-doux px-4 py-3 text-[14px] text-[#6d3818] [&_svg]:mt-0.5 [&_svg]:size-[18px] [&_svg]:shrink-0">
            <Pencil aria-hidden="true" strokeWidth={1.75} />
            <div>Vous avez modifié certaines informations. C&apos;est votre version qui sera retenue.</div>
          </div>
        ) : null}
      </>
    );
    pied = (
      <Button variante="principal" onClick={validerInfos}>
        Continuer
        <ArrowRight aria-hidden="true" strokeWidth={1.75} />
      </Button>
    );
  }

  if (etape === "signature") {
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
      </>
    );
    pied = (
      <Button variante="principal" onClick={validerTrace} disabled={!trace}>
        Continuer
        <ArrowRight aria-hidden="true" strokeWidth={1.75} />
      </Button>
    );
  }

  if (etape === "confirmer" && trace) {
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
        <p className="text-[13px] text-texte-secondaire">Vous signez la version {version} du texte.</p>
        {erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreur}
          </p>
        ) : null}
      </>
    );
    pied = (
      <Button variante="principal" onClick={signer} disabled={!consentement || envoi} aria-busy={envoi}>
        <PenTool aria-hidden="true" strokeWidth={1.75} />
        {envoi ? "Enregistrement en cours" : "Je signe le Manifeste"}
      </Button>
    );
  }

  if (etape === "merci" && signee) {
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
              <div>L&apos;équipe vérifie votre inscription. Votre signature sera ensuite ajoutée à l&apos;annexe.</div>
            </Notice>
          ) : signee.modifies.length ? (
            <Notice>
              <Pencil aria-hidden="true" strokeWidth={1.75} />
              <div>Vous avez modifié vos informations : l&apos;équipe les vérifie avant l&apos;impression. Votre version est retenue.</div>
            </Notice>
          ) : null}
        </div>
        <Link className={classesBouton("secondaire")} href={`/s/${props.jeton}/accuse`}>
          <FileDown aria-hidden="true" strokeWidth={1.75} />
          Télécharger mon accusé
        </Link>
        <p className="text-center text-[13px] text-texte-secondaire">
          Gardez ce lien : vous y retrouverez le document final après Abu Dhabi.
        </p>
        <Button variante="discret" onClick={onFermer}>
          <BookOpen aria-hidden="true" strokeWidth={1.75} />
          Relire le texte
        </Button>
      </>
    );
  }

  return (
    <dialog
      ref={dialogue}
      aria-label={numero ? `Signature, étape ${numero} sur 3` : "Merci"}
      onCancel={(e) => {
        /* Échap pendant l'enregistrement : on attend la réponse du serveur */
        if (envoi) e.preventDefault();
      }}
      onClose={() => fermer.current()}
      className={
        "fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-papier p-0 text-encre backdrop:bg-[rgba(20,33,43,0.45)] " +
        "min-[760px]:m-auto min-[760px]:h-fit min-[760px]:max-h-[85vh] min-[760px]:max-w-[660px] min-[760px]:rounded-[18px] min-[760px]:shadow-[0_24px_70px_rgba(20,33,43,0.3)]"
      }
    >
      {ouvert ? (
        <div className="flex h-full max-h-[inherit] flex-col min-[760px]:max-h-[85vh]">
          {numero ? (
            <div className="flex items-center gap-2 border-b border-filet bg-surface px-4 py-3">
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
          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 py-6 min-[760px]:px-8 min-[760px]:py-7">{corps}</div>
          {pied ? (
            <div className="grid border-t border-filet bg-surface px-4 py-3 min-[760px]:justify-items-end min-[760px]:px-8 min-[760px]:py-4 min-[760px]:[&>button]:min-w-60">
              {pied}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] bg-argile-doux px-4 py-3 text-left text-[14px] text-[#6d3818] [&_svg]:mt-0.5 [&_svg]:size-[18px] [&_svg]:shrink-0">
      {children}
    </div>
  );
}
