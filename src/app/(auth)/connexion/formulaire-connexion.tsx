"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { connexion, type EtatFormulaire } from "../actions";

export function FormulaireConnexion() {
  const [etat, envoyer, enCours] = useActionState<EtatFormulaire, FormData>(connexion, {});

  return (
    <form action={envoyer} className="grid gap-4" noValidate>
      <Field id="email" libelle="Adresse email">
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
      <Field id="motDePasse" libelle="Mot de passe">
        <Input id="motDePasse" name="motDePasse" type="password" autoComplete="current-password" required />
      </Field>
      {etat.erreur ? (
        <p className="text-[13.5px] text-erreur" role="alert">
          {etat.erreur}
        </p>
      ) : null}
      <Button type="submit" variante="principal" disabled={enCours}>
        <LogIn aria-hidden="true" strokeWidth={1.75} />
        {enCours ? "Connexion en cours" : "Se connecter"}
      </Button>
      <Link
        href="/mot-de-passe-oublie"
        className="inline-flex min-h-11 items-center justify-self-start text-[14px] font-medium text-eau hover:underline"
      >
        Mot de passe oublié
      </Link>
    </form>
  );
}
