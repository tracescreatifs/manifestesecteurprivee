"use client";

import { ListTodo, PenTool, Plus, Send, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formaterDateLimite } from "@/lib/ceo/message";
import { formaterDateHeure } from "@/lib/dates";
import {
  AUTRE,
  erreursDoleance,
  libelleTheme,
  SOLUTION_MAX,
  TEXTE_MAX,
  THEME_PROPOSE_MAX,
  type ChampDoleance,
  type SaisieDoleance,
} from "@/lib/doleances/regles";
import type { DoleanceCeo, DoleancesCeo } from "@/lib/doleances/serveur";

import { deposerDoleance, supprimerMaDoleance } from "./actions-doleances";
import { EXPEDITEUR, Feuille } from "./commun";

/*
  Carte « Vos doléances » (prompt 09a) : facultative, après la signature et les commentaires.
  Une doléance porte sur une difficulté de l'entreprise ou du secteur ; un commentaire porte sur le texte.
  Lue par la Task Force seule ; jamais une donnée d'un autre CEO dans cette carte.
*/

const CHAMP =
  "min-h-11 w-full rounded-controle border bg-surface px-3 py-3 text-[16px] text-encre outline-none focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)]";
const VIDE: SaisieDoleance = { theme: "", themePropose: "", texte: "", solution: "", neJamaisPublier: false };

/* Clé anti-doublon : tirée au premier envoi, gardée pour chaque nouvel essai, renouvelée après un dépôt réussi */
function nouvelleCle(): string {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}

const CONNEXION = "La connexion a échoué. Vérifiez votre connexion Internet, puis réessayez.";

