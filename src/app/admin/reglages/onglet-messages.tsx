"use client";

import { RotateCcw, Save } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { MODELE_ORIGINE, lienPersonnel, remplirModele } from "@/lib/ceo/message";

import { enregistrerModeleMessage } from "./actions";

type Props = { modele: string; dateLimite: string; siteUrl: string };

/* Onglet Messages : le modèle du message WhatsApp envoyé aux CEO */
export function OngletMessages({ modele, dateLimite, siteUrl }: Props) {
  const { message, afficher } = useToast();
  const [texte, setTexte] = useState(modele);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  const apercu = remplirModele(texte, {
    prenom: "Aminata",
    lien: lienPersonnel(siteUrl, "exemple"),
    dateLimite,
  });

  const enregistrer = () =>
    demarrer(async () => {
      const r = await enregistrerModeleMessage({ modele: texte });
      if (!r.ok) return setErreur(r.erreur);
      setErreur(undefined);
      afficher("Message enregistré");
    });

  return (
    <section className="grid gap-3 rounded-[14px] border border-filet bg-surface p-6">
      <h3 className="font-titre text-xl font-normal">Message WhatsApp aux CEO</h3>
      <p className="text-[13px] text-texte-secondaire">
        Variables : <code>{"{prenom}"}</code> (prénom du CEO), <code>{"{lien}"}</code> (son lien personnel, obligatoire)
        et <code>{"{date_limite}"}</code> (date limite de signature). Le message est signé par la Task Force du secteur
        privé sénégalais de l&apos;eau et de l&apos;assainissement. Une relance ajoute « Petit rappel. » au début.
      </p>
      <label htmlFor="modele" className="text-[13px] font-medium text-texte-secondaire">
        Modèle
      </label>
      <textarea
        id="modele"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        className="min-h-56 w-full rounded-[10px] border border-filet-fort bg-surface p-3 text-[14.5px] focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none"
      />
      {erreur ? (
        <p role="alert" className="text-[13.5px] text-erreur">
          {erreur}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variante="principal" onClick={enregistrer} disabled={enCours}>
          <Save aria-hidden="true" strokeWidth={1.75} />
          Enregistrer
        </Button>
        <Button variante="discret" onClick={() => setTexte(MODELE_ORIGINE)} disabled={texte === MODELE_ORIGINE}>
          <RotateCcw aria-hidden="true" strokeWidth={1.75} />
          Revenir au modèle d&apos;origine
        </Button>
      </div>

      <div className="grid gap-2 border-t border-filet pt-3">
        <p className="text-[13px] font-medium text-texte-secondaire">Aperçu, avec un CEO fictif</p>
        <div className="relative rounded-[10px] bg-sureleve p-3 pt-8 text-[14px] whitespace-pre-wrap">
          <span className="absolute top-2 left-3 rounded-md bg-[#ECECEA] px-2 py-0.5 text-[12px] font-medium text-encre">
            Exemple
          </span>
          {apercu}
        </div>
      </div>
      <Toast message={message} />
    </section>
  );
}
