"use client";

import { Copy, Download, MessageCircle } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, useTransition } from "react";

import { ApercuWhatsApp } from "@/components/apercu-whatsapp";
import { Button, classesBouton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { lienPartageWhatsApp, messageLienOuvert } from "@/lib/ceo/message";

import { basculerLienOuvert } from "./actions";

type Props = {
  adresse: string;
  /* Date limite, forme longue (heure de Dakar et d'Abu Dhabi) */
  dateLimite: string;
  actif: boolean;
  onFermer: () => void;
  onMessage: (texte: string, erreur?: boolean) => void;
};

/* Lien ouvert : pour les CEO qui ne sont pas dans la liste, avec son QR code */
export function LienOuvert({ adresse, dateLimite, actif, onFermer, onMessage }: Props) {
  const message = messageLienOuvert(adresse, dateLimite);
  const [qr, setQr] = useState<string | null>(null);
  /* État affiché tout de suite, rétabli si le serveur refuse */
  const [coche, setCoche] = useState(actif);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let actuel = true;
    QRCode.toDataURL(adresse, { width: 1024, margin: 2, color: { dark: "#14212B", light: "#FFFFFF" } })
      .then((url) => actuel && setQr(url))
      .catch(() => actuel && setQr(null));
    return () => {
      actuel = false;
    };
  }, [adresse]);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(adresse);
      onMessage("Lien ouvert copié");
    } catch {
      onMessage("Copie impossible : sélectionnez l'adresse et copiez-la à la main.", true);
    }
  };

  const basculer = (valeur: boolean) => {
    setCoche(valeur);
    demarrer(async () => {
      const r = await basculerLienOuvert({ actif: valeur });
      if (!r.ok) {
        setCoche(!valeur);
        return onMessage(r.erreur, true);
      }
      onMessage(valeur ? "Lien ouvert actif" : "Lien ouvert en pause : les nouvelles inscriptions sont suspendues");
    });
  };

  return (
    <Modal
      ouvert
      titre="Lien ouvert"
      onFermer={onFermer}
      pied={
        <>
          <Button variante="discret" onClick={copier}>
            <Copy aria-hidden="true" strokeWidth={1.75} />
            Copier
          </Button>
          {qr ? (
            <a href={qr} download="manifeste-qr-code.png" className={classesBouton("secondaire")}>
              <Download aria-hidden="true" strokeWidth={1.75} />
              Télécharger le QR code
            </a>
          ) : null}
          <a
            href={lienPartageWhatsApp(message)}
            target="_blank"
            rel="noopener noreferrer"
            className={classesBouton("principal")}
          >
            <MessageCircle aria-hidden="true" strokeWidth={1.75} />
            Partager sur WhatsApp
          </a>
        </>
      }
    >
      <p>
        Pour les CEO qui ne sont pas dans votre liste. Partagez-le dans les groupes WhatsApp, ou affichez le QR code.
        Chaque inscription arrive dans « À vérifier » et n&apos;entre dans l&apos;annexe qu&apos;après votre validation.
      </p>
      <div className="grid items-center gap-4 min-[480px]:grid-cols-[150px_minmax(0,1fr)]">
        <div className="grid size-[150px] place-items-center rounded-[10px] border border-filet bg-white p-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- image générée dans le navigateur (data URL)
            <img src={qr} alt="QR code du lien ouvert" width={132} height={132} />
          ) : (
            <span className="text-center text-[13px] text-texte-secondaire">QR code en préparation</span>
          )}
        </div>
        <div className="grid gap-2">
          <span className="text-[13px] text-texte-secondaire">Adresse</span>
          <span className="font-medium break-all">{adresse}</span>
          <span className="text-[13px] text-texte-secondaire">Il se ferme à la clôture des signatures.</span>
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-[13px] font-medium text-texte-secondaire">Message de partage, aperçu dans WhatsApp</p>
        <ApercuWhatsApp message={message} />
      </div>
      <label className="flex items-start gap-2.5 text-[14px]">
        <input
          type="checkbox"
          checked={coche}
          disabled={enCours}
          onChange={(e) => basculer(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-eau"
        />
        <span>Lien ouvert actif. Décochez pour le mettre en pause, en cas d&apos;abus par exemple.</span>
      </label>
    </Modal>
  );
}
