import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { estTrace } from "@/lib/ceo/serveur";
import { normaliserNomEntreprise } from "@/lib/ceo/normaliser";
import { CHAMPS, type Champ } from "@/lib/signature/regles";
import type {
  Bloc,
  Database,
  DecisionVerification,
  EtatVerification,
  Json,
  MotifVerification,
  OrigineInvitation,
  StatutCommentaire,
  TraceSignature,
} from "@/types/database";

import { actionsPossibles, motifDuCas, type ActionVerification, type MotifCas } from "./regles";

type Client = SupabaseClient<Database>;

/*
  Lecture des cas « À vérifier » et des commentaires, avec la session de l'admin (RLS : admins actifs seulement).
*/

export type SignatureCas = {
  reference: string;
  signeLe: string;
  prenom: string;
  nom: string;
  fonction: string;
  entreprise: string;
  maillon: string;
  trace: TraceSignature | null;
  validee: boolean;
  origine: OrigineInvitation;
};

export type CasVerification = {
  invitationId: string;
  motif: MotifCas;
  origine: OrigineInvitation;
  verification: EtatVerification;
  signature: SignatureCas | null;
  /* Informations de la liste importée (null pour un nouvel inscrit) et saisie du CEO */
  liste: Partial<Record<Champ, string>> | null;
  saisie: Partial<Record<Champ, string>>;
  telephone: string;
  invitePar: string | null;
  parrain: string | null;
  /* Entreprise enregistrée (celle de la liste), et autres CEO rattachés à la même entreprise */
  entrepriseEnregistree: string;
  autresCeoEntreprise: number;
  /* Doublon : les autres signatures actives de la même entreprise */
  autresSignatures: SignatureCas[];
  actions: ActionVerification[];
  decision: DecisionVerification | null;
  decidePar: string | null;
  decideLe: string | null;
};

export type CommentaireAdmin = {
  id: string;
  invitationId: string;
  blocId: string | null;
  texte: string;
  statut: StatutCommentaire;
  note: string;
  creeLe: string;
  version: number;
  /* Texte du paragraphe dans la version commentée (si le paragraphe a changé depuis) */
  extraitVersion: string | null;
  ceo: { prenom: string; nom: string; entreprise: string };
  traitePar: string | null;
  traiteLe: string | null;
};

function versSaisie(valeur: Json | null): Partial<Record<Champ, string>> | null {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return null;
  const sortie: Partial<Record<Champ, string>> = {};
  for (const c of CHAMPS) {
    const v = (valeur as Record<string, Json | undefined>)[c];
    if (typeof v === "string") sortie[c] = v;
  }
  return sortie;
}

async function nomsAdmins(supabase: Client): Promise<Map<string, string>> {
  const { data } = await supabase.from("admins").select("user_id, prenom, nom");
  return new Map((data ?? []).map((a) => [a.user_id, `${a.prenom} ${a.nom}`.trim()]));
}

