"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { lireSiteUrl } from "@/lib/env";
import { messageErreurAuth } from "@/lib/erreurs-auth";
import { journaliser } from "@/lib/journal";
import { effacerCookieConnexion, poserCookieConnexion } from "@/lib/session-admin";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { creerClientServeur } from "@/lib/supabase/server";

export type EtatFormulaire = { erreur?: string; envoye?: boolean; email?: string };

const schemaEmail = z.string().trim().toLowerCase().pipe(z.email("Indiquez une adresse email valide."));

/* ----- Connexion ----- */

const schemaConnexion = z.object({
  email: schemaEmail,
  motDePasse: z.string().min(1, "Indiquez votre mot de passe."),
});

export async function connexion(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const saisie = schemaConnexion.safeParse({
    email: donnees.get("email"),
    motDePasse: donnees.get("motDePasse"),
  });
  const email = String(donnees.get("email") ?? "");
  if (!saisie.success) {
    return { erreur: saisie.error.issues[0]?.message ?? "Formulaire incomplet.", email };
  }

  const supabase = await creerClientServeur();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: saisie.data.email,
    password: saisie.data.motDePasse,
  });
  if (error || !data.user) {
    return { erreur: messageErreurAuth(error?.code, "Connexion impossible. Réessayez."), email };
  }

  const { data: admin } = await creerClientAdmin()
    .from("admins")
    .select("user_id, actif, mot_de_passe_defini_le")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!admin || !admin.actif) {
    await supabase.auth.signOut();
    return {
      erreur: admin ? "Cet accès a été coupé. Contactez un autre admin." : "Ce compte n'est pas un compte admin.",
      email,
    };
  }

  /* Un admin qui se connecte avec un mot de passe l'a forcément défini */
  if (!admin.mot_de_passe_defini_le) {
    await creerClientAdmin()
      .from("admins")
      .update({ mot_de_passe_defini_le: new Date().toISOString() })
      .eq("user_id", admin.user_id);
  }

  await poserCookieConnexion();
  await journaliser({ acteurType: "admin", acteurId: admin.user_id, action: "connexion" });
  redirect("/admin");
}

/* ----- Déconnexion (bouton du menu admin) ----- */

export async function deconnexion(): Promise<void> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await journaliser({ acteurType: "admin", acteurId: user.id, action: "deconnexion" });
  }
  await supabase.auth.signOut();
  await effacerCookieConnexion();
  redirect("/connexion");
}

/* ----- Mot de passe oublié : toujours le même message, sans révéler si l'email existe ----- */

export async function demanderReinitialisation(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const saisie = schemaEmail.safeParse(donnees.get("email"));
  if (!saisie.success) {
    return { erreur: saisie.error.issues[0]?.message, email: String(donnees.get("email") ?? "") };
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.resetPasswordForEmail(saisie.data, {
    redirectTo: `${lireSiteUrl()}/auth/confirm`,
  });
  if (error) {
    console.error("Demande de réinitialisation :", error.code, error.message);
  }

  return { envoye: true };
}

/* ----- Lien reçu (invitation ou réinitialisation) : vérifié seulement au clic ----- */

const schemaLien = z.object({
  tokenHash: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
  type: z.enum(["invite", "recovery"]),
});

export async function confirmerLien(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const saisie = schemaLien.safeParse({ tokenHash: donnees.get("tokenHash"), type: donnees.get("type") });
  if (!saisie.success) return { erreur: "invalide" };

  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: saisie.data.tokenHash,
    type: saisie.data.type,
  });
  if (error) return { erreur: "invalide" };

  redirect("/definir-mot-de-passe");
}

/* ----- Définir son mot de passe (après une invitation ou une réinitialisation) ----- */

const schemaMotDePasse = z
  .object({
    motDePasse: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères."),
    confirmation: z.string(),
  })
  .refine((v) => v.motDePasse === v.confirmation, {
    message: "Les deux mots de passe ne sont pas identiques.",
  });

export async function definirMotDePasse(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const saisie = schemaMotDePasse.safeParse({
    motDePasse: donnees.get("motDePasse"),
    confirmation: donnees.get("confirmation"),
  });
  if (!saisie.success) return { erreur: saisie.error.issues[0]?.message };

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erreur: "Ce lien n'est plus valide. Demandez un nouveau lien à un administrateur." };
  }

  const clientAdmin = creerClientAdmin();
  const { data: admin } = await clientAdmin
    .from("admins")
    .select("user_id, actif")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin || !admin.actif) {
    await supabase.auth.signOut();
    return { erreur: "Votre accès administrateur a été retiré." };
  }

  const { error } = await supabase.auth.updateUser({ password: saisie.data.motDePasse });
  if (error) {
    return { erreur: messageErreurAuth(error.code, "Enregistrement du mot de passe impossible. Réessayez.") };
  }

  await clientAdmin
    .from("admins")
    .update({ mot_de_passe_defini_le: new Date().toISOString() })
    .eq("user_id", user.id);

  await poserCookieConnexion();
  await journaliser({ acteurType: "admin", acteurId: user.id, action: "mot_de_passe_defini" });
  redirect("/admin");
}
