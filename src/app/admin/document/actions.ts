"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { lireMaillons } from "@/lib/ceo/serveur";
import {
  dateDeReouverture,
  estJpeg,
  schemaSignataireSurPlace,
  SIGNATURE_IMAGE_TAILLE_MAX,
  type SaisieSurPlace,
} from "@/lib/document/regles";
import { exigerAdminActif, type ResultatAction } from "@/lib/session-admin";
import { LIGNES_PAR_PAGE, LIGNES_VIDES, ORDRES_ANNEXE } from "@/lib/signature/annexe";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste } from "@/lib/texte/serveur";

/*
  Document final (prompt 08) : réglages de l'annexe, clôture, réouverture, publication et signataires sur place.
  Chaque action : zod, admin actif, puis une fonction SQL de la migration 0010 qui recontrôle tout et journalise
  dans la même transaction. Les signataires sur place passent par la clé secrète (la référence MSP n'est générée
  que par le serveur, D94), avec l'identifiant de l'admin vérifié ici.
*/

const rafraichir = () => revalidatePath("/", "layout");

const MESSAGES: Record<string, string> = {
  acces_refuse: "Votre accès d'admin n'est plus actif.",
  introuvable: "Cet élément n'existe plus. Rechargez la page.",
  statut_invalide: "Cette action n'est plus possible dans l'état actuel du Manifeste. Rechargez la page.",
  date_invalide: "Cette date est déjà passée. Choisissez une date à venir.",
  document_publie: "Le document est publié : plus rien ne change.",
  reglage_invalide: "Réglage invalide.",
  pdf_introuvable: "Le PDF déposé est introuvable. Déposez-le de nouveau.",
  maillon_invalide: "Choisissez le maillon.",
  champ_invalide: "Vérifiez les informations du signataire.",
  aucune_version: "Aucune version du texte n'existe.",
};
const MIGRATION = "Exécutez d'abord la migration supabase/migrations/0010_document_final.sql.";

function message(erreur: { message?: string; code?: string } | null, defaut: string): string {
  const m = erreur?.message ?? "";
  /* Fonction absente : la migration 0010 n'est pas encore exécutée */
  if (erreur?.code === "PGRST202" || /function .* does not exist|Could not find the function/i.test(m)) return MIGRATION;
  const code = Object.keys(MESSAGES).find((c) => m.includes(c));
  return code ? MESSAGES[code] : defaut;
}

async function manifesteId(): Promise<string | null> {
  return (await lireManifeste(await creerClientServeur()))?.id ?? null;
}

/* ----- Réglages de l'annexe (D69) ----- */

const schemaReglages = z.object({
  ordre: z.enum(ORDRES_ANNEXE as [string, ...string[]]),
  parPage: z.number().refine((n) => (LIGNES_PAR_PAGE as number[]).includes(n)),
  lignesVides: z.number().refine((n) => (LIGNES_VIDES as number[]).includes(n)),
});

export async function reglerAnnexe(entree: { ordre: string; parPage: number; lignesVides: number }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const d = schemaReglages.safeParse(entree);
  if (!d.success) return { ok: false, erreur: MESSAGES.reglage_invalide };
  const id = await manifesteId();
  if (!id) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  const { error } = await (await creerClientServeur()).rpc("regler_annexe", {
    p_manifeste_id: id,
    p_ordre: d.data.ordre as "entreprise",
    p_lignes_par_page: d.data.parPage,
    p_lignes_vides: d.data.lignesVides,
  });
  if (error) return { ok: false, erreur: message(error, "Les réglages n'ont pas pu être enregistrés. Réessayez.") };
  rafraichir();
  return { ok: true };
}

/* ----- Clôture, réouverture, publication ----- */

export async function cloreSignatures(): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const id = await manifesteId();
  if (!id) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  const { error } = await (await creerClientServeur()).rpc("clore_signatures", { p_manifeste_id: id });
  if (error) return { ok: false, erreur: message(error, "La clôture n'a pas pu être enregistrée. Réessayez.") };
  rafraichir();
  return { ok: true };
}

export async function rouvrirSignatures(entree: { dateLimite: string }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const d = dateDeReouverture(String(entree.dateLimite ?? ""), new Date());
  if (!d.ok) return { ok: false, erreur: d.erreur };
  const id = await manifesteId();
  if (!id) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  const { error } = await (await creerClientServeur()).rpc("rouvrir_signatures", {
    p_manifeste_id: id,
    p_date_limite: d.date.toISOString(),
  });
  if (error) return { ok: false, erreur: message(error, "La réouverture n'a pas pu être enregistrée. Réessayez.") };
  rafraichir();
  return { ok: true };
}

export async function publierDocument(entree: { chemin: string }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  if (!/^document-final\/[A-Za-z0-9._-]+\.pdf$/.test(String(entree.chemin ?? ""))) return { ok: false, erreur: MESSAGES.pdf_introuvable };
  const id = await manifesteId();
  if (!id) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  const { error } = await (await creerClientServeur()).rpc("publier_document", { p_manifeste_id: id, p_pdf_path: entree.chemin });
  if (error) return { ok: false, erreur: message(error, "La publication a échoué. Réessayez.") };
  rafraichir();
  return { ok: true };
}

