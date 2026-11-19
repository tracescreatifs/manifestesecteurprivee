"use client";

import { Copy, MessageCircle } from "lucide-react";
import { useState } from "react";

import { ApercuWhatsApp } from "@/components/apercu-whatsapp";
import { Button, classesBouton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formaterTelephone } from "@/lib/ceo/normaliser";
import { lienWhatsApp } from "@/lib/ceo/message";
import type { LigneCeo } from "@/lib/ceo/serveur";

type Props = {
  ceo: LigneCeo;
  relance: boolean;
  messageInitial: string;
  onFermer: () => void;
  /* Appelé au clic sur « Ouvrir WhatsApp » : le serveur note l'envoi ou la relance */
  onOuvert: () => void;
  onCopie: (ok: boolean) => void;
};

/* Envoi ou relance : le message est modifiable, puis WhatsApp s'ouvre avec le message prêt */
export function FenetreWhatsApp({ ceo, relance, messageInitial, onFermer, onOuvert, onCopie }: Props) {
  const [message, setMessage] = useState(messageInitial);
  const nom = `${ceo.prenom} ${ceo.nom}`.trim();

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(message);
      onCopie(true);
    } catch {
      onCopie(false);
    }
  };

  return (
    <Modal
      ouvert
      titre={relance ? `Relancer ${nom}` : `Envoyer à ${nom}`}
      onFermer={onFermer}
      pied={
        <>
          <Button variante="discret" onClick={copier}>
            <Copy aria-hidden="true" strokeWidth={1.75} />
            Copier le message
          </Button>
          <a
            href={lienWhatsApp(ceo.telephone, message)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOuvert}
            className={classesBouton("principal")}
          >
            <MessageCircle aria-hidden="true" strokeWidth={1.75} />
            Ouvrir WhatsApp
          </a>
        </>
      }
    >
      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px]">
        <dt className="text-texte-secondaire">Destinataire</dt>
        <dd>
          {nom}, {ceo.entreprise}
        </dd>
        <dt className="text-texte-secondaire">WhatsApp</dt>
        <dd className="tabular-nums">{formaterTelephone(ceo.telephone)}</dd>
      </dl>
      <div className="grid gap-2">
        <label htmlFor="wa-message" className="text-[13px] font-medium text-texte-secondaire">
          Message (modifiable)
        </label>
        <textarea
          id="wa-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-52 w-full rounded-controle border border-filet-fort bg-surface p-3 text-[14.5px] focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none"
        />
      </div>
      <div className="grid gap-2">
        <p className="text-[13px] font-medium text-texte-secondaire">Aperçu dans WhatsApp</p>
        <ApercuWhatsApp message={message} />
      </div>
      <p className="text-[13px] text-texte-secondaire">
        *texte* pour le gras, _texte_ pour l&apos;italique. Le bouton ouvre WhatsApp avec ce message prêt : il ne reste qu&apos;à appuyer sur Envoyer.
      </p>
    </Modal>
  );
}
