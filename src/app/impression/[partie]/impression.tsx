"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { DocumentA4, type PartieDocument } from "@/components/document/document-a4";
import { Button, classesBouton } from "@/components/ui/button";
import type { DonneesDocument } from "@/lib/document/serveur";

/*
  Impression A4 stricte (cahier des charges 5.3) : @page A4 sans marge, une page du document par feuille,
  rendu identique à l'écran. L'annexe seule garde la numérotation du document complet.
*/

const IMPRESSION = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .impression { padding: 0 !important; background: #fff !important; }
}
`;

const TITRES: Record<PartieDocument, string> = {
  texte: "Texte seul",
  annexe: "Annexe seule",
  complet: "Document complet",
};

export function ImpressionDocument({ partie, donnees }: { partie: PartieDocument; donnees: DonneesDocument }) {
  const [pages, setPages] = useState<{ texte: number; annexe: number } | null>(null);
  const lance = useRef(false);
  const version = donnees.version;

  /* Impression lancée une fois, quand la mise en page, les polices et les images sont prêtes */
  const surPages = useCallback((p: { texte: number; annexe: number }) => {
    setPages(p);
    if (lance.current) return;
    lance.current = true;
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".a4-impression img"));
    Promise.all([document.fonts?.ready, ...images.map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => undefined)))]).then(() =>
      window.setTimeout(() => window.print(), 300),
    );
  }, []);

  if (!version) return null;
  const debut = partie === "annexe" && pages ? pages.texte + 1 : 1;
  const fin = pages ? (partie === "texte" ? pages.texte : pages.texte + pages.annexe) : null;

  return (
    <main className="impression min-h-dvh bg-[#F7F7F6] px-4 py-6 text-encre">
      <style>{IMPRESSION}</style>
      <div className="sans-impression mx-auto mb-5 flex w-full max-w-[700px] flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-titre text-[20px] font-normal">Impression : {TITRES[partie]}</h1>
          <p className="text-[13.5px] text-texte-secondaire">
            {fin ? `${fin - debut + 1} page${fin > debut ? "s" : ""} A4, ${debut === fin ? `page ${debut}` : `pages ${debut} à ${fin}`}. ` : ""}
            Dans la fenêtre d&apos;impression, choisissez Enregistrer en PDF pour obtenir le fichier.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/admin/document" className={classesBouton("discret")}>
            <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
            Document A4
          </a>
          <Button variante="principal" onClick={() => window.print()} disabled={!pages}>
            <Printer aria-hidden="true" strokeWidth={1.75} />
            Imprimer
          </Button>
        </div>
      </div>
      <DocumentA4
        titre={version.titre}
        sousTitre={version.sousTitre}
        blocs={version.blocs}
        brouillon={donnees.statut === "redaction"}
        annexe={{ lignes: donnees.lignes, ...donnees.reglages }}
        partie={partie}
        impression
        onPages={surPages}
      />
    </main>
  );
}
