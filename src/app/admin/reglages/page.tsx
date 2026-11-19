import { FileText, History, MessageCircle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { Tabs } from "@/components/ui/tabs";
import { formaterDateLimite } from "@/lib/ceo/message";
import { lireSiteUrl } from "@/lib/env";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";

import { OngletAdmins, type LigneAdmin } from "./onglet-admins";
import { OngletJournal } from "./onglet-journal";
import { OngletManifeste } from "./onglet-manifeste";
import { OngletMessages } from "./onglet-messages";

export const metadata: Metadata = { title: "Réglages" };

const ONGLETS = [
  { cle: "manifeste", libelle: "Manifeste", href: "/admin/reglages", icone: FileText },
  { cle: "admins", libelle: "Admins", href: "/admin/reglages?onglet=admins", icone: ShieldCheck },
  { cle: "messages", libelle: "Messages", href: "/admin/reglages?onglet=messages", icone: MessageCircle },
  { cle: "journal", libelle: "Journal", href: "/admin/reglages?onglet=journal", icone: History },
];

export default async function PageReglages({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const moi = await exigerSessionAdmin();
  const { onglet, page } = await searchParams;
  const actif = onglet === "journal" || onglet === "admins" || onglet === "messages" ? onglet : "manifeste";

  return (
    <>
      <div className="mb-4">
        <h2 className="font-titre text-[30px] leading-tight font-light tracking-[-0.01em]">Réglages</h2>
      </div>
      <Tabs onglets={ONGLETS} actif={actif} libelle="Rubriques des réglages" />
      <div className="grid max-w-[840px] gap-4">
        {actif === "journal" ? (
          <OngletJournal page={Number(typeof page === "string" ? page : 1)} />
        ) : actif === "admins" ? (
          <ListeAdmins moi={moi.user_id} />
        ) : actif === "messages" ? (
          <ReglagesMessages />
        ) : (
          <ReglagesManifeste />
        )}
      </div>
    </>
  );
}

async function ListeAdmins({ moi }: { moi: string }) {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("admins")
    .select("user_id, prenom, nom, email, actif, mot_de_passe_defini_le, cree_le")
    .order("cree_le", { ascending: true });

  if (error) {
    return (
      <p role="alert" className="text-erreur">
        La liste des admins n&apos;a pas pu être chargée. Rechargez la page.
      </p>
    );
  }

  const admins: LigneAdmin[] = (data ?? []).map((a) => ({
    userId: a.user_id,
    prenom: a.prenom,
    nom: a.nom,
    email: a.email,
    etat: !a.actif ? "coupe" : a.mot_de_passe_defini_le ? "actif" : "en_attente",
    ajouteLe: a.cree_le,
  }));

  return <OngletAdmins admins={admins} moi={moi} />;
}

async function ReglagesManifeste() {
  const supabase = await creerClientServeur();
  const { data: manifeste } = await supabase
    .from("manifestes")
    .select("id, google_doc_url, date_limite, auto_validation, whatsapp_task_force, texte_consentement")
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!manifeste) {
    return (
      <p role="alert" className="text-erreur">
        Le Manifeste n&apos;existe pas encore en base : exécutez supabase/seed/0001_referentiels.sql.
      </p>
    );
  }
  /* Le texte de consentement ne change plus dès qu'une signature existe (même retirée) */
  const [{ count }, { data: doleances, error: erreurDoleances }] = await Promise.all([
    supabase.from("signatures").select("id", { count: "exact", head: true }).eq("manifeste_id", manifeste.id),
    /* Lue à part : la page reste utilisable tant que la migration 0009 n'est pas exécutée */
    supabase.from("manifestes").select("doleances_cloture").eq("id", manifeste.id).maybeSingle(),
  ]);

  return (
    <OngletManifeste
      googleDocUrl={manifeste.google_doc_url ?? ""}
      dateLimite={manifeste.date_limite}
      autoValidation={manifeste.auto_validation}
      whatsapp={manifeste.whatsapp_task_force}
      texteConsentement={manifeste.texte_consentement}
      consentementVerrouille={(count ?? 0) > 0}
      clotureDoleances={erreurDoleances || !doleances ? null : doleances.doleances_cloture}
    />
  );
}

async function ReglagesMessages() {
  const supabase = await creerClientServeur();
  const { data: manifeste } = await supabase
    .from("manifestes")
    .select("modele_message_whatsapp, date_limite")
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!manifeste) {
    return (
      <p role="alert" className="text-erreur">
        Le Manifeste n&apos;existe pas encore en base : exécutez supabase/seed/0001_referentiels.sql.
      </p>
    );
  }

  let siteUrl = "https://adresse-du-site";
  try {
    siteUrl = lireSiteUrl();
  } catch {
    /* Aperçu seulement : l'adresse réelle manque encore (NEXT_PUBLIC_SITE_URL) */
  }

  return (
    <OngletMessages
      modele={manifeste.modele_message_whatsapp}
      dateLimite={formaterDateLimite(manifeste.date_limite)}
      siteUrl={siteUrl}
    />
  );
}
