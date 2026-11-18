"use client";

import { MessageCircle, Shield, Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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

/* Copie dans le presse-papiers, avec un repli pour les navigateurs anciens */
export async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    try {
      const zone = document.createElement("textarea");
      zone.value = texte;
      zone.setAttribute("readonly", "");
      zone.style.position = "fixed";
      zone.style.opacity = "0";
      document.body.appendChild(zone);
      zone.select();
      const ok = document.execCommand("copy");
      zone.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/*
  Fenêtre centrée verticalement, sur téléphone comme sur ordinateur : 85 % de la hauteur de l'écran au plus,
  contenu qui défile, boutons du bas toujours visibles. Titre et bouton « Fermer » en haut ; Échap ferme aussi.
*/

/* Bouton de fermeture commun aux fenêtres de l'espace CEO */
export function BoutonFermer({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Fermer"
      className="grid size-11 shrink-0 place-items-center rounded-[10px] text-texte-secondaire hover:bg-[rgba(20,33,43,0.06)] hover:text-encre [&_svg]:size-[18px]"
    >
      <X aria-hidden="true" strokeWidth={1.75} />
    </button>
  );
}
export function Feuille({
  ouverte,
  titre,
  onFermer,
  children,
  pied,
}: {
  ouverte: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  pied?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const fermer = useRef(onFermer);
  const idTitre = useId();
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
      aria-labelledby={idTitre}
      onClose={(e) => {
        /* L'événement d'une fenêtre imbriquée remonte dans React : seule la fermeture de celle-ci compte */
        if (e.target === e.currentTarget) fermer.current();
      }}
      onClick={(e) => e.target === e.currentTarget && fermer.current()}
      style={{ maxHeight: "min(85vh, 85dvh)" }}
      className={
        "fixed inset-0 m-auto h-fit max-h-[85vh] w-[calc(100%-32px)] max-w-[520px] overflow-hidden rounded-[18px] bg-surface p-0 text-encre " +
        "backdrop:bg-[rgba(20,33,43,0.4)]"
      }
    >
      {ouverte ? (
        <div className="flex max-h-[inherit] flex-col" style={{ maxHeight: "min(85vh, 85dvh)" }}>
          <div className="flex shrink-0 items-center justify-between gap-3 pt-3 pr-3 pl-5 min-[760px]:pl-6">
            <h3 id={idTitre} className="min-w-0 font-titre text-xl font-normal">
              {titre}
            </h3>
            <BoutonFermer onClick={() => fermer.current()} />
          </div>
          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain px-5 pt-2 pb-4 min-[760px]:px-6">
            {children}
          </div>
          {pied ? <div className="grid shrink-0 gap-2 border-t border-filet px-5 py-3 min-[760px]:px-6">{pied}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/* Barre de connexion (signature gardée sur l'appareil, puis envoyée au retour du réseau) */
export function BarreReseau({ etat }: { etat: "perdue" | "retablie" | null }) {
  return (
    <div role="status" aria-live="polite">
      {etat ? (
        <div
          className={
            "flex items-center gap-2 px-4 py-2.5 text-[13.5px] text-white [&_svg]:size-[18px] [&_svg]:shrink-0 " +
            /* Encre et non argile : l'argile est réservée à « à vérifier » (charte), et le contraste est AA */
            (etat === "perdue" ? "bg-encre" : "bg-succes")
          }
        >
          {etat === "perdue" ? <WifiOff aria-hidden="true" strokeWidth={1.75} /> : <Wifi aria-hidden="true" strokeWidth={1.75} />}
          {etat === "perdue"
            ? "Connexion perdue. Votre signature est gardée sur cet appareil"
            : "Connexion rétablie. Votre signature est enregistrée"}
        </div>
      ) : null}
    </div>
  );
}

/* Texte du prototype 2-ceo.html, complété pour les doléances (prompt 09a) */
export function TexteConfidentialite() {
  return (
    <>
      <p>
        <strong>Ce que nous recueillons.</strong> Votre nom, votre fonction, votre entreprise, son maillon, votre numéro
        WhatsApp et votre signature. Si vous le choisissez : votre photo, vos commentaires et vos doléances (thème, texte et
        proposition de solution).
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
        <strong>Vos doléances.</strong> Elles sont lues uniquement par {EXPEDITEUR}. Elles ne sont jamais publiées avec votre
        nom ni celui de votre entreprise. Une doléance pour laquelle vous avez coché « Ne jamais la publier, même sans nom »
        n&apos;est jamais publiée du tout. Vous pouvez supprimer vos doléances depuis ce lien.
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
          <Feuille
            ouverte={ouverte}
            titre="Confidentialité"
            onFermer={() => setOuverte(false)}
            pied={<Button onClick={() => setOuverte(false)}>Fermer</Button>}
          >
            <div className="grid gap-3 text-[15px]">
              <TexteConfidentialite />
            </div>
          </Feuille>
        </>
      ) : null}
    </div>
  );
}
