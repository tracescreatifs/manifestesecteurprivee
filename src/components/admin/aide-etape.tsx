"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { usePositionFlottante } from "@/components/ui/position-flottante";

/*
  Aide de la barre d'étapes, sur ordinateur : un bouton d'information à côté de l'action.
  La bulle s'ouvre au survol, au focus clavier et au toucher ; Échap et un clic ailleurs la ferment.
  Elle est rendue dans un portail : jamais coupée, jamais sous la barre en verre.
  Le texte lui-même est l'élément idDescription (masqué), relié au bouton d'action par aria-describedby.
*/
export function AideEtape({ texte, idDescription }: { texte: string; idDescription: string }) {
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const bulle = useRef<HTMLDivElement>(null);
  const style = usePositionFlottante(ouvert, bouton, bulle, "fin", "dessous");

  useEffect(() => {
    if (!ouvert) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    const clic = (e: PointerEvent) => {
      if (!bouton.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("keydown", touche);
    document.addEventListener("pointerdown", clic);
    return () => {
      document.removeEventListener("keydown", touche);
      document.removeEventListener("pointerdown", clic);
    };
  }, [ouvert]);

  return (
    <>
      <button
        ref={bouton}
        type="button"
        aria-label="Aide sur cette étape"
        aria-describedby={idDescription}
        aria-expanded={ouvert}
        onMouseEnter={() => setOuvert(true)}
        onMouseLeave={() => setOuvert(false)}
        onFocus={() => setOuvert(true)}
        onBlur={() => setOuvert(false)}
        onClick={() => setOuvert(true)}
        className="grid size-11 shrink-0 place-items-center rounded-controle text-texte-secondaire hover:bg-[rgba(20,33,43,0.06)] hover:text-encre"
      >
        <Info aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
      </button>
      {ouvert
        ? createPortal(
            <div
              ref={bulle}
              role="tooltip"
              style={style}
              className="pointer-events-none z-[70] max-w-[300px] rounded-lg bg-encre px-3 py-2 text-[13px] text-white shadow-[0_10px_30px_rgba(20,33,43,0.25)]"
            >
              {texte}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
