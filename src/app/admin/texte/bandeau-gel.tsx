"use client";

import { Lock, Unlock } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";

import { revenirEnRedaction } from "./actions";

/* Bandeau affiché quand le texte est gelé, avec « Revenir en rédaction » tant qu'aucun lien n'est parti (D42) */
export function BandeauGel({
  geleLe,
  numero,
  peutRevenir,
}: {
  geleLe: string;
  numero: number | null;
  peutRevenir: boolean;
}) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState(false);

  const confirmer = () =>
    demarrer(async () => {
      const r = await revenirEnRedaction();
      setOuvert(false);
      if (!r.ok) afficher(r.erreur, true);
    });

  return (
    <div className="mb-4 flex flex-wrap items-start gap-3 rounded-controle bg-succes-doux px-4 py-3 text-[14.5px] text-[#214d39]">
      <Lock aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} />
      <p className="min-w-0 flex-1">
        Texte gelé le {geleLe}
        {numero ? ` sur la version ${numero}` : ""}. C&apos;est la plateforme qui fait foi : passez le Google Doc en
        lecture seule. Une coquille se corrige en important une correction mineure.
      </p>
      {peutRevenir ? (
        <Button onClick={() => setOuvert(true)}>
          <Unlock aria-hidden="true" strokeWidth={1.75} />
          Revenir en rédaction
        </Button>
      ) : null}

      <Modal
        ouvert={ouvert}
        titre="Revenir en rédaction"
        onFermer={() => setOuvert(false)}
        pied={
          <>
            <Button variante="discret" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button variante="principal" onClick={confirmer} disabled={enCours}>
              <Unlock aria-hidden="true" strokeWidth={1.75} />
              Revenir en rédaction
            </Button>
          </>
        }
      >
        <p>
          Le texte n&apos;est plus gelé : vous pourrez de nouveau importer des versions et en restaurer. Ce retour
          n&apos;est possible que tant qu&apos;aucun lien n&apos;a été envoyé aux CEO.
        </p>
      </Modal>
      <Toast message={message} />
    </div>
  );
}
