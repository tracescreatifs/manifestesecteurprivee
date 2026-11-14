"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { confirmerLien, type EtatFormulaire } from "../../actions";

export function LienInvalide() {
  return (
    <>
      <p className="text-texte-secondaire">Demandez un nouveau lien à un administrateur.</p>
      <Link
        href="/connexion"
        className="inline-flex min-h-11 items-center justify-self-start text-[14px] font-medium text-eau hover:underline"
      >
        Aller à la connexion
      </Link>
    </>
  );
}

export function BoutonConfirmer({ tokenHash, type }: { tokenHash: string; type: "invite" | "recovery" }) {
  const [etat, envoyer, enCours] = useActionState<EtatFormulaire, FormData>(confirmerLien, {});

  if (etat.erreur) {
    return (
      <div className="grid gap-3" role="alert">
        <p className="font-titre text-xl">Ce lien n&apos;est plus valide</p>
        <LienInvalide />
      </div>
    );
  }

  return (
    <form action={envoyer} className="grid">
      <input type="hidden" name="tokenHash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <Button type="submit" variante="principal" disabled={enCours}>
        Choisir mon mot de passe
        <ArrowRight aria-hidden="true" strokeWidth={1.75} />
      </Button>
    </form>
  );
}
