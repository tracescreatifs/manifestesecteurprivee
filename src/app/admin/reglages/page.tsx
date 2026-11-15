import { FileText, History, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { Tabs } from "@/components/ui/tabs";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";

import { OngletAdmins, type LigneAdmin } from "./onglet-admins";
import { OngletJournal } from "./onglet-journal";
import { OngletManifeste } from "./onglet-manifeste";

export const metadata: Metadata = { title: "Réglages" };

/* L'onglet Messages arrivera avec l'envoi des liens */
const ONGLETS = [
  { cle: "manifeste", libelle: "Manifeste", href: "/admin/reglages", icone: FileText },
  { cle: "admins", libelle: "Admins", href: "/admin/reglages?onglet=admins", icone: ShieldCheck },
  { cle: "journal", libelle: "Journal", href: "/admin/reglages?onglet=journal", icone: History },
];

export default async function PageReglages({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const moi = await exigerSessionAdmin();
  const { onglet, page } = await searchParams;
  const actif = onglet === "journal" || onglet === "admins" ? onglet : "manifeste";

  return (
    <>
      <div className="mb-4">
        <h2 className="font-titre text-[22px] font-normal tracking-[-0.01em]">Réglages</h2>
      </div>
      <Tabs onglets={ONGLETS} actif={actif} libelle="Rubriques des réglages" />
      <div className="grid max-w-[840px] gap-4">
        {actif === "journal" ? (
          <OngletJournal page={Number(typeof page === "string" ? page : 1)} />
        ) : actif === "admins" ? (
          <ListeAdmins moi={moi.user_id} />
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
    .select("google_doc_url")
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
  return <OngletManifeste googleDocUrl={manifeste.google_doc_url ?? ""} />;
}
