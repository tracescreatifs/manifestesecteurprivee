"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { genererCodeParrainage, genererJeton } from "@/lib/ceo/jetons";
import { normaliserEmail } from "@/lib/ceo/lire-liste";
import { normaliserTelephone, rapprocherMaillon } from "@/lib/ceo/normaliser";
import { lireMaillons } from "@/lib/ceo/serveur";
import { journaliser } from "@/lib/journal";
import { exigerAdminActif, type ResultatAction } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste } from "@/lib/texte/serveur";
import type { Json } from "@/types/database";

const rafraichir = () => revalidatePath("/admin", "layout");

/* ----- Une ligne de CEO, revalidée côté serveur ----- */

const schemaLigne = z.object({
  prenom: z.string().trim().max(80, "Prénom trop long."),
  nom: z.string().trim().max(80, "Nom trop long."),
  fonction: z.string().trim().max(120, "Fonction trop longue."),
  entreprise: z.string().trim().min(1, "Indiquez l'entreprise.").max(160, "Nom d'entreprise trop long."),
  maillon: z.string().trim().max(80),
  telephone: z.string().trim().max(40),
  /* Facultatif, jamais demandé au CEO (D30, D62) */
  email: z.string().trim().max(200).default(""),
});

type LigneSaisie = z.infer<typeof schemaLigne>;

/* Téléphone et maillon relus ici : on ne se fie pas à l'aperçu du navigateur */
async function preparer(lignes: LigneSaisie[]) {
  const supabase = await creerClientServeur();
  const maillons = await lireMaillons(supabase);
  const libelles = maillons.map((m) => m.libelle);
  const idMaillon = new Map(maillons.map((m) => [m.libelle, m.id]));

  return lignes.map((l) => {
    const telephone = normaliserTelephone(l.telephone) ?? "";
    const email = normaliserEmail(l.email);
    const maillon = l.maillon ? (rapprocherMaillon(l.maillon, libelles) ?? "") : "";
    const saisieListe = {
      prenom: l.prenom,
      nom: l.nom,
      fonction: l.fonction,
      entreprise: l.entreprise,
      maillon,
      telephone,
      email,
    };
    return {
      prenom: l.prenom,
      nom: l.nom,
      fonction: l.fonction,
      entreprise: l.entreprise,
      maillon_id: idMaillon.get(maillon) ?? "",
      telephone,
      email,
      saisie_liste: saisieListe,
    };
  });
}

async function creerCeo(lignes: LigneSaisie[]): Promise<{ ok: true; nombre: number } | { ok: false; erreur: string }> {
  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };

  const preparees = await preparer(lignes);
  /* Deux essais : un jeton ou un code en double (improbable) fait échouer toute l'opération */
  for (let essai = 0; essai < 2; essai++) {
    const avecJetons = preparees.map((l) => ({ ...l, jeton: genererJeton(), code_parrainage: genererCodeParrainage() }));
    const { data, error } = await supabase.rpc("importer_ceo", {
      p_manifeste_id: manifeste.id,
      p_lignes: avecJetons as unknown as Json,
    });
    if (!error) return { ok: true, nombre: data ?? avecJetons.length };
    if (error.code !== "23505") break;
  }
  return { ok: false, erreur: "L'enregistrement a échoué : rien n'a été importé. Réessayez." };
}

/* ----- Import de la liste ----- */

const schemaImport = z.object({
  fichier: z.string().trim().max(200),
  lignes: z.array(schemaLigne).min(1, "Aucune ligne à importer.").max(1000, "1 000 lignes au plus par import."),
});

export async function importerListe(saisie: {
  fichier: string;
  lignes: z.input<typeof schemaLigne>[];
}): Promise<ResultatAction<{ nombre: number }>> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const donnees = schemaImport.safeParse(saisie);
  if (!donnees.success) {
    const probleme = donnees.error.issues[0];
    const ligne = typeof probleme?.path[1] === "number" ? ` (ligne ${probleme.path[1] + 1} de l'aperçu)` : "";
    return { ok: false, erreur: `${probleme?.message ?? "Liste invalide."}${ligne}` };
  }

  const resultat = await creerCeo(donnees.data.lignes);
  if (!resultat.ok) return resultat;

  const nombre = resultat.nombre;
  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "ceo_importes",
    details: { nombre, fichier: donnees.data.fichier || "tableau collé" },
  });
  rafraichir();
  return { ok: true, nombre };
}

