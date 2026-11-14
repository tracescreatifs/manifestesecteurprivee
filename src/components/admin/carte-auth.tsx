import type { ReactNode } from "react";

/* Cadre commun des écrans de connexion, dans l'ambiance admin */
export function CarteAuth({ surtitre, titre, children }: { surtitre?: string; titre: string; children: ReactNode }) {
  return (
    <main data-ambiance="admin" className="min-h-dvh px-4 py-10 sm:py-16">
      <div className="mx-auto grid w-full max-w-[460px] gap-4 rounded-[14px] border border-filet bg-surface p-6">
        {surtitre ? <p className="text-[13px] font-medium text-texte-secondaire">{surtitre}</p> : null}
        <h1 className="font-titre text-[26px] leading-tight font-normal tracking-[-0.01em]">{titre}</h1>
        {children}
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
        "rounded-[10px] px-4 py-3 text-[14.5px] " +
        (ton === "erreur" ? "bg-erreur-doux text-[#7a2a1d]" : "bg-eau-doux text-[#173e49]")
      }
    >
      {children}
    </div>
  );
}
