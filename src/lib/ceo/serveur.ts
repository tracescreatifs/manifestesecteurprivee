import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, OrigineInvitation, StatutEnvoi, TraceSignature, TypeConsentement } from "@/types/database";

type Client = SupabaseClient<Database>;

/* Une ligne de la rubrique CEO (lue avec la session de l'admin : RLS) */
export type LigneCeo = {
  invitationId: string;
  jeton: string;
  origine: OrigineInvitation;
  prenom: string;
  nom: string;
  fonction: string;
  entreprise: string;
  maillon: string;
  telephone: string;
  email: string;
  photoUrl: string | null;
  statut: StatutEnvoi;
  envoyeLe: string | null;
  ouvertLe: string | null;
  derniereRelanceLe: string | null;
  relances: number;
  signeLe: string | null;
  /* Signature active (lecture seule dans la fiche) ; validee faux : nouvel inscrit, « À valider » */
  signature: { reference: string; trace: TraceSignature | null; validee: boolean } | null;
  /* Parrain (parrainage) et « Qui vous a invité ? » (lien ouvert) */
  parrain: string | null;
  invitePar: string | null;
  /* Consentements courants de la fiche */
  consentements: { type: TypeConsentement; accorde: boolean; le: string }[];
  creeLe: string;
};

export type SignatureRecente = {
  prenom: string;
  nom: string;
  entreprise: string;
  trace: TraceSignature | null;
};

export function estTrace(valeur: unknown): valeur is TraceSignature {
  const t = valeur as TraceSignature | null;
  return Boolean(t && typeof t.vb === "string" && Array.isArray(t.d) && t.d.every((x) => typeof x === "string"));
}

export async function lireMaillons(supabase: Client): Promise<{ id: string; libelle: string }[]> {
  const { data } = await supabase.from("maillons").select("id, libelle").eq("actif", true).order("ordre");
  return data ?? [];
}

export async function lireListeCeo(
  supabase: Client,
  manifesteId: string,
): Promise<{ lignes: LigneCeo[]; recentes: SignatureRecente[] }> {
  const [{ data: invitations }, { data: signatures }] = await Promise.all([
    supabase
      .from("invitations")
      .select(
        "id, jeton, origine, statut_envoi, envoye_le, ouvert_le, derniere_relance_le, relances, cree_le, " +
          "invite_par_texte, parrain_invitation_id, personne_id, " +
          "personne:personnes(prenom, nom, fonction, telephone, email, photo_path), " +
          "entreprise:entreprises(nom, maillon:maillons(libelle))",
      )
      .eq("manifeste_id", manifesteId)
      .order("cree_le", { ascending: true }),
    supabase
      .from("signatures")
      .select("invitation_id, signe_le, validee, prenom, nom, entreprise_nom, trace, reference")
      .eq("manifeste_id", manifesteId)
      .is("retiree_le", null)
      .order("signe_le", { ascending: false }),
  ]);

  type Brute = {
    id: string;
    jeton: string;
    origine: OrigineInvitation;
    statut_envoi: StatutEnvoi;
    envoye_le: string | null;
    ouvert_le: string | null;
    derniere_relance_le: string | null;
    relances: number;
    cree_le: string;
    invite_par_texte: string | null;
    parrain_invitation_id: string | null;
    personne_id: string | null;
    personne: {
      prenom: string;
      nom: string;
      fonction: string | null;
      telephone: string | null;
      email: string | null;
      photo_path: string | null;
    } | null;
    entreprise: { nom: string; maillon: { libelle: string } | null } | null;
  };
  const brutes = (invitations ?? []) as unknown as Brute[];

  /* Photos (bucket privé) : liens signés valables une heure */
  const chemins = brutes.map((b) => b.personne?.photo_path).filter((c): c is string => Boolean(c));
  const photos = new Map<string, string>();
  if (chemins.length) {
    const { data } = await supabase.storage.from("photos").createSignedUrls(chemins, 3600);
    (data ?? []).forEach((d) => d.path && d.signedUrl && photos.set(d.path, d.signedUrl));
  }

  /* Une seule signature active par invitation (garanti en base) */
  const actives = new Map<string, { signeLe: string; reference: string; trace: TraceSignature | null; validee: boolean }>();
  (signatures ?? []).forEach(
    (s) =>
      s.invitation_id &&
      !actives.has(s.invitation_id) &&
      actives.set(s.invitation_id, {
        signeLe: s.signe_le,
        reference: s.reference,
        trace: estTrace(s.trace) ? s.trace : null,
        validee: s.validee,
      }),
  );

  /* Nom du parrain : une autre invitation de la même liste */
  const nomsParInvitation = new Map(
    brutes.map((b) => [b.id, `${b.personne?.prenom ?? ""} ${b.personne?.nom ?? ""}`.trim() + (b.entreprise?.nom ? `, ${b.entreprise.nom}` : "")]),
  );

  /* Consentements courants (vue consentements_courants, lue avec la session de l'admin) */
  const consentementsParPersonne = new Map<string, { type: TypeConsentement; accorde: boolean; le: string }[]>();
  if (brutes.length) {
    /* Toute la vue (une ligne par personne et par type) : pas de longue liste d'identifiants dans l'adresse */
    const { data } = await supabase.from("consentements_courants").select("personne_id, type, accorde, cree_le");
    (data ?? []).forEach((c) => {
      if (!c.personne_id || !c.type) return;
      const liste = consentementsParPersonne.get(c.personne_id) ?? [];
      liste.push({ type: c.type, accorde: Boolean(c.accorde), le: c.cree_le ?? "" });
      consentementsParPersonne.set(c.personne_id, liste);
    });
  }

  const lignes: LigneCeo[] = brutes.map((b) => {
    const active = actives.get(b.id) ?? null;
    const signe = active?.signeLe ?? null;
    return {
      invitationId: b.id,
      jeton: b.jeton,
      origine: b.origine,
      prenom: b.personne?.prenom ?? "",
      nom: b.personne?.nom ?? "",
      fonction: b.personne?.fonction ?? "",
      entreprise: b.entreprise?.nom ?? "",
      maillon: b.entreprise?.maillon?.libelle ?? "",
      telephone: b.personne?.telephone ?? "",
      email: b.personne?.email ?? "",
      photoUrl: b.personne?.photo_path ? (photos.get(b.personne.photo_path) ?? null) : null,
      statut: signe ? "signe" : b.statut_envoi,
      envoyeLe: b.envoye_le,
      ouvertLe: b.ouvert_le,
      derniereRelanceLe: b.derniere_relance_le,
      relances: b.relances,
      signeLe: signe,
      signature: active ? { reference: active.reference, trace: active.trace, validee: active.validee } : null,
      parrain: b.parrain_invitation_id ? (nomsParInvitation.get(b.parrain_invitation_id) ?? null) : null,
      invitePar: b.invite_par_texte,
      consentements: b.personne_id ? (consentementsParPersonne.get(b.personne_id) ?? []) : [],
      creeLe: b.cree_le,
    };
  });

  const recentes: SignatureRecente[] = (signatures ?? [])
    .filter((s) => s.validee)
    .slice(0, 3)
    .map((s) => ({
      prenom: s.prenom ?? "",
      nom: s.nom ?? "",
      entreprise: s.entreprise_nom ?? "",
      trace: estTrace(s.trace) ? s.trace : null,
    }));

  return { lignes, recentes };
}
