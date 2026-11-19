import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BarreEtapes } from "@/components/admin/barre-etapes";
import { NavBasse } from "@/components/admin/navigation";
import { PanneauAdmin } from "@/components/admin/panneau-admin";
import { RechercheAdmin } from "@/components/admin/recherche-admin";
import { Marque } from "@/components/marque";
import { lireCadreAdmin, type AFaire } from "@/lib/admin/tableau-de-bord";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Espace admin" };

/* Manifeste absent (seed 0001 non exécuté) : rien à faire */
const CADRE_VIDE: AFaire & { annexe: number } = { aVerifier: 0, aRelancer: 0, nonLues: 0, dernierExport: null, annexe: 0 };

/* Date limite passée (lue à chaque requête) */
function estPassee(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

/*
  Toute la zone /admin : vérifie côté serveur, à chaque requête,
  que l'utilisateur est un admin actif connecté depuis moins de 30 jours.
  Cadre (R2) : sur ordinateur, panneau flottant réductible (marque, recherche, navigation, journal, compte) ;
  sur téléphone, marque en tête et barre basse flottante. « À faire maintenant » est sur le tableau de bord.
*/
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await exigerSessionAdmin();
  const supabase = await creerClientServeur();
  const { data: manifeste } = await supabase
    .from("manifestes")
    .select("id, statut, date_limite")
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  const [{ data: courante }, cadre] = manifeste
    ? await Promise.all([
        supabase
          .from("manifeste_versions")
          .select("numero")
          .eq("manifeste_id", manifeste.id)
          .order("numero", { ascending: false })
          .limit(1)
          .maybeSingle(),
        lireCadreAdmin(supabase, manifeste.id),
      ])
    : [{ data: null }, CADRE_VIDE];
  const compte = { prenom: admin.prenom, nom: admin.nom, email: admin.email };

  return (
    <div data-ambiance="admin" className="min-h-dvh bg-page-admin min-[820px]:grid min-[820px]:grid-cols-[auto_minmax(0,1fr)]">
      <aside
        aria-label="Panneau de l'admin"
        className="panneau-admin sticky top-5 my-5 ml-5 hidden h-[calc(100dvh-40px)] self-start overflow-hidden rounded-panneau bg-fond-admin shadow-panneau min-[820px]:flex"
      >
        <PanneauAdmin aVerifier={cadre.aVerifier} nonLues={cadre.nonLues} compte={compte} />
      </aside>

      <section className="min-w-0 px-4 pt-4 pb-32 min-[820px]:px-6 min-[820px]:pt-5 min-[820px]:pb-10">
        {/* Sur téléphone, le panneau est masqué : la marque passe en tête de page */}
        <header className="mb-3 min-[820px]:hidden">
          <Marque deuxLignes />
        </header>
        <BarreEtapes
          statut={manifeste?.statut ?? "redaction"}
          versionCourante={courante?.numero ?? null}
          admin={compte}
          dateLimite={manifeste?.date_limite ?? null}
          datePassee={manifeste ? estPassee(manifeste.date_limite) : false}
          annexe={cadre.annexe}
          aVerifier={cadre.aVerifier}
        />
        {children}
      </section>

      <NavBasse aVerifier={cadre.aVerifier} nonLues={cadre.nonLues} />
      <RechercheAdmin />
    </div>
  );
}
