"use client";

import { ArrowRight, MessageCircle } from "lucide-react";
import { useState } from "react";

import { ApercuWhatsApp } from "@/components/apercu-whatsapp";
import { Button, classesBouton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { lienWhatsApp } from "@/lib/ceo/message";
import type { LigneCeo } from "@/lib/ceo/serveur";

type Props = {
  file: LigneCeo[];
  message: (ceo: LigneCeo) => string;
  derniereAction: (ceo: LigneCeo) => string;
  onFermer: () => void;
  /* Note la relance côté serveur */
  onRelance: (ceo: LigneCeo) => void;
};

/* « Relancer un par un » : les CEO qui ont reçu le lien sans signer, l'un après l'autre */
export function FileRelance({ file, message, derniereAction, onFermer, onRelance }: Props) {
  const [index, setIndex] = useState(0);
  const [faites, setFaites] = useState<Set<string>>(new Set());
  const ceo = file[index];

  if (!ceo) {
    return (
      <Modal
        ouvert
        titre="Relances"
        onFermer={onFermer}
        pied={
          <Button variante="principal" onClick={onFermer}>
            Terminer
          </Button>
        }
      >
        <p>
          {faites.size
            ? `${faites.size} relance${faites.size > 1 ? "s" : ""} faite${faites.size > 1 ? "s" : ""}. La file est terminée.`
            : "La file est terminée."}
        </p>
      </Modal>
    );
  }

  const texte = message(ceo);
  const fait = faites.has(ceo.invitationId);

  return (
    <Modal
      ouvert
      titre={`Relance ${index + 1} sur ${file.length}`}
      onFermer={onFermer}
      pied={
        <>
          {!fait ? (
            <a
              href={lienWhatsApp(ceo.telephone, texte)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setFaites((avant) => new Set(avant).add(ceo.invitationId));
                onRelance(ceo);
              }}
              className={classesBouton("principal")}
            >
              <MessageCircle aria-hidden="true" strokeWidth={1.75} />
              Ouvrir WhatsApp
            </a>
          ) : null}
          <Button variante={fait ? "principal" : "secondaire"} onClick={() => setIndex((i) => i + 1)}>
            Suivant
            <ArrowRight aria-hidden="true" strokeWidth={1.75} />
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-texte-secondaire">
        Les CEO qui ont reçu le lien sans signer, un par un. WhatsApp impose un clic par message.
      </p>
      <div className="grid gap-0.5">
        <strong className="font-semibold">
          {`${ceo.prenom} ${ceo.nom}`.trim()}, {ceo.entreprise}
        </strong>
        <span className="text-[13.5px] text-texte-secondaire">{derniereAction(ceo)}</span>
      </div>
      <ApercuWhatsApp message={texte} />
      {fait ? (
        <p role="status" className="text-[13.5px] text-succes">
          Relance notée. Passez au suivant quand le message est envoyé.
        </p>
      ) : null}
    </Modal>
  );
}
