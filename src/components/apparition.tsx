"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/* Courbe unique du projet : cubic-bezier(0.22, 1, 0.36, 1) */
const COURBE = [0.22, 1, 0.36, 1] as const;

/*
  Entrée discrète, jouée une seule fois : fondu et montée de quelques pixels.
  Si l'utilisateur a demandé moins d'animations, le contenu s'affiche immédiatement.
*/
export function Apparition({ children, className }: { children: ReactNode; className?: string }) {
  const animationsReduites = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={animationsReduites ? { duration: 0 } : { duration: 0.6, ease: COURBE }}
    >
      {children}
    </motion.div>
  );
}
