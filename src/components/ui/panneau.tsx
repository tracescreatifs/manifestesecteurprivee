"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";

const COURBE = [0.22, 1, 0.36, 1] as const;

type Props = {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  pied?: ReactNode;
};

/*
  Panneau de détail : à droite de l'écran sur ordinateur, en plein écran sur téléphone.
  Fermeture par Échap, par la croix ou par un clic sur le fond. Défilement interne.
*/
export function Panneau({ ouvert, titre, onFermer, children, pied }: Props) {
  const idTitre = useId();
  const boite = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  const reduit = useReducedMotion();

  useEffect(() => {
    fermer.current = onFermer;
  }, [onFermer]);

  useEffect(() => {
    if (!ouvert) return;
    const precedent = document.activeElement as HTMLElement | null;
    boite.current?.focus();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* Une fenêtre ouverte par-dessus le panneau se ferme seule */
      const autres = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).filter(
        (d) => d !== boite.current,
      );
      if (autres.length === 0) fermer.current();
    };
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("keydown", surTouche);
      precedent?.focus?.();
    };
  }, [ouvert]);

  const transition = reduit ? { duration: 0 } : { duration: 0.26, ease: COURBE };

  return (
    <AnimatePresence>
      {ouvert ? (
        <motion.div
          className="fixed inset-0 z-40 flex justify-end bg-[rgba(20,33,43,0.35)]"
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
            className="flex h-dvh w-full flex-col bg-surface shadow-[0_24px_60px_rgba(20,33,43,0.25)] focus:outline-none min-[820px]:max-w-[440px]"
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={transition}
          >
            <div className="flex items-center justify-between gap-3 border-b border-filet px-5 py-3">
              <h3 id={idTitre} className="min-w-0 truncate font-titre text-xl font-normal">
                {titre}
              </h3>
              <button
                type="button"
                onClick={onFermer}
                aria-label="Fermer"
                className="grid size-11 shrink-0 place-items-center rounded-[10px] text-texte-secondaire hover:bg-[rgba(20,33,43,0.06)] hover:text-encre"
              >
                <X aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <div className="grid flex-1 content-start gap-5 overflow-y-auto px-5 py-5">{children}</div>
            {pied ? (
              <div className="flex flex-wrap gap-2 border-t border-filet px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                {pied}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
