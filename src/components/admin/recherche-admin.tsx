"use client";

import { ListTodo, Search, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { rechercherAdmin } from "@/app/admin/actions-recherche";
import { RECHERCHE_MIN, type ResultatRecherche } from "@/lib/admin/recherche";

/*
  Recherche de l'admin (R2) : CEO (nom, entreprise, téléphone) et doléances (thème, texte), lus côté serveur avec
  la session de l'admin. Fenêtre dans un portail, résultats groupés, clavier complet (flèches, Début, Fin, Entrée, Échap).
  Ouverture : champ du panneau, icône du menu réduit, « Rechercher » dans « Plus » sur téléphone, Ctrl ou Cmd + K.
  Un résultat ouvre la fiche du CEO (/admin/ceo?fiche=) ou la fiche de la doléance (/admin/doleances?fiche=).
*/

const EVENEMENT = "manifeste-ouvrir-recherche";

export function ouvrirRecherche(): void {
  window.dispatchEvent(new Event(EVENEMENT));
}

type Option = { cle: string; href: string; titre: string; detail: string; groupe: "ceo" | "doleances" };

const VIDE: ResultatRecherche = { ceo: [], doleances: [], totalCeo: 0, totalDoleances: 0 };

export function RechercheAdmin() {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [resultat, setResultat] = useState<{ q: string; r: ResultatRecherche } | null>(null);
  const [erreur, setErreur] = useState<string>();
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const precedent = useRef<HTMLElement | null>(null);
  const sequence = useRef(0);
  const id = useId();
  const client = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const ouvrir = useCallback(() => {
    precedent.current = document.activeElement as HTMLElement | null;
    setOuverte(true);
  }, []);
  const fermer = useCallback(() => {
    setOuverte(false);
    precedent.current?.focus?.();
  }, []);

  /* Ctrl ou Cmd + K (bascule), et ouverture depuis le panneau ou le menu « Plus » */
  useEffect(() => {
    const surTouche = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (ouverte) fermer();
        else ouvrir();
      }
    };
    window.addEventListener("keydown", surTouche);
    window.addEventListener(EVENEMENT, ouvrir);
    return () => {
      window.removeEventListener("keydown", surTouche);
      window.removeEventListener(EVENEMENT, ouvrir);
    };
  }, [ouverte, ouvrir, fermer]);

  useEffect(() => {
    if (ouverte) requestAnimationFrame(() => champ.current?.select());
  }, [ouverte]);

  /* Recherche sur le serveur, 200 ms après la dernière frappe ; une réponse dépassée est ignorée */
  useEffect(() => {
    const q = saisie.trim();
    if (!ouverte || q.length < RECHERCHE_MIN) return;
    const numero = ++sequence.current;
    const minuterie = window.setTimeout(async () => {
      try {
        const r = await rechercherAdmin(q);
        if (numero !== sequence.current) return;
        if (!r.ok) return setErreur(r.erreur);
        setErreur(undefined);
        setResultat({ q, r: r.resultat });
        setActif(0);
      } catch {
        if (numero === sequence.current) setErreur("La recherche a échoué. Vérifiez votre connexion Internet, puis réessayez.");
      }
    }, 200);
    return () => window.clearTimeout(minuterie);
  }, [saisie, ouverte]);

  const q = saisie.trim();
  const courant = q.length >= RECHERCHE_MIN && resultat?.q === q ? resultat.r : VIDE;
  const options: Option[] = [
    ...courant.ceo.map((c) => ({ cle: `ceo-${c.id}`, href: `/admin/ceo?fiche=${c.id}`, titre: c.titre, detail: c.detail, groupe: "ceo" as const })),
    ...courant.doleances.map((d) => ({
      cle: `dol-${d.id}`,
      href: `/admin/doleances?fiche=${d.id}`,
      titre: d.titre,
      detail: d.detail,
      groupe: "doleances" as const,
    })),
  ];

  const choisir = (o: Option) => {
    setOuverte(false);
    router.push(o.href);
  };

  const surTouche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      fermer();
    } else if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setActif((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActif((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === "Home" && options.length && e.ctrlKey) {
      e.preventDefault();
      setActif(0);
    } else if (e.key === "End" && options.length && e.ctrlKey) {
      e.preventDefault();
      setActif(options.length - 1);
    } else if (e.key === "Enter" && options[actif]) {
      e.preventDefault();
      choisir(options[actif]);
    }
  };

  /* Focus gardé dans la fenêtre : Tab passe du champ au bouton « Fermer la recherche » et inversement */
  const garderFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && e.target !== champ.current) {
      e.preventDefault();
      return fermer();
    }
    if (e.key !== "Tab") return;
    const elements = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("input, button"));
    const premier = elements[0];
    const dernier = elements[elements.length - 1];
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault();
      dernier?.focus();
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault();
      premier?.focus();
    }
  };

  /* L'option active reste visible */
  useEffect(() => {
    document.getElementById(`${id}-${actif}`)?.scrollIntoView({ block: "nearest" });
  }, [actif, id]);

  if (!client || !ouverte) return null;

  const etat =
    q.length < RECHERCHE_MIN
      ? "Saisissez au moins deux caractères : nom, entreprise, téléphone, thème ou texte d'une doléance."
      : erreur
        ? erreur
        : resultat?.q !== q
          ? "Recherche en cours"
          : options.length
            ? `${courant.totalCeo} CEO, ${courant.totalDoleances} doléance${courant.totalDoleances > 1 ? "s" : ""}`
            : `Aucun résultat pour « ${q} »`;

  const groupe = (cle: "ceo" | "doleances", titre: string, total: number) => {
    const liste = options.map((o, i) => ({ o, i })).filter(({ o }) => o.groupe === cle);
    if (!liste.length) return null;
    const Icone = cle === "ceo" ? Users : ListTodo;
    return (
      <div role="group" aria-labelledby={`${id}-${cle}`} className="grid gap-1">
        <p id={`${id}-${cle}`} className="flex items-center gap-2 px-3 pt-2 pb-1 text-[13px] font-medium text-texte-secondaire">
          <Icone aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {titre}
          {total > liste.length ? <span className="font-normal">({liste.length} sur {total})</span> : null}
        </p>
        {liste.map(({ o, i }) => (
          <div
            key={o.cle}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === actif}
            onMouseMove={() => setActif(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choisir(o)}
            className={
              "grid min-h-11 cursor-pointer content-center gap-0.5 rounded-rangee px-3 py-2 " + (i === actif ? "bg-eau-doux" : "")
            }
          >
            <span className="truncate text-[14.5px] font-medium">{o.titre}</span>
            {o.detail ? <span className="line-clamp-2 text-[13px] text-texte-secondaire [overflow-wrap:anywhere]">{o.detail}</span> : null}
          </div>
        ))}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid items-start justify-items-center bg-[rgba(20,33,43,0.35)] px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fermer();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rechercher"
        onKeyDown={garderFocus}
        className="flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden rounded-carte bg-surface shadow-panneau"
      >
        <div className="flex items-center gap-2 border-b border-filet px-3 py-2">
          <Search aria-hidden="true" className="ml-1 size-[18px] shrink-0 text-texte-secondaire" strokeWidth={1.75} />
          <input
            ref={champ}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            role="combobox"
            aria-label="Rechercher un CEO ou une doléance"
            aria-expanded={options.length > 0}
            aria-controls={`${id}-liste`}
            aria-activedescendant={options[actif] ? `${id}-${actif}` : undefined}
            aria-autocomplete="list"
            aria-describedby={`${id}-etat`}
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={surTouche}
            placeholder="Nom, entreprise, téléphone, thème"
            className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-encre placeholder:text-texte-secondaire/80 focus:outline-none"
          />
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer la recherche"
            className="grid size-11 shrink-0 place-items-center rounded-controle text-texte-secondaire hover:bg-[rgba(20,33,43,0.06)] hover:text-encre"
          >
            <X aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>
        <div id={`${id}-liste`} role="listbox" aria-label="Résultats" className="grid min-h-0 content-start gap-2 overflow-y-auto overscroll-contain p-2">
          {groupe("ceo", "CEO", courant.totalCeo)}
          {groupe("doleances", "Doléances", courant.totalDoleances)}
        </div>
        <p id={`${id}-etat`} aria-live="polite" className="border-t border-filet px-4 py-2.5 text-[13px] text-texte-secondaire">
          {etat}
        </p>
      </div>
    </div>,
    document.body,
  );
}
