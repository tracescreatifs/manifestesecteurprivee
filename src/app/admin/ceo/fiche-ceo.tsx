"use client";

import { BellRing, Link2, MessageCircle, Pencil, RotateCcw, ShieldCheck, Trash2, Undo2, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";

import { SignatureSvg } from "@/components/document/signature";
import { BoutonAvecRaison } from "@/components/ui/bouton-raison";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Modal } from "@/components/ui/modal";
import { Panneau } from "@/components/ui/panneau";
import { formaterDateHeure } from "@/lib/dates";
import { formaterTelephone } from "@/lib/ceo/normaliser";
import type { LigneCeo } from "@/lib/ceo/serveur";
import { LIBELLES_DECISIONS, LIBELLES_STATUTS_COMMENTAIRE, peutRetablir } from "@/lib/verification/regles";
import type { OrigineInvitation, StatutManifeste, TypeConsentement } from "@/types/database";

import { retablirSignature } from "./actions-verification";

import { LIBELLES_STATUTS } from "./statuts";

const ORIGINES: Record<OrigineInvitation, string> = {
  liste: "Liste importée par un admin",
  lien_ouvert: "Lien ouvert",
  parrainage: "Parrainage d'un confrère",
};

const CHOIX: [TypeConsentement, string][] = [
  ["signature_publique", "Publication de la signature"],
  ["recontact", "Recontact"],
  ["annuaire", "Annuaire"],
  ["photo_communication", "Photo pour la communication"],
];

type Props = {
  ceo: LigneCeo | null;
  onFermer: () => void;
  /* Raison pour laquelle l'envoi est impossible, ou null ; undefined : pas d'envoi pour ce CEO (signé, signatures closes) */
  raisonEnvoi: string | null | undefined;
  occupe: boolean;
  onEnvoyer: (relance: boolean) => void;
  onCopier: () => void;
  onModifier: () => void;
  onNonEnvoye: () => void;
  onRetirer: () => void;
  /* Pour « Rétablir » : seulement tant que les signatures sont ouvertes */
  manifeste: { statut: StatutManifeste; dateLimite: string };
  onSignale: (message: string) => void;
};

function Ligne({ terme, children }: { terme: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-texte-secondaire">{terme}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </>
  );
}

