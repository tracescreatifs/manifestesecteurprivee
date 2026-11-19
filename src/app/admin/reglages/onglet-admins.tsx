"use client";

import { Copy, KeyRound, Link2, MessageCircle, RotateCcw, UserPlus, UserX } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import { Button, classesBouton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";
import { formaterJour } from "@/lib/dates";
import { messageLienAdmin } from "@/lib/ceo/message";

import { couperAcces, genererLien, inviterAdmin, retablirAcces } from "./actions";

export type LigneAdmin = {
  userId: string;
  prenom: string;
  nom: string;
  email: string;
  etat: "actif" | "en_attente" | "coupe";
  ajouteLe: string;
};

type LienGenere = { lien: string; prenom: string; nom: string; type: "invite" | "recovery" };

function messageWhatsApp({ lien, prenom, type }: LienGenere) {
  return messageLienAdmin(type === "invite" ? "invite" : "reinitialisation", prenom, lien);
}

export function OngletAdmins({ admins, moi }: { admins: LigneAdmin[]; moi: string }) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [invitationOuverte, setInvitationOuverte] = useState(false);
  const [erreurInvitation, setErreurInvitation] = useState<string>();
  const [lienGenere, setLienGenere] = useState<LienGenere | null>(null);
  const [aCouper, setACouper] = useState<LigneAdmin | null>(null);

  /* Le dernier admin actif (mot de passe défini, accès ouvert) ne peut pas être coupé */
  const nbActifs = admins.filter((a) => a.etat === "actif").length;

  const inviter = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const saisie = {
      prenom: String(f.get("prenom") ?? ""),
      nom: String(f.get("nom") ?? ""),
      email: String(f.get("email") ?? ""),
    };
    demarrer(async () => {
      const r = await inviterAdmin(saisie);
      if (!r.ok) {
        setErreurInvitation(r.erreur);
        return;
      }
      setErreurInvitation(undefined);
      setInvitationOuverte(false);
      setLienGenere({ lien: r.lien, prenom: saisie.prenom.trim(), nom: saisie.nom.trim(), type: r.type });
    });
  };

  const nouveauLien = (a: LigneAdmin) =>
    demarrer(async () => {
      const r = await genererLien({ userId: a.userId });
      if (!r.ok) return afficher(r.erreur, true);
      setLienGenere({ lien: r.lien, prenom: a.prenom, nom: a.nom, type: r.type });
    });

  const confirmerCoupure = () => {
    if (!aCouper) return;
    const cible = aCouper;
    demarrer(async () => {
      const r = await couperAcces({ userId: cible.userId });
      setACouper(null);
      if (!r.ok) return afficher(r.erreur, true);
      afficher(`Accès coupé : ${cible.prenom} ${cible.nom}`);
    });
  };

  const retablir = (a: LigneAdmin) =>
    demarrer(async () => {
      const r = await retablirAcces({ userId: a.userId });
      if (!r.ok) return afficher(r.erreur, true);
      afficher(`Accès rétabli : ${a.prenom} ${a.nom}`);
    });

  const copier = async (texte: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      afficher("Lien copié");
    } catch {
      afficher("Copie impossible : sélectionnez le lien et copiez-le à la main.", true);
    }
  };

  return (
    <section className="grid gap-3 rounded-carte bg-surface shadow-douce p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-titre text-xl font-normal">Admins</h3>
        <Button
          variante="principal"
          onClick={() => {
            setErreurInvitation(undefined);
            setInvitationOuverte(true);
          }}
        >
          <UserPlus aria-hidden="true" strokeWidth={1.75} />
          Inviter un admin
        </Button>
      </div>
      <p className="text-[13px] text-texte-secondaire">
        Les admins se connectent avec leur email et leur mot de passe. Tous ont les mêmes droits : importer, geler,
        clore, publier, gérer les CEO et les doléances. Il reste toujours au moins un admin actif. Les rédacteurs,
        eux, travaillent dans le Google Doc et n&apos;ont pas d&apos;accès ici.
      </p>

      <ul className="grid">
        {admins.map((a) => {
          const dernier = a.etat === "actif" && nbActifs <= 1;
          return (
            <li
              key={a.userId}
              className="grid gap-3 border-t border-filet py-3 first:border-t-0 min-[820px]:grid-cols-[minmax(0,1fr)_auto] min-[820px]:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {a.prenom} {a.nom}
                  </span>
                  {a.userId === moi ? <Chip>Vous</Chip> : null}
                  {a.etat === "actif" ? (
                    <Chip variante="succes">Actif</Chip>
                  ) : a.etat === "en_attente" ? (
                    <Chip>Invitation en attente</Chip>
                  ) : (
                    <Chip variante="erreur">Accès coupé</Chip>
                  )}
                </div>
                <p className="text-[13px] break-all text-texte-secondaire">{a.email}</p>
                <p className="text-[13px] text-texte-secondaire">Ajouté le {formaterJour(a.ajouteLe)}</p>
              </div>

              <div className="flex flex-wrap gap-2 min-[820px]:justify-end">
                {a.etat === "coupe" ? (
                  <Button onClick={() => retablir(a)} disabled={enCours}>
                    <RotateCcw aria-hidden="true" strokeWidth={1.75} />
                    Rétablir l&apos;accès
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => nouveauLien(a)} disabled={enCours}>
                      {a.etat === "en_attente" ? (
                        <>
                          <Link2 aria-hidden="true" strokeWidth={1.75} />
                          Générer un nouveau lien
                        </>
                      ) : (
                        <>
                          <KeyRound aria-hidden="true" strokeWidth={1.75} />
                          Générer un lien de réinitialisation
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setACouper(a)}
                      disabled={enCours || dernier}
                      aria-describedby={dernier ? `dernier-${a.userId}` : undefined}
                    >
                      <UserX aria-hidden="true" strokeWidth={1.75} />
                      Couper l&apos;accès
                    </Button>
                  </>
                )}
              </div>
              {dernier ? (
                <p id={`dernier-${a.userId}`} className="text-[13px] text-texte-secondaire min-[820px]:col-span-2">
                  Dernier admin actif : son accès ne peut pas être coupé. Invitez d&apos;abord un autre admin.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Invitation */}
      <Modal
        ouvert={invitationOuverte}
        titre="Inviter un admin"
        onFermer={() => setInvitationOuverte(false)}
        pied={
          <>
            <Button variante="discret" onClick={() => setInvitationOuverte(false)}>
              Annuler
            </Button>
            <Button type="submit" form="formulaire-invitation" variante="principal" disabled={enCours}>
              <UserPlus aria-hidden="true" strokeWidth={1.75} />
              Créer le lien d&apos;invitation
            </Button>
          </>
        }
      >
        <form id="formulaire-invitation" onSubmit={inviter} className="grid gap-4" noValidate>
          <div className="grid gap-4 min-[520px]:grid-cols-2">
            <Field id="i-prenom" libelle="Prénom">
              <Input id="i-prenom" name="prenom" autoComplete="off" required />
            </Field>
            <Field id="i-nom" libelle="Nom">
              <Input id="i-nom" name="nom" autoComplete="off" required />
            </Field>
          </div>
          <Field id="i-email" libelle="Email" aide="L'adresse qui servira à se connecter.">
            <Input id="i-email" name="email" type="email" inputMode="email" autoComplete="off" required />
          </Field>
          {erreurInvitation ? (
            <p role="alert" className="text-[13.5px] text-erreur">
              {erreurInvitation}
            </p>
          ) : null}
          <p className="text-[13px] text-texte-secondaire">
            Aucun email n&apos;est envoyé : un lien s&apos;affiche ensuite, à copier ou à envoyer sur WhatsApp.
          </p>
        </form>
      </Modal>

      {/* Lien généré */}
      <Modal
        ouvert={lienGenere !== null}
        titre={lienGenere?.type === "invite" ? "Lien d'invitation" : "Lien de réinitialisation"}
        onFermer={() => setLienGenere(null)}
        pied={
          lienGenere ? (
            <>
              <Button onClick={() => copier(lienGenere.lien)}>
                <Copy aria-hidden="true" strokeWidth={1.75} />
                Copier le lien
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(messageWhatsApp(lienGenere))}`}
                target="_blank"
                rel="noopener noreferrer"
                className={classesBouton("principal")}
              >
                <MessageCircle aria-hidden="true" strokeWidth={1.75} />
                Envoyer sur WhatsApp
              </a>
            </>
          ) : null
        }
      >
        {lienGenere ? (
          <>
            <p>
              Envoyez ce lien à {lienGenere.prenom} {lienGenere.nom}.{" "}
              {lienGenere.type === "invite"
                ? "Il permet de choisir un mot de passe et d'entrer dans l'espace admin."
                : "Il permet de choisir un nouveau mot de passe."}
            </p>
            <p className="rounded-controle bg-sureleve px-3 py-2.5 text-[14px] break-all select-all">
              {lienGenere.lien}
            </p>
            <p className="text-[13px] text-texte-secondaire">
              Ce lien ne fonctionne qu&apos;une seule fois. S&apos;il a expiré, générez-en un nouveau.
            </p>
          </>
        ) : null}
      </Modal>

      {/* Confirmation de coupure */}
      <Modal
        ouvert={aCouper !== null}
        titre="Couper l'accès"
        onFermer={() => setACouper(null)}
        pied={
          <>
            <Button variante="discret" onClick={() => setACouper(null)}>
              Annuler
            </Button>
            <Button variante="danger" onClick={confirmerCoupure} disabled={enCours}>
              <UserX aria-hidden="true" strokeWidth={1.75} />
              Couper l&apos;accès
            </Button>
          </>
        }
      >
        {aCouper ? (
          <p>
            {aCouper.prenom} {aCouper.nom} ne pourra plus se connecter et sera déconnecté de ses appareils. Ses
            actions restent dans le journal. Vous pourrez rétablir son accès à tout moment.
            {aCouper.userId === moi ? " Il s'agit de votre propre accès : vous serez déconnecté aussitôt." : ""}
          </p>
        ) : null}
      </Modal>

      <Toast message={message} />
    </section>
  );
}
