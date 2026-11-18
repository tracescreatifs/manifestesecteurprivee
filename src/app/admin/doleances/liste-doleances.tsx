"use client";

import { Check, EyeOff, Link2, Mail, MailOpen, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Button, classesBouton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panneau } from "@/components/ui/panneau";
import { Toast, useToast } from "@/components/ui/toast";
import { formaterDateHeure } from "@/lib/dates";
import type { DoleanceAdmin, ThemeAdmin } from "@/lib/doleances/admin";
import { libelleTheme } from "@/lib/doleances/regles";

import { marquerDoleance, rattacherDoleance } from "./actions";

/*
  Liste des doléances (prompt 09a) : filtres par thème, lecture et auteur, tri par date.
  La fiche s'ouvre dans un panneau (portail) ; l'ouvrir ne marque pas la doléance comme lue.
*/

const AUTRE = "__autre";
const SELECT =
  "min-h-11 min-w-0 rounded-[10px] border border-filet-fort bg-surface px-3 text-[14px] focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none";
const extrait = (t: string, n = 180) => (t.length > n ? `${t.slice(0, n).trim()}…` : t);

function Segments<T extends string>({
  libelle,
  valeur,
  options,
  onChange,
}: {
  libelle: string;
  valeur: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={libelle} className="flex flex-wrap gap-1.5">
      {options.map(([v, texte]) => (
        <button
          key={v}
          type="button"
          aria-pressed={valeur === v}
          onClick={() => onChange(v)}
          className={
            "min-h-11 rounded-full border px-3 text-[13.5px] font-medium " +
            (valeur === v ? "border-encre bg-encre text-white" : "border-filet-fort bg-surface text-texte-secondaire hover:text-encre")
          }
        >
          {texte}
        </button>
      ))}
    </div>
  );
}

