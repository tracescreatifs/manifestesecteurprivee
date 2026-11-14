"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Encadre } from "@/components/admin/carte-auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { demanderReinitialisation, type EtatFormulaire } from "../actions";

export function FormulaireMotDePasseOublie() {
  const [etat, envoyer, enCours] = useActionState<EtatFormulaire, FormData>(demanderReinitialisation, {});

  const retour = (
    <Link
      href="/connexion"
      className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-[14px] font-medium text-eau hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Retour à la connexion
    </Link>
  );

  if (etat.envoye) {
    return (
      <>
        <Encadre>
          Si cette adresse est celle d&apos;un admin, un lien pour choisir un nouveau mot de passe vient
          d&apos;être envoyé. Si rien n&apos;arrive, demandez à un autre admin de générer un lien de
          réinitialisation.
        </Encadre>
        {retour}
      </>
    );
  }

  return (
    <form action={envoyer} className="grid gap-4" noValidate>
      <p className="text-texte-secondaire">
        Indiquez votre email : vous recevrez un lien pour choisir un nouveau mot de passe.
      </p>
      <Field id="email" libelle="Adresse email" erreur={etat.erreur}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={etat.email}
          required
        />
      </Field>
      <Button type="submit" variante="principal" disabled={enCours}>
        <Send aria-hidden="true" strokeWidth={1.75} />
        Envoyer le lien
      </Button>
      {retour}
    </form>
  );
}
