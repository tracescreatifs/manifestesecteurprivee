"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { lireSiteUrl } from "@/lib/env";
import { journaliser } from "@/lib/journal";
import { exigerAdminActif, type ResultatAction } from "@/lib/session-admin";
import { creerClientAdmin } from "@/lib/supabase/admin";

/* Blocage dans Supabase Auth pour un accès coupé : environ 100 ans */
const DUREE_BLOCAGE = "876000h";

type ResultatLien = ResultatAction<{ lien: string; prenom: string; type: "invite" | "recovery" }>;

function construireLien(hashedToken: string, type: "invite" | "recovery") {
  return `${lireSiteUrl()}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${type}`;
}

/* ----- Inviter un admin ----- */

const schemaInvitation = z.object({
  prenom: z.string().trim().min(1, "Indiquez le prénom.").max(80, "Prénom trop long."),
  nom: z.string().trim().min(1, "Indiquez le nom.").max(80, "Nom trop long."),
  email: z.string().trim().toLowerCase().pipe(z.email("Indiquez une adresse email valide.")),
});

export async function inviterAdmin(saisie: {
  prenom: string;
  nom: string;
  email: string;
}): Promise<ResultatLien> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const donnees = schemaInvitation.safeParse(saisie);
  if (!donnees.success) {
    return { ok: false, erreur: donnees.error.issues[0]?.message ?? "Formulaire incomplet." };
  }
  const { prenom, nom, email } = donnees.data;
  const supabase = creerClientAdmin();

  /* Comparaison sans tenir compte des majuscules ; % et _ échappés pour ilike */
  const motif = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: existant } = await supabase.from("admins").select("user_id").ilike("email", motif).maybeSingle();
  if (existant) {
    return { ok: false, erreur: "Cette adresse est déjà celle d'un admin. Rien n'a été créé." };
  }

  /* Crée le compte Supabase Auth et le lien, sans envoyer d'email */
  const { data: lien, error } = await supabase.auth.admin.generateLink({ type: "invite", email });
  if (error || !lien.user) {
    const dejaPris = error?.code === "email_exists" || error?.code === "user_already_exists";
    return {
      ok: false,
      erreur: dejaPris
        ? "Un compte existe déjà avec cette adresse. Rien n'a été créé."
        : "La création du lien a échoué. Réessayez.",
    };
  }

  const { error: erreurAjout } = await supabase.from("admins").insert({
    user_id: lien.user.id,
    email,
    prenom,
    nom,
    cree_par: acces.admin.user_id,
  });
  if (erreurAjout) {
    /* Pas d'admin sans compte, ni de compte sans admin */
    await supabase.auth.admin.deleteUser(lien.user.id);
    return { ok: false, erreur: "L'ajout de l'admin a échoué. Rien n'a été créé." };
  }

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "admin_invite",
    cibleType: "admin",
    cibleId: lien.user.id,
    details: { email },
  });
  revalidatePath("/admin/reglages");

  return { ok: true, lien: construireLien(lien.properties.hashed_token, "invite"), prenom, type: "invite" };
}

/* ----- Générer un nouveau lien (invitation en attente) ou un lien de réinitialisation (admin actif) ----- */

const schemaCible = z.object({ userId: z.uuid("Admin introuvable.") });

export async function genererLien(saisie: { userId: string }): Promise<ResultatLien> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const donnees = schemaCible.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "Admin introuvable." };

  const supabase = creerClientAdmin();
  const { data: cible } = await supabase.from("admins").select("*").eq("user_id", donnees.data.userId).maybeSingle();
  if (!cible) return { ok: false, erreur: "Admin introuvable." };
  if (!cible.actif) {
    return { ok: false, erreur: "Cet accès est coupé : rétablissez-le d'abord." };
  }

  const { data: lien, error } = await supabase.auth.admin.generateLink({ type: "recovery", email: cible.email });
  if (error) return { ok: false, erreur: "La création du lien a échoué. Réessayez." };

  const enAttente = !cible.mot_de_passe_defini_le;
  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: enAttente ? "lien_invitation_genere" : "lien_reinitialisation_genere",
    cibleType: "admin",
    cibleId: cible.user_id,
    details: { email: cible.email },
  });
  revalidatePath("/admin/reglages");

  return {
    ok: true,
    lien: construireLien(lien.properties.hashed_token, "recovery"),
    prenom: cible.prenom,
    type: enAttente ? "invite" : "recovery",
  };
}

/* ----- Couper l'accès ----- */

export async function couperAcces(saisie: { userId: string }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const donnees = schemaCible.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "Admin introuvable." };

  const supabase = creerClientAdmin();
  const { data: cible } = await supabase.from("admins").select("*").eq("user_id", donnees.data.userId).maybeSingle();
  if (!cible) return { ok: false, erreur: "Admin introuvable." };
  if (!cible.actif) return { ok: false, erreur: "Cet accès est déjà coupé." };

  /* La base refuse de couper le dernier admin actif (trigger garder_un_admin_actif) */
  const { error } = await supabase
    .from("admins")
    .update({ actif: false, desactive_le: new Date().toISOString() })
    .eq("user_id", cible.user_id);
  if (error) {
    return {
      ok: false,
      erreur: error.message.includes("dernier admin actif")
        ? "Impossible : c'est le dernier admin actif. Invitez d'abord un autre admin."
        : "Le changement n'a pas pu être enregistré. Réessayez.",
    };
  }

  /* Blocage dans Supabase Auth : plus de connexion ni de renouvellement de session */
  const { error: erreurBlocage } = await supabase.auth.admin.updateUserById(cible.user_id, {
    ban_duration: DUREE_BLOCAGE,
  });
  if (erreurBlocage) {
    await supabase.from("admins").update({ actif: true, desactive_le: null }).eq("user_id", cible.user_id);
    return { ok: false, erreur: "Le blocage du compte a échoué. Rien n'a été changé." };
  }

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "acces_coupe",
    cibleType: "admin",
    cibleId: cible.user_id,
    details: { email: cible.email },
  });
  revalidatePath("/admin/reglages");
  return { ok: true };
}

/* ----- Rétablir l'accès ----- */

export async function retablirAcces(saisie: { userId: string }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const donnees = schemaCible.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "Admin introuvable." };

  const supabase = creerClientAdmin();
  const { data: cible } = await supabase.from("admins").select("*").eq("user_id", donnees.data.userId).maybeSingle();
  if (!cible) return { ok: false, erreur: "Admin introuvable." };
  if (cible.actif) return { ok: false, erreur: "Cet accès est déjà ouvert." };

  const { error: erreurBlocage } = await supabase.auth.admin.updateUserById(cible.user_id, {
    ban_duration: "none",
  });
  if (erreurBlocage) return { ok: false, erreur: "Le déblocage du compte a échoué. Réessayez." };

  const { error } = await supabase
    .from("admins")
    .update({ actif: true, desactive_le: null })
    .eq("user_id", cible.user_id);
  if (error) {
    await supabase.auth.admin.updateUserById(cible.user_id, { ban_duration: DUREE_BLOCAGE });
    return { ok: false, erreur: "Le changement n'a pas pu être enregistré. Réessayez." };
  }

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "acces_retabli",
    cibleType: "admin",
    cibleId: cible.user_id,
    details: { email: cible.email },
  });
  revalidatePath("/admin/reglages");
  return { ok: true };
}