/* lectureInitiale : filtre de lecture à l'ouverture (?lecture=non_lues, depuis « À faire maintenant », R1) */
export function ListeDoleances({
  doleances,
  themes,
  lectureInitiale = "toutes",
}: {
  doleances: DoleanceAdmin[];
  themes: ThemeAdmin[];
  lectureInitiale?: "toutes" | "non_lues" | "lues";
}) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [theme, setTheme] = useState("");
  const [lecture, setLecture] = useState<"toutes" | "non_lues" | "lues">(lectureInitiale);
  const [auteur, setAuteur] = useState<"tous" | "signataires" | "non_signataires">("tous");
  const [ordre, setOrdre] = useState<"recentes" | "anciennes">("recentes");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [cible, setCible] = useState("");

  const visibles = useMemo(() => {
    const liste = doleances.filter(
      (d) =>
        (!theme || (theme === AUTRE ? d.themeId === null : d.themeId === theme)) &&
        (lecture === "toutes" || (lecture === "lues") === Boolean(d.lueLe)) &&
        (auteur === "tous" || (auteur === "signataires") === d.auteur.signataire),
    );
    return [...liste].sort((a, b) => (ordre === "recentes" ? -1 : 1) * a.deposeLe.localeCompare(b.deposeLe));
  }, [doleances, theme, lecture, auteur, ordre]);

  const d = ouverte ? (doleances.find((x) => x.id === ouverte) ?? null) : null;
  const actifs = themes.filter((t) => t.actif);

  const marquer = (lue: boolean) =>
    d &&
    demarrer(async () => {
      const r = await marquerDoleance({ id: d.id, lue });
      afficher(r.ok ? (lue ? "Doléance marquée comme lue" : "Doléance marquée comme non lue") : r.erreur, !r.ok);
    });

  const rattacher = () =>
    d &&
    cible &&
    demarrer(async () => {
      const r = await rattacherDoleance({ id: d.id, themeId: cible });
      if (r.ok) setCible("");
      afficher(r.ok ? "Doléance rattachée au thème" : r.erreur, !r.ok);
    });

  return (
    /* Colonnes en minmax(0, 1fr) : une liste déroulante ne force jamais sa largeur sur un petit écran */
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-xl border border-filet bg-surface p-4">
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filtrer par thème" value={theme} onChange={(e) => setTheme(e.target.value)} className={`${SELECT} w-full flex-1 basis-56`}>
            <option value="">Tous les thèmes</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.libelle}
                {t.actif ? "" : " (désactivé)"}
              </option>
            ))}
            <option value={AUTRE}>Autre</option>
          </select>
          <select
            aria-label="Trier par date"
            value={ordre}
            onChange={(e) => setOrdre(e.target.value as typeof ordre)}
            className={`${SELECT} w-full flex-1 basis-48`}
          >
            <option value="recentes">Les plus récentes d&apos;abord</option>
            <option value="anciennes">Les plus anciennes d&apos;abord</option>
          </select>
        </div>
        <Segments
          libelle="Filtrer par lecture"
          valeur={lecture}
          onChange={setLecture}
          options={[
            ["toutes", "Toutes"],
            ["non_lues", "Non lues"],
            ["lues", "Lues"],
          ]}
        />
        <Segments
          libelle="Filtrer par auteur"
          valeur={auteur}
          onChange={setAuteur}
          options={[
            ["tous", "Tous les auteurs"],
            ["signataires", "Signataires"],
            ["non_signataires", "Non signataires"],
          ]}
        />
      </div>

      <p className="text-[13.5px] text-texte-secondaire" aria-live="polite">
        {visibles.length} doléance{visibles.length > 1 ? "s" : ""}
        {visibles.length !== doleances.length ? ` sur ${doleances.length}` : ""}
      </p>

      {visibles.length ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
          {visibles.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => {
                  setCible("");
                  setOuverte(x.id);
                }}
                className="grid w-full gap-2 rounded-xl border border-filet bg-surface p-4 text-left hover:border-filet-fort focus-visible:border-eau"
                aria-label={`${x.lueLe ? "" : "Non lue. "}${libelleTheme(x.theme, x.themePropose)}, par ${x.auteur.nom}, ${x.auteur.entreprise}. Ouvrir la doléance`}
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <Chip variante={x.lueLe ? "neutre" : "eau"}>{x.lueLe ? "Lue" : "Non lue"}</Chip>
                  {/* Le thème proposé peut être long : il passe à la ligne au lieu d'élargir la liste */}
                  <span className="min-w-0 rounded-md bg-sureleve px-2 py-0.5 text-[12.5px] font-medium text-texte-secondaire [overflow-wrap:anywhere]">
                    {libelleTheme(x.theme, x.themePropose)}
                  </span>
                  {x.neJamaisPublier ? (
                    <Chip>
                      <EyeOff aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                      Ne pas publier
                    </Chip>
                  ) : null}
                </span>
                <span className={"text-[15px] [overflow-wrap:anywhere] " + (x.lueLe ? "" : "font-medium")}>{extrait(x.texte)}</span>
                <span className="text-[13px] text-texte-secondaire">
                  {x.auteur.nom}, {x.auteur.entreprise}, {x.auteur.signataire ? "signataire" : "non signataire"}. Le{" "}
                  {formaterDateHeure(x.deposeLe)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-filet bg-surface px-4 py-7 text-center text-texte-secondaire">
          {doleances.length ? "Aucune doléance avec ces filtres." : "Aucune doléance pour l'instant. Elles arriveront après l'envoi des liens."}
        </p>
      )}

      <Panneau
        ouvert={d !== null}
        titre="Doléance"
        onFermer={() => setOuverte(null)}
        pied={
          d ? (
            <Button variante={d.lueLe ? "secondaire" : "principal"} disabled={enCours} onClick={() => marquer(!d.lueLe)}>
              {d.lueLe ? <Mail aria-hidden="true" strokeWidth={1.75} /> : <MailOpen aria-hidden="true" strokeWidth={1.75} />}
              {d.lueLe ? "Marquer comme non lue" : "Marquer comme lue"}
            </Button>
          ) : null
        }
      >
        {d ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip variante={d.lueLe ? "neutre" : "eau"}>{d.lueLe ? "Lue" : "Non lue"}</Chip>
              {d.neJamaisPublier ? (
                <Chip>
                  <EyeOff aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                  Ne pas publier
                </Chip>
              ) : null}
            </div>
            <dl className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-x-3 gap-y-2 text-[14px]">
              <dt className="text-texte-secondaire">Thème</dt>
              <dd>{d.theme ?? "Autre"}</dd>
              {!d.themeId || d.themePropose ? (
                <>
                  <dt className="text-texte-secondaire">Thème proposé</dt>
                  <dd>{d.themePropose ? `« ${d.themePropose} »` : "Aucun"}</dd>
                </>
              ) : null}
              <dt className="text-texte-secondaire">Déposée le</dt>
              <dd>{formaterDateHeure(d.deposeLe)}</dd>
              <dt className="text-texte-secondaire">Publication</dt>
              <dd>{d.neJamaisPublier ? "Ne jamais la publier, même sans nom" : "Publiable plus tard, sans nom, après relecture"}</dd>
              {d.lueLe ? (
                <>
                  <dt className="text-texte-secondaire">Lue</dt>
                  <dd>
                    Par {d.luePar ?? "un admin"}, le {formaterDateHeure(d.lueLe)}
                  </dd>
                </>
              ) : null}
            </dl>
            <div className="grid gap-1.5">
              <h4 className="text-[13px] font-medium text-texte-secondaire">Doléance</h4>
              <p className="text-[15.5px] whitespace-pre-line [overflow-wrap:anywhere]">{d.texte}</p>
            </div>
            <div className="grid gap-1.5">
              <h4 className="text-[13px] font-medium text-texte-secondaire">Proposition de solution</h4>
              <p className={"text-[15px] whitespace-pre-line [overflow-wrap:anywhere] " + (d.solution ? "" : "text-texte-secondaire")}>
                {d.solution ?? "Aucune"}
              </p>
            </div>
            <div className="grid gap-2 rounded-[10px] bg-sureleve p-3">
              <p className="flex items-start gap-2 text-[14px] [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
                <UserRound aria-hidden="true" strokeWidth={1.75} />
                <span>
                  <strong className="font-semibold">{d.auteur.nom}</strong>, {d.auteur.entreprise}
                  <span className="block text-[13px] text-texte-secondaire">
                    {d.auteur.signataire ? "Signataire du Manifeste" : "N'a pas signé le Manifeste"}. Auteur visible des admins
                    seulement.
                  </span>
                </span>
              </p>
              <Link href={`/admin/ceo?fiche=${d.auteur.invitationId}`} className={classesBouton("secondaire", "w-fit")}>
                <Link2 aria-hidden="true" strokeWidth={1.75} />
                Voir sa fiche CEO
              </Link>
            </div>
            {!d.themeId ? (
              <div className="grid gap-2">
                <label htmlFor="rattacher-theme" className="text-[13px] font-medium text-texte-secondaire">
                  Rattacher à un thème existant
                </label>
                <div className="flex flex-wrap gap-2">
                  <select id="rattacher-theme" value={cible} onChange={(e) => setCible(e.target.value)} className={`${SELECT} w-full flex-1 basis-52`}>
                    <option value="">Choisissez un thème</option>
                    {actifs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.libelle}
                      </option>
                    ))}
                  </select>
                  <Button onClick={rattacher} disabled={!cible || enCours}>
                    <Check aria-hidden="true" strokeWidth={1.75} />
                    Rattacher
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Panneau>
      <Toast message={message} />
    </div>
  );
}
