"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { definirMotDePasse, type EtatFormulaire } from "../actions";

export function FormulaireMotDePasse() {
  const [etat, envoyer, enCours] = useActionState<EtatFormulaire, FormData>(definirMotDePasse, {});

  return (
    <form action={envoyer} className="grid gap-4" noValidate>
      <Field id="motDePasse" libelle="Nouveau mot de passe" aide="10 caractères au moins.">
        <Input id="motDePasse" name="motDePasse" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field id="confirmation" libelle="Confirmez le mot de passe">
        <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required />
      </Field>
      {etat.erreur ? (
        <p className="text-[13.5px] text-erreur" role="alert">
          {etat.erreur}
        </p>
      ) : null}
      <Button type="submit" variante="principal" disabled={enCours}>
        <Check aria-hidden="true" strokeWidth={1.75} />
        Enregistrer mon mot de passe
      </Button>
    </form>
  );
}
