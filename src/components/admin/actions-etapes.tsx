"use client";

import { BadgeCheck, CircleSlash, FileDown, FileUp, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cloreSignatures, publierDocument, rouvrirSignatures } from "@/app/admin/document/actions";
import { Button, classesBouton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formaterDateLimite } from "@/lib/ceo/message";
import { dateDeReouverture, PDF_TAILLE_MAX } from "@/lib/document/regles";

/*
  Actions de la barre d'étapes après le gel (prompt 08) : clore les signatures, rouvrir (D18), publier (D25).
  Fenêtres rendues dans un portail (composant Modal). Chaque action est recontrôlée par le serveur.
*/

const ENTREE =
  "min-h-11 w-full rounded-controle border border-filet-fort bg-surface px-3 text-[15px] focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none";

function Erreur({ texte }: { texte?: string }) {
  return texte ? (
    <p role="alert" className="text-[13.5px] text-erreur">
      {texte}
    </p>
  ) : null;
}

/* « Clore les signatures » : nombre de signatures dans l'annexe et en attente dans « À vérifier » */
export function BoutonClore({ annexe, aVerifier, aideId }: { annexe: number; aVerifier: number; aideId?: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const clore = () =>
    demarrer(async () => {
      const r = await cloreSignatures();
      if (!r.ok) return setErreur(r.erreur);
      setOuvert(false);
      router.refresh();
    });
  return (
    <>
      <Button variante="principal" aria-describedby={aideId} onClick={() => (setErreur(undefined), setOuvert(true))}>
        <CircleSlash aria-hidden="true" strokeWidth={1.75} />
        Clore les signatures
      </Button>
      <Modal
        ouvert={ouvert}
        titre="Clore les signatures"
        onFermer={() => setOuvert(false)}
        pied={
          <>
            <Button variante="discret" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button variante="principal" onClick={clore} disabled={enCours}>
              <CircleSlash aria-hidden="true" strokeWidth={1.75} />
              Clore
            </Button>
          </>
        }
      >
        <ul className="grid gap-1.5">
          <li>
            <strong className="tabular-nums">{annexe}</strong> signature{annexe > 1 ? "s" : ""} dans l&apos;annexe.
          </li>
          <li>
            <strong className="tabular-nums">{aVerifier}</strong> en attente dans « À vérifier ».
          </li>
        </ul>
        <p>Les CEO ne pourront plus signer. Vous pourrez rouvrir tant que le document n&apos;est pas publié.</p>
        <Erreur texte={erreur} />
      </Modal>
    </>
  );
}

/* « Rouvrir » (D18) : nouvelle date limite, à l'heure de Dakar, affichée aussi à l'heure d'Abu Dhabi */
export function BoutonRouvrir({ aideId }: { aideId?: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const apercu = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(saisie) ? formaterDateLimite(`${saisie}:00Z`) : null;

  const rouvrir = () => {
    const d = dateDeReouverture(saisie, new Date());
    if (!d.ok) return setErreur(d.erreur);
    demarrer(async () => {
      const r = await rouvrirSignatures({ dateLimite: saisie });
      if (!r.ok) return setErreur(r.erreur);
      setOuvert(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        aria-describedby={aideId}
        aria-label="Rouvrir les signatures"
        onClick={() => (setErreur(undefined), setSaisie(""), setOuvert(true))}
      >
        <RotateCcw aria-hidden="true" strokeWidth={1.75} />
        {/* De 820 à 1079 px, l'icône seule : la barre d'étapes tient sur une ligne (D104) */}
        <span className="min-[820px]:max-[1079px]:sr-only">Rouvrir</span>
      </Button>
      <Modal
        ouvert={ouvert}
        titre="Rouvrir les signatures"
        onFermer={() => setOuvert(false)}
        pied={
          <>
            <Button variante="discret" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button variante="principal" onClick={rouvrir} disabled={enCours}>
              <RotateCcw aria-hidden="true" strokeWidth={1.75} />
              Rouvrir
            </Button>
          </>
        }
      >
        <p>Les CEO pourront de nouveau signer jusqu&apos;à la nouvelle date limite. Possible tant que le document n&apos;est pas publié.</p>
        <div className="grid gap-2">
          <label htmlFor="nouvelle-date-limite" className="text-[13px] font-medium text-texte-secondaire">
            Nouvelle date limite (heure de Dakar)
          </label>
          <input
            id="nouvelle-date-limite"
            type="datetime-local"
            value={saisie}
            onChange={(e) => (setSaisie(e.target.value), setErreur(undefined))}
            aria-describedby="nouvelle-date-apercu"
            className={`${ENTREE} max-w-[320px]`}
          />
          <p id="nouvelle-date-apercu" aria-live="polite" className="text-[14px]">
            {apercu ? `Soit le ${apercu}` : "Pour le 10 décembre à minuit, saisissez le 11 décembre à 00:00."}
          </p>
        </div>
        <Erreur texte={erreur} />
      </Modal>
    </>
  );
}

/* « Publier » (D25) : exporter le document complet en PDF, le déposer, puis publier. Sans retour. */
export function BoutonPublier({ aideId }: { aideId?: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [depot, setDepot] = useState<{ chemin: string; nom: string; taille: number } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [verifie, setVerifie] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  const deposer = async (fichier: File) => {
    setErreur(undefined);
    setDepot(null);
    setVerifie(false);
    if (fichier.size > PDF_TAILLE_MAX) return setErreur("PDF trop lourd (4 Mo au plus).");
    setEnvoi(true);
    try {
      const donnees = new FormData();
      donnees.set("pdf", fichier);
      const r = await fetch("/admin/document/pdf", { method: "POST", body: donnees });
      const corps = (await r.json().catch(() => ({}))) as { chemin?: string; taille?: number; erreur?: string };
      if (!r.ok || !corps.chemin) return setErreur(corps.erreur ?? "Le PDF n'a pas pu être déposé. Réessayez.");
      setDepot({ chemin: corps.chemin, nom: fichier.name, taille: corps.taille ?? fichier.size });
    } catch {
      setErreur("La connexion a échoué. Vérifiez votre connexion Internet, puis réessayez.");
    } finally {
      setEnvoi(false);
    }
  };

  const publier = () =>
    depot &&
    demarrer(async () => {
      const r = await publierDocument({ chemin: depot.chemin });
      if (!r.ok) return setErreur(r.erreur);
      setOuvert(false);
      router.refresh();
    });

  return (
    <>
      <Button
        variante="principal"
        aria-describedby={aideId}
        onClick={() => (setErreur(undefined), setDepot(null), setVerifie(false), setOuvert(true))}
      >
        <BadgeCheck aria-hidden="true" strokeWidth={1.75} />
        Publier
      </Button>
      <Modal
        ouvert={ouvert}
        titre="Publier le document final"
        onFermer={() => setOuvert(false)}
        pied={
          <>
            <Button variante="discret" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button variante="principal" onClick={publier} disabled={!depot || !verifie || enCours}>
              <BadgeCheck aria-hidden="true" strokeWidth={1.75} />
              Publier
            </Button>
          </>
        }
      >
        <p>
          Chaque CEO verra, depuis son lien, le document final A4 complet avec l&apos;annexe des signataires, et pourra le
          télécharger. La publication est définitive : plus de réouverture, de réglages de l&apos;annexe ni de signataires sur
          place.
        </p>
        <ol className="grid gap-4">
          <li className="grid gap-2">
            <strong className="font-semibold">1. Exportez le document complet en PDF</strong>
            <a
              href="/impression/complet"
              target="_blank"
              rel="noopener"
              aria-describedby="aide-export-publication"
              className={classesBouton("secondaire", "w-fit")}
            >
              <FileDown aria-hidden="true" strokeWidth={1.75} />
              Exporter en PDF
            </a>
            <p id="aide-export-publication" className="text-[13px] text-texte-secondaire">
              Une fenêtre s&apos;ouvre : choisissez Enregistrer en PDF.
            </p>
          </li>
          <li className="grid gap-2">
            <strong className="font-semibold">2. Déposez le PDF</strong>
            <label className="relative inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-controle border border-filet-fort bg-surface px-4 text-[15px] font-medium focus-within:border-eau focus-within:shadow-[0_0_0_3px_var(--color-eau-doux)] [&_svg]:size-[18px]">
              <FileUp aria-hidden="true" strokeWidth={1.75} />
              {depot ? "Changer de fichier" : "Choisir le PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={envoi}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void deposer(f);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-[13px] text-texte-secondaire" aria-live="polite">
              {envoi
                ? "Dépôt en cours"
                : depot
                  ? `Déposé : ${depot.nom} (${(depot.taille / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo).`
                  : "Format PDF, 4 Mo au plus."}
            </p>
          </li>
          <li className="grid gap-2">
            <strong className="font-semibold">3. Confirmez</strong>
            <label className="flex min-h-11 items-start gap-2.5 text-[14.5px]">
              <input
                type="checkbox"
                checked={verifie}
                disabled={!depot}
                onChange={(e) => setVerifie(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-eau"
              />
              <span>J&apos;ai vérifié le PDF : c&apos;est le document complet, texte et annexe des signataires.</span>
            </label>
          </li>
        </ol>
        <Erreur texte={erreur} />
      </Modal>
    </>
  );
}
