import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { compterDoleancesNonLues } from "@/lib/doleances/admin";
import { acteurJournal, cibleJournal } from "@/lib/journal-affichage";
import { libelleAction } from "@/lib/journal-libelles";
import { compterAVerifier } from "@/lib/verification/serveur";
import type { Database, StatutEnvoi, StatutManifeste } from "@/types/database";

import { jourDakar } from "./calculs";
import { estARelancer } from "./compteurs";

/*
  Tableau de bord de l'admin (R1, R2) et ligne « À faire maintenant ». Lu avec la session de l'admin (RLS).
  Uniquement des valeurs réelles, lues en base à chaque requête ; les calculs sont définis dans decisions.md (D120).
*/

type Client = SupabaseClient<Database>;

/* Parcours des liens : chaque invitation compte une seule fois, avec le même statut que la rubrique CEO */
export type Parcours = Record<StatutEnvoi, number> & { total: number };

/* Ligne « À faire maintenant » du tableau de bord (R2) et pastilles du menu */
export type AFaire = {
  aVerifier: number;
  /* Liens envoyés ou ouverts, pas encore signés, avec un numéro (estARelancer, comme « Relancer un par un ») */
  aRelancer: number;
  /* Doléances non lues */
  nonLues: number;
  /* Date du dernier export des signatures (journal), null : aucun export */
  dernierExport: string | null;
};

export type ActionRecente = { id: string; quand: string; acteur: string; libelle: string; cible: string };

export type TableauDeBord = {
  manifesteId: string;
  statut: StatutManifeste;
  version: { numero: number; correction: boolean } | null;
  geleLe: string | null;
  closLe: string | null;
  publieLe: string | null;
  dateLimite: string;
  /* Signatures dans l'annexe : validées et non retirées (en ligne et sur place) */
  annexe: number;
  surPlace: number;
  /* Signatures de l'annexe signées aujourd'hui (jour de Dakar) */
  aujourdhui: number;
  parcours: Parcours;
  doleances: { disponible: boolean; total: number; themes: { libelle: string; nombre: number }[] };
  actions: ActionRecente[];
  lueLe: string;
};

type InvitationLue = { id: string; statut_envoi: StatutEnvoi; personne: { telephone: string | null } | null };
type SignatureActive = { invitation_id: string | null; validee: boolean; origine: string; signe_le: string };

/* Invitations et signatures actives (non retirées) : base du parcours, de l'annexe et de « À relancer » */
async function lireInvitationsEtSignatures(supabase: Client, manifesteId: string) {
  const [{ data: invitations }, { data: signatures }] = await Promise.all([
    supabase.from("invitations").select("id, statut_envoi, personne:personnes(telephone)").eq("manifeste_id", manifesteId),
    supabase
      .from("signatures")
      .select("invitation_id, validee, origine, signe_le")
      .eq("manifeste_id", manifesteId)
      .is("retiree_le", null),
  ]);
  return {
    invitations: (invitations ?? []) as unknown as InvitationLue[],
    signatures: (signatures ?? []) as SignatureActive[],
  };
}

/* Statut de la rubrique CEO : « signe » dès qu'une signature active existe, sinon le statut d'envoi */
function statuts(invitations: InvitationLue[], signatures: SignatureActive[]): { statut: StatutEnvoi; telephone: string | null }[] {
  const signees = new Set(signatures.map((s) => s.invitation_id).filter((x): x is string => Boolean(x)));
  return invitations.map((i) => ({ statut: signees.has(i.id) ? "signe" : i.statut_envoi, telephone: i.personne?.telephone ?? null }));
}

function calculerParcours(invitations: InvitationLue[], signatures: SignatureActive[]): Parcours {
  const signees = new Set(signatures.map((s) => s.invitation_id).filter((x): x is string => Boolean(x)));
  const p: Parcours = { a_envoyer: 0, envoye: 0, ouvert: 0, signe: 0, total: invitations.length };
  invitations.forEach((i) => p[signees.has(i.id) ? "signe" : i.statut_envoi]++);
  return p;
}

