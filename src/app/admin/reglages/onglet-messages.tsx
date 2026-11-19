"use client";

import { RotateCcw, Save } from "lucide-react";
import { useState, useTransition } from "react";

import { ApercuWhatsApp } from "@/components/apercu-whatsapp";
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
    <section className="grid gap-3 rounded-carte bg-surface shadow-douce p-6">
      <h3 className="font-titre text-xl font-normal">Message WhatsApp aux CEO</h3>
      <p className="text-[13px] text-texte-secondaire">
        Variables : <code>{"{prenom}"}</code> (prénom du CEO), <code>{"{lien}"}</code> (son lien personnel, obligatoire)
        et <code>{"{date_limite}"}</code> (date limite de signature, en heure de Dakar et d&apos;Abu Dhabi). Le message est signé par la Task Force du secteur
        privé sénégalais de l&apos;eau et de l&apos;assainissement. Une relance ajoute « Petit rappel. », en gras, sur la première ligne.
      </p>
      {/* Le modèle et son rendu dans WhatsApp : côte à côte sur ordinateur, l'un sous l'autre sur téléphone */}
      <div className="grid gap-4 min-[1080px]:grid-cols-2">
        <div className="grid content-start gap-2">
          <label htmlFor="modele" className="text-[13px] font-medium text-texte-secondaire">
            Modèle
          </label>
          <textarea
            id="modele"
            value={texte}
            aria-describedby="modele-aide"
            onChange={(e) => setTexte(e.target.value)}
            className="min-h-72 w-full rounded-controle border border-filet-fort bg-surface p-3 text-[14.5px] focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none"
          />
          <p id="modele-aide" className="text-[13px] text-texte-secondaire">
            *texte* pour le gras, _texte_ pour l&apos;italique
          </p>
        </div>
        <div className="grid content-start gap-2">
          <p className="text-[13px] font-medium text-texte-secondaire">Aperçu dans WhatsApp, avec un CEO fictif</p>
          <ApercuWhatsApp message={apercu} etiquette="Exemple" />
        </div>
      </div>
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

      <Toast message={message} />
    </section>
  );
}