export async function lireVerification(
  supabase: Client,
  manifesteId: string,
): Promise<{ aTraiter: CasVerification[]; traites: CasVerification[] }> {
  const [{ data: invitations }, { data: signatures }, admins] = await Promise.all([
    supabase
      .from("invitations")
      .select(
        "id, origine, verification, motif, decision, decision_signature_id, verifie_par, verifie_le, saisie_liste, saisie_ceo, " +
          "invite_par_texte, parrain_invitation_id, entreprise_id, cree_le, " +
          "personne:personnes(prenom, nom, telephone), entreprise:entreprises(nom, maillon:maillons(libelle))",
      )
      .eq("manifeste_id", manifesteId),
    supabase
      .from("signatures")
      .select("id, invitation_id, reference, signe_le, prenom, nom, fonction, entreprise_nom, maillon_libelle, trace, validee, retiree_le")
      .eq("manifeste_id", manifesteId)
      .order("signe_le", { ascending: true }),
    nomsAdmins(supabase),
  ]);

  type Inv = {
    id: string;
    origine: OrigineInvitation;
    verification: EtatVerification;
    motif: MotifVerification | null;
    decision: DecisionVerification | null;
    decision_signature_id: string | null;
    verifie_par: string | null;
    verifie_le: string | null;
    saisie_liste: Json | null;
    saisie_ceo: Json | null;
    invite_par_texte: string | null;
    parrain_invitation_id: string | null;
    entreprise_id: string | null;
    cree_le: string;
    personne: { prenom: string; nom: string; telephone: string | null } | null;
    entreprise: { nom: string; maillon: { libelle: string } | null } | null;
  };
  const toutes = (invitations ?? []) as unknown as Inv[];
  const parId = new Map(toutes.map((i) => [i.id, i]));
  const sigs = signatures ?? [];

  const versSignature = (s: (typeof sigs)[number]): SignatureCas => ({
    reference: s.reference,
    signeLe: s.signe_le,
    prenom: s.prenom ?? "",
    nom: s.nom ?? "",
    fonction: s.fonction ?? "",
    entreprise: s.entreprise_nom ?? "",
    maillon: s.maillon_libelle ?? "",
    trace: estTrace(s.trace) ? s.trace : null,
    validee: s.validee,
    origine: (s.invitation_id && parId.get(s.invitation_id)?.origine) || "liste",
  });

  const cas = (i: Inv): CasVerification => {
    const active = sigs.find((s) => s.invitation_id === i.id && !s.retiree_le) ?? null;
    const concernee = active ?? (i.decision_signature_id ? (sigs.find((s) => s.id === i.decision_signature_id) ?? null) : null);
    const saisie = versSaisie(i.saisie_ceo) ?? {
      prenom: concernee?.prenom ?? "",
      nom: concernee?.nom ?? "",
      fonction: concernee?.fonction ?? "",
      entreprise: concernee?.entreprise_nom ?? "",
      maillon: concernee?.maillon_libelle ?? "",
    };
    const entrepriseNormalisee = normaliserNomEntreprise(concernee?.entreprise_nom ?? saisie.entreprise ?? "");
    const autresSignatures = sigs
      .filter((s) => s.invitation_id !== i.id && !s.retiree_le && normaliserNomEntreprise(s.entreprise_nom ?? "") === entrepriseNormalisee)
      .map(versSignature);
    const enregistree = i.entreprise?.nom ?? "";
    const entrepriseDifferente =
      normaliserNomEntreprise(saisie.entreprise ?? "") !== normaliserNomEntreprise(enregistree) ||
      (saisie.maillon ?? "") !== (i.entreprise?.maillon?.libelle ?? "");
    const parrain = i.parrain_invitation_id ? parId.get(i.parrain_invitation_id) : null;
    return {
      invitationId: i.id,
      motif: motifDuCas(i.motif),
      origine: i.origine,
      verification: i.verification,
      signature: concernee ? versSignature(concernee) : null,
      liste: versSaisie(i.saisie_liste),
      saisie,
      telephone: i.personne?.telephone ?? saisie.telephone ?? "",
      invitePar: i.invite_par_texte,
      parrain: parrain
        ? `${parrain.personne?.prenom ?? ""} ${parrain.personne?.nom ?? ""}`.trim() + (parrain.entreprise?.nom ? `, ${parrain.entreprise.nom}` : "")
        : null,
      entrepriseEnregistree: enregistree,
      autresCeoEntreprise: i.entreprise_id ? toutes.filter((x) => x.id !== i.id && x.entreprise_id === i.entreprise_id).length : 0,
      autresSignatures,
      actions: actionsPossibles({ verification: i.verification, motif: i.motif, active: active !== null, entrepriseDifferente }),
      decision: i.decision,
      decidePar: i.verifie_par ? (admins.get(i.verifie_par) ?? "Admin supprimé") : null,
      decideLe: i.verifie_le,
    };
  };

  const aTraiter = toutes
    .filter((i) => i.verification === "a_verifier" && sigs.some((s) => s.invitation_id === i.id && !s.retiree_le))
    .map(cas)
    .sort((a, b) => (a.signature?.signeLe ?? "").localeCompare(b.signature?.signeLe ?? ""));
  const traites = toutes
    .filter((i) => i.decision !== null && i.verifie_le !== null)
    .map(cas)
    .sort((a, b) => (b.decideLe ?? "").localeCompare(a.decideLe ?? ""));
  return { aTraiter, traites };
}

/* Nombre de cas à vérifier (navigation et onglet) : une vérification « à vérifier » a toujours une signature active */
export async function compterAVerifier(supabase: Client, manifesteId: string): Promise<number> {
  const { count } = await supabase
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("manifeste_id", manifesteId)
    .eq("verification", "a_verifier");
  return count ?? 0;
}

export async function lireCommentaires(supabase: Client, manifesteId: string): Promise<CommentaireAdmin[]> {
  const { data: versions } = await supabase.from("manifeste_versions").select("id, numero, blocs").eq("manifeste_id", manifesteId);
  const ids = (versions ?? []).map((v) => v.id);
  if (!ids.length) return [];
  const [{ data: commentaires }, admins] = await Promise.all([
    supabase
      .from("commentaires")
      .select(
        "id, invitation_id, manifeste_version_id, bloc_id, texte, statut, note_admin, traite_par, traite_le, cree_le, " +
          "invitation:invitations(personne:personnes(prenom, nom), entreprise:entreprises(nom))",
      )
      .in("manifeste_version_id", ids)
      .order("cree_le", { ascending: true }),
    nomsAdmins(supabase),
  ]);
  type Com = {
    id: string;
    invitation_id: string;
    manifeste_version_id: string;
    bloc_id: string | null;
    texte: string;
    statut: StatutCommentaire;
    note_admin: string | null;
    traite_par: string | null;
    traite_le: string | null;
    cree_le: string;
    invitation: { personne: { prenom: string; nom: string } | null; entreprise: { nom: string } | null } | null;
  };
  const parVersion = new Map((versions ?? []).map((v) => [v.id, v]));
  return ((commentaires ?? []) as unknown as Com[]).map((c) => {
    const v = parVersion.get(c.manifeste_version_id);
    const blocs = (Array.isArray(v?.blocs) ? v.blocs : []) as unknown as Bloc[];
    const bloc = c.bloc_id ? blocs.find((b) => b.id === c.bloc_id) : null;
    return {
      id: c.id,
      invitationId: c.invitation_id,
      blocId: c.bloc_id,
      texte: c.texte,
      statut: c.statut,
      note: c.note_admin ?? "",
      creeLe: c.cree_le,
      version: v?.numero ?? 0,
      extraitVersion: bloc?.html ?? null,
      ceo: {
        prenom: c.invitation?.personne?.prenom ?? "",
        nom: c.invitation?.personne?.nom ?? "",
        entreprise: c.invitation?.entreprise?.nom ?? "",
      },
      traitePar: c.traite_par ? (admins.get(c.traite_par) ?? "Admin supprimé") : null,
      traiteLe: c.traite_le,
    };
  });
}
