import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Bloc, Database, Ligne } from "@/types/database";

import { aligner, resumePremiereVersion, type Operation, type Resume } from "./comparer";
import { lireDocx, type Avertissement } from "./lire-docx";

/*
  Accès aux données du texte, côté serveur, avec la session de l'admin
  (la RLS réserve ces tables et le bucket imports aux admins actifs).
*/

type Client = SupabaseClient<Database>;

export type Manifeste = Ligne<"manifestes">;
export type Version = Omit<Ligne<"manifeste_versions">, "blocs" | "resume"> & {
  blocs: Bloc[];
  resume: Resume | null;
};

export const BUCKET_IMPORTS = "imports";
export const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;
export const TYPE_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function lireManifeste(supabase: Client): Promise<Manifeste | null> {
  const { data } = await supabase
    .from("manifestes")
    .select("*")
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

function versVersion(ligne: Ligne<"manifeste_versions">): Version {
  return {
    ...ligne,
    blocs: Array.isArray(ligne.blocs) ? (ligne.blocs as unknown as Bloc[]) : [],
    resume: (ligne.resume as unknown as Resume | null) ?? null,
  };
}

/* Toutes les versions, de la plus récente à la plus ancienne */
export async function lireVersions(supabase: Client, manifesteId: string): Promise<Version[]> {
  const { data } = await supabase
    .from("manifeste_versions")
    .select("*")
    .eq("manifeste_id", manifesteId)
    .order("numero", { ascending: false });
  return (data ?? []).map(versVersion);
}

export async function lireVersionCourante(supabase: Client, manifesteId: string): Promise<Version | null> {
  const { data } = await supabase
    .from("manifeste_versions")
    .select("*")
    .eq("manifeste_id", manifesteId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? versVersion(data) : null;
}

/* Nom de fichier sûr pour le stockage */
export function nomDeFichierSur(nom: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.docx$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${base || "texte"}.docx`;
}

/* Fichier importé : rangé dans imports/textes/<identifiant>/<nom>.docx */
export function cheminImport(id: string, nom: string): string {
  return `textes/${id}/${nom}`;
}

export const RE_ID_IMPORT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/* Relit un fichier importé depuis le stockage */
export async function lireImport(
  supabase: Client,
  id: string,
): Promise<{ chemin: string; nom: string; octets: Uint8Array } | null> {
  if (!RE_ID_IMPORT.test(id)) return null;
  const { data: liste } = await supabase.storage.from(BUCKET_IMPORTS).list(`textes/${id}`, { limit: 5 });
  const fichier = liste?.find((f) => f.name.toLowerCase().endsWith(".docx"));
  if (!fichier) return null;
  const chemin = cheminImport(id, fichier.name);
  const { data } = await supabase.storage.from(BUCKET_IMPORTS).download(chemin);
  if (!data) return null;
  return { chemin, nom: fichier.name, octets: new Uint8Array(await data.arrayBuffer()) };
}

export async function supprimerImport(supabase: Client, id: string): Promise<void> {
  const fichier = await lireImport(supabase, id);
  if (fichier) await supabase.storage.from(BUCKET_IMPORTS).remove([fichier.chemin]);
}

/* Un lien a-t-il déjà été envoyé (invitation à un autre statut que « à envoyer ») ? */
export async function lienDejaEnvoye(supabase: Client, manifesteId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("manifeste_id", manifesteId)
    .neq("statut_envoi", "a_envoyer");
  /* En cas de doute (erreur de lecture), on considère qu'un lien est parti */
  if (error) return true;
  return (count ?? 0) > 0;
}

export type AnalyseImport = {
  id: string;
  chemin: string;
  nom: string;
  titre: string;
  sousTitre: string;
  blocs: Bloc[];
  avertissements: Avertissement[];
  bloquant: boolean;
  courante: Version | null;
  operations: Operation[];
  resume: Resume;
};

/*
  Relit le fichier rangé, le lit et l'aligne sur la version courante.
  Utilisé par l'écran de vérification et, de nouveau, au moment de créer la version :
  le résultat envoyé par le navigateur n'est jamais réutilisé.
*/
export async function analyserImport(
  supabase: Client,
  manifeste: Manifeste,
  id: string,
): Promise<AnalyseImport | null> {
  const fichier = await lireImport(supabase, id);
  if (!fichier) return null;

  const lecture = lireDocx(fichier.octets);
  const courante = await lireVersionCourante(supabase, manifeste.id);
  const suivante = { titre: lecture.titre, sousTitre: lecture.sousTitre, blocs: lecture.blocs };

  const alignement = courante
    ? aligner({ titre: courante.titre, sousTitre: courante.sous_titre ?? "", blocs: courante.blocs }, suivante)
    : {
        blocs: lecture.blocs,
        operations: lecture.blocs.map((apres): Operation => ({ statut: "ajoute", apres })),
        resume: resumePremiereVersion(lecture.blocs),
      };

  return {
    id,
    chemin: fichier.chemin,
    nom: fichier.nom,
    titre: lecture.titre,
    sousTitre: lecture.sousTitre,
    blocs: alignement.blocs,
    avertissements: lecture.avertissements,
    bloquant: lecture.avertissements.some((a) => a.niveau === "bloquant"),
    courante,
    operations: alignement.operations,
    resume: alignement.resume,
  };
}
