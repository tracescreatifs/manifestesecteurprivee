import type { Metadata } from "next";
import { MessageSquareText, ShieldCheck, Users } from "lucide-react";

import { Tabs } from "@/components/ui/tabs";
import { lireMaillons, lireListeCeo } from "@/lib/ceo/serveur";
import { formaterDateLimite } from "@/lib/ceo/message";
import { lireSiteUrl } from "@/lib/env";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste, lireVersionCourante } from "@/lib/texte/serveur";
import { lireCommentaires, lireVerification } from "@/lib/verification/serveur";

import { OngletCommentaires } from "./onglet-commentaires";
import { OngletVerifier } from "./onglet-verifier";
import { TableauCeo } from "./tableau-ceo";

export const metadata: Metadata = { title: "CEO" };

/* Rubrique CEO : « Liste et suivi », « À vérifier » (prompt 07) et « Commentaires » (prompt 07). ?fiche= ouvre la fiche d'un CEO (lien depuis une doléance), ?filtre= choisit le statut affiché (R1) */
export default async function PageCeo({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; cas?: string; fiche?: string; filtre?: string }>;
}) {
  await exigerSessionAdmin();
  const { onglet, cas, fiche, filtre } = await searchParams;
  const actif = onglet === "verifier" || onglet === "commentaires" ? onglet : "liste";
  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);

  if (!manifeste) {
    return (
      <p role="alert" className="text-erreur">
        Le Manifeste n&apos;existe pas encore en base : exécutez supabase/seed/0001_referentiels.sql.
      </p>
    );
  }

  const [{ lignes, recentes }, maillons, verification, commentaires, version] = await Promise.all([
    lireListeCeo(supabase, manifeste.id),
    lireMaillons(supabase),
    lireVerification(supabase, manifeste.id),
    lireCommentaires(supabase, manifeste.id),
    lireVersionCourante(supabase, manifeste.id),
  ]);

  let siteUrl: string | null = null;
  try {
    siteUrl = lireSiteUrl();
  } catch {
    siteUrl = null;
  }

  const nouveaux = commentaires.filter((c) => c.statut === "nouveau").length;
  const onglets = (
    <Tabs
      libelle="Rubrique CEO"
      actif={actif}
      onglets={[
        { cle: "liste", libelle: "Liste et suivi", href: "/admin/ceo", icone: Users },
        {
          cle: "verifier",
          libelle: "À vérifier",
          href: "/admin/ceo?onglet=verifier",
          icone: ShieldCheck,
          pastille: { nombre: verification.aTraiter.length, variante: "argile", titre: "Signatures à vérifier" },
        },
        {
          cle: "commentaires",
          libelle: "Commentaires",
          href: "/admin/ceo?onglet=commentaires",
          icone: MessageSquareText,
          pastille: { nombre: nouveaux, variante: "neutre", titre: "Nouveaux commentaires" },
        },
      ]}
    />
  );

  const contenu =
    actif === "verifier" ? (
      <OngletVerifier
        aTraiter={verification.aTraiter}
        traites={verification.traites}
        autoValidation={manifeste.auto_validation}
        statutManifeste={manifeste.statut}
        cible={typeof cas === "string" ? cas : null}
        siteUrl={siteUrl}
      />
    ) : actif === "commentaires" ? (
      <OngletCommentaires commentaires={commentaires} blocs={version?.blocs ?? []} statutManifeste={manifeste.statut} />
    ) : null;

  return (
    <TableauCeo
      lignes={lignes}
      recentes={recentes}
      maillons={maillons.map((m) => m.libelle)}
      statutManifeste={manifeste.statut}
      siteUrl={siteUrl}
      modele={manifeste.modele_message_whatsapp}
      dateLimite={formaterDateLimite(manifeste.date_limite)}
      dateLimiteIso={manifeste.date_limite}
      lienOuvertActif={manifeste.lien_ouvert_actif}
      ficheInitiale={actif === "liste" && typeof fiche === "string" ? fiche : null}
      filtreInitial={filtre === "a_envoyer" || filtre === "envoye" || filtre === "ouvert" || filtre === "signe" ? filtre : undefined}
      onglets={onglets}
      contenu={contenu}
    />
  );
}
