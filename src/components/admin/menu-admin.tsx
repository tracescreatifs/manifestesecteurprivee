"use client";

import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { deconnexion } from "@/app/(auth)/actions";

/* Initiales de l'admin connecté, avec un menu qui contient « Se déconnecter » */
export function MenuAdmin({ prenom, nom, email }: { prenom: string; nom: string; email: string }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const initiales = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (!zone.current?.contains(e.target as Node)) setOuvert(false);
    };
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  return (
    <div ref={zone} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        aria-label={`Compte de ${prenom} ${nom}`}
        className="grid size-11 place-items-center rounded-full"
      >
        <span className="grid size-[30px] place-items-center rounded-full bg-eau text-[13px] font-semibold text-white">
          {initiales}
        </span>
      </button>
      {ouvert ? (
        <div
          role="menu"
          className="absolute top-12 right-0 z-30 grid min-w-[230px] gap-1 rounded-[10px] border border-filet bg-surface p-1.5 shadow-[0_10px_30px_rgba(20,33,43,0.15)]"
        >
          <div className="px-2.5 py-2">
            <p className="font-medium">
              {prenom} {nom}
            </p>
            <p className="text-[13px] break-all text-texte-secondaire">{email}</p>
          </div>
          <form action={deconnexion}>
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[14px] hover:bg-sureleve"
            >
              <LogOut aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              Se déconnecter
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
