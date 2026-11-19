"use client";

import { Camera, Pencil, PenTool, RotateCw, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { preparerSignature } from "@/lib/document/image-signature";
import { schemaSignataireSurPlace, SIGNATURE_IMAGE_TAILLE_MAX, type SaisieSurPlace } from "@/lib/document/regles";
import type { SignataireSurPlace } from "@/lib/document/serveur";

import { ajouterSignataireSurPlace, modifierSignataireSurPlace, retirerSignataireSurPlace } from "./actions";

/*
  Signataires sur place (cahier des charges, partie 8 ; prompt 08) : CEO qui ont signé à la main à Abu Dhabi,
  ajoutés après la clôture et avant la publication. La photo de la signature est recadrée autour de l'encre,
  mise sur fond blanc et compressée dans le navigateur, puis vérifiée par le serveur.
*/

const VIDE: SaisieSurPlace = { prenom: "", nom: "", fonction: "", entreprise: "", maillon: "" };
const CHAMPS: [keyof SaisieSurPlace, string, string][] = [
  ["prenom", "Prénom", "given-name"],
  ["nom", "Nom", "family-name"],
  ["fonction", "Fonction", "organization-title"],
  ["entreprise", "Entreprise (nom officiel)", "organization"],
];

type Formulaire = { signataire: SignataireSurPlace | null };

export function SignatairesSurPlace({
  signataires,
  maillons,
  onMessage,
}: {
  signataires: SignataireSurPlace[];
  maillons: string[];
  onMessage: (texte: string, erreur?: boolean) => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [saisie, setSaisie] = useState<SaisieSurPlace>(VIDE);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof SaisieSurPlace, string>>>({});
  const [erreur, setErreur] = useState<string>();
  const [fichier, setFichier] = useState<Blob | null>(null);
  const [tours, setTours] = useState(0);
  const [image, setImage] = useState<{ blob: Blob; apercu: string } | null>(null);
  const [preparation, setPreparation] = useState(false);
  const [aRetirer, setARetirer] = useState<SignataireSurPlace | null>(null);

  /* Photo préparée à chaque nouveau fichier ou quart de tour */
  useEffect(() => {
    if (!fichier) return;
    let actuel = true;
    const t = window.setTimeout(() => setPreparation(true), 0);
    preparerSignature(fichier, tours)
      .then((r) => {
        if (!actuel) return URL.revokeObjectURL(r.apercu);
        setImage((avant) => {
          if (avant) URL.revokeObjectURL(avant.apercu);
          return r;
        });
        setErreur(r.blob.size > SIGNATURE_IMAGE_TAILLE_MAX ? "Photo trop lourde. Reprenez-la de plus près." : undefined);
      })
      .catch(() => actuel && setErreur("Cette photo n'a pas pu être lue. Reprenez-la."))
      .finally(() => actuel && setPreparation(false));
    return () => {
      actuel = false;
      window.clearTimeout(t);
    };
  }, [fichier, tours]);

  const ouvrir = (signataire: SignataireSurPlace | null) => {
    setSaisie(signataire ? { prenom: signataire.prenom, nom: signataire.nom, fonction: signataire.fonction, entreprise: signataire.entreprise, maillon: signataire.maillon } : VIDE);
    setErreurs({});
    setErreur(undefined);
    setFichier(null);
    setTours(0);
    setImage(null);
    setFormulaire({ signataire });
  };

  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    if (!formulaire) return;
    const r = schemaSignataireSurPlace(maillons).safeParse(saisie);
    if (!r.success) {
      const champs: Partial<Record<keyof SaisieSurPlace, string>> = {};
      r.error.issues.forEach((i) => {
        const c = i.path[0] as keyof SaisieSurPlace;
        if (!champs[c]) champs[c] = i.message;
      });
      setErreurs(champs);
      return setErreur("Vérifiez les informations du signataire.");
    }
    if (!formulaire.signataire && !image) return setErreur("Ajoutez la photo de la signature.");
    if (image && image.blob.size > SIGNATURE_IMAGE_TAILLE_MAX) return setErreur("Photo trop lourde. Reprenez-la de plus près.");
    const donnees = new FormData();
    Object.entries(r.data).forEach(([c, v]) => donnees.set(c, v));
    if (image) donnees.set("image", image.blob, "signature.jpg");
    if (formulaire.signataire) donnees.set("id", formulaire.signataire.id);
    demarrer(async () => {
      const res = formulaire.signataire ? await modifierSignataireSurPlace(donnees) : await ajouterSignataireSurPlace(donnees);
      if (!res.ok) {
        if ("champs" in res && res.champs) setErreurs(res.champs);
        return setErreur(res.erreur);
      }
      setFormulaire(null);
      onMessage(formulaire.signataire ? "Signataire modifié" : `Signataire ajouté${"reference" in res && res.reference ? ` : ${res.reference}` : ""}`);
    });
  };

  const retirer = () =>
    aRetirer &&
    demarrer(async () => {
      const r = await retirerSignataireSurPlace({ id: aRetirer.id });
      if (r.ok) setARetirer(null);
      onMessage(r.ok ? "Signataire retiré de l'annexe" : r.erreur, !r.ok);
    });

  const apercu = image?.apercu ?? formulaire?.signataire?.image ?? null;

  return (
    <section className="grid gap-3 rounded-carte bg-surface shadow-douce p-5" aria-labelledby="titre-sur-place">
      <h3 id="titre-sur-place" className="flex items-center gap-2 font-titre text-xl font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
        <PenTool aria-hidden="true" strokeWidth={1.75} />
        Signataires sur place
      </h3>
      <p className="text-[13.5px] text-texte-secondaire">
        Les CEO qui ont signé à la main à Abu Dhabi. Chaque ligne entre dans l&apos;annexe selon l&apos;ordre choisi, avec sa
        référence. Possible jusqu&apos;à la publication.
      </p>
      <Button onClick={() => ouvrir(null)} className="w-fit">
        <UserPlus aria-hidden="true" strokeWidth={1.75} />
        Ajouter un signataire sur place
      </Button>
      {signataires.length ? (
        <ul className="grid gap-2">
          {signataires.map((s) => (
            <li key={s.id} className="grid gap-2 rounded-controle border border-filet p-3 min-[520px]:grid-cols-[96px_minmax(0,1fr)_auto] min-[520px]:items-center">
              <div className="grid h-12 w-24 place-items-center rounded-md border border-filet bg-white">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- lien signé privé d'une heure
                  <img src={s.image} alt={`Signature de ${s.prenom} ${s.nom}`} className="max-h-11 max-w-[92px] object-contain" />
                ) : null}
              </div>
              <div className="min-w-0 text-[14px]">
                <strong className="font-semibold">
                  {s.prenom} {s.nom}
                </strong>
                <span className="block text-[13px] text-texte-secondaire [overflow-wrap:anywhere]">
                  {s.fonction}, {s.entreprise}, {s.maillon}. <span className="tabular-nums">{s.reference}</span>
                </span>
              </div>
              <div className="flex gap-1">
                <Button variante="discret" className="min-h-11 px-3 text-[14px]" onClick={() => ouvrir(s)} aria-label={`Modifier ${s.prenom} ${s.nom}`}>
                  <Pencil aria-hidden="true" strokeWidth={1.75} />
                  Modifier
                </Button>
                <Button variante="discret" className="min-h-11 px-3 text-[14px]" onClick={() => setARetirer(s)} aria-label={`Retirer ${s.prenom} ${s.nom}`}>
                  <Trash2 aria-hidden="true" strokeWidth={1.75} />
                  Retirer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-texte-secondaire">Aucun signataire sur place pour l&apos;instant.</p>
      )}

      <Modal
        ouvert={formulaire !== null}
        titre={formulaire?.signataire ? "Modifier un signataire sur place" : "Ajouter un signataire sur place"}
        onFermer={() => setFormulaire(null)}
        pied={
          <>
            <Button variante="discret" onClick={() => setFormulaire(null)}>
              Annuler
            </Button>
            <Button type="submit" form="formulaire-sur-place" variante="principal" disabled={enCours || preparation}>
              {formulaire?.signataire ? "Enregistrer" : "Ajouter à l'annexe"}
            </Button>
          </>
        }
      >
        <form id="formulaire-sur-place" onSubmit={envoyer} noValidate className="grid gap-4 min-[520px]:grid-cols-2">
          {CHAMPS.map(([c, libelle, auto]) => (
            <Field key={c} id={`sp-${c}`} libelle={libelle} erreur={erreurs[c]}>
              <Input
                id={`sp-${c}`}
                value={saisie[c]}
                autoComplete={auto}
                aria-invalid={Boolean(erreurs[c])}
                onChange={(e) => {
                  setSaisie((s) => ({ ...s, [c]: e.target.value }));
                  setErreurs((x) => ({ ...x, [c]: undefined }));
                }}
              />
            </Field>
          ))}
          <Field id="sp-maillon" libelle="Maillon" erreur={erreurs.maillon} className="min-[520px]:col-span-2">
            <select
              id="sp-maillon"
              value={saisie.maillon}
              aria-invalid={Boolean(erreurs.maillon)}
              onChange={(e) => {
                setSaisie((s) => ({ ...s, maillon: e.target.value }));
                setErreurs((x) => ({ ...x, maillon: undefined }));
              }}
              className="min-h-11 w-full rounded-controle border border-filet-fort bg-surface px-3 text-[15px] focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none"
            >
              <option value="">Choisissez</option>
              {maillons.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-2 min-[520px]:col-span-2">
            <span className="text-[13px] font-medium text-texte-secondaire">Photo de la signature</span>
            <div className="grid h-36 place-items-center overflow-hidden rounded-controle border border-filet bg-white p-2">
              {apercu ? (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL d'objet) ou lien signé privé
                <img src={apercu} alt="Aperçu de la signature, sur fond blanc" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[13px] text-texte-secondaire">{preparation ? "Préparation de la photo" : "Aucune photo"}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-controle border border-filet-fort bg-surface px-4 text-[15px] font-medium focus-within:border-eau focus-within:shadow-[0_0_0_3px_var(--color-eau-doux)] [&_svg]:size-[18px]">
                <Camera aria-hidden="true" strokeWidth={1.75} />
                {fichier || formulaire?.signataire ? "Changer de photo" : "Prendre ou choisir une photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setTours(0);
                      setFichier(f);
                      setErreur(undefined);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {fichier ? (
                <Button onClick={() => setTours((t) => (t + 1) % 4)} disabled={preparation}>
                  <RotateCw aria-hidden="true" strokeWidth={1.75} />
                  Tourner
                </Button>
              ) : null}
            </div>
            <span className="text-[12.5px] text-texte-secondaire">
              Photographiez la signature à plat, en entier, avec un bon éclairage. Elle est recadrée autour de l&apos;encre et
              mise sur fond blanc.
            </span>
          </div>
          {erreur ? (
            <p role="alert" className="text-[13.5px] text-erreur min-[520px]:col-span-2">
              {erreur}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        ouvert={aRetirer !== null}
        titre="Retirer ce signataire ?"
        onFermer={() => setARetirer(null)}
        pied={
          <>
            <Button variante="discret" onClick={() => setARetirer(null)}>
              Garder
            </Button>
            <Button variante="danger" onClick={retirer} disabled={enCours}>
              <Trash2 aria-hidden="true" strokeWidth={1.75} />
              Retirer
            </Button>
          </>
        }
      >
        <p>
          {aRetirer ? `${aRetirer.prenom} ${aRetirer.nom} (${aRetirer.entreprise}) ` : ""}
          sort de l&apos;annexe. La signature reste dans le journal et dans l&apos;export, comme retirée.
        </p>
      </Modal>
    </section>
  );
}
