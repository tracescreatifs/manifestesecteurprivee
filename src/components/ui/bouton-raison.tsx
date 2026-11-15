"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { classesBouton, type VarianteBouton } from "./button";
import { usePositionFlottante } from "./position-flottante";

type Props = {
  /* Raison pour laquelle l'action est impossible, ou null si elle est possible */
  raison: string | null;
  onClick: () => void;
  children: ReactNode;
  variante?: VarianteBouton;
  className?: string;
  occupe?: boolean;
};

/*
  Bouton dont l'action peut être indisponible. Indisponible, il reste atteignable :
  sa raison s'affiche au survol, au focus clavier et au toucher (une infobulle,
  rendue dans un portail pour n'être coupée par aucun conteneur).
*/
export function BoutonAvecRaison({ raison, onClick, children, variante = "secondaire", className = "", occupe = false }: Props) {
  const [bulle, setBulle] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const flottant = useRef<HTMLDivElement>(null);
  const id = useId();
  const visible = Boolean(raison) && bulle;
  const style = usePositionFlottante(visible, bouton, flottant, "centre", "dessus");

  /* Au toucher, la bulle se referme d'elle-même */
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setBulle(false), 4000);
    return () => clearTimeout(t);
  }, [visible]);

  const indisponible = Boolean(raison) || occupe;

  return (
    <>
      <button
        ref={bouton}
        type="button"
        aria-disabled={indisponible || undefined}
        aria-describedby={raison ? id : undefined}
        onMouseEnter={() => setBulle(true)}
        onMouseLeave={() => setBulle(false)}
        onFocus={() => setBulle(true)}
        onBlur={() => setBulle(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (raison) return setBulle(true);
          if (!occupe) onClick();
        }}
        className={classesBouton(
          variante,
          `${indisponible ? "cursor-not-allowed opacity-45 active:scale-100" : ""} ${className}`,
        )}
      >
        {children}
      </button>
      {raison ? (
        <span id={id} className="sr-only">
          {raison}
        </span>
      ) : null}
      {visible
        ? createPortal(
            <div
              ref={flottant}
              role="tooltip"
              style={style}
              className="pointer-events-none z-[70] max-w-[260px] rounded-lg bg-encre px-3 py-2 text-[13px] text-white shadow-[0_10px_30px_rgba(20,33,43,0.25)]"
            >
              {raison}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
