import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { PartieDocument } from "@/components/document/document-a4";
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
  return <ImpressionDocument partie={partie} donnees={donnees} />;
}
