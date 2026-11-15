"use client";

import { Lock, Save } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Toast, useToast } from "@/components/ui/toast";
import { formaterTelephone } from "@/lib/ceo/normaliser";

import { enregistrerConsentement, enregistrerGoogleDoc, enregistrerReglagesSignature } from "./actions";

type Props = {
  googleDocUrl: string;
  dateLimite: string;
  autoValidation: boolean;
  whatsapp: string | null;
  texteConsentement: string;
  /* Une signature existe déjà : le texte de consentement ne change plus */
  consentementVerrouille: boolean;
};

/* Valeur d'un champ datetime-local : l'heure de Dakar est l'heure UTC */
const versSaisieDate = (iso: string) => new Date(iso).toISOString().slice(0, 16);

const PANNEAU = "grid gap-3 rounded-[14px] border border-filet bg-surface p-6";

/* Onglet Manifeste : signature (date limite, validation automatique, numéro de la Task Force), consentement, rédaction */
export function OngletManifeste(props: Props) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [auto, setAuto] = useState(props.autoValidation);
  const [erreurs, setErreurs] = useState<{ signature?: string; consentement?: string; googleDoc?: string }>({});

  const enregistrerSignature = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    demarrer(async () => {
      const r = await enregistrerReglagesSignature({
        dateLimite: String(form.get("dateLimite") ?? ""),
        autoValidation: auto,
        whatsapp: String(form.get("whatsapp") ?? ""),
      });
      if (!r.ok) return setErreurs((x) => ({ ...x, signature: r.erreur }));
      setErreurs((x) => ({ ...x, signature: undefined }));
      afficher("Réglages enregistrés");
    });
  };

  const enregistrerTexte = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const texte = String(new FormData(e.currentTarget).get("consentement") ?? "");
    demarrer(async () => {
      const r = await enregistrerConsentement({ texte });
      if (!r.ok) return setErreurs((x) => ({ ...x, consentement: r.erreur }));
      setErreurs((x) => ({ ...x, consentement: undefined }));
      afficher("Texte de consentement enregistré");
    });
  };

  const enregistrerLien = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const url = String(new FormData(e.currentTarget).get("url") ?? "");
    demarrer(async () => {
      const r = await enregistrerGoogleDoc({ url });
      if (!r.ok) return setErreurs((x) => ({ ...x, googleDoc: r.erreur }));
      setErreurs((x) => ({ ...x, googleDoc: undefined }));
      afficher("Lien enregistré");
    });
  };

  return (
    <div className="grid gap-4">
      <section className={PANNEAU}>
        <h3 className="font-titre text-xl font-normal">Signature</h3>
        <form onSubmit={enregistrerSignature} className="grid gap-4" noValidate>
          <Field
            id="date-limite"
            libelle="Date limite des signatures"
            aide="Heure de Dakar. Après cette date, le serveur refuse toute signature, même sans clôture."
            className="max-w-[320px]"
          >
            <Input id="date-limite" name="dateLimite" type="datetime-local" required defaultValue={versSaisieDate(props.dateLimite)} />
          </Field>

          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={auto}
              aria-labelledby="auto-libelle"
              aria-describedby="auto-aide"
              onClick={() => setAuto((v) => !v)}
              className="grid min-h-11 shrink-0 place-items-center"
            >
              <span
                className={
                  "relative block h-6 w-11 rounded-full transition-colors duration-150 ease-projet " + (auto ? "bg-eau" : "bg-filet-fort")
                }
              >
                <span
                  className={
                    "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-150 ease-projet " +
                    (auto ? "translate-x-5" : "")
                  }
                />
              </span>
            </button>
            <div className="grid gap-1 pt-2.5">
              <span id="auto-libelle" className="text-[14.5px] font-medium">
                Validation automatique
              </span>
              <span id="auto-aide" className="text-[13px] text-texte-secondaire">
                Valider automatiquement les signatures dont les informations sont identiques à la liste importée. Les autres passent
                dans « À vérifier ».
              </span>
            </div>
          </div>

          <Field
            id="whatsapp-task-force"
            libelle="Numéro WhatsApp de la Task Force (facultatif)"
            aide="Format international. Ouvert par le lien « Une question ? » de l'espace CEO, masqué s'il est vide."
            className="max-w-[420px]"
          >
            <Input
              id="whatsapp-task-force"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              placeholder="+221 77 000 00 00"
              defaultValue={props.whatsapp ? formaterTelephone(props.whatsapp) : ""}
            />
          </Field>

          {erreurs.signature ? (
            <p role="alert" className="text-[13px] text-erreur">
              {erreurs.signature}
            </p>
          ) : null}
          <div>
            <Button type="submit" variante="principal" disabled={enCours}>
              <Save aria-hidden="true" strokeWidth={1.75} />
              Enregistrer
            </Button>
          </div>
        </form>
      </section>

      <section className={PANNEAU}>
        <h3 className="font-titre text-xl font-normal">Texte de consentement</h3>
        <p className="text-[13px] text-texte-secondaire">
          Affiché au CEO juste avant la signature. La case doit être cochée pour signer. Le texte accepté est conservé avec chaque
          signature.
        </p>
        {props.consentementVerrouille ? (
          <>
            <p className="rounded-[10px] border border-filet bg-sureleve px-4 py-3 text-[14.5px]">{props.texteConsentement}</p>
            <p className="flex items-start gap-2 text-[13px] text-texte-secondaire [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
              <Lock aria-hidden="true" strokeWidth={1.75} />
              Des CEO ont déjà signé avec ce texte : il ne peut plus changer, pour que tous les signataires aient accepté le même.
            </p>
          </>
        ) : (
          <form onSubmit={enregistrerTexte} className="grid gap-3" noValidate>
            <Field id="consentement" libelle="Texte de la case à cocher" erreur={erreurs.consentement}>
              <textarea
                id="consentement"
                name="consentement"
                defaultValue={props.texteConsentement}
                maxLength={600}
                className="min-h-[100px] w-full resize-y rounded-[10px] border border-filet-fort bg-surface p-3 text-[15px] outline-none focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)]"
              />
            </Field>
            <div>
              <Button type="submit" disabled={enCours}>
                <Save aria-hidden="true" strokeWidth={1.75} />
                Enregistrer
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className={PANNEAU}>
        <h3 className="font-titre text-xl font-normal">Rédaction</h3>
        <form onSubmit={enregistrerLien} className="grid gap-3" noValidate>
          <Field
            id="google-doc"
            libelle="Lien du Google Doc de rédaction"
            aide="Affiché dans la rubrique Texte (« Ouvrir le Google Doc »). Laissez vide pour le retirer."
            erreur={erreurs.googleDoc}
          >
            <Input
              id="google-doc"
              name="url"
              type="url"
              inputMode="url"
              defaultValue={props.googleDocUrl}
              placeholder="https://docs.google.com/document/d/..."
            />
          </Field>
          <div>
            <Button type="submit" disabled={enCours}>
              <Save aria-hidden="true" strokeWidth={1.75} />
              Enregistrer
            </Button>
          </div>
        </form>
        <p className="text-[13px] text-texte-secondaire">
          Le titre et le sous-titre viennent du document importé (styles Titre et Sous-titre).
        </p>
      </section>
      <Toast message={message} />
    </div>
  );
}
