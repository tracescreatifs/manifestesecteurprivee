import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { estTrace } from "@/lib/ceo/serveur";
import { reglagesDuManifeste, type LigneAnnexeA4, type ReglagesAnnexe } from "@/lib/signature/annexe";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { lireManifeste, lireVersionCourante } from "@/lib/texte/serveur";
import type { Bloc, Database, StatutManifeste } from "@/types/database";

/*
  Document final côté admin (prompt 08) : texte courant, annexe complète (toutes les signatures visibles, D75),
  réglages de l'annexe et signataires sur place. Lu avec la session de l'admin (RLS) ;
  les photos des signatures manuscrites sont servies par des liens signés d'une heure.
*/

type Client = SupabaseClient<Database>;

export type SignataireSurPlace = {
  id: string;
  reference: string;
  prenom: string;
  nom: string;
  fonction: string;
  entreprise: string;
  maillon: string;
  image: string | null;
  signeLe: string;
};

export type DonneesDocument = {
  manifesteId: string;
  statut: StatutManifeste;
  dateLimite: string;
  closLe: string | null;
  publieLe: string | null;
  pdfPath: string | null;
  /* Migration 0010 exécutée : réglages enregistrables, signataires sur place et publication possibles */
  disponible: boolean;
  reglages: ReglagesAnnexe;
  version: { numero: number; titre: string; sousTitre: string; blocs: Bloc[]; correction: boolean } | null;
  lignes: LigneAnnexeA4[];
  surPlace: SignataireSurPlace[];
  aVerifier: number;
  /* Heure de lecture des données (affichée « Mis à jour à … ») */
  lueLe: string;
};

type SignatureLue = {
  id: string;
  origine: "en_ligne" | "sur_place";
  reference: string;
  prenom: string | null;
  nom: string | null;
  fonction: string | null;
  entreprise_nom: string | null;
  maillon_libelle: string | null;
  trace: unknown;
  image_path: string | null;
  signe_le: string;
};

/* Liens signés (une heure) des photos de signatures manuscrites, par chemin */
export async function liensImages(chemins: string[]): Promise<Map<string, string>> {
  if (!chemins.length) return new Map();
  const { data } = await creerClientAdmin().storage.from("signatures").createSignedUrls(chemins, 3600);
  const liens = new Map<string, string>();
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) liens.set(d.path, d.signedUrl);
  });
  return liens;
}

export async function lireDocument(supabase: Client): Promise<DonneesDocument | null> {
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return null;
  const [version, { data: signatures }, { count: aVerifier }] = await Promise.all([
    lireVersionCourante(supabase, manifeste.id),
    supabase
      .from("signatures")
      .select("id, origine, reference, prenom, nom, fonction, entreprise_nom, maillon_libelle, trace, image_path, signe_le")
      .eq("manifeste_id", manifeste.id)
      .eq("validee", true)
      .is("retiree_le", null)
      .order("signe_le", { ascending: true }),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("manifeste_id", manifeste.id)
      .eq("verification", "a_verifier"),
  ]);
  const lues = (signatures ?? []) as SignatureLue[];
  const images = await liensImages(lues.map((s) => s.image_path).filter((c): c is string => Boolean(c)));

  const lignes: LigneAnnexeA4[] = lues.map((s) => ({
    cle: s.id,
    prenom: s.prenom ?? "",
    nom: s.nom ?? "",
    fonction: s.fonction ?? "",
    entreprise: s.entreprise_nom ?? "",
    maillon: s.maillon_libelle ?? "",
    trace: estTrace(s.trace) ? s.trace : null,
    image: s.image_path ? (images.get(s.image_path) ?? null) : null,
    signeLe: s.signe_le,
  }));

  return {
    manifesteId: manifeste.id,
    statut: manifeste.statut,
    dateLimite: manifeste.date_limite,
    closLe: manifeste.clos_le,
    publieLe: manifeste.publie_le,
    pdfPath: manifeste.pdf_final_path,
    disponible: "annexe_ordre" in manifeste,
    reglages: reglagesDuManifeste(manifeste),
    version: version
      ? {
          numero: version.numero,
          titre: version.titre,
          sousTitre: version.sous_titre ?? "",
          blocs: version.blocs,
          correction: version.type === "correction_mineure",
        }
      : null,
    lignes,
    surPlace: lues
      .filter((s) => s.origine === "sur_place")
      .map((s) => ({
        id: s.id,
        reference: s.reference,
        prenom: s.prenom ?? "",
        nom: s.nom ?? "",
        fonction: s.fonction ?? "",
        entreprise: s.entreprise_nom ?? "",
        maillon: s.maillon_libelle ?? "",
        image: s.image_path ? (images.get(s.image_path) ?? null) : null,
        signeLe: s.signe_le,
      })),
    aVerifier: aVerifier ?? 0,
    lueLe: new Date().toISOString(),
  };
}