/* ----- Ajout et modification d'un CEO ----- */

export async function ajouterCeo(saisie: z.input<typeof schemaLigne>): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const donnees = schemaLigne.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: donnees.error.issues[0]?.message ?? "Formulaire incomplet." };
  if (donnees.data.telephone && !normaliserTelephone(donnees.data.telephone)) {
    return { ok: false, erreur: "Numéro WhatsApp illisible : indiquez le numéro complet, avec l'indicatif si besoin." };
  }
  if (donnees.data.email && !normaliserEmail(donnees.data.email)) {
    return { ok: false, erreur: "Adresse email invalide : corrigez-la ou laissez le champ vide." };
  }

  const resultat = await creerCeo([donnees.data]);
  if (!resultat.ok) return resultat;

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "ceo_ajoute",
    cibleType: "ceo",
    details: { nom: `${donnees.data.prenom} ${donnees.data.nom}`.trim(), entreprise: donnees.data.entreprise },
  });
  rafraichir();
  return { ok: true };
}

const schemaId = z.object({ invitationId: z.uuid("CEO introuvable.") });

export async function modifierCeo(saisie: z.input<typeof schemaLigne> & { invitationId: string }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const id = schemaId.safeParse(saisie);
  const donnees = schemaLigne.safeParse(saisie);
  if (!id.success) return { ok: false, erreur: "CEO introuvable." };
  if (!donnees.success) return { ok: false, erreur: donnees.error.issues[0]?.message ?? "Formulaire incomplet." };
  if (donnees.data.telephone && !normaliserTelephone(donnees.data.telephone)) {
    return { ok: false, erreur: "Numéro WhatsApp illisible : indiquez le numéro complet, avec l'indicatif si besoin." };
  }
  if (donnees.data.email && !normaliserEmail(donnees.data.email)) {
    return { ok: false, erreur: "Adresse email invalide : corrigez-la ou laissez le champ vide." };
  }

  const [ligne] = await preparer([donnees.data]);
  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("modifier_ceo", {
    p_invitation_id: id.data.invitationId,
    p_ligne: ligne as unknown as Json,
  });
  if (error) return { ok: false, erreur: "La modification n'a pas pu être enregistrée. Réessayez." };

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "ceo_modifie",
    cibleType: "ceo",
    cibleId: id.data.invitationId,
    details: { nom: `${ligne.prenom} ${ligne.nom}`.trim(), entreprise: ligne.entreprise },
  });
  rafraichir();
  return { ok: true };
}

/* ----- Retrait (seulement sans signature) ----- */

export async function retirerCeo(saisie: { invitationId: string }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const id = schemaId.safeParse(saisie);
  if (!id.success) return { ok: false, erreur: "CEO introuvable." };

  const supabase = await creerClientServeur();
  const { data: avant } = await supabase
    .from("invitations")
    .select("personne:personnes(prenom, nom), entreprise:entreprises(nom)")
    .eq("id", id.data.invitationId)
    .maybeSingle();

  const { error } = await supabase.rpc("retirer_ceo", { p_invitation_id: id.data.invitationId });
  if (error) {
    return {
      ok: false,
      erreur: error.message.includes("a signé")
        ? "Ce CEO a signé : il ne peut pas être retiré de la liste."
        : "Le retrait n'a pas pu être enregistré. Réessayez.",
    };
  }

  const info = avant as unknown as { personne: { prenom: string; nom: string } | null; entreprise: { nom: string } | null } | null;
  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "ceo_retire",
    cibleType: "ceo",
    details: {
      nom: `${info?.personne?.prenom ?? ""} ${info?.personne?.nom ?? ""}`.trim(),
      entreprise: info?.entreprise?.nom ?? "",
    },
  });
  rafraichir();
  return { ok: true };
}

/* ----- Envoi et relance sur WhatsApp ----- */

const schemaEnvoi = z.object({ invitationId: z.uuid("CEO introuvable."), relance: z.boolean() });

