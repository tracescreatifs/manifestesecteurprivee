"use client";

import { AlertCircle, Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const COURBE = [0.22, 1, 0.36, 1] as const;

export type MessageToast = { texte: string; erreur?: boolean; cle: number };

/* Message bref en bas de l'écran, effacé après 3 secondes */
export function useToast() {
  const [message, setMessage] = useState<MessageToast | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const afficher = useCallback((texte: string, erreur = false) => {
    if (minuteur.current) clearTimeout(minuteur.current);
    setMessage({ texte, erreur, cle: Date.now() });
    minuteur.current = setTimeout(() => setMessage(null), 3000);
  }, []);

  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    [],
  );

  return { message, afficher };
}

export function Toast({ message }: { message: MessageToast | null }) {
  const reduit = useReducedMotion();
  const Icone = message?.erreur ? AlertCircle : Check;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 min-[820px]:bottom-6"
    >
      <AnimatePresence>
        {message ? (
          <motion.div
            key={message.cle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={reduit ? { duration: 0 } : { duration: 0.2, ease: COURBE }}
            className="flex max-w-full items-center gap-2.5 rounded-controle bg-encre px-4 py-3 text-[14.5px] text-white shadow-[0_10px_30px_rgba(20,33,43,0.25)]"
          >
            <Icone aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
            <span>{message.texte}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
