import type { ReactNode } from "react";

import { LiensPied } from "./commun";

/* Écran d'un seul message (lien invalide, pas encore ouvert, pause, signatures closes), avec « Une question ? » */
export function EcranMessage({
  icone,
  titre,
  texte,
  whatsapp,
}: {
  icone: ReactNode;
  titre: string;
  texte?: string;
  whatsapp: string | null;
}) {
  return (
    <main data-ambiance="ceo" className="grid min-h-dvh place-items-center bg-papier px-5 py-12 text-encre">
      <div className="grid max-w-[480px] justify-items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-[#EDE8DE] text-texte-secondaire [&_svg]:size-[30px]">{icone}</span>
        <h1 className="font-titre text-[24px] leading-tight font-normal">{titre}</h1>
        {texte ? <p className="text-[16px] leading-[1.55] text-texte-secondaire">{texte}</p> : null}
        <LiensPied whatsapp={whatsapp} confidentialite={false} />
      </div>
    </main>
  );
}
