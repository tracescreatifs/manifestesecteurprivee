"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { journaliser } from "@/lib/journal";
import { exigerAdminActif, type ResultatAction } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { aligner } from "@/lib/texte/comparer";
import { ErreurLecture } from "@/lib/texte/lire-docx";
import {
  RE_ID_IMPORT,
  analyserImport,
  lienDejaEnvoye,
  lireManifeste,
  lireVersionCourante,
  supprimerImport,
} from "@/lib/texte/serveur";
import type { Json } from "@/types/database";

const rafraichir = () => revalidatePath("/admin", "layout");

/* ----- Créer une version à partir du fichier importé ----- */

const schemaCreation = z.object({
  fichier: z.string().regex(RE_ID_IMPORT, "Import introuvable."),
  correctionMineure: z.boolean(),
});

export async function creerVersion(saisie: { fichier: string; correctionMineure: boolean }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const donnees = schemaCreation.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "Import introuvable. Déposez à nouveau le fichier." };

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  if (manifeste.statut !== "redaction" && manifeste.statut !== "gele") {
    return { ok: false, erreur: "Les signatures sont closes : le texte ne peut plus être modifié." };
  }
  const gele = manifeste.statut === "gele";
  if (gele && !donnees.data.correctionMineure) {
    return {
      ok: false,
      erreur: "Le texte est gelé : cochez la case qui confirme qu'il s'agit d'une correction mineure.",
    };
  }

  /* Le serveur relit le fichier rangé et recalcule tout */
  let analyse;
  try {
    analyse = await analyserImport(supabase, manifeste, donnees.data.fichier);
  } catch (e) {
    return { ok: false, erreur: e instanceof ErreurLecture ? e.message : "Le fichier n'a pas pu être relu." };
  }
  if (!analyse) return { ok: false, erreur: "Import introuvable. Déposez à nouveau le fichier." };
  if (analyse.bloquant) {
    return { ok: false, erreur: "Le fichier contient un problème bloquant : corrigez le Google Doc, puis importez-le à nouveau." };
  }
  if (analyse.courante && analyse.resume.identique) {
    return { ok: false, erreur: `Aucune modification par rapport à la version ${analyse.courante.numero}.` };
  }

  const numero = (analyse.courante?.numero ?? 0) + 1;
  const type = gele ? "correction_mineure" : "redaction";
  const { data: version, error } = await supabase
    .from("manifeste_versions")
    .insert({
      manifeste_id: manifeste.id,
      numero,
      type,
      titre: analyse.titre,
      sous_titre: analyse.sousTitre || null,
      blocs: analyse.blocs as unknown as Json,
      resume: analyse.resume as unknown as Json,
      fichier_source_path: analyse.chemin,
      cree_par: acces.admin.user_id,
    })
    .select("id")
    .single();
  if (error || !version) {
    return {
      ok: false,
      erreur:
        error?.code === "23505"
          ? "Une autre version vient d'être créée. Rechargez la page, puis importez à nouveau."
          : "La version n'a pas pu être créée. Réessayez.",
    };
  }

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: gele ? "correction_mineure_importee" : "version_importee",
    cibleType: "version",
    cibleId: version.id,
    details: { numero, fichier: analyse.nom, resume: analyse.resume.texte },
  });
  rafraichir();
  redirect("/admin/texte");
}

/* ----- Abandonner un import : le fichier rangé est supprimé ----- */

export async function annulerImport(saisie: { fichier: string }): Promise<void> {
  const acces = await exigerAdminActif();
  if (acces.ok && RE_ID_IMPORT.test(saisie.fichier)) {
    const supabase = await creerClientServeur();
    await supprimerImport(supabase, saisie.fichier);
  }
  redirect("/admin/texte");
}

/* ----- Restaurer une version (en rédaction seulement) ----- */

const schemaNumero = z.object({ numero: z.number().int().positive() });

export async function restaurerVersion(saisie: { numero: number }): Promise<ResultatAction<{ numero: number }>> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const donnees = schemaNumero.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "Version introuvable." };

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  if (manifeste.statut !== "redaction") {
    return { ok: false, erreur: "Le texte est gelé : une version ne peut plus être restaurée." };
  }

  const courante = await lireVersionCourante(supabase, manifeste.id);
  const { data: source } = await supabase
    .from("manifeste_versions")
    .select("*")
    .eq("manifeste_id", manifeste.id)
    .eq("numero", donnees.data.numero)
    .maybeSingle();
  if (!courante || !source) return { ok: false, erreur: "Version introuvable." };
  if (source.numero === courante.numero) return { ok: false, erreur: "C'est déjà la version courante." };

  const blocsSource = Array.isArray(source.blocs) ? (source.blocs as unknown as typeof courante.blocs) : [];
  const { resume } = aligner(
    { titre: courante.titre, sousTitre: courante.sous_titre ?? "", blocs: courante.blocs },
    { titre: source.titre, sousTitre: source.sous_titre ?? "", blocs: blocsSource },
  );
  const numero = courante.numero + 1;

  const { data: version, error } = await supabase
    .from("manifeste_versions")
    .insert({
      manifeste_id: manifeste.id,
      numero,
      type: "redaction",
      titre: source.titre,
      sous_titre: source.sous_titre,
      blocs: source.blocs,
      resume: { ...resume, texte: `Restauration de la version ${source.numero}` } as unknown as Json,
      fichier_source_path: source.fichier_source_path,
      cree_par: acces.admin.user_id,
    })
    .select("id")
    .single();
  if (error || !version) return { ok: false, erreur: "La restauration a échoué. Réessayez." };

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "version_restauree",
    cibleType: "version",
    cibleId: version.id,
    details: { numero, restauree: source.numero },
  });
  rafraichir();
  return { ok: true, numero };
}

/* ----- Geler le texte ----- */

export async function gelerTexte(saisie: { confirme: boolean }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  if (saisie.confirme !== true) return { ok: false, erreur: "Cochez la confirmation de validation du texte." };

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  if (manifeste.statut !== "redaction") return { ok: false, erreur: "Le texte est déjà gelé." };

  const courante = await lireVersionCourante(supabase, manifeste.id);
  if (!courante) return { ok: false, erreur: "Importez d'abord une version du texte." };

  const { error } = await supabase
    .from("manifestes")
    .update({ statut: "gele", version_gelee_id: courante.id, gele_le: new Date().toISOString() })
    .eq("id", manifeste.id)
    .eq("statut", "redaction");
  if (error) return { ok: false, erreur: "Le gel n'a pas pu être enregistré. Réessayez." };

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "texte_gele",
    cibleType: "version",
    cibleId: courante.id,
    details: { numero: courante.numero },
  });
  rafraichir();
  return { ok: true };
}

/* ----- Revenir en rédaction : seulement tant qu'aucun lien n'a été envoyé (D42) ----- */

export async function revenirEnRedaction(): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };
  if (manifeste.statut !== "gele") return { ok: false, erreur: "Le texte n'est pas gelé." };
  if (await lienDejaEnvoye(supabase, manifeste.id)) {
    return { ok: false, erreur: "Des liens ont déjà été envoyés aux CEO : le texte ne peut plus revenir en rédaction." };
  }

  const { error } = await supabase
    .from("manifestes")
    .update({ statut: "redaction", version_gelee_id: null, gele_le: null })
    .eq("id", manifeste.id)
    .eq("statut", "gele");
  if (error) return { ok: false, erreur: "Le retour en rédaction n'a pas pu être enregistré. Réessayez." };

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "retour_redaction",
    cibleType: "manifeste",
    cibleId: manifeste.id,
  });
  rafraichir();
  return { ok: true };
}