export async function enregistrerEnvoi(saisie: { invitationId: string; relance: boolean }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const donnees = schemaEnvoi.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "CEO introuvable." };

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  /* Les liens ne sont actifs qu'à partir du gel (règle 11), et plus d'envoi après la clôture */
  if (manifeste.statut === "redaction") return { ok: false, erreur: "Gelez le texte avant d'envoyer les liens." };
  if (manifeste.statut !== "gele") return { ok: false, erreur: "Les signatures sont closes : plus d'envoi possible." };

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, statut_envoi, relances, personne:personnes(prenom, nom, telephone), entreprise:entreprises(nom)")
    .eq("id", donnees.data.invitationId)
    .eq("manifeste_id", manifeste.id)
    .maybeSingle();
  const inv = invitation as unknown as {
    id: string;
    statut_envoi: string;
    relances: number;
    personne: { prenom: string; nom: string; telephone: string | null } | null;
    entreprise: { nom: string } | null;
  } | null;
  if (!inv) return { ok: false, erreur: "CEO introuvable." };
  if (!inv.personne?.telephone) return { ok: false, erreur: "Ajoutez un numéro WhatsApp avant d'envoyer le lien." };

  const maintenant = new Date().toISOString();
  const { relance } = donnees.data;
  if (relance) {
    if (inv.statut_envoi !== "envoye" && inv.statut_envoi !== "ouvert") {
      return { ok: false, erreur: "Seul un CEO qui a reçu le lien sans signer peut être relancé." };
    }
    const { error } = await supabase
      .from("invitations")
      .update({ relances: inv.relances + 1, derniere_relance_le: maintenant })
      .eq("id", inv.id);
    if (error) return { ok: false, erreur: "La relance n'a pas pu être notée. Réessayez." };
  } else {
    if (inv.statut_envoi !== "a_envoyer") return { ok: false, erreur: "Le lien a déjà été envoyé : utilisez « Relancer »." };
    const { error } = await supabase
      .from("invitations")
      .update({ statut_envoi: "envoye", envoye_le: maintenant })
      .eq("id", inv.id);
    if (error) return { ok: false, erreur: "L'envoi n'a pas pu être noté. Réessayez." };
  }

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: relance ? "relance_envoyee" : "lien_envoye",
    cibleType: "ceo",
    cibleId: inv.id,
    details: { nom: `${inv.personne.prenom} ${inv.personne.nom}`.trim(), entreprise: inv.entreprise?.nom ?? "" },
  });
  rafraichir();
  return { ok: true };
}

/* ----- Marquer comme non envoyé ----- */

export async function annulerEnvoi(saisie: { invitationId: string }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const id = schemaId.safeParse(saisie);
  if (!id.success) return { ok: false, erreur: "CEO introuvable." };

  const supabase = await creerClientServeur();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, statut_envoi, personne:personnes(prenom, nom), entreprise:entreprises(nom)")
    .eq("id", id.data.invitationId)
    .maybeSingle();
  const info = inv as unknown as {
    id: string;
    statut_envoi: string;
    personne: { prenom: string; nom: string } | null;
    entreprise: { nom: string } | null;
  } | null;
  if (!info) return { ok: false, erreur: "CEO introuvable." };
  if (info.statut_envoi !== "envoye") {
    return { ok: false, erreur: "Seul un lien envoyé et pas encore ouvert peut être marqué comme non envoyé." };
  }

  const { error } = await supabase
    .from("invitations")
    .update({ statut_envoi: "a_envoyer", envoye_le: null, derniere_relance_le: null, relances: 0 })
    .eq("id", info.id)
    .eq("statut_envoi", "envoye");
  if (error) return { ok: false, erreur: "Le changement n'a pas pu être enregistré. Réessayez." };

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "envoi_annule",
    cibleType: "ceo",
    cibleId: info.id,
    details: { nom: `${info.personne?.prenom ?? ""} ${info.personne?.nom ?? ""}`.trim(), entreprise: info.entreprise?.nom ?? "" },
  });
  rafraichir();
  return { ok: true };
}

/* ----- Lien ouvert : actif ou en pause ----- */

export async function basculerLienOuvert(saisie: { actif: boolean }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  if (typeof saisie.actif !== "boolean") return { ok: false, erreur: "Valeur invalide." };

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };

  const { error } = await supabase
    .from("manifestes")
    .update({ lien_ouvert_actif: saisie.actif })
    .eq("id", manifeste.id);
  if (error) return { ok: false, erreur: "Le changement n'a pas pu être enregistré. Réessayez." };

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: saisie.actif ? "lien_ouvert_active" : "lien_ouvert_pause",
    cibleType: "manifeste",
    cibleId: manifeste.id,
  });
  rafraichir();
  return { ok: true };
}
