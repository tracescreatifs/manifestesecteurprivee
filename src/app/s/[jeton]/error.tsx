"use client";

import { CloudOff, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/*
  Erreur inattendue dans l'espace CEO (base momentanément injoignable, par exemple) :
  un message clair en français, jamais le détail technique, et « Réessayer ».
*/
export default function ErreurEspaceCeo({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main data-ambiance="ceo" className="grid min-h-dvh place-items-center bg-papier px-5 py-12 text-encre">
      <div className="grid max-w-[480px] justify-items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-[#EDE8DE] text-texte-secondaire [&_svg]:size-[30px]">
          <CloudOff aria-hidden="true" strokeWidth={1.75} />
        </span>
        <h1 className="font-titre text-[24px] leading-tight font-normal">Le service est momentanément indisponible</h1>
        <p className="text-[16px] leading-[1.55] text-texte-secondaire">
          Réessayez dans quelques minutes. Votre lien reste valable, et rien de ce que vous avez déjà enregistré n&apos;est perdu.
        </p>
        <Button variante="principal" onClick={reset}>
          <RotateCcw aria-hidden="true" strokeWidth={1.75} />
          Réessayer
        </Button>
      </div>
    </main>
  );
}
