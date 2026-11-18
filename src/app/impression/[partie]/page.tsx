import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { PartieDocument } from "@/components/document/document-a4";
import { classesBouton } from "@/components/ui/button";
import { lireDocument } from "@/lib/document/serveur";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";

import { ImpressionDocument } from "./impression";

/*
  Page d'impression A4 du document (prompt 08), réservée aux admins : texte seul, annexe seule ou document complet.
  Hors de la mise en page de l'admin, pour que seule la feuille soit imprimée. L'impression du navigateur s'ouvre
  dès que la mise en page est faite ; « Enregistrer en PDF » donne le fichier.
*/

export const metadata: Metadata = { title: "Impression du document A4", referrer: "no-referrer" };

const PARTIES: Record<string, PartieDocument> = { texte: "texte", annexe: "annexe", complet: "complet" };

export default async function PageImpression({ params }: { params: Promise<{ partie: string }> }) {
  await exigerSessionAdmin();
  const partie = PARTIES[(await params).partie];
  if (!partie) notFound();
  const donnees = await lireDocument(await creerClientServeur());
  if (!donnees?.version) notFound();
  /* Impressions à partir du gel (D117) : en rédaction, le texte n'est pas encore celui que l'on signe */
  if (donnees.statut === "redaction") {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#F7F7F6] px-5 text-center text-encre">
        <div className="grid max-w-[460px] justify-items-center gap-3">
          <h1 className="font-titre text-[22px] font-normal">Les impressions sont disponibles à partir du gel du texte</h1>
          <Link href="/admin/document" className={classesBouton("secondaire")}>
            Retour au document A4
          </Link>
        </div>
      </main>
    );
  }
  return <ImpressionDocument partie={partie} donnees={donnees} />;
}
