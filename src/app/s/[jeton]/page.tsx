import type { Metadata } from "next";
import { Droplets, Hourglass, Link2Off } from "lucide-react";
import { headers } from "next/headers";

import { adresseDuSite, lireEspace, lireWhatsappTaskForce } from "@/lib/signature/serveur";

import { EcranMessage } from "./ecran-message";
import { EspaceCeoClient } from "./espace-ceo";

/*
  Espace CEO : lien personnel /s/[jeton], sans compte.
  Le jeton est validé ici avec la clé secrète ; le navigateur ne reçoit que les données de ce CEO et le texte.
  Titre générique : aucune donnée personnelle dans l'aperçu d'un lien partagé. La page reste en noindex.
  ?etape=2 : la signature reprend à l'étape 2 (QR code depuis l'ordinateur, ou juste après l'inscription).
*/

const ROBOT_APERCU = /WhatsApp|facebookexternalhit|Facebot|meta-externalagent/i;

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
  const [{ jeton }, { etape }, entetes] = await Promise.all([params, searchParams, headers()]);

  /*
    Robots d'aperçu de lien (WhatsApp, Facebook, D58) : ils ne lisent que le titre et l'image,
    jamais les données du CEO. Rien n'est lu en base pour eux, et rien de personnel n'est envoyé.
  */
  if (ROBOT_APERCU.test(entetes.get("user-agent") ?? "")) {
    return (
      <EcranMessage
        icone={<Droplets aria-hidden="true" strokeWidth={1.75} />}
        titre="Manifeste du secteur privé sénégalais de l'eau et de l'assainissement"
        texte="Lien personnel de signature."
        whatsapp={null}
      />
    );
  }

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
