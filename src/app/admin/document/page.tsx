import type { Metadata } from "next";

import { lireMaillons } from "@/lib/ceo/serveur";
import { lireDocument } from "@/lib/document/serveur";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";

import { EspaceDocument } from "./espace-document";

export const metadata: Metadata = { title: "Document A4" };

/* Rubrique Document A4 (prompt 08) : aperçu complet, réglages de l'annexe, impressions, signataires sur place */
export default async function PageDocument() {
  await exigerSessionAdmin();
  const supabase = await creerClientServeur();
  const [donnees, maillons] = await Promise.all([lireDocument(supabase), lireMaillons(supabase)]);

  return (
    <>
      <div className="mb-4">
        <h2 className="font-titre text-[22px] font-normal tracking-[-0.01em]">Document A4</h2>
        <p className="mt-1 max-w-[70ch] text-texte-secondaire">
          Exactement ce qui sera imprimé : le texte, puis l&apos;annexe des signataires à partir de la page qui suit la dernière
          page de texte. Toutes les signatures sont visibles ici.
        </p>
      </div>
      {donnees ? (
        <EspaceDocument donnees={donnees} maillons={maillons.map((m) => m.libelle)} />
      ) : (
        <p role="alert" className="text-erreur">
          Le Manifeste n&apos;existe pas encore en base : exécutez supabase/seed/0001_referentiels.sql.
        </p>
      )}
    </>
  );
}
