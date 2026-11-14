import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CarteAuth } from "@/components/admin/carte-auth";
import { creerClientServeur } from "@/lib/supabase/server";

import { FormulaireMotDePasse } from "./formulaire";

export const metadata: Metadata = { title: "Définir mon mot de passe" };

export default async function PageDefinirMotDePasse() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* Cette page n'est accessible qu'après l'ouverture d'un lien d'invitation ou de réinitialisation */
  if (!user) redirect("/connexion");

  /* La RLS ne montre la ligne qu'à un admin dont l'accès est ouvert */
  const { data: admin } = await supabase
    .from("admins")
    .select("prenom")
    .eq("user_id", user.id)
    .eq("actif", true)
    .maybeSingle();

  if (!admin) redirect("/auth/deconnexion?raison=retire");

  return (
    <CarteAuth surtitre="Espace admin" titre="Définir mon mot de passe">
      <p className="text-texte-secondaire">
        Bonjour {admin.prenom}, choisissez votre mot de passe : 10 caractères au moins. Vous l&apos;utiliserez
        avec votre email pour vous connecter.
      </p>
      <FormulaireMotDePasse />
    </CarteAuth>
  );
}