/* Fiche d'un CEO : panneau à droite sur ordinateur, plein écran sur téléphone */
export function FicheCeo({
  ceo,
  onFermer,
  raisonEnvoi,
  occupe,
  onEnvoyer,
  onCopier,
  onModifier,
  onNonEnvoye,
  onRetirer,
  manifeste,
  onSignale,
}: Props) {
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const retablissable =
    ceo !== null &&
    peutRetablir(
      { verification: ceo.verification, decisionSignature: ceo.signatureDecision !== null, signatureActive: ceo.signature !== null },
      manifeste,
      new Date(),
    );
  const retablir = () => {
    if (!ceo) return;
    setErreur(undefined);
    demarrer(async () => {
      const r = await retablirSignature({ invitationId: ceo.invitationId });
      if (!r.ok) return setErreur(r.erreur);
      setConfirmer(false);
      onSignale("Signature rétablie : elle revient dans l'annexe");
    });
  };
  const nom = ceo ? `${ceo.prenom} ${ceo.nom}`.trim() || "Dirigeant à préciser" : "";
  const relance = ceo?.statut === "envoye" || ceo?.statut === "ouvert";

  return (
    <Panneau ouvert={ceo !== null} titre={nom} onFermer={onFermer}>
      {ceo ? (
        <>
          <section className="grid gap-2">
            <h4 className="text-[13px] font-medium text-texte-secondaire">Informations</h4>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[14.5px]">
              <Ligne terme="Prénom">{ceo.prenom || "Non renseigné"}</Ligne>
              <Ligne terme="Nom">{ceo.nom || "Non renseigné"}</Ligne>
              <Ligne terme="Fonction">{ceo.fonction || "Non renseignée"}</Ligne>
              <Ligne terme="Entreprise">{ceo.entreprise}</Ligne>
              <Ligne terme="Maillon">{ceo.maillon || "À préciser"}</Ligne>
              <Ligne terme="WhatsApp">
                {ceo.telephone ? <span className="tabular-nums">{formaterTelephone(ceo.telephone)}</span> : "Aucun numéro"}
              </Ligne>
              {ceo.email ? <Ligne terme="Email">{ceo.email}</Ligne> : null}
              <Ligne terme="Origine">{ORIGINES[ceo.origine]}</Ligne>
              {ceo.parrain ? <Ligne terme="Parrain">{ceo.parrain}</Ligne> : null}
              {ceo.invitePar ? <Ligne terme="Invité par">{ceo.invitePar}</Ligne> : null}
            </dl>
          </section>

          <section className="grid gap-2">
            <h4 className="text-[13px] font-medium text-texte-secondaire">Fiche</h4>
            <div className="flex items-start gap-3">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#E6E0D3] text-texte-secondaire">
                {ceo.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- lien signé du bucket privé, photo déjà réduite à 400 px
                  <img src={ceo.photoUrl} alt={`Photo de ${nom}`} width={64} height={64} className="size-full object-cover" />
                ) : (
                  <UserRound aria-hidden="true" className="size-7" strokeWidth={1.75} />
                )}
              </div>
              <ul className="grid gap-1 text-[13.5px]">
                {CHOIX.map(([type, libelle]) => {
                  const c = ceo.consentements.find((x) => x.type === type);
                  return (
                    <li key={type}>
                      <span className="text-texte-secondaire">{libelle} : </span>
                      {c?.accorde ? "Accepté" : "Non"}
                      {c ? <span className="text-texte-secondaire"> (le {formaterDateHeure(c.le)})</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="grid gap-2">
            <h4 className="text-[13px] font-medium text-texte-secondaire">Suivi</h4>
            <div>
              <Chip variante={LIBELLES_STATUTS[ceo.statut].variante}>
                <span className="size-[7px] rounded-full bg-current" />
                {LIBELLES_STATUTS[ceo.statut].libelle}
              </Chip>
            </div>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[14.5px]">
              <Ligne terme="Envoyé le">{ceo.envoyeLe ? formaterDateHeure(ceo.envoyeLe) : "Pas encore envoyé"}</Ligne>
              <Ligne terme="Ouvert le">{ceo.ouvertLe ? formaterDateHeure(ceo.ouvertLe) : "Pas encore ouvert"}</Ligne>
              <Ligne terme="Relances">
                {ceo.relances
                  ? `${ceo.relances}, la dernière le ${ceo.derniereRelanceLe ? formaterDateHeure(ceo.derniereRelanceLe) : "?"}`
                  : "Aucune"}
              </Ligne>
              {ceo.signeLe ? <Ligne terme="Signé le">{formaterDateHeure(ceo.signeLe)}</Ligne> : null}
            </dl>
          </section>

          {ceo.signature && ceo.signeLe ? (
            <section className="grid gap-2">
              <h4 className="flex items-center gap-2 text-[13px] font-medium text-texte-secondaire">
                Signature
                {!ceo.signature.validee ? <Chip variante="argile">À valider</Chip> : null}
              </h4>
              <div className="rounded-md bg-white px-3 py-2 shadow-[0_1px_2px_rgba(20,33,43,0.06),0_8px_24px_rgba(20,33,43,0.07)]">
                <div className="h-20">
                  {ceo.signature.trace ? (
                    <SignatureSvg trace={ceo.signature.trace} className="h-full" libelle={`Signature de ${nom}`} />
                  ) : (
                    <p className="text-[13px] text-texte-secondaire">Tracé indisponible.</p>
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[14.5px]">
                <Ligne terme="Référence">
                  <span className="tabular-nums">{ceo.signature.reference}</span>
                </Ligne>
              </dl>
            </section>
          ) : null}

          <section className="grid gap-2">
            <h4 className="text-[13px] font-medium text-texte-secondaire">Vérification</h4>
            <EtatVerification ceo={ceo} />
            {retablissable ? (
              <div>
                <Button onClick={() => setConfirmer(true)}>
                  <RotateCcw aria-hidden="true" strokeWidth={1.75} />
                  Rétablir la signature
                </Button>
              </div>
            ) : null}
          </section>

          {ceo.commentaires.length ? (
            <section className="grid gap-2">
              <h4 className="text-[13px] font-medium text-texte-secondaire">Commentaires ({ceo.commentaires.length})</h4>
              <ul className="grid gap-2">
                {ceo.commentaires.map((c) => (
                  <li key={c.id} className="grid gap-1 rounded-controle border border-filet p-3 text-[14px]">
                    <span className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-texte-secondaire">
                      {formaterDateHeure(c.creeLe)}
                      <Chip variante={c.statut === "nouveau" ? "neutre" : c.statut === "non_retenu" ? "neutre" : "eau"}>
                        {LIBELLES_STATUTS_COMMENTAIRE[c.statut]}
                      </Chip>
                    </span>
                    <p className="whitespace-pre-line [overflow-wrap:anywhere]">{c.texte}</p>
                  </li>
                ))}
              </ul>
              <Link href="/admin/ceo?onglet=commentaires" className="inline-flex min-h-11 items-center text-[14px] font-medium text-eau">
                Traiter dans « Commentaires »
              </Link>
            </section>
          ) : null}

          <section className="grid gap-2">
            <h4 className="text-[13px] font-medium text-texte-secondaire">Actions</h4>
            <div className="grid gap-2">
              {raisonEnvoi !== undefined ? (
                <BoutonAvecRaison raison={raisonEnvoi} onClick={() => onEnvoyer(relance)} variante="principal" occupe={occupe}>
                  {relance ? (
                    <BellRing aria-hidden="true" strokeWidth={1.75} />
                  ) : (
                    <MessageCircle aria-hidden="true" strokeWidth={1.75} />
                  )}
                  {relance ? "Relancer sur WhatsApp" : "Envoyer sur WhatsApp"}
                </BoutonAvecRaison>
              ) : null}
              <Button onClick={onCopier}>
                <Link2 aria-hidden="true" strokeWidth={1.75} />
                Copier le lien personnel
              </Button>
              <Button onClick={onModifier}>
                <Pencil aria-hidden="true" strokeWidth={1.75} />
                Modifier
              </Button>
              {ceo.statut === "envoye" ? (
                <Button onClick={onNonEnvoye} disabled={occupe}>
                  <Undo2 aria-hidden="true" strokeWidth={1.75} />
                  Marquer comme non envoyé
                </Button>
              ) : null}
              {ceo.statut === "signe" ? (
                <p className="text-[13px] text-texte-secondaire">Ce CEO a signé : il ne peut pas être retiré de la liste.</p>
              ) : (
                <Button onClick={onRetirer} className="text-erreur">
                  <Trash2 aria-hidden="true" strokeWidth={1.75} />
                  Retirer de la liste
                </Button>
              )}
            </div>
          </section>
        </>
      ) : null}
      <Modal
        ouvert={confirmer}
        titre="Rétablir la signature"
        onFermer={() => setConfirmer(false)}
        pied={
          <>
            <Button variante="discret" onClick={() => setConfirmer(false)}>
              Annuler
            </Button>
            <Button variante="principal" onClick={retablir} disabled={enCours}>
              <RotateCcw aria-hidden="true" strokeWidth={1.75} />
              Rétablir
            </Button>
          </>
        }
      >
        <p>
          La signature {ceo?.signatureDecision?.reference} redevient active et vérifiée : elle revient dans l&apos;annexe, et le CEO
          retrouve sa signature sur son lien.
        </p>
        {erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreur}
          </p>
        ) : null}
      </Modal>
    </Panneau>
  );
}

/* État de vérification de la signature : à vérifier, vérifiée (par qui, quand), retirée ou refusée */
function EtatVerification({ ceo }: { ceo: LigneCeo }) {
  const lien = (
    <Link
      href={`/admin/ceo?onglet=verifier&cas=${ceo.invitationId}`}
      className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-eau [&_svg]:size-4"
    >
      <ShieldCheck aria-hidden="true" strokeWidth={1.75} />
      Voir dans « À vérifier »
    </Link>
  );
  const par = ceo.decidePar ? ` par ${ceo.decidePar}` : "";
  const le = ceo.decideLe ? `, le ${formaterDateHeure(ceo.decideLe)}` : "";

  if (ceo.verification === "a_verifier" && ceo.signature) {
    return (
      <div className="grid gap-1">
        <div>
          <Chip variante="argile">{ceo.signature.validee ? "À vérifier" : "À valider"}</Chip>
        </div>
        {lien}
      </div>
    );
  }
  if (ceo.verification === "rejete") {
    return (
      <div className="grid gap-1 text-[14.5px]">
        <div>
          <Chip variante="erreur">{ceo.decision ? LIBELLES_DECISIONS[ceo.decision] : "Retirée par un admin"}</Chip>
        </div>
        <p className="text-texte-secondaire">
          Signature {ceo.signatureDecision?.reference}
          {par}
          {le}. Le CEO ne peut plus signer avec ce lien.
        </p>
        {lien}
      </div>
    );
  }
  if (ceo.verification === "valide" && ceo.signature) {
    return (
      <div className="grid gap-1 text-[14.5px]">
        <div>
          <Chip variante="succes">{ceo.decision ? LIBELLES_DECISIONS[ceo.decision] : "Vérifiée"}</Chip>
        </div>
        <p className="text-texte-secondaire">{ceo.decision ? `Décision${par}${le}.` : "Validée automatiquement : informations identiques à la liste."}</p>
        {ceo.decision ? lien : null}
      </div>
    );
  }
  return <p className="text-[14.5px] text-texte-secondaire">{ceo.signature ? "Aucune vérification nécessaire." : "Pas encore de signature."}</p>;
}
