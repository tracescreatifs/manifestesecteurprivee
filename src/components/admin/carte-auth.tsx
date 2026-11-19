import type { ReactNode } from "react";

import { DrapeauOndulant } from "@/components/drapeau";

/*
  Cadre commun des écrans de connexion (R2) : fond de page #ECECEA, carte flottante #F7F7F6 (rayon 28, ombre de panneau),
  grand drapeau du Sénégal qui ondule, « Manifeste » en Fraunces 300 et le nom complet du secteur sur deux lignes.
*/
export function CarteAuth({ surtitre, titre, children }: { surtitre?: string; titre: string; children: ReactNode }) {
  return (
    <main data-ambiance="admin" className="grid min-h-dvh place-items-center bg-page-admin px-4 py-10 sm:py-16">
      <div className="grid w-full max-w-[440px] gap-6 rounded-panneau bg-fond-admin p-6 shadow-panneau sm:p-8">
        <div className="grid justify-items-center gap-3 text-center">
          <DrapeauOndulant />
          <p className="font-titre text-[36px] leading-none font-light tracking-[-0.01em]">Manifeste</p>
          <p className="text-[14px] leading-snug text-texte-secondaire">
            <span className="block">Secteur privé sénégalais</span>
            <span className="block">de l&apos;eau et de l&apos;assainissement</span>
          </p>
        </div>
        <div className="grid gap-4 border-t border-filet pt-6">
          {surtitre ? <p className="text-[13px] font-medium text-texte-secondaire">{surtitre}</p> : null}
          <h1 className="font-titre text-[26px] leading-tight font-light tracking-[-0.01em]">{titre}</h1>
          {children}
        </div>
        <p className="text-center text-[13px] text-texte-secondaire">Espace réservé à la Task Force</p>
      </div>
    </main>
  );
}

/* Encadré d'information (fond eau doux) ou d'avertissement (fond erreur doux) */
export function Encadre({ ton = "info", children }: { ton?: "info" | "erreur"; children: ReactNode }) {
  return (
    <div
      role={ton === "erreur" ? "alert" : "status"}
      className={
        "rounded-controle px-4 py-3 text-[14.5px] " +
        (ton === "erreur" ? "bg-erreur-doux text-[#7a2a1d]" : "bg-eau-doux text-[#173e49]")
      }
    >
      {children}
    </div>
  );
}
