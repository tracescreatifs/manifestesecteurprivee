"use client";

import { Camera, Save, Trash2, UserRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PHOTO_COTE, TEXTES_CHOIX, type ChoixFiche } from "@/lib/signature/fiche";

import { enregistrerFiche } from "./actions";
import { Feuille } from "./commun";

/*
  Fiche facultative du CEO (prototype 2-ceo.html) : photo et trois consentements indépendants.
  La photo est recadrée en carré au centre et réduite à 400 x 400 px en JPEG dans le navigateur,
  puis envoyée à la route /s/[jeton]/photo, qui revalide le jeton.
*/

async function preparerPhoto(fichier: File): Promise<Blob> {
  const image = await createImageBitmap(fichier);
  const cote = Math.min(image.width, image.height);
  const toile = document.createElement("canvas");
  toile.width = PHOTO_COTE;
  toile.height = PHOTO_COTE;
  const g = toile.getContext("2d");
  if (!g) throw new Error("toile");
  g.imageSmoothingQuality = "high";
  g.drawImage(image, (image.width - cote) / 2, (image.height - cote) / 2, cote, cote, 0, 0, PHOTO_COTE, PHOTO_COTE);
  image.close();
  return new Promise((resoudre, rejeter) =>
    toile.toBlob((b) => (b ? resoudre(b) : rejeter(new Error("jpeg"))), "image/jpeg", 0.85),
  );
}

export function FicheCeo({
  ouverte,
  onFermer,
  jeton,
  photoInitiale,
  choixInitiaux,
  onEnregistree,
}: {
  ouverte: boolean;
  onFermer: () => void;
  jeton: string;
  photoInitiale: string | null;
  choixInitiaux: ChoixFiche;
  onEnregistree: (message: string) => void;
}) {
  const [photo, setPhoto] = useState(photoInitiale);
  const [choix, setChoix] = useState(choixInitiaux);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string>();

  const envoyerPhoto = async (fichier: File | undefined) => {
    if (!fichier) return;
    setOccupe(true);
    setErreur(undefined);
    try {
      const corps = new FormData();
      corps.append("photo", await preparerPhoto(fichier), "photo.jpg");
      const r = await fetch(`/s/${jeton}/photo`, { method: "POST", body: corps });
      const donnees = (await r.json()) as { url?: string | null; erreur?: string };
      if (!r.ok) return setErreur(donnees.erreur ?? "La photo n'a pas pu être enregistrée. Réessayez.");
      setPhoto(donnees.url ?? null);
    } catch {
      setErreur("La photo n'a pas pu être lue ou envoyée. Vérifiez votre connexion Internet, puis réessayez.");
    } finally {
      setOccupe(false);
    }
  };

  const retirerPhoto = async () => {
    setOccupe(true);
    setErreur(undefined);
    try {
      const r = await fetch(`/s/${jeton}/photo`, { method: "DELETE" });
      if (!r.ok) return setErreur("La photo n'a pas pu être retirée. Réessayez.");
      setPhoto(null);
      setChoix((c) => ({ ...c, photo_communication: false }));
    } catch {
      setErreur("La connexion a échoué. Vérifiez votre connexion Internet, puis réessayez.");
    } finally {
      setOccupe(false);
    }
  };

  const enregistrer = async () => {
    setOccupe(true);
    setErreur(undefined);
    try {
      const r = await enregistrerFiche({ jeton, choix: { ...choix, photo_communication: choix.photo_communication && Boolean(photo) } });
      if (!r.ok) return setErreur(r.erreur);
      onEnregistree("Fiche enregistrée");
    } catch {
      setErreur("La connexion a échoué. Vérifiez votre connexion Internet, puis réessayez.");
    } finally {
      setOccupe(false);
    }
  };

  const CASES: [keyof ChoixFiche, boolean][] = [
    ["recontact", false],
    ["annuaire", false],
    ["photo_communication", !photo],
  ];

  return (
    <Feuille
      ouverte={ouverte}
      titre="Votre fiche"
      onFermer={onFermer}
      pied={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onFermer}>Fermer</Button>
          <Button variante="principal" onClick={enregistrer} disabled={occupe}>
            <Save aria-hidden="true" strokeWidth={1.75} />
            Enregistrer
          </Button>
        </div>
      }
    >
      <h3 className="font-titre text-[23px] font-normal">Votre photo</h3>
      <p className="text-texte-secondaire">Facultatif. Une photo portrait, de face, sur un fond simple.</p>
      <div className="grid size-[84px] place-items-center overflow-hidden rounded-full bg-[#E6E0D3] text-texte-secondaire [&_svg]:size-9">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- lien signé du bucket privé, déjà réduit à 400 px
          <img src={photo} alt="Votre photo" width={84} height={84} className="size-full object-cover" />
        ) : (
          <UserRound aria-hidden="true" strokeWidth={1.75} />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <label
          className={
            "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-controle border border-filet-fort bg-surface px-3 text-[14px] font-medium " +
            "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-eau [&_svg]:size-[18px] " +
            (occupe ? "pointer-events-none opacity-50" : "")
          }
        >
          <Camera aria-hidden="true" strokeWidth={1.75} />
          {photo ? "Changer" : "Prendre ou choisir une photo"}
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Choisir une photo"
            disabled={occupe}
            onChange={(e) => {
              void envoyerPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {photo ? (
          <Button variante="discret" onClick={retirerPhoto} disabled={occupe}>
            <Trash2 aria-hidden="true" strokeWidth={1.75} />
            Retirer
          </Button>
        ) : null}
      </div>
      {occupe ? <p className="text-[13px] text-texte-secondaire">Envoi en cours</p> : null}

      <h3 className="mt-1.5 font-titre text-[20px] font-normal">Vos choix</h3>
      {CASES.map(([type, desactive]) => (
        <label key={type} className={"flex items-start gap-2.5 text-[14.5px] " + (desactive ? "opacity-50" : "")}>
          <input
            type="checkbox"
            checked={choix[type] && !desactive}
            disabled={desactive}
            onChange={(e) => setChoix((c) => ({ ...c, [type]: e.target.checked }))}
            className="mt-0.5 size-5 shrink-0 accent-eau"
          />
          <span>{TEXTES_CHOIX[type]}</span>
        </label>
      ))}
      <p className="text-[13px] text-texte-secondaire">Chaque choix est indépendant. Vous pouvez le modifier à tout moment depuis ce lien.</p>
      {erreur ? (
        <p role="alert" className="text-[13.5px] text-erreur">
          {erreur}
        </p>
      ) : null}
    </Feuille>
  );
}
