import type { Metadata } from "next";
import { CircleSlash, Hourglass, PauseCircle } from "lucide-react";

import { REGLAGES_ANNEXE } from "@/lib/signature/annexe";
import { adresseDuSite, lirePageRejoindre } from "@/lib/signature/serveur";

import { EcranMessage } from "../s/[jeton]/ecran-message";
import { EspaceCeoClient } from "../s/[jeton]/espace-ceo";

/*
  Lien ouvert (/rejoindre) et lien de parrainage (/rejoindre?par=CODE) : un CEO absent de la liste
  lit le Manifeste, s'inscrit à l'étape 1 (sa fiche et son lien personnel sont créés), puis signe sur son lien.
  Page publique, en noindex comme tout le site.
*/

export const metadata: Metadata = {
  title: "Signer le Manifeste",
  referrer: "no-referrer",
};

export default async function PageRejoindre({ searchParams }: { searchParams: Promise<{ par?: string }> }) {
  const { par } = await searchParams;
  const page = await lirePageRejoindre(typeof par === "string" ? par : null);

  if (!page) {
    return <EcranMessage icone={<Hourglass aria-hidden="true" strokeWidth={1.75} />} titre="Le Manifeste n'est pas encore ouvert à la signature" whatsapp={null} />;
  }
  if (page.etat === "pas_ouvert") {
    return (
      <EcranMessage
        icone={<Hourglass aria-hidden="true" strokeWidth={1.75} />}
        titre="Le Manifeste n'est pas encore ouvert à la signature"
        whatsapp={page.whatsappTaskForce}
      />
    );
  }
  if (page.etat === "clos") {
    return (
      <EcranMessage
        icone={<CircleSlash aria-hidden="true" strokeWidth={1.75} />}
        titre="Les signatures sont closes"
        texte="La période de signature est terminée."
        whatsapp={page.whatsappTaskForce}
      />
    );
  }
  if (page.etat === "ouvert" && !page.lienActif) {
    return (
      <EcranMessage
        icone={<PauseCircle aria-hidden="true" strokeWidth={1.75} />}
        titre="Les inscriptions sont momentanément en pause"
        texte="Revenez un peu plus tard, ou écrivez à la Task Force avec « Une question ? »."
        whatsapp={page.whatsappTaskForce}
      />
    );
  }

  return (
    <EspaceCeoClient
      jeton={null}
      siteUrl={adresseDuSite()}
      reprendreSignature={false}
      rejoindre={{ parrain: page.parrain, codeParrain: page.codeParrain }}
      espace={{
        etat: page.etat,
        origine: page.parrain ? "parrainage" : "lien_ouvert",
        identifie: false,
        dateLimite: page.dateLimite,
        saisieInitiale: { prenom: "", nom: "", fonction: "", entreprise: "", maillon: "", telephone: "+221 " },
        saisieListe: null,
        maillons: page.maillons,
        version: page.version,
        texteConsentement: page.texteConsentement,
        whatsappTaskForce: page.whatsappTaskForce,
        signature: null,
        annexe: [],
        /* Avant validation par un admin : aucun nom, seulement le nombre des signataires (D134) */
        autresSignataires: page.signataires,
        commentaires: [],
        photoUrl: null,
        choix: { recontact: false, annuaire: false, photo_communication: false },
        codeParrainage: null,
        refus: null,
        closDepuis: null,
        reglagesAnnexe: REGLAGES_ANNEXE,
        documentFinal: false,
      }}
      doleances={null}
    />
  );
}
