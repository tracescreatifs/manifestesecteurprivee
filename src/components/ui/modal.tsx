"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const COURBE = [0.22, 1, 0.36, 1] as const;

type Props = {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  pied?: ReactNode;
  /* Fenêtre large (820 px), pour les aperçus et les tableaux */
  large?: boolean;
};

/*
  Fenêtre modale : hauteur maximale de 85 % de l'écran, défilement interne,
  fermeture par Échap, par la croix ou par un clic sur le fond.
*/
export function Modal({ ouvert, titre, onFermer, children, pied, large = false }: Props) {
  const idTitre = useId();
  const boite = useRef<HTMLDivElement>(null);
  const reduit = useReducedMotion();
  /* Référence stable : le focus ne doit pas sauter à chaque rendu du parent */
  const fermer = useRef(onFermer);

  useEffect(() => {
    fermer.current = onFermer;
  }, [onFermer]);

  useEffect(() => {
    if (!ouvert) return;
    const precedent = document.activeElement as HTMLElement | null;
    const premier = boite.current?.querySelector<HTMLElement>(
      "input, textarea, select, button:not([data-fermer]), a[href]",
    );
    (premier ?? boite.current)?.focus();

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer.current();
    };
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("keydown", surTouche);
      precedent?.focus?.();
    };
  }, [ouvert]);

  const transition = reduit ? { duration: 0 } : { duration: 0.22, ease: COURBE };

  /* Rendu dans un portail : un ancêtre en verre dépoli (backdrop-filter) ne déplace jamais la fenêtre */
  const client = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!client) return null;

  return createPortal(
    <AnimatePresence>
      {ouvert ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(20,33,43,0.45)] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onFermer();
          }}
        >
          <motion.div
            ref={boite}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitre}
            tabIndex={-1}
            className={`flex max-h-[85vh] w-full ${large ? "max-w-[820px]" : "max-w-[560px]"} flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_24px_60px_rgba(20,33,43,0.25)] focus:outline-none`}
            style={{ maxHeight: "min(85vh, 85dvh)" }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={transition}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-filet px-6 py-4">
              <h3 id={idTitre} className="min-w-0 font-titre text-xl font-normal">
                {titre}
              </h3>
              <button
                type="button"
                data-fermer
                onClick={onFermer}
                aria-label="Fermer"
                className="grid size-11 shrink-0 place-items-center rounded-[10px] text-texte-secondaire hover:bg-[rgba(20,33,43,0.06)] hover:text-encre"
              >
                <X aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-6 py-6">{children}</div>
            {pied ? (
              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-filet px-6 py-4">{pied}</div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
