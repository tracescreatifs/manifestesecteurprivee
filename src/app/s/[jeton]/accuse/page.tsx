import type { Metadata } from "next";
import { ArrowLeft, FileDown } from "lucide-react";
import Link from "next/link";

import { SignatureSvg } from "@/components/document/signature";
import { classesBouton } from "@/components/ui/button";
import { formaterDateHeureLongue } from "@/lib/dates";
import { lireEspace } from "@/lib/signature/serveur";

/*
  Aperçu de l'accusé de signature. Le fichier PDF (D74) est téléchargé par /s/[jeton]/accuse/pdf.
  Tout est lu dans la signature enregistrée,
  figée au moment de la signature (D25) : référence, date et heure, version, informations imprimées,
  tracé et texte du consentement accepté. Rien n'est recalculé au moment du téléchargement.
*/

export const metadata: Metadata = {
  title: "Accusé de signature",
  referrer: "no-referrer",
};

const IMPRESSION = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .accuse { padding: 0 !important; min-height: 0 !important; background: #fff !important; }
  .accuse .a4-wrap { max-width: none; width: 210mm; margin: 0; }
  .accuse .a4-page { width: 210mm; height: 297mm; aspect-ratio: auto; box-shadow: none; border-radius: 0; }
  .accuse * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

export default async function PageAccuse({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const espace = await lireEspace(jeton);
  const s = espace?.signature ?? null;

  if (!espace || !s) {
    return (
      <main data-ambiance="ceo" className="grid min-h-dvh place-items-center bg-papier px-5 py-12 text-center text-encre">
        <div className="grid max-w-[480px] justify-items-center gap-3">
          <h1 className="font-titre text-[24px] font-normal">{espace ? "Aucune signature pour ce lien" : "Ce lien n'est pas valide"}</h1>
          {espace ? (
            <>
              <p className="text-texte-secondaire">L&apos;accusé est disponible dès que vous avez signé le Manifeste.</p>
              <Link className={classesBouton("secondaire")} href={`/s/${jeton}`}>
                <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
                Retour au Manifeste
              </Link>
            </>
          ) : null}
        </div>
      </main>
    );
  }


  return (
    <main data-ambiance="ceo" className="accuse grid min-h-dvh content-start gap-5 bg-papier px-4 py-6 text-encre min-[760px]:px-10 min-[760px]:py-10">
      <style>{IMPRESSION}</style>
      <div className="sans-impression mx-auto flex w-full max-w-[700px] flex-wrap items-center justify-between gap-3">
        <Link className={classesBouton("discret")} href={`/s/${jeton}`}>
          <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
          Retour au Manifeste
        </Link>
        <a className={classesBouton("principal")} href={`/s/${jeton}/accuse/pdf`} download={`Accuse-${s.reference}.pdf`}>
          <FileDown aria-hidden="true" strokeWidth={1.75} />
          Télécharger mon accusé
        </a>
      </div>

      <div className="a4-wrap">
        <article className="a4-page" aria-label="Accusé de signature">
          <div className="a4-body">
            <div className="d-kicker">Accusé de signature</div>
            <h1 className="d-title">
              {s.titre.split("\n").map((ligne, i) => (
                <span key={i}>
                  {i > 0 ? <br /> : null}
                  {ligne}
                </span>
              ))}
            </h1>
            <div className="d-sub">Version {s.version} du texte</div>
            <div className="d-rule" />

            <div style={{ display: "grid", gap: "0.6cqw", fontSize: "1.9cqw", lineHeight: 1.35 }}>
              <strong style={{ fontSize: "2.6cqw", fontFamily: "var(--font-doc-serif)", color: "var(--color-doc-vert)", fontWeight: 400 }}>
                {s.prenom} {s.nom}
              </strong>
              <span>
                {s.fonction}, {s.entreprise}
              </span>
              <span style={{ color: "var(--color-doc-gris)" }}>Maillon : {s.maillon}</span>
            </div>

            <div style={{ height: "16cqw", margin: "3cqw 0 1cqw", borderBottom: "1px solid var(--color-doc-filet)" }}>
              {s.trace ? (
                <SignatureSvg trace={s.trace} ajustement="xMinYMax meet" className="h-full" libelle={`Signature de ${s.prenom} ${s.nom}`} />
              ) : null}
            </div>

            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1cqw 3cqw", fontSize: "1.7cqw", margin: "2.4cqw 0 0" }}>
              <dt style={{ color: "var(--color-doc-gris)" }}>Référence</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{s.reference}</dd>
              <dt style={{ color: "var(--color-doc-gris)" }}>Signé le</dt>
              <dd style={{ margin: 0 }}>{formaterDateHeureLongue(s.signeLe)} (heure de Dakar)</dd>
              <dt style={{ color: "var(--color-doc-gris)" }}>Version signée</dt>
              <dd style={{ margin: 0 }}>Version {s.version}</dd>
            </dl>

            <div style={{ marginTop: "4cqw", fontSize: "1.6cqw" }}>
              <div style={{ color: "var(--color-doc-gris)", marginBottom: "0.8cqw" }}>Consentement accepté au moment de signer</div>
              <p style={{ margin: 0, fontStyle: "italic" }}>« {s.texteConsentement} »</p>
            </div>
          </div>
          <div className="a4-foot">
            <span>Manifeste du secteur privé sénégalais de l&apos;eau et de l&apos;assainissement</span>
            <span>{s.reference}</span>
          </div>
        </article>
      </div>
    </main>
  );
}
