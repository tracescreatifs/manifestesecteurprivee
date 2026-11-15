import type { Metadata } from "next";
import { Hourglass, Link2Off } from "lucide-react";

import { adresseDuSite, lireEspace, lireWhatsappTaskForce } from "@/lib/signature/serveur";

import { EcranMessage } from "./ecran-message";
import { EspaceCeoClient } from "./espace-ceo";

/*
  Espace CEO : lien personnel /s/[jeton], sans compte.
  Le jeton est validé ici avec la clé secrète ; le navigateur ne reçoit que les données de ce CEO et le texte.
  Titre générique : aucune donnée personnelle dans l'aperçu d'un lien partagé. La page reste en noindex.
  ?etape=2 : la signature reprend à l'étape 2 (QR code depuis l'ordinateur, ou juste après l'inscription).
*/

export const metadata: Metadata = {
  title: "Votre espace de signature",
  /* Le jeton ne part jamais vers un autre site (WhatsApp, etc.) dans l'en-tête Referer */
  referrer: "no-referrer",
};

export default async function PageEspaceCeo({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<{ etape?: string }>;
}) {
  const [{ jeton }, { etape }] = await Promise.all([params, searchParams]);
  const espace = await lireEspace(jeton);

  if (!espace) {
    return (
      <EcranMessage
        icone={<Link2Off aria-hidden="true" strokeWidth={1.75} />}
        titre="Ce lien n'est pas valide"
        whatsapp={await lireWhatsappTaskForce()}
      />
    );
  }

  /* Les liens ne sont actifs qu'à partir du gel : le texte en rédaction n'est jamais envoyé */
  if (espace.etat === "pas_ouvert") {
    return (
      <EcranMessage
        icone={<Hourglass aria-hidden="true" strokeWidth={1.75} />}
        titre="Le Manifeste n'est pas encore ouvert à la signature"
        texte="Vous recevrez un message dès qu'il le sera."
        whatsapp={espace.whatsappTaskForce}
      />
    );
  }

  return (
    <EspaceCeoClient
      jeton={jeton}
      espace={espace}
      siteUrl={adresseDuSite()}
      reprendreSignature={etape === "2"}
      rejoindre={null}
    />
  );
}
