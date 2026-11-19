"use client";

import { Check, Lock } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { annulerImport, creerVersion } from "../actions";

type Props = {
  fichier: string;
  numero: number;
  gele: boolean;
  /* Raison pour laquelle la version ne peut pas être créée (bloquant, identique, signatures closes) */
  raisonBlocage: string | null;
};

export function ActionsVerification({ fichier, numero, gele, raisonBlocage }: Props) {
  const [enCours, demarrer] = useTransition();
  const [correction, setCorrection] = useState(false);
  const [erreur, setErreur] = useState<string>();

  const peutCreer = !raisonBlocage && (!gele || correction);

  const creer = () =>
    demarrer(async () => {
      setErreur(undefined);
      const r = await creerVersion({ fichier, correctionMineure: correction });
      /* En cas de succès, le serveur redirige vers la rubrique Texte */
      if (r && !r.ok) setErreur(r.erreur);
    });

  return (
    <div className="grid gap-3 border-t border-filet pt-3.5">
      {gele && !raisonBlocage ? (
        <>
          <p className="flex items-start gap-2.5 rounded-controle bg-argile-doux px-3 py-2.5 text-[14px] text-[#6d3818]">
            <Lock aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} />
            Le texte est gelé : cette version sera une correction mineure. Le fond ne doit pas changer, et les
            signatures déjà recueillies restent valables.
          </p>
          <label className="flex items-start gap-2.5 text-[14px]">
            <input
              type="checkbox"
              checked={correction}
              onChange={(e) => setCorrection(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-eau"
            />
            <span>Il s&apos;agit d&apos;une correction mineure (coquille, ponctuation), qui ne change pas le sens</span>
          </label>
        </>
      ) : null}

      {raisonBlocage ? (
        <p className="text-[13.5px] text-texte-secondaire" role="status">
          {raisonBlocage}
        </p>
      ) : null}
      {erreur ? (
        <p className="text-[13.5px] text-erreur" role="alert">
          {erreur}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variante="principal" onClick={creer} disabled={!peutCreer || enCours}>
          <Check aria-hidden="true" strokeWidth={1.75} />
          Créer la version {numero}
        </Button>
        <Button variante="discret" onClick={() => demarrer(() => annulerImport({ fichier }))} disabled={enCours}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
