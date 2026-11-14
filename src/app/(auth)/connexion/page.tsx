import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CarteAuth, Encadre } from "@/components/admin/carte-auth";
import { supabaseConfigure } from "@/lib/env";
import { lireSession } from "@/lib/session-admin";

import { FormulaireConnexion } from "./formulaire-connexion";

export const metadata: Metadata = { title: "Connexion" };

const MESSAGES: Record<string, string> = {
  expiree: "Votre session a expiré. Reconnectez-vous",
  retire: "Votre accès administrateur a été retiré",
};

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /* Déjà connecté : directement vers l'espace admin */
  if (supabaseConfigure()) {
    const session = await lireSession();
    if (session.etat === "actif") redirect("/admin");
  }

  const { raison } = await searchParams;
  const message = typeof raison === "string" ? MESSAGES[raison] : undefined;

  return (
    <CarteAuth surtitre="Espace admin" titre="Connexion">
      <p className="text-texte-secondaire">
        Réservée aux admins. Une fois connecté, cet appareil le reste 30 jours.
      </p>
      {message ? <Encadre>{message}</Encadre> : null}
      <FormulaireConnexion />
    </CarteAuth>
  );
}