export function CarteDoleances({
  jeton,
  donnees,
  signe,
  onSigner,
  onAnnonce,
}: {
  jeton: string;
  donnees: DoleancesCeo;
  /* Le CEO a signé : sinon, rappel discret après l'envoi */
  signe: boolean;
  onSigner: () => void;
  onAnnonce: (message: string) => void;
}) {
  const ouvert = donnees.etat === "ouvert";
  const [doleances, setDoleances] = useState<DoleanceCeo[]>(donnees.doleances);
  const [formulaire, setFormulaire] = useState(false);
  const [saisie, setSaisie] = useState<SaisieDoleance>(VIDE);
  const [erreurs, setErreurs] = useState<Partial<Record<ChampDoleance, string>>>({});
  const [erreur, setErreur] = useState<string>();
  const [envoi, setEnvoi] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);
  const [aSupprimer, setASupprimer] = useState<DoleanceCeo | null>(null);
  const [suppression, setSuppression] = useState<{ occupe: boolean; erreur?: string }>({ occupe: false });
  const cle = useRef<string | null>(null);

  const changer = <C extends ChampDoleance>(champ: C, valeur: SaisieDoleance[C]) => {
    setSaisie((s) => ({ ...s, [champ]: valeur }));
    setErreurs((e) => ({ ...e, [champ]: undefined }));
    setErreur(undefined);
  };

  const ouvrir = () => {
    setErreur(undefined);
    setErreurs({});
    setFormulaire(true);
  };

  const envoyer = async () => {
    if (envoi) return;
    const locales = erreursDoleance(saisie);
    if (locales) {
      setErreurs(locales);
      return setErreur("Vérifiez votre doléance.");
    }
    if (!cle.current) cle.current = nouvelleCle();
    setEnvoi(true);
    try {
      const r = await deposerDoleance({ jeton, cle: cle.current, saisie });
      if (!r.ok) {
        if (r.champs) setErreurs(r.champs);
        return setErreur(r.erreur);
      }
      cle.current = null;
      setDoleances((d) => [r.doleance, ...d.filter((x) => x.id !== r.doleance.id)]);
      setSaisie(VIDE);
      setFormulaire(false);
      setEnvoyee(true);
      onAnnonce("Doléance envoyée à la Task Force");
    } catch {
      setErreur(CONNEXION);
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async () => {
    if (!aSupprimer || suppression.occupe) return;
    setSuppression({ occupe: true });
    try {
      const r = await supprimerMaDoleance({ jeton, id: aSupprimer.id });
      if (!r.ok) return setSuppression({ occupe: false, erreur: r.erreur });
      setDoleances((d) => d.filter((x) => x.id !== aSupprimer.id));
      setASupprimer(null);
      setSuppression({ occupe: false });
      onAnnonce("Doléance supprimée");
    } catch {
      setSuppression({ occupe: false, erreur: CONNEXION });
    }
  };

  const decrit = (champ: ChampDoleance, aide?: string) => (erreurs[champ] ? `doleance-erreur-${champ}` : aide);
  const classes = (champ: ChampDoleance) => `${CHAMP} ${erreurs[champ] ? "border-erreur" : "border-filet-fort"}`;
  const erreurChamp = (champ: ChampDoleance) =>
    erreurs[champ] ? (
      <span id={`doleance-erreur-${champ}`} className="text-[13px] text-erreur">
        {erreurs[champ]}
      </span>
    ) : null;

  return (
    <section aria-labelledby="titre-doleances" className="grid gap-3 rounded-carte bg-surface shadow-douce p-5">
      <h2
        id="titre-doleances"
        className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire"
      >
        <ListTodo aria-hidden="true" strokeWidth={1.75} />
        Vos doléances
      </h2>
      <p className="text-[14.5px] text-texte-secondaire">
        Une doléance porte sur une difficulté que rencontre votre entreprise ou le secteur, et sur ce qui aiderait. Les
        commentaires, eux, portent sur le texte du Manifeste.
      </p>
      <p className="text-[14.5px] text-texte-secondaire">
        Elle est lue uniquement par {EXPEDITEUR}. Elle pourra être publiée plus tard, sans votre nom ni celui de votre
        entreprise, après relecture, sauf si vous cochez « Ne jamais la publier, même sans nom ».
      </p>

      {ouvert ? (
        <>
          <Button onClick={ouvrir}>
            <Plus aria-hidden="true" strokeWidth={1.75} />
            Déposer une doléance
          </Button>
          <p className="text-[13px] text-texte-secondaire">Dépôt possible jusqu&apos;au {formaterDateLimite(donnees.cloture)}.</p>
        </>
      ) : (
        <p className="rounded-controle bg-sureleve px-3 py-2.5 text-[14px]">
          Le dépôt des doléances est clos depuis le {formaterDateLimite(donnees.cloture)}.
        </p>
      )}

      <div role="status" aria-live="polite">
        {envoyee ? (
          <div className="grid gap-2 rounded-controle bg-succes-doux px-4 py-3 text-[14px] text-[#214d39]">
            <p>Votre doléance est envoyée. Elle est lue par la Task Force seulement.</p>
            {!signe ? (
              <button
                type="button"
                onClick={onSigner}
                className="inline-flex min-h-11 w-fit items-center gap-1.5 font-medium text-eau underline underline-offset-2 [&_svg]:size-4"
              >
                <PenTool aria-hidden="true" strokeWidth={1.75} />
                Pensez aussi à signer le Manifeste
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {doleances.length ? (
        <div className="grid gap-3 border-t border-filet pt-3">
          <h3 className="text-[15px] font-semibold">Vos doléances déposées</h3>
          <ul className="grid gap-3">
            {doleances.map((d) => (
              <li key={d.id} className="grid gap-1.5 border-t border-filet pt-3 first:border-t-0 first:pt-0">
                <span className="text-[12.5px] text-texte-secondaire">
                  {libelleTheme(d.theme, d.themePropose)}, le {formaterDateHeure(d.deposeLe)}
                </span>
                <p className="text-[14.5px] whitespace-pre-line [overflow-wrap:anywhere]">{d.texte}</p>
                {d.solution ? (
                  <p className="text-[14px] whitespace-pre-line text-texte-secondaire [overflow-wrap:anywhere]">
                    <strong className="font-semibold text-encre">Proposition de solution :</strong> {d.solution}
                  </p>
                ) : null}
                {d.neJamaisPublier ? <span className="text-[12.5px] text-texte-secondaire">Ne jamais la publier, même sans nom</span> : null}
                <Button
                  variante="discret"
                  className="min-h-11 w-fit px-2 text-[14px]"
                  onClick={() => {
                    setSuppression({ occupe: false });
                    setASupprimer(d);
                  }}
                  aria-label={`Supprimer la doléance du ${formaterDateHeure(d.deposeLe)}`}
                >
                  <Trash2 aria-hidden="true" strokeWidth={1.75} />
                  Supprimer
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Feuille
        ouverte={formulaire}
        titre="Nouvelle doléance"
        onFermer={() => setFormulaire(false)}
        pied={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setFormulaire(false)}>Annuler</Button>
            <Button variante="principal" onClick={envoyer} disabled={envoi}>
              <Send aria-hidden="true" strokeWidth={1.75} />
              Envoyer
            </Button>
          </div>
        }
      >
        <div className="grid gap-2">
          <label htmlFor="doleance-theme" className="text-[13.5px] font-medium text-texte-secondaire">
            Thème
          </label>
          <select
            id="doleance-theme"
            value={saisie.theme}
            onChange={(e) => changer("theme", e.target.value)}
            aria-invalid={Boolean(erreurs.theme)}
            aria-describedby={decrit("theme")}
            className={classes("theme")}
          >
            <option value="">Choisissez un thème</option>
            {donnees.themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.libelle}
              </option>
            ))}
            <option value={AUTRE}>Autre</option>
          </select>
          {erreurChamp("theme")}
        </div>
        {saisie.theme === AUTRE ? (
          <div className="grid gap-2">
            <label htmlFor="doleance-theme-propose" className="text-[13.5px] font-medium text-texte-secondaire">
              Votre thème (facultatif)
            </label>
            <input
              id="doleance-theme-propose"
              value={saisie.themePropose}
              maxLength={THEME_PROPOSE_MAX}
              onChange={(e) => changer("themePropose", e.target.value)}
              placeholder="Par exemple : fiscalité"
              aria-invalid={Boolean(erreurs.themePropose)}
              aria-describedby={decrit("themePropose", "doleance-aide-theme")}
              className={classes("themePropose")}
            />
            {erreurs.themePropose ? (
              erreurChamp("themePropose")
            ) : (
              <span id="doleance-aide-theme" className="text-[12.5px] text-texte-secondaire">
                La Task Force pourra la rattacher à un thème existant.
              </span>
            )}
          </div>
        ) : null}
        <div className="grid gap-2">
          <label htmlFor="doleance-texte" className="text-[13.5px] font-medium text-texte-secondaire">
            Votre doléance
          </label>
          <textarea
            id="doleance-texte"
            value={saisie.texte}
            maxLength={TEXTE_MAX}
            onChange={(e) => changer("texte", e.target.value)}
            placeholder="La difficulté que rencontre votre entreprise ou le secteur, en quelques phrases."
            aria-invalid={Boolean(erreurs.texte)}
            aria-describedby={`${decrit("texte") ?? ""} doleance-compte-texte`.trim()}
            className={`${classes("texte")} min-h-[120px] resize-y`}
          />
          <div className="flex justify-between gap-3">
            {erreurChamp("texte")}
            <span id="doleance-compte-texte" className="ml-auto shrink-0 text-[13px] text-texte-secondaire tabular-nums">
              {saisie.texte.length} / {TEXTE_MAX}
            </span>
          </div>
        </div>
        <div className="grid gap-2">
          <label htmlFor="doleance-solution" className="text-[13.5px] font-medium text-texte-secondaire">
            Votre proposition de solution (facultatif)
          </label>
          <span id="doleance-aide-solution" className="text-[12.5px] text-texte-secondaire">
            Ce qui changerait la situation pour votre entreprise ou le secteur
          </span>
          <textarea
            id="doleance-solution"
            value={saisie.solution}
            maxLength={SOLUTION_MAX}
            onChange={(e) => changer("solution", e.target.value)}
            aria-invalid={Boolean(erreurs.solution)}
            aria-describedby={`doleance-aide-solution ${decrit("solution") ?? ""} doleance-compte-solution`.replace(/\s+/g, " ").trim()}
            className={`${classes("solution")} min-h-[88px] resize-y`}
          />
          <div className="flex justify-between gap-3">
            {erreurChamp("solution")}
            <span id="doleance-compte-solution" className="ml-auto shrink-0 text-[13px] text-texte-secondaire tabular-nums">
              {saisie.solution.length} / {SOLUTION_MAX}
            </span>
          </div>
        </div>
        <label className="flex min-h-11 items-start gap-2.5 text-[14.5px]">
          <input
            type="checkbox"
            checked={saisie.neJamaisPublier}
            onChange={(e) => changer("neJamaisPublier", e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-eau"
          />
          <span>Ne jamais la publier, même sans nom</span>
        </label>
        <p className="text-[13px] text-texte-secondaire">
          Lue uniquement par la Task Force. Si elle est publiée plus tard, ce sera sans votre nom ni celui de votre entreprise.
        </p>
        {erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreur}
          </p>
        ) : null}
      </Feuille>

      <Feuille
        ouverte={aSupprimer !== null}
        titre="Supprimer cette doléance ?"
        onFermer={() => setASupprimer(null)}
        pied={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setASupprimer(null)}>Garder</Button>
            <Button variante="danger" onClick={supprimer} disabled={suppression.occupe}>
              <Trash2 aria-hidden="true" strokeWidth={1.75} />
              Supprimer
            </Button>
          </div>
        }
      >
        <p className="text-texte-secondaire">Elle sera effacée et la Task Force ne pourra plus la lire. Cette action est définitive.</p>
        {aSupprimer ? <p className="rounded-lg bg-[#F6F2E8] px-3 py-2 text-[14px] italic [overflow-wrap:anywhere]">{aSupprimer.texte}</p> : null}
        {suppression.erreur ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {suppression.erreur}
          </p>
        ) : null}
      </Feuille>
    </section>
  );
}
