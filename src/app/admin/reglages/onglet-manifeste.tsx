"use client";

import { Save } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Toast, useToast } from "@/components/ui/toast";

import { enregistrerGoogleDoc } from "./actions";

/* Onglet Manifeste : pour l'instant, le lien du Google Doc de rédaction */
export function OngletManifeste({ googleDocUrl }: { googleDocUrl: string }) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string>();

  const enregistrer = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const url = String(new FormData(e.currentTarget).get("url") ?? "");
    demarrer(async () => {
      const r = await enregistrerGoogleDoc({ url });
      if (!r.ok) return setErreur(r.erreur);
      setErreur(undefined);
      afficher("Lien enregistré");
    });
  };

  return (
    <section className="grid gap-3 rounded-[14px] border border-filet bg-surface p-6">
      <h3 className="font-titre text-xl font-normal">Rédaction</h3>
      <form onSubmit={enregistrer} className="grid gap-3" noValidate>
        <Field
          id="google-doc"
          libelle="Lien du Google Doc de rédaction"
          aide="Affiché dans la rubrique Texte (« Ouvrir le Google Doc »). Laissez vide pour le retirer."
          erreur={erreur}
        >
          <Input
            id="google-doc"
            name="url"
            type="url"
            inputMode="url"
            defaultValue={googleDocUrl}
            placeholder="https://docs.google.com/document/d/..."
          />
        </Field>
        <div>
          <Button type="submit" variante="principal" disabled={enCours}>
            <Save aria-hidden="true" strokeWidth={1.75} />
            Enregistrer
          </Button>
        </div>
      </form>
      <p className="text-[13px] text-texte-secondaire">
        Le titre et le sous-titre viennent du document importé (styles Titre et Sous-titre).
      </p>
      <Toast message={message} />
    </section>
  );
}
