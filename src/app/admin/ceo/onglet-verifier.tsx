"use client";

import { Building2, Check, CheckCheck, Copy, MessageCircle, RotateCcw, ShieldCheck, UserPlus, X } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { SignatureSvg } from "@/components/document/signature";
import { ApercuWhatsApp } from "@/components/apercu-whatsapp";
import { Button, classesBouton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";
import { formaterDateHeure } from "@/lib/dates";
import { formaterTelephone } from "@/lib/ceo/normaliser";
import { lienPersonnel, lienWhatsApp } from "@/lib/ceo/message";
import {
  comparerChamps,
  LIBELLES_DECISIONS,
  messageValidation,
  type ActionVerification,
} from "@/lib/verification/regles";
import type { CasVerification, SignatureCas } from "@/lib/verification/serveur";
import type { OrigineInvitation, StatutManifeste } from "@/types/database";

import { deciderVerification } from "./actions-verification";

/*
  Onglet « À vérifier » (prototype 1-admin.html, cahier des charges 6.4) :
  modification (comparaison champ par champ), nouvel inscrit, doublon d'entreprise.
  Chaque décision passe par le serveur et le journal ; les cas traités restent consultables.
*/

const ORIGINES: Record<OrigineInvitation, string> = {
  liste: "Liste importée",
  lien_ouvert: "Lien ouvert",
  parrainage: "Parrainage",
};

const LIBELLES_ACTIONS: Record<ActionVerification, string> = {
  verifier: "Marquer comme vérifié",
  valider: "Valider",
  garder_les_deux: "Garder les deux",
  mettre_a_jour_entreprise: "Mettre à jour l'entreprise",
  retirer: "Retirer la signature",
};

function libelleRetrait(cas: CasVerification): string {
  return cas.motif === "nouveau" ? "Refuser" : cas.motif === "doublon" ? "Retirer cette signature" : "Retirer la signature";
}

type Confirmation = { cas: CasVerification; action: "retirer" | "mettre_a_jour_entreprise" };

export function OngletVerifier({
  aTraiter,
  traites,
  autoValidation,
  statutManifeste,
  cible,
  siteUrl,
}: {
  aTraiter: CasVerification[];
  traites: CasVerification[];
  autoValidation: boolean;
  statutManifeste: StatutManifeste;
  /* Raccourci depuis la fiche du CEO : le cas à montrer */
  cible?: string | null;
  /* Adresse publique, pour le lien personnel du message de validation */
  siteUrl: string | null;
}) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [vue, setVue] = useState<"a_traiter" | "traites">(
    cible && !aTraiter.some((c) => c.invitationId === cible) && traites.some((c) => c.invitationId === cible) ? "traites" : "a_traiter",
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string>();
  /* Après « Valider » : proposer de prévenir le nouvel inscrit sur WhatsApp (facultatif) */
  const [valide, setValide] = useState<{ prenom: string; telephone: string; jeton: string } | null>(null);

  /* Raccourci depuis la fiche : le cas visé est amené à l'écran */
  useEffect(() => {
    if (!cible) return;
    const t = window.setTimeout(() => document.getElementById(`cas-${cible}`)?.scrollIntoView({ block: "start" }), 50);
    return () => window.clearTimeout(t);
  }, [cible]);

  const decider = (cas: CasVerification, action: ActionVerification, motifSaisi = "") => {
    setErreur(undefined);
    demarrer(async () => {
      const r = await deciderVerification({ invitationId: cas.invitationId, action, motif: motifSaisi });
      if (!r.ok) {
        if (confirmation) setErreur(r.erreur);
        else afficher(r.erreur);
        return;
      }
      setConfirmation(null);
      setMotif("");
      if (action === "valider") {
        setValide({ prenom: cas.signature?.prenom || cas.saisie.prenom || "", telephone: cas.telephone, jeton: cas.jeton });
      }
      afficher(
        action === "retirer"
          ? cas.motif === "nouveau"
            ? "Signature refusée"
            : "Signature retirée"
          : action === "valider"
            ? "Signature validée : elle entre dans l'annexe"
            : action === "mettre_a_jour_entreprise"
              ? "Entreprise mise à jour"
              : "Décision enregistrée",
      );
    });
  };

  const liste = vue === "a_traiter" ? aTraiter : traites;

  return (
    <div className="grid gap-4">
      <p className="max-w-[80ch] text-texte-secondaire">
        Chaque CEO remplit lui-même ses informations, et c&apos;est sa version qui prime. Ici arrivent seulement les cas à
        regarder : informations différentes de votre liste, CEO absent de la liste, entreprise qui a déjà signé.{" "}
        {autoValidation
          ? "Les signatures identiques à la liste sont validées automatiquement."
          : "La validation automatique est désactivée : toutes les signatures passent ici."}
      </p>

      {valide ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] bg-succes-doux px-4 py-3 text-[14.5px] text-[#214d39]">
          <Check aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 flex-1">
            La signature de {valide.prenom || "ce CEO"} est validée. Vous pouvez le prévenir sur WhatsApp (facultatif).
          </span>
          {valide.telephone && siteUrl ? (
            <a
              className={classesBouton("secondaire", "min-h-10 px-3 text-[14px]")}
              href={lienWhatsApp(valide.telephone, messageValidation(valide.prenom, lienPersonnel(siteUrl, valide.jeton)))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" strokeWidth={1.75} />
              Prévenir sur WhatsApp
            </a>
          ) : (
            <span className="text-[13px]">
              {valide.telephone ? "L'adresse du site n'est pas configurée : le lien ne peut pas être construit." : "Aucun numéro WhatsApp."}
            </span>
          )}
          <Button variante="discret" className="min-h-10 px-3 text-[14px]" onClick={() => setValide(null)}>
            Fermer
          </Button>
          {valide.telephone && siteUrl ? (
            <div className="grid basis-full gap-1.5">
              <p className="text-[13px] text-texte-secondaire">Aperçu dans WhatsApp</p>
              <ApercuWhatsApp message={messageValidation(valide.prenom, lienPersonnel(siteUrl, valide.jeton))} fond="surface" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer les cas">
        {(
          [
            ["a_traiter", "À traiter", aTraiter.length],
            ["traites", "Traités", traites.length],
          ] as const
        ).map(([cle, libelle, n]) => (
          <button
            key={cle}
            type="button"
            aria-pressed={vue === cle}
            onClick={() => setVue(cle)}
            className={
              "min-h-11 rounded-full border px-3 text-[13.5px] font-medium " +
              (vue === cle ? "border-encre bg-encre text-white" : "border-filet-fort bg-surface text-texte-secondaire")
            }
          >
            {libelle} <span className="tabular-nums">{n}</span>
          </button>
        ))}
      </div>

      {liste.length === 0 ? (
        <p className="rounded-xl border border-filet bg-surface px-4 py-7 text-center text-texte-secondaire">
          {vue === "a_traiter" ? "Rien à vérifier pour l'instant." : "Aucun cas traité pour l'instant."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {liste.map((cas) => (
            <li key={cas.invitationId} id={`cas-${cas.invitationId}`} className="scroll-mt-24">
              <CarteCas
                cas={cas}
                cible={cas.invitationId === cible}
                enCours={enCours}
                statutManifeste={statutManifeste}
                onAction={(action) =>
                  action === "retirer" || action === "mettre_a_jour_entreprise"
                    ? (setErreur(undefined), setMotif(""), setConfirmation({ cas, action }))
                    : decider(cas, action)
                }
              />
            </li>
          ))}
        </ul>
      )}

      <Modal
        ouvert={confirmation !== null}
        titre={
          confirmation?.action === "mettre_a_jour_entreprise"
            ? "Mettre à jour l'entreprise"
            : confirmation
              ? libelleRetrait(confirmation.cas)
              : ""
        }
        onFermer={() => setConfirmation(null)}
        pied={
          confirmation ? (
            <>
              <Button variante="discret" onClick={() => setConfirmation(null)}>
                Annuler
              </Button>
              <Button
                variante={confirmation.action === "retirer" ? "danger" : "principal"}
                disabled={enCours}
                onClick={() => decider(confirmation.cas, confirmation.action, motif)}
              >
                {confirmation.action === "retirer" ? <X aria-hidden="true" strokeWidth={1.75} /> : <Building2 aria-hidden="true" strokeWidth={1.75} />}
                {confirmation.action === "retirer" ? libelleRetrait(confirmation.cas) : "Mettre à jour"}
              </Button>
            </>
          ) : null
        }
      >
        {confirmation?.action === "mettre_a_jour_entreprise" ? (
          <>
            <p>
              L&apos;entreprise « {confirmation.cas.entrepriseEnregistree} » prendra le nom et le maillon saisis par le CEO : «{" "}
              {confirmation.cas.saisie.entreprise} », {confirmation.cas.saisie.maillon}. La signature sera marquée comme vérifiée.
            </p>
            {confirmation.cas.autresCeoEntreprise > 0 ? (
              <p className="rounded-[10px] bg-argile-doux px-4 py-3 text-[14px] text-[#6d3818]">
                {confirmation.cas.autresCeoEntreprise === 1
                  ? "Un autre CEO est rattaché à cette entreprise : le changement s'applique aussi à lui."
                  : `${confirmation.cas.autresCeoEntreprise} autres CEO sont rattachés à cette entreprise : le changement s'applique aussi à eux.`}
              </p>
            ) : null}
          </>
        ) : confirmation ? (
          <>
            <p>
              {confirmation.cas.motif === "nouveau"
                ? "Sa signature n'entrera pas dans l'annexe."
                : "Sa signature sort de l'annexe. Elle n'est jamais effacée : vous pourrez la rétablir depuis sa fiche tant que les signatures sont ouvertes."}{" "}
              Sur son lien, le CEO verra « Votre signature n&apos;a pas été retenue » et ne pourra plus signer.
            </p>
            <div className="grid gap-2">
              <label htmlFor="motif-retrait" className="text-[13px] font-medium text-texte-secondaire">
                Motif (facultatif, gardé dans le journal, jamais montré au CEO)
              </label>
              <textarea
                id="motif-retrait"
                value={motif}
                maxLength={500}
                onChange={(e) => setMotif(e.target.value)}
                className="min-h-[80px] w-full resize-y rounded-[10px] border border-filet-fort bg-surface p-3 text-[15px] outline-none focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)]"
              />
            </div>
          </>
        ) : null}
        {erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreur}
          </p>
        ) : null}
      </Modal>
      <Toast message={message} />
    </div>
  );
}

function Entete({ cas }: { cas: CasVerification }) {
  const chips: ReactNode[] = [];
  if (cas.motif === "modification") {
    chips.push(
      <Chip key="m" variante="argile">
        Informations modifiées par le CEO
      </Chip>,
      <Chip key="a" variante="succes">
        Déjà dans l&apos;annexe avec sa version
      </Chip>,
    );
  } else if (cas.motif === "nouveau") {
    chips.push(
      <Chip key="m" variante="eau">
        <UserPlus aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        Nouvel inscrit, par {cas.origine === "parrainage" ? "parrainage" : "le lien ouvert"}
      </Chip>,
      <Chip key="a" variante="neutre">
        {cas.signature?.validee ? "Dans l'annexe" : "Pas encore dans l'annexe"}
      </Chip>,
    );
  } else if (cas.motif === "doublon") {
    chips.push(
      <Chip key="m" variante="argile">
        <Copy aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        Entreprise qui a déjà signé
      </Chip>,
    );
  } else {
    chips.push(
      <Chip key="m" variante="argile">
        Validation automatique coupée
      </Chip>,
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips}
      {cas.signature ? (
        <span className="text-[13px] text-texte-secondaire">Signé le {formaterDateHeure(cas.signature.signeLe)}</span>
      ) : null}
    </div>
  );
}

/* Comparaison champ par champ : un tableau sur ordinateur, des champs empilés sur téléphone */
function Comparaison({ cas }: { cas: CasVerification }) {
  const lignes = comparerChamps(cas.liste, cas.saisie);
  return (
    <div className="overflow-hidden rounded-[10px] border border-filet" role="table" aria-label="Votre liste et saisie du CEO">
      <div role="row" className="hidden grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-sureleve px-3 py-2 text-[12.5px] font-semibold text-texte-secondaire min-[640px]:grid">
        <div role="columnheader">Champ</div>
        <div role="columnheader">Votre liste</div>
        <div role="columnheader">Saisie du CEO (retenue)</div>
      </div>
      {lignes.map((l) => {
        const liste = l.champ === "telephone" ? formaterTelephone(l.liste) || l.liste : l.liste;
        const saisie = l.champ === "telephone" ? formaterTelephone(l.saisie) || l.saisie : l.saisie;
        return (
          <div
            key={l.champ}
            role="row"
            className={
              "grid gap-1 border-t border-filet px-3 py-2.5 text-[14.5px] first:border-t-0 min-[640px]:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)] min-[640px]:gap-3 " +
              (l.different ? "bg-[#FFF8F1]" : "")
            }
          >
            <div role="rowheader" className="text-[13px] font-medium text-texte-secondaire">
              {l.libelle}
              {l.different ? <span className="sr-only"> (différent)</span> : null}
            </div>
            <div role="cell" className="min-w-0 [overflow-wrap:anywhere]">
              <span className="text-[12.5px] text-texte-secondaire min-[640px]:hidden">Votre liste : </span>
              {l.different ? <del className="text-texte-secondaire">{liste || "vide"}</del> : liste || <span className="text-texte-secondaire">vide</span>}
            </div>
            <div role="cell" className="min-w-0 [overflow-wrap:anywhere]">
              <span className="text-[12.5px] text-texte-secondaire min-[640px]:hidden">Saisie du CEO : </span>
              {l.different ? <strong>{saisie || "vide"}</strong> : saisie || <span className="text-texte-secondaire">vide</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Fiche({ s, titre }: { s: SignatureCas; titre?: string }) {
  return (
    <div className="grid content-start gap-2 rounded-[10px] border border-filet p-3">
      {titre ? <p className="text-[12.5px] font-semibold text-texte-secondaire">{titre}</p> : null}
      <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px]">
        <dt className="text-texte-secondaire">Nom</dt>
        <dd className="font-semibold [overflow-wrap:anywhere]">
          {s.prenom} {s.nom}
        </dd>
        <dt className="text-texte-secondaire">Fonction</dt>
        <dd className="[overflow-wrap:anywhere]">{s.fonction}</dd>
        <dt className="text-texte-secondaire">Entreprise</dt>
        <dd className="[overflow-wrap:anywhere]">{s.entreprise}</dd>
        <dt className="text-texte-secondaire">Signé le</dt>
        <dd>{formaterDateHeure(s.signeLe)}</dd>
        <dt className="text-texte-secondaire">Origine</dt>
        <dd>{ORIGINES[s.origine]}</dd>
      </dl>
      {s.trace ? (
        <div className="h-16 rounded-md bg-white">
          <SignatureSvg trace={s.trace} className="h-full" libelle={`Signature de ${s.prenom} ${s.nom}`} />
        </div>
      ) : null}
    </div>
  );
}

function CarteCas({
  cas,
  cible,
  enCours,
  statutManifeste,
  onAction,
}: {
  cas: CasVerification;
  cible: boolean;
  enCours: boolean;
  statutManifeste: StatutManifeste;
  onAction: (action: ActionVerification) => void;
}) {
  const s = cas.signature;
  const nom = s ? `${s.prenom} ${s.nom}`.trim() : `${cas.saisie.prenom ?? ""} ${cas.saisie.nom ?? ""}`.trim();
  const traite = cas.verification !== "a_verifier";
  const differences = cas.liste ? comparerChamps(cas.liste, cas.saisie).some((l) => l.different) : false;

  return (
    <article
      aria-label={`${nom}, ${s?.entreprise ?? cas.saisie.entreprise ?? ""}`}
      className={"grid gap-3 rounded-xl border bg-surface p-4 min-[820px]:p-5 " + (cible ? "border-eau shadow-[0_0_0_3px_var(--color-eau-doux)]" : "border-filet")}
    >
      <Entete cas={cas} />
      <h3 className="font-titre text-[19px] font-normal [overflow-wrap:anywhere]">
        {nom || "Dirigeant à préciser"}
        <span className="font-interface text-[15px] text-texte-secondaire"> · {s?.entreprise ?? cas.saisie.entreprise}</span>
      </h3>

      {cas.motif === "nouveau" && s ? (
        <div className="grid gap-3 min-[820px]:grid-cols-[minmax(0,1fr)_260px] min-[820px]:items-start">
          <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14.5px]">
            <dt className="text-texte-secondaire">Fonction</dt>
            <dd className="[overflow-wrap:anywhere]">{s.fonction}</dd>
            <dt className="text-texte-secondaire">Entreprise</dt>
            <dd className="[overflow-wrap:anywhere]">{s.entreprise}</dd>
            <dt className="text-texte-secondaire">Maillon</dt>
            <dd>{s.maillon}</dd>
            <dt className="text-texte-secondaire">WhatsApp</dt>
            <dd className="tabular-nums">{cas.telephone ? formaterTelephone(cas.telephone) : "Aucun numéro"}</dd>
            <dt className="text-texte-secondaire">Origine</dt>
            <dd>{ORIGINES[cas.origine]}</dd>
            <dt className="text-texte-secondaire">Qui l&apos;a invité</dt>
            <dd className="[overflow-wrap:anywhere]">{cas.invitePar || <span className="text-texte-secondaire">Non renseigné</span>}</dd>
            {cas.parrain ? (
              <>
                <dt className="text-texte-secondaire">Parrain</dt>
                <dd className="[overflow-wrap:anywhere]">{cas.parrain}</dd>
              </>
            ) : null}
            <dt className="text-texte-secondaire">Signé le</dt>
            <dd>{formaterDateHeure(s.signeLe)}</dd>
          </dl>
          {s.trace ? (
            <div className="h-24 rounded-[10px] border border-filet bg-white p-2">
              <SignatureSvg trace={s.trace} className="h-full" libelle={`Signature de ${nom}`} />
            </div>
          ) : null}
        </div>
      ) : null}

      {cas.motif === "doublon" && s ? (
        <>
          <p className="rounded-[10px] bg-argile-doux px-4 py-3 text-[14px] text-[#6d3818]">
            Une seule signature par entreprise est recommandée. Gardez les deux seulement si l&apos;entreprise le souhaite.
          </p>
          <div className="grid gap-3 min-[820px]:grid-cols-2">
            <Fiche s={s} titre="Cette signature" />
            {cas.autresSignatures.length ? (
              cas.autresSignatures.map((a) => <Fiche key={a.reference} s={a} titre="Déjà signée pour la même entreprise" />)
            ) : (
              <p className="rounded-[10px] border border-filet p-3 text-[14px] text-texte-secondaire">
                L&apos;autre signature de cette entreprise a été retirée depuis.
              </p>
            )}
          </div>
          {differences ? <Comparaison cas={cas} /> : null}
        </>
      ) : null}

      {(cas.motif === "modification" || cas.motif === "manuelle") && s ? (
        <>
          <Comparaison cas={cas} />
          {s.trace ? (
            <div className="h-16 max-w-[320px] rounded-md bg-white">
              <SignatureSvg trace={s.trace} className="h-full" libelle={`Signature de ${nom}`} />
            </div>
          ) : null}
        </>
      ) : null}

      {traite ? (
        <p className="flex flex-wrap items-center gap-2 text-[14px]">
          <Chip variante={cas.verification === "rejete" ? "erreur" : "succes"}>
            {cas.verification === "rejete" ? <X aria-hidden="true" className="size-3.5" strokeWidth={1.75} /> : <CheckCheck aria-hidden="true" className="size-3.5" strokeWidth={1.75} />}
            {cas.decision ? LIBELLES_DECISIONS[cas.decision] : "Traité"}
          </Chip>
          <span className="text-texte-secondaire">
            par {cas.decidePar ?? "un admin"}
            {cas.decideLe ? `, le ${formaterDateHeure(cas.decideLe)}` : ""}
            {cas.verification === "rejete" && statutManifeste === "gele" ? ". Rétablir depuis la fiche du CEO." : ""}
          </span>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cas.actions.map((action) => (
            <Button
              key={action}
              variante={action === "valider" || action === "verifier" ? "principal" : "secondaire"}
              disabled={enCours}
              onClick={() => onAction(action)}
              className={action === "retirer" ? "text-erreur" : ""}
            >
              {action === "retirer" ? (
                <X aria-hidden="true" strokeWidth={1.75} />
              ) : action === "mettre_a_jour_entreprise" ? (
                <Building2 aria-hidden="true" strokeWidth={1.75} />
              ) : action === "garder_les_deux" ? (
                <RotateCcw aria-hidden="true" strokeWidth={1.75} />
              ) : (
                <ShieldCheck aria-hidden="true" strokeWidth={1.75} />
              )}
              {action === "retirer" ? libelleRetrait(cas) : LIBELLES_ACTIONS[action]}
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}
