"use client";

import { Save, UserPlus } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { normaliserNomEntreprise, normaliserTelephone } from "@/lib/ceo/normaliser";
import type { LigneCeo } from "@/lib/ceo/serveur";

import { ajouterCeo, modifierCeo } from "./actions";

type Props = {
  ouvert: boolean;
  onFermer: () => void;
  /* CEO à modifier, ou null pour un ajout */
  ceo: LigneCeo | null;
  lignes: LigneCeo[];
  maillons: string[];
  onEnregistre: (message: string) => void;
};

const VIDE = { prenom: "", nom: "", fonction: "", entreprise: "", maillon: "", telephone: "" };

/* Ajouter ou modifier un CEO, avec le même contrôle de doublon que l'import (D21) */
export function FormulaireCeo({ ouvert, onFermer, ceo, lignes, maillons, onEnregistre }: Props) {
  const [erreur, setErreur] = useState<string>();
  const [doublon, setDoublon] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const initial = ceo
    ? {
        prenom: ceo.prenom,
        nom: ceo.nom,
        fonction: ceo.fonction,
        entreprise: ceo.entreprise,
        maillon: ceo.maillon,
        telephone: ceo.telephone,
      }
    : VIDE;

  const fermer = () => {
    setErreur(undefined);
    setDoublon(null);
    onFermer();
  };

  const chercherDoublon = (entreprise: string, telephone: string): string | null => {
    const cle = normaliserNomEntreprise(entreprise);
    const tel = normaliserTelephone(telephone);
    const autre = lignes.find(
      (l) =>
        l.invitationId !== ceo?.invitationId &&
        ((cle && normaliserNomEntreprise(l.entreprise) === cle) || (tel && l.telephone === tel)),
    );
    return autre ? `${`${autre.prenom} ${autre.nom}`.trim() || "Un CEO"} (${autre.entreprise})` : null;
  };

  const envoyer = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const saisie = {
      prenom: String(f.get("prenom") ?? "").trim(),
      nom: String(f.get("nom") ?? "").trim(),
      fonction: String(f.get("fonction") ?? "").trim(),
      entreprise: String(f.get("entreprise") ?? "").trim(),
      maillon: String(f.get("maillon") ?? ""),
      telephone: String(f.get("telephone") ?? "").trim(),
    };
    if (!saisie.entreprise) return setErreur("Indiquez l'entreprise.");
    if (!saisie.prenom && !saisie.nom) return setErreur("Indiquez au moins le nom du dirigeant.");
    if (saisie.telephone && !normaliserTelephone(saisie.telephone)) {
      return setErreur("Numéro WhatsApp illisible : indiquez le numéro complet, avec l'indicatif si besoin.");
    }
    const confirme = f.get("confirmeDoublon") === "1";
    const deja = chercherDoublon(saisie.entreprise, saisie.telephone);
    if (deja && !confirme) {
      setErreur(undefined);
      return setDoublon(deja);
    }

    demarrer(async () => {
      const r = ceo ? await modifierCeo({ ...saisie, invitationId: ceo.invitationId }) : await ajouterCeo(saisie);
      if (!r.ok) return setErreur(r.erreur);
      fermer();
      onEnregistre(ceo ? "Informations mises à jour" : `${`${saisie.prenom} ${saisie.nom}`.trim()} ajouté à la liste`);
    });
  };

  return (
    <Modal ouvert={ouvert} titre={ceo ? "Modifier un CEO" : "Ajouter un CEO"} onFermer={fermer}>
      <form onSubmit={envoyer} className="grid gap-4" noValidate key={ceo?.invitationId ?? "nouveau"}>
        <div className="grid gap-4 min-[520px]:grid-cols-2">
          <Field id="c-prenom" libelle="Prénom">
            <Input id="c-prenom" name="prenom" defaultValue={initial.prenom} autoComplete="off" />
          </Field>
          <Field id="c-nom" libelle="Nom">
            <Input id="c-nom" name="nom" defaultValue={initial.nom} autoComplete="off" />
          </Field>
          <Field id="c-fonction" libelle="Fonction">
            <Input id="c-fonction" name="fonction" defaultValue={initial.fonction} placeholder="Directeur général" autoComplete="off" />
          </Field>
          <Field id="c-entreprise" libelle="Entreprise">
            <Input id="c-entreprise" name="entreprise" defaultValue={initial.entreprise} autoComplete="off" />
          </Field>
          <Field id="c-maillon" libelle="Maillon">
            <select
              id="c-maillon"
              name="maillon"
              defaultValue={initial.maillon}
              className="min-h-11 w-full rounded-[10px] border border-filet-fort bg-surface px-3 text-base focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none"
            >
              <option value="">À préciser</option>
              {maillons.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field id="c-tel" libelle="Téléphone WhatsApp" aide="Un numéro à 9 chiffres reçoit l'indicatif +221.">
            <Input id="c-tel" name="telephone" defaultValue={initial.telephone} inputMode="tel" placeholder="+221 77 123 45 67" autoComplete="off" />
          </Field>
        </div>

        {ceo?.statut === "signe" ? (
          <p className="text-[13px] text-texte-secondaire">
            Ce CEO a déjà signé : sa signature garde les informations confirmées au moment de signer.
          </p>
        ) : null}
        {doublon ? (
          <div role="alert" className="grid gap-2 rounded-[10px] bg-argile-doux px-4 py-3 text-[14px] text-[#6d3818]">
            <p>
              Déjà dans la liste : {doublon}. Une seule signature par entreprise est recommandée. Confirmez pour enregistrer
              quand même.
            </p>
            <input type="hidden" name="confirmeDoublon" value="1" />
          </div>
        ) : null}
        {erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreur}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variante="discret" onClick={fermer}>
            Annuler
          </Button>
          <Button type="submit" variante="principal" disabled={enCours}>
            {ceo ? <Save aria-hidden="true" strokeWidth={1.75} /> : <UserPlus aria-hidden="true" strokeWidth={1.75} />}
            {doublon ? "Enregistrer quand même" : ceo ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
