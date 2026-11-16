"use client";

import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, RotateCcw, Save, X } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Toast, useToast } from "@/components/ui/toast";
import type { ThemeAdmin } from "@/lib/doleances/admin";

import { activerTheme, creerTheme, ordonnerThemes, renommerTheme } from "./actions";

/*
  Thèmes des doléances (prompt 09a) : créer, renommer, réordonner, désactiver.
  Un thème désactivé n'est plus proposé aux CEO, mais reste sur les doléances existantes.
  La fusion de thèmes viendra au prompt 09b.
*/

const CHAMP =
  "min-h-11 min-w-0 rounded-[10px] border border-filet-fort bg-surface px-3 text-[15px] focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none";
const ICONE =
  "grid size-11 shrink-0 place-items-center rounded-[10px] text-texte-secondaire hover:bg-[rgba(20,33,43,0.06)] hover:text-encre disabled:opacity-35 disabled:hover:bg-transparent [&_svg]:size-[18px]";

export function ThemesDoleances({ themes }: { themes: ThemeAdmin[] }) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [nouveau, setNouveau] = useState("");
  const [edition, setEdition] = useState<{ id: string; libelle: string } | null>(null);

  const executer = (action: () => Promise<{ ok: true } | { ok: false; erreur: string }>, confirmation: string, apres?: () => void) =>
    demarrer(async () => {
      const r = await action();
      if (r.ok) apres?.();
      afficher(r.ok ? confirmation : r.erreur, !r.ok);
    });

  const creer = (e: FormEvent) => {
    e.preventDefault();
    executer(() => creerTheme({ libelle: nouveau }), "Thème créé", () => setNouveau(""));
  };

  const deplacer = (index: number, sens: -1 | 1) => {
    const ids = themes.map((t) => t.id);
    [ids[index], ids[index + sens]] = [ids[index + sens], ids[index]];
    executer(() => ordonnerThemes({ ids }), "Ordre enregistré");
  };

  return (
    <div className="grid max-w-[840px] gap-4">
      <section className="grid gap-3 rounded-[14px] border border-filet bg-surface p-5 min-[820px]:p-6">
        <h3 className="font-titre text-xl font-normal">Thèmes proposés aux CEO</h3>
        <p className="text-[13.5px] text-texte-secondaire">
          Dans cet ordre, puis « Autre ». Un thème désactivé n&apos;est plus proposé, mais reste sur les doléances déjà
          déposées. Les doléances « Autre » se rattachent à un thème depuis leur fiche.
        </p>
        <ol className="grid">
          {themes.map((t, i) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 border-t border-filet py-2 first:border-t-0">
              {edition?.id === t.id ? (
                <form
                  className="flex min-w-0 flex-1 basis-64 flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    executer(() => renommerTheme({ id: t.id, libelle: edition.libelle }), "Thème renommé", () => setEdition(null));
                  }}
                >
                  <label htmlFor={`theme-${t.id}`} className="sr-only">
                    Nouveau nom du thème
                  </label>
                  <input
                    id={`theme-${t.id}`}
                    autoFocus
                    value={edition.libelle}
                    maxLength={60}
                    onChange={(e) => setEdition({ id: t.id, libelle: e.target.value })}
                    className={`${CHAMP} flex-1 basis-48`}
                  />
                  <Button type="submit" variante="principal" disabled={enCours}>
                    <Save aria-hidden="true" strokeWidth={1.75} />
                    Enregistrer
                  </Button>
                  <button type="button" className={ICONE} aria-label="Annuler" onClick={() => setEdition(null)}>
                    <X aria-hidden="true" strokeWidth={1.75} />
                  </button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 basis-48">
                    <span className={"font-medium " + (t.actif ? "" : "text-texte-secondaire")}>{t.libelle}</span>
                    <span className="block text-[13px] text-texte-secondaire tabular-nums">
                      {t.nombre} doléance{t.nombre > 1 ? "s" : ""}
                    </span>
                  </span>
                  {!t.actif ? <Chip>Désactivé</Chip> : null}
                  <span className="flex flex-wrap items-center">
                    <button
                      type="button"
                      className={ICONE}
                      aria-label={`Monter « ${t.libelle} »`}
                      disabled={i === 0 || enCours}
                      onClick={() => deplacer(i, -1)}
                    >
                      <ArrowUp aria-hidden="true" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className={ICONE}
                      aria-label={`Descendre « ${t.libelle} »`}
                      disabled={i === themes.length - 1 || enCours}
                      onClick={() => deplacer(i, 1)}
                    >
                      <ArrowDown aria-hidden="true" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className={ICONE}
                      aria-label={`Renommer « ${t.libelle} »`}
                      disabled={enCours}
                      onClick={() => setEdition({ id: t.id, libelle: t.libelle })}
                    >
                      <Pencil aria-hidden="true" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className={ICONE}
                      aria-label={t.actif ? `Désactiver « ${t.libelle} »` : `Réactiver « ${t.libelle} »`}
                      disabled={enCours}
                      onClick={() =>
                        executer(() => activerTheme({ id: t.id, actif: !t.actif }), t.actif ? "Thème désactivé" : "Thème réactivé")
                      }
                    >
                      {t.actif ? <EyeOff aria-hidden="true" strokeWidth={1.75} /> : <RotateCcw aria-hidden="true" strokeWidth={1.75} />}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
        {!themes.length ? (
          <p className="text-texte-secondaire">Aucun thème : exécutez supabase/seed/0003_themes_doleances.sql, ou créez-en un ci-dessous.</p>
        ) : null}
      </section>

      <form onSubmit={creer} className="grid gap-2 rounded-[14px] border border-filet bg-surface p-5 min-[820px]:p-6">
        <label htmlFor="nouveau-theme" className="text-[13px] font-medium text-texte-secondaire">
          Nouveau thème
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="nouveau-theme"
            value={nouveau}
            maxLength={60}
            onChange={(e) => setNouveau(e.target.value)}
            placeholder="Par exemple : Fiscalité"
            className={`${CHAMP} flex-1 basis-60`}
          />
          <Button type="submit" variante="principal" disabled={enCours || nouveau.trim().length < 2}>
            <Plus aria-hidden="true" strokeWidth={1.75} />
            Ajouter
          </Button>
        </div>
      </form>
      <Toast message={message} />
    </div>
  );
}