/* ----- Signataires sur place ----- */

type ResultatSurPlace = { ok: true; reference?: string } | { ok: false; erreur: string; champs?: Partial<Record<keyof SaisieSurPlace, string>> };

async function lireFormulaire(form: FormData, imageObligatoire: boolean) {
  const maillons = (await lireMaillons(await creerClientServeur())).map((m) => m.libelle);
  const saisie = Object.fromEntries(["prenom", "nom", "fonction", "entreprise", "maillon"].map((c) => [c, String(form.get(c) ?? "")]));
  const r = schemaSignataireSurPlace(maillons).safeParse(saisie);
  const fichier = form.get("image");
  const avecImage = fichier instanceof Blob && fichier.size > 0;
  if (!r.success) {
    const champs: Partial<Record<keyof SaisieSurPlace, string>> = {};
    r.error.issues.forEach((i) => {
      const c = i.path[0] as keyof SaisieSurPlace;
      if (!champs[c]) champs[c] = i.message;
    });
    return { ok: false as const, erreur: "Vérifiez les informations du signataire.", champs };
  }
  if (!avecImage && imageObligatoire) return { ok: false as const, erreur: "Ajoutez la photo de la signature." };
  let octets: Uint8Array | null = null;
  if (avecImage) {
    if (fichier.size > SIGNATURE_IMAGE_TAILLE_MAX) return { ok: false as const, erreur: "Photo trop lourde. Reprenez-la." };
    octets = new Uint8Array(await fichier.arrayBuffer());
    if (!estJpeg(octets)) return { ok: false as const, erreur: "Ce fichier n'est pas une photo valide." };
  }
  return { ok: true as const, saisie: r.data, octets };
}

async function deposerImage(octets: Uint8Array): Promise<string | null> {
  const chemin = `sur-place/${randomUUID()}.jpg`;
  const { error } = await creerClientAdmin().storage.from("signatures").upload(chemin, octets, { contentType: "image/jpeg", upsert: false });
  return error ? null : chemin;
}

export async function ajouterSignataireSurPlace(form: FormData): Promise<ResultatSurPlace> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const f = await lireFormulaire(form, true);
  if (!f.ok) return f;
  const manifeste = await lireManifeste(await creerClientServeur());
  if (!manifeste) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  if (manifeste.statut !== "clos") return { ok: false, erreur: "Les signataires sur place s'ajoutent quand les signatures sont closes, avant la publication." };

  const chemin = await deposerImage(f.octets as Uint8Array);
  if (!chemin) return { ok: false, erreur: "La photo n'a pas pu être enregistrée. Réessayez." };
  const { data, error } = await creerClientAdmin().rpc("ajouter_signataire_sur_place", {
    p_manifeste_id: manifeste.id,
    p_admin_id: acces.admin.user_id,
    p_prenom: f.saisie.prenom,
    p_nom: f.saisie.nom,
    p_fonction: f.saisie.fonction,
    p_entreprise: f.saisie.entreprise,
    p_maillon: f.saisie.maillon,
    p_image_path: chemin,
  });
  if (error) {
    await creerClientAdmin().storage.from("signatures").remove([chemin]);
    return { ok: false, erreur: message(error, "Le signataire n'a pas pu être ajouté. Réessayez.") };
  }
  rafraichir();
  return { ok: true, reference: (data as { reference?: string } | null)?.reference };
}

export async function modifierSignataireSurPlace(form: FormData): Promise<ResultatSurPlace> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, erreur: MESSAGES.introuvable };
  const f = await lireFormulaire(form, false);
  if (!f.ok) return f;

  const chemin = f.octets ? await deposerImage(f.octets) : null;
  if (f.octets && !chemin) return { ok: false, erreur: "La photo n'a pas pu être enregistrée. Réessayez." };
  const { data, error } = await creerClientAdmin().rpc("modifier_signataire_sur_place", {
    p_signature_id: id,
    p_admin_id: acces.admin.user_id,
    p_prenom: f.saisie.prenom,
    p_nom: f.saisie.nom,
    p_fonction: f.saisie.fonction,
    p_entreprise: f.saisie.entreprise,
    p_maillon: f.saisie.maillon,
    p_image_path: chemin,
  });
  if (error) {
    if (chemin) await creerClientAdmin().storage.from("signatures").remove([chemin]);
    return { ok: false, erreur: message(error, "Le signataire n'a pas pu être modifié. Réessayez.") };
  }
  /* Photo remplacée : l'ancienne n'est plus utilisée */
  const ancienne = (data as { ancienne_image?: string | null } | null)?.ancienne_image;
  if (ancienne) await creerClientAdmin().storage.from("signatures").remove([ancienne]);
  rafraichir();
  return { ok: true };
}

export async function retirerSignataireSurPlace(entree: { id: string }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  if (!/^[0-9a-f-]{36}$/i.test(String(entree.id ?? ""))) return { ok: false, erreur: MESSAGES.introuvable };
  const { error } = await creerClientAdmin().rpc("retirer_signataire_sur_place", { p_signature_id: entree.id, p_admin_id: acces.admin.user_id });
  if (error) return { ok: false, erreur: message(error, "Le signataire n'a pas pu être retiré. Réessayez.") };
  rafraichir();
  return { ok: true };
}
