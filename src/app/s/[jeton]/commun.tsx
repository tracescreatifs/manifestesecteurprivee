"use client";

import { MessageCircle, Shield } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

/*
  Éléments communs de l'espace CEO, sans bibliothèque d'animation (page légère pour les téléphones modestes).
  Les fenêtres utilisent l'élément dialog natif : focus gardé dans la fenêtre, Échap pour fermer.
*/

export const EXPEDITEUR = "la Task Force du secteur privé sénégalais de l'eau et de l'assainissement";

export function lienQuestion(numero: string | null): string | null {
  const chiffres = (numero ?? "").replace(/\D/g, "");
  return chiffres ? `https://wa.me/${chiffres}` : null;
}

/* Feuille : en bas de l'écran sur téléphone, au centre sur ordinateur */
export function Feuille({
  ouverte,
  titre,
  onFermer,
  children,
}: {
  ouverte: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  }, [onFermer]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouverte && !d.open) d.showModal();
    if (!ouverte && d.open) d.close();
  }, [ouverte]);

  return (
    <dialog
      ref={ref}
      aria-label={titre}
      onClose={() => fermer.current()}
      onClick={(e) => e.target === e.currentTarget && fermer.current()}
      className={
        "fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-[20px] bg-surface p-0 text-encre " +
        "backdrop:bg-[rgba(20,33,43,0.4)] min-[760px]:inset-0 min-[760px]:m-auto min-[760px]:h-fit min-[760px]:max-w-[520px] min-[760px]:rounded-[18px]"
      }
    >
      {ouverte ? <div className="grid gap-3 px-5 pt-5 pb-6 min-[760px]:p-6">{children}</div> : null}
    </dialog>
  );
}

/* Texte exact du prototype 2-ceo.html */
export function TexteConfidentialite() {
  return (
    <>
      <p>
        <strong>Ce que nous recueillons.</strong> Votre nom, votre fonction, votre entreprise, son maillon, votre numéro
        WhatsApp et votre signature. Si vous le choisissez : votre photo et vos commentaires.
      </p>
      <p>
        <strong>Pourquoi.</strong> Pour faire figurer votre signature dans l&apos;annexe du Manifeste et pour vous recontacter
        si vous l&apos;acceptez.
      </p>
      <p>
        <strong>Qui le voit.</strong> Votre nom, votre fonction, votre entreprise et votre signature sont publiés avec le
        Manifeste. Votre numéro et vos commentaires ne sont lus que par l&apos;équipe de rédaction. Votre photo n&apos;est
        visible que selon les choix de votre fiche.
      </p>
      <p>
        <strong>Vos droits.</strong> Vous pouvez retirer votre signature jusqu&apos;à la clôture, modifier vos choix à tout
        moment depuis ce lien, et demander la suppression de vos données avec le bouton « Une question ? ».
      </p>
      <p className="text-[13px] text-texte-secondaire">
        Plateforme gérée par Aziz Fall pour le compte de {EXPEDITEUR}, dans le respect de la loi sénégalaise sur la
        protection des données personnelles.
      </p>
    </>
  );
}

const LIEN_DISCRET =
  "inline-flex min-h-11 items-center gap-1.5 text-[13px] text-texte-secondaire hover:text-encre [&_svg]:size-4";

/* Pied de page : « Une question ? » (WhatsApp de la Task Force, masqué sans numéro) et « Confidentialité » */
export function LiensPied({ whatsapp, confidentialite = true }: { whatsapp: string | null; confidentialite?: boolean }) {
  const [ouverte, setOuverte] = useState(false);
  const question = lienQuestion(whatsapp);
  if (!question && !confidentialite) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {question ? (
        <a className={LIEN_DISCRET} href={question} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden="true" strokeWidth={1.75} />
          Une question ?
        </a>
      ) : null}
      {question && confidentialite ? (
        <span aria-hidden="true" className="text-texte-secondaire">
          ·
        </span>
      ) : null}
      {confidentialite ? (
        <>
          <button type="button" className={LIEN_DISCRET} onClick={() => setOuverte(true)}>
            <Shield aria-hidden="true" strokeWidth={1.75} />
            Confidentialité
          </button>
          <Feuille ouverte={ouverte} titre="Confidentialité" onFermer={() => setOuverte(false)}>
            <h3 className="font-titre text-xl font-normal">Confidentialité</h3>
            <div className="grid gap-3 text-[15px]">
              <TexteConfidentialite />
            </div>
            <Button onClick={() => setOuverte(false)}>Fermer</Button>
          </Feuille>
        </>
      ) : null}
    </div>
  );
}
