import type { Metadata } from "next";

import { CarteAuth } from "@/components/admin/carte-auth";

import { BoutonConfirmer, LienInvalide } from "./confirmer";

/* Le lien contient un jeton à usage unique : il ne part jamais vers un autre site dans l'en-tête Referer */
export const metadata: Metadata = { title: "Accès à l'espace admin", referrer: "no-referrer" };

/*
  Lien reçu par WhatsApp ou par email (invitation ou réinitialisation).
  Le lien n'est vérifié qu'au clic sur le bouton : un simple affichage de la page
  (aperçu de lien de WhatsApp, antivirus d'une messagerie) ne le consomme pas.
*/
export default async function PageConfirmer({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const valide =
    typeof tokenHash === "string" &&
    /^[A-Za-z0-9_-]{10,200}$/.test(tokenHash) &&
    (type === "invite" || type === "recovery");

  if (!valide) {
    return (
      <CarteAuth surtitre="Espace admin" titre="Ce lien n'est plus valide">
        <LienInvalide />
      </CarteAuth>
    );
  }

  const invitation = type === "invite";
  return (
    <CarteAuth
      surtitre="Espace admin"
      titre={invitation ? "Bienvenue dans l'espace admin" : "Nouveau mot de passe"}
    >
      <p className="text-texte-secondaire">
        {invitation
          ? "Une invitation vous a été envoyée pour rejoindre l'espace admin de la plateforme du Manifeste. Continuez pour choisir votre mot de passe."
          : "Continuez pour choisir un nouveau mot de passe."}
      </p>
      <BoutonConfirmer tokenHash={tokenHash} type={type} />
    </CarteAuth>
  );
}
