"use client";

import { Check, Lock } from "lucide-react";
import { useState, useTransition } from "react";

import { gelerTexte } from "@/app/admin/texte/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/* Action suivante de la barre d'étapes en rédaction : geler la version courante */
export function BoutonGel({ numero }: { numero: number }) {
  const [ouvert, setOuvert] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  const fermer = () => {
    setOuvert(false);
    setConfirme(false);
    setErreur(undefined);
  };

  const geler = () =>
    demarrer(async () => {
      const r = await gelerTexte({ confirme });
      if (!r.ok) return setErreur(r.erreur);
      fermer();
    });

  return (
    <>
      <Button variante="principal" onClick={() => setOuvert(true)}>
        <Lock aria-hidden="true" strokeWidth={1.75} />
        Geler le texte
      </Button>
      <Modal
        ouvert={ouvert}
        titre={`Geler la version ${numero}`}
        onFermer={fermer}
        pied={
          <>
            <Button variante="discret" onClick={fermer}>
              Annuler
            </Button>
            <Button variante="principal" onClick={geler} disabled={!confirme || enCours}>
              <Lock aria-hidden="true" strokeWidth={1.75} />
              Geler la version {numero}
            </Button>
          </>
        }
      >
        <p>
          La version {numero} devient la <strong>version de signature</strong>.
        </p>
        <ul className="grid gap-2.5">
          {[
            "La mention « Proposition de texte » disparaît du document.",
            "Les liens des CEO deviennent actifs et peuvent être envoyés.",
            "Passez le Google Doc en lecture seule : désormais, la plateforme fait foi.",
            "Ensuite, seules des corrections mineures sont possibles (coquille, ponctuation), par import, avec contrôle des différences.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <Check aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-eau" strokeWidth={1.75} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <label className="flex items-start gap-2.5 text-[14px]">
          <input
            type="checkbox"
            checked={confirme}
            onChange={(e) => setConfirme(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-eau"
          />
          <span>Je confirme que ce texte a été validé</span>
        </label>
        {erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreur}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