async function lireDernierExport(supabase: Client): Promise<string | null> {
  const { data } = await supabase
    .from("journal")
    .select("cree_le")
    .eq("action", "signatures_exportees")
    .order("cree_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.cree_le ?? null;
}

/* Données du cadre de l'admin : pastilles de la navigation, barre d'étapes et « À faire maintenant » */
export async function lireCadreAdmin(supabase: Client, manifesteId: string): Promise<AFaire & { annexe: number }> {
  const [{ invitations, signatures }, aVerifier, nonLues, dernierExport] = await Promise.all([
    lireInvitationsEtSignatures(supabase, manifesteId),
    compterAVerifier(supabase, manifesteId),
    compterDoleancesNonLues(supabase, manifesteId),
    lireDernierExport(supabase),
  ]);
  return {
    aVerifier,
    aRelancer: statuts(invitations, signatures).filter((i) => estARelancer(i.statut, i.telephone)).length,
    nonLues,
    dernierExport,
    annexe: signatures.filter((s) => s.validee).length,
  };
}

export async function lireTableauDeBord(supabase: Client): Promise<TableauDeBord | null> {
  const { data: manifeste } = await supabase
    .from("manifestes")
    .select("id, statut, date_limite, gele_le, clos_le, publie_le")
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!manifeste) return null;

  const [{ invitations, signatures }, { data: version }, doleances, themes, journal, admins] = await Promise.all([
    lireInvitationsEtSignatures(supabase, manifeste.id),
    supabase
      .from("manifeste_versions")
      .select("numero, type")
      .eq("manifeste_id", manifeste.id)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("doleances").select("theme_id").eq("manifeste_id", manifeste.id),
    supabase.from("doleance_themes").select("id, libelle"),
    supabase
      .from("journal")
      .select("id, acteur_type, acteur_id, action, cible_type, cible_id, details, cree_le")
      .order("cree_le", { ascending: false })
      .order("id", { ascending: false })
      .limit(5),
    supabase.from("admins").select("user_id, prenom, nom"),
  ]);

  const annexe = signatures.filter((s) => s.validee);
  const aujourdhui = jourDakar(new Date());

  /* Doléances par thème, de la plus fréquente à la moins fréquente ; « Autre » pour une doléance sans thème */
  const libelles = new Map((themes.data ?? []).map((t) => [t.id, t.libelle]));
  const parTheme = new Map<string, number>();
  (doleances.data ?? []).forEach((d) => {
    const libelle = d.theme_id ? (libelles.get(d.theme_id) ?? "Autre") : "Autre";
    parTheme.set(libelle, (parTheme.get(libelle) ?? 0) + 1);
  });

  const noms = new Map((admins.data ?? []).map((a) => [a.user_id, `${a.prenom} ${a.nom}`]));

  return {
    manifesteId: manifeste.id,
    statut: manifeste.statut,
    version: version ? { numero: version.numero, correction: version.type === "correction_mineure" } : null,
    geleLe: manifeste.gele_le,
    closLe: manifeste.clos_le,
    publieLe: manifeste.publie_le,
    dateLimite: manifeste.date_limite,
    annexe: annexe.length,
    surPlace: annexe.filter((s) => s.origine === "sur_place").length,
    aujourdhui: annexe.filter((s) => jourDakar(new Date(s.signe_le)) === aujourdhui).length,
    parcours: calculerParcours(invitations, signatures),
    doleances: {
      disponible: !doleances.error && !themes.error,
      total: (doleances.data ?? []).length,
      themes: [...parTheme.entries()]
        .map(([libelle, nombre]) => ({ libelle, nombre }))
        .sort((a, b) => b.nombre - a.nombre || a.libelle.localeCompare(b.libelle, "fr")),
    },
    actions: (journal.data ?? []).map((l) => ({
      id: l.id,
      quand: l.cree_le,
      acteur: acteurJournal(l.acteur_type, l.acteur_id, noms),
      libelle: libelleAction(l.action),
      cible: cibleJournal(l.cible_type, l.cible_id, l.details, noms),
    })),
    lueLe: new Date().toISOString(),
  };
}
