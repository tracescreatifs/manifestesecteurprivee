import { Droplets } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BarreEtapes } from "@/components/admin/barre-etapes";
import { compterAVerifier } from "@/lib/verification/serveur";
import { NavBasse, NavLaterale } from "@/components/admin/navigation";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Espace admin" };

/*
  Toute la zone /admin : vérifie côté serveur, à chaque requête,
  que l'utilisateur est un admin actif connecté depuis moins de 30 jours.
*/
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await exigerSessionAdmin();
  const supabase = await creerClientServeur();
  const { data: manifeste } = await supabase
    .from("manifestes")
    .select("id, statut")
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: courante } = manifeste
    ? await supabase
        .from("manifeste_versions")
        .select("numero")
        .eq("manifeste_id", manifeste.id)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  /* Signatures à vérifier, affichées à côté de « CEO » dans la navigation */
  const aVerifier = manifeste ? await compterAVerifier(supabase, manifeste.id) : 0;

  return (
    <div data-ambiance="admin" className="min-h-dvh min-[820px]:grid min-[820px]:grid-cols-[228px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-0.5 border-r border-filet bg-sureleve px-3 py-4 min-[820px]:flex">
        <div className="flex items-center gap-3 px-2 pt-1 pb-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-eau text-white">
            <Droplets aria-hidden="true" className="size-4" strokeWidth={1.75} />
          </span>
          <span className="font-titre text-[18px] leading-[1.1]">
            Manifeste
            <small className="mt-0.5 block font-interface text-[12px] text-texte-secondaire">
              Secteur privé sénégalais de l&apos;eau
            </small>
          </span>
        </div>
        <NavLaterale aVerifier={aVerifier} />
      </aside>

      <section className="min-w-0 px-4 pt-4 pb-24 min-[820px]:px-8 min-[820px]:pt-6">
        <BarreEtapes
          statut={manifeste?.statut ?? "redaction"}
          versionCourante={courante?.numero ?? null}
          admin={{ prenom: admin.prenom, nom: admin.nom, email: admin.email }}
        />
        {children}
      </section>

      <NavBasse aVerifier={aVerifier} />
    </div>
  );
}
