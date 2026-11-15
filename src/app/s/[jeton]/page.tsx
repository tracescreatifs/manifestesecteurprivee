import type { Metadata } from "next";
import { Hourglass, Link2Off } from "lucide-react";
import type { ReactNode } from "react";

import { lireEspace, lireWhatsappTaskForce } from "@/lib/signature/serveur";

import { LiensPied } from "./commun";
import { EspaceCeoClient } from "./espace-ceo";

/*
  Espace CEO : lien personnel /s/[jeton], sans compte.
  Le jeton est validé ici avec la clé secrète ; le navigateur ne reçoit que les données de ce CEO et le texte.
  Titre générique : aucune donnée personnelle dans l'aperçu d'un lien partagé. La page reste en noindex.
*/

export const metadata: Metadata = {
  title: "Votre espace de signature",
  /* Le jeton ne part jamais vers un autre site (WhatsApp, etc.) dans l'en-tête Referer */
  referrer: "no-referrer",
};

function EcranMessage({ icone, titre, texte, whatsapp }: { icone: ReactNode; titre: string; texte?: string; whatsapp: string | null }) {
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

export default async function PageEspaceCeo({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
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

  return <EspaceCeoClient jeton={jeton} espace={espace} />;
}
