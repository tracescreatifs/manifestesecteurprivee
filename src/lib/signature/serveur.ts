import "server-only";

import { estTrace } from "@/lib/ceo/serveur";
import { masquerAnnexe } from "@/lib/signature/annexe";
import type { ChoixFiche } from "@/lib/signature/fiche";
import { formaterTelephone, normaliserNomEntreprise } from "@/lib/ceo/normaliser";
import { lireSiteUrl } from "@/lib/env";
import { creerClientAdmin } from "@/lib/supabase/admin";
import type { Bloc, Json, TraceSignature } from "@/types/database";

import {
  CHAMPS,
  etatCampagne,
  type Champ,
  type CodeErreur,
  type DepotSignature,
  type EtatCampagne,
  type Saisie,
  type SignatureEnregistree,
} from "./regles";
import type { DepotInscription } from "./inscription";
import type { DepotRetrait } from "./retrait";

/*
  Espace CEO, côté serveur. Toutes les lectures et écritures passent par la clé secrète,
  après validation du jeton : les CEO n'ont aucun accès direct aux tables (règle 3).
  Le navigateur ne reçoit que les données utiles à ce CEO, et le texte.
*/

export const JETON_VALIDE = /^[A-Za-z0-9]{16,64}$/;

export type LigneAnnexe = {
  cle: string;
  prenom: string;
  nom: string;
  fonction: string;
  entreprise: string;
  maillon: string;
  trace: TraceSignature | null;
  signeLe: string;
  /* Signature du CEO qui consulte la page */
  moi: boolean;
  /* Image non envoyée au navigateur avant la publication (D75) */
  masquee?: boolean;
};

export type { ChoixFiche };

export type SignatureCeo = {
  reference: string;
  signeLe: string;
  version: number;
  /* Titre de la version signée, pour l'accusé */
  titre: string;
  prenom: string;
  nom: string;
  fonction: string;
  entreprise: string;
  maillon: string;
  trace: TraceSignature | null;
  texteConsentement: string;
  validee: boolean;
};

export type CommentaireCeo = { id: string; blocId: string | null; texte: string; creeLe: string };

export type EspaceCeo = {
  etat: EtatCampagne;
  origine: "liste" | "lien_ouvert" | "parrainage";
  /* Le CEO a une fiche (personne) : il peut commenter */
  identifie: boolean;
  dateLimite: string;
  saisieInitiale: Saisie;
  saisieListe: Partial<Record<Champ, string>> | null;
  maillons: { libelle: string; description: string }[];
  version: { numero: number; titre: string; sousTitre: string; blocs: Bloc[] } | null;
  texteConsentement: string;
  whatsappTaskForce: string | null;
  signature: SignatureCeo | null;
  annexe: LigneAnnexe[];
  commentaires: CommentaireCeo[];
  /* Fiche facultative (après la signature) : photo (lien signé d'une heure) et consentements courants */
  photoUrl: string | null;
  choix: ChoixFiche;
  /* Code de parrainage du CEO, pour « Inviter un confrère » */
  codeParrainage: string | null;
};

type InvitationLue = {
  id: string;
  manifeste_id: string;
  personne_id: string | null;
  origine: "liste" | "lien_ouvert" | "parrainage";
  code_parrainage: string | null;
  saisie_liste: Json | null;
  saisie_ceo: Json | null;
  personne: { prenom: string; nom: string; fonction: string | null; telephone: string | null; photo_path: string | null } | null;
  entreprise: { nom: string; maillon: { libelle: string } | null } | null;
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

async function lireInvitation(jeton: string): Promise<InvitationLue | null> {
  if (!JETON_VALIDE.test(jeton)) return null;
  const { data } = await creerClientAdmin()
    .from("invitations")
    .select(
      "id, manifeste_id, personne_id, origine, code_parrainage, saisie_liste, saisie_ceo, " +
        "personne:personnes(prenom, nom, fonction, telephone, photo_path), entreprise:entreprises(nom, maillon:maillons(libelle))",
    )
    .eq("jeton", jeton)
    .maybeSingle();
  return (data as unknown as InvitationLue | null) ?? null;
}

/* Invitation d'un jeton valide (pour les actions du CEO) */
export async function invitationDuJeton(
  jeton: string,
): Promise<{ id: string; manifesteId: string; personneId: string | null; photoPath: string | null } | null> {
  const inv = await lireInvitation(jeton);
  return inv
    ? { id: inv.id, manifesteId: inv.manifeste_id, personneId: inv.personne_id, photoPath: inv.personne?.photo_path ?? null }
    : null;
}

/* Consentements courants d'une personne (la ligne la plus récente de chaque type) */
export async function lireChoix(personneId: string | null): Promise<ChoixFiche> {
  const choix: ChoixFiche = { recontact: false, annuaire: false, photo_communication: false };
  if (!personneId) return choix;
  const { data } = await creerClientAdmin()
    .from("consentements_courants")
    .select("type, accorde")
    .eq("personne_id", personneId);
  (data ?? []).forEach((c) => {
    if (c.type && c.type in choix) choix[c.type as keyof ChoixFiche] = Boolean(c.accorde);
  });
  return choix;
}

/* Numéro WhatsApp de la Task Force, pour « Une question ? » sur un lien invalide */
export async function lireWhatsappTaskForce(): Promise<string | null> {
  const { data } = await creerClientAdmin()
    .from("manifestes")
    .select("whatsapp_task_force")
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.whatsapp_task_force ?? null;
}

export async function lireEspace(jeton: string): Promise<EspaceCeo | null> {
  const inv = await lireInvitation(jeton);
  if (!inv) return null;
  const supabase = creerClientAdmin();

  const [{ data: manifeste }, { data: version }, { data: maillons }, { data: signatures }, { data: commentaires }] =
    await Promise.all([
      supabase
        .from("manifestes")
        .select("statut, date_limite, texte_consentement, whatsapp_task_force")
        .eq("id", inv.manifeste_id)
        .single(),
      supabase
        .from("manifeste_versions")
        .select("numero, titre, sous_titre, blocs")
        .eq("manifeste_id", inv.manifeste_id)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("maillons").select("libelle, description").eq("actif", true).order("ordre"),
      supabase
        .from("signatures")
        .select(
          "id, invitation_id, prenom, nom, fonction, entreprise_nom, maillon_libelle, trace, signe_le, validee, reference, texte_consentement, version:manifeste_versions(numero, titre)",
        )
        .eq("manifeste_id", inv.manifeste_id)
        .is("retiree_le", null)
        .order("signe_le", { ascending: true }),
      supabase
        .from("commentaires")
        .select("id, bloc_id, texte, cree_le")
        .eq("invitation_id", inv.id)
        .order("cree_le", { ascending: true }),
    ]);
  if (!manifeste) return null;

  type SignatureLue = {
    id: string;
    invitation_id: string | null;
    prenom: string | null;
    nom: string | null;
    fonction: string | null;
    entreprise_nom: string | null;
    maillon_libelle: string | null;
    trace: Json | null;
    signe_le: string;
    validee: boolean;
    reference: string;
    texte_consentement: string | null;
    version: { numero: number; titre: string } | null;
  };
  const lues = (signatures ?? []) as unknown as SignatureLue[];
  const mienne = lues.find((s) => s.invitation_id === inv.id) ?? null;

  /* L'annexe : les signatures validées, et celle du CEO même en attente de validation */
  const etat = etatCampagne(manifeste.statut, manifeste.date_limite, new Date());
  const lignes: LigneAnnexe[] = lues
    .filter((s) => s.validee || s.invitation_id === inv.id)
    .map((s) => ({
      cle: s.id === mienne?.id ? "moi" : `s${lues.indexOf(s)}`,
      prenom: s.prenom ?? "",
      nom: s.nom ?? "",
      fonction: s.fonction ?? "",
      entreprise: s.entreprise_nom ?? "",
      maillon: s.maillon_libelle ?? "",
      trace: estTrace(s.trace) ? s.trace : null,
      signeLe: s.signe_le,
      moi: s.invitation_id === inv.id,
    }));
  /* Images des autres signatures retirées avant la publication (D75) : elles ne quittent pas le serveur */
  const annexe = masquerAnnexe(lignes, etat === "publie");

  const [photo, choix] = await Promise.all([
    inv.personne?.photo_path
      ? supabase.storage.from("photos").createSignedUrl(inv.personne.photo_path, 3600)
      : Promise.resolve({ data: null }),
    lireChoix(inv.personne_id),
  ]);

  const liste = versSaisie(inv.saisie_liste);
  const precedente = versSaisie(inv.saisie_ceo);
  const depuisFiche: Saisie = {
    prenom: inv.personne?.prenom ?? "",
    nom: inv.personne?.nom ?? "",
    fonction: inv.personne?.fonction ?? "",
    entreprise: inv.entreprise?.nom ?? "",
    maillon: inv.entreprise?.maillon?.libelle ?? "",
    telephone: inv.personne?.telephone ?? "",
  };
  const base = precedente ?? liste;
  const saisieInitiale = Object.fromEntries(CHAMPS.map((c) => [c, base?.[c] ?? depuisFiche[c] ?? ""])) as Saisie;
  /* Numéro affiché lisiblement (+221 77 000 01 02) ; la comparaison avec la liste se fait sur la forme normalisée */
  if (saisieInitiale.telephone) saisieInitiale.telephone = formaterTelephone(saisieInitiale.telephone) || saisieInitiale.telephone;

  return {
    etat,
    origine: inv.origine,
    identifie: inv.personne_id !== null,
    dateLimite: manifeste.date_limite,
    saisieInitiale,
    saisieListe: liste,
    maillons: (maillons ?? []).map((m) => ({ libelle: m.libelle, description: m.description ?? "" })),
    version: version
      ? {
          numero: version.numero,
          titre: version.titre,
          sousTitre: version.sous_titre ?? "",
          blocs: Array.isArray(version.blocs) ? (version.blocs as unknown as Bloc[]) : [],
        }
      : null,
    texteConsentement: manifeste.texte_consentement,
    whatsappTaskForce: manifeste.whatsapp_task_force,
    signature: mienne
      ? {
          reference: mienne.reference,
          signeLe: mienne.signe_le,
          version: mienne.version?.numero ?? 0,
          titre: mienne.version?.titre ?? "",
          prenom: mienne.prenom ?? "",
          nom: mienne.nom ?? "",
          fonction: mienne.fonction ?? "",
          entreprise: mienne.entreprise_nom ?? "",
          maillon: mienne.maillon_libelle ?? "",
          trace: estTrace(mienne.trace) ? mienne.trace : null,
          texteConsentement: mienne.texte_consentement ?? "",
          validee: mienne.validee,
        }
      : null,
    annexe,
    photoUrl: photo.data?.signedUrl ?? null,
    choix,
    codeParrainage: inv.code_parrainage,
    commentaires: (commentaires ?? []).map((c) => ({ id: c.id, blocId: c.bloc_id, texte: c.texte, creeLe: c.cree_le })),
  };
}

/* ----- Dépôt réel pour l'orchestration de la signature ----- */

const CODES: CodeErreur[] = ["cle_invalide", "lien_invalide", "deja_signe", "aucune_version"];

function versSignature(r: Record<string, unknown>): SignatureEnregistree {
  return {
    reference: String(r.reference ?? ""),
    signeLe: String(r.signe_le ?? ""),
    version: Number(r.version ?? 0),
    prenom: String(r.prenom ?? ""),
    nom: String(r.nom ?? ""),
    fonction: String(r.fonction ?? ""),
    entreprise: String(r.entreprise ?? ""),
    maillon: String(r.maillon ?? ""),
    validee: Boolean(r.validee),
    invitationId: String(r.invitation_id ?? ""),
    deja: Boolean(r.deja),
  };
}

export function creerDepot(options: { trace: TraceSignature; appareil: string }): DepotSignature {
  const supabase = creerClientAdmin();
  let manifesteId = "";

  return {
    async contexte(jeton) {
      const inv = await lireInvitation(jeton);
      if (!inv) return null;
      manifesteId = inv.manifeste_id;
      const [{ data: manifeste }, { count }] = await Promise.all([
        supabase.from("manifestes").select("statut, date_limite, auto_validation").eq("id", inv.manifeste_id).single(),
        supabase
          .from("signatures")
          .select("id", { count: "exact", head: true })
          .eq("invitation_id", inv.id)
          .is("retiree_le", null),
      ]);
      if (!manifeste) return null;
      return {
        invitation: { id: inv.id, origine: inv.origine, saisieListe: versSaisie(inv.saisie_liste) },
        manifeste: {
          statut: manifeste.statut,
          dateLimite: manifeste.date_limite,
          autoValidation: manifeste.auto_validation,
        },
        signatureActive: (count ?? 0) > 0,
      };
    },

    async parCle(cle) {
      const { data } = await supabase.from("signatures").select("id").eq("cle_idempotence", cle).maybeSingle();
      if (!data) return null;
      const { data: resultat } = await supabase.rpc("resultat_signature", { p_signature_id: data.id, p_deja: true });
      return resultat ? versSignature(resultat as Record<string, unknown>) : null;
    },

    async doublonEntreprise(entrepriseNormalisee, invitationId) {
      if (!entrepriseNormalisee) return false;
      const { data } = await supabase
        .from("signatures")
        .select("entreprise_nom, invitation_id")
        .eq("manifeste_id", manifesteId)
        .is("retiree_le", null);
      return (data ?? []).some(
        (s) => s.invitation_id !== invitationId && normaliserNomEntreprise(s.entreprise_nom ?? "") === entrepriseNormalisee,
      );
    },

    async enregistrer(invitationId, cle, saisie, decision) {
      const { data, error } = await supabase.rpc("enregistrer_signature", {
        p_invitation_id: invitationId,
        p_cle: cle,
        p_signature: {
          ...saisie,
          trace: options.trace,
          appareil: options.appareil,
          saisie,
        } as unknown as Json,
        p_verification: decision as unknown as Json,
      });
      if (error) {
        const message = error.message ?? "";
        if (message.includes("signatures_fermees") || message.includes("date_limite_depassee")) {
          return { ok: false, code: "signatures_closes" };
        }
        const code = CODES.find((c) => message.includes(c));
        return { ok: false, code: code ?? "echec" };
      }
      return { ok: true, signature: versSignature(data as Record<string, unknown>) };
    },
  };
}

/* ----- Retrait (et « Refaire ») ----- */

export function creerDepotRetrait(): DepotRetrait {
  const depot = creerDepot({ trace: { vb: "0 0 1 1", d: [] }, appareil: "" });
  return {
    contexte: (jeton) => depot.contexte(jeton),
    async retirer(invitationId) {
      const { data, error } = await creerClientAdmin().rpc("retirer_signature", { p_invitation_id: invitationId });
      if (error) {
        const m = error.message ?? "";
        if (m.includes("signatures_fermees") || m.includes("date_limite_depassee")) return { ok: false, code: "signatures_closes" };
        if (m.includes("aucune_signature")) return { ok: false, code: "aucune_signature" };
        if (m.includes("lien_invalide")) return { ok: false, code: "lien_invalide" };
        return { ok: false, code: "echec" };
      }
      return { ok: true, reference: String((data as Record<string, unknown> | null)?.reference ?? "") };
    },
  };
}

/* ----- Signature faite ailleurs (téléphone) : lue par l'ordinateur toutes les 5 secondes ----- */

export async function lireSignatureActive(
  invitationId: string,
): Promise<{ signature: SignatureEnregistree; trace: TraceSignature | null } | null> {
  const supabase = creerClientAdmin();
  const { data } = await supabase
    .from("signatures")
    .select("id, trace")
    .eq("invitation_id", invitationId)
    .is("retiree_le", null)
    .maybeSingle();
  if (!data) return null;
  const { data: resultat } = await supabase.rpc("resultat_signature", { p_signature_id: data.id, p_deja: true });
  if (!resultat) return null;
  return { signature: versSignature(resultat as Record<string, unknown>), trace: estTrace(data.trace) ? data.trace : null };
}

/* ----- Inscription par le lien ouvert ou par parrainage ----- */

export function creerDepotInscription(manifesteId: string): DepotInscription {
  return {
    async inscrire(e) {
      const { error } = await creerClientAdmin().rpc("inscrire_par_lien_ouvert", {
        p_manifeste_id: manifesteId,
        p_saisie: e.saisie as unknown as Json,
        p_jeton: e.jeton,
        p_code_parrainage: e.codeParrainage,
        p_code_parrain: e.codeParrain,
        p_invite_par: e.invitePar,
        p_empreinte: e.empreinte,
        p_limite_par_heure: e.limiteParHeure,
      });
      if (!error) return { ok: true };
      const m = error.message ?? "";
      if (m.includes("limite_atteinte")) return { ok: false, code: "limite_atteinte" };
      if (m.includes("lien_en_pause")) return { ok: false, code: "lien_en_pause" };
      if (m.includes("pas_ouvert")) return { ok: false, code: "pas_ouvert" };
      if (m.includes("signatures_fermees") || m.includes("date_limite_depassee")) return { ok: false, code: "signatures_closes" };
      return { ok: false, code: "echec" };
    },
  };
}

/* Manifeste et texte pour la page /rejoindre (aucune donnée personnelle) */
export type PageRejoindre = {
  manifesteId: string;
  etat: EtatCampagne;
  lienActif: boolean;
  dateLimite: string;
  version: { numero: number; titre: string; sousTitre: string; blocs: Bloc[] } | null;
  maillons: { libelle: string; description: string }[];
  texteConsentement: string;
  whatsappTaskForce: string | null;
  /* Nom du parrain si le code est valide, pour préremplir « Qui vous a invité ? » */
  parrain: string | null;
  codeParrain: string;
};

export async function lirePageRejoindre(codeParrain: string | null): Promise<PageRejoindre | null> {
  const supabase = creerClientAdmin();
  const { data: manifeste } = await supabase
    .from("manifestes")
    .select("id, statut, date_limite, lien_ouvert_actif, texte_consentement, whatsapp_task_force")
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!manifeste) return null;
  const code = (codeParrain ?? "").trim().toUpperCase();
  const [{ data: version }, { data: maillons }, { data: parrain }] = await Promise.all([
    supabase
      .from("manifeste_versions")
      .select("numero, titre, sous_titre, blocs")
      .eq("manifeste_id", manifeste.id)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("maillons").select("libelle, description").eq("actif", true).order("ordre"),
    /^[A-Z0-9]{6,12}$/.test(code)
      ? supabase
          .from("invitations")
          .select("personne:personnes(prenom, nom)")
          .eq("code_parrainage", code)
          .eq("manifeste_id", manifeste.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const personne = (parrain as unknown as { personne: { prenom: string; nom: string } | null } | null)?.personne;
  const etat = etatCampagne(manifeste.statut, manifeste.date_limite, new Date());
  return {
    manifesteId: manifeste.id,
    etat,
    lienActif: manifeste.lien_ouvert_actif,
    dateLimite: manifeste.date_limite,
    /* Le texte en rédaction n'est jamais envoyé */
    version:
      version && etat !== "pas_ouvert"
        ? {
            numero: version.numero,
            titre: version.titre,
            sousTitre: version.sous_titre ?? "",
            blocs: Array.isArray(version.blocs) ? (version.blocs as unknown as Bloc[]) : [],
          }
        : null,
    maillons: (maillons ?? []).map((m) => ({ libelle: m.libelle, description: m.description ?? "" })),
    texteConsentement: manifeste.texte_consentement,
    whatsappTaskForce: manifeste.whatsapp_task_force,
    parrain: personne ? `${personne.prenom} ${personne.nom}`.trim() || null : null,
    codeParrain: personne ? code : "",
  };
}

/* Adresse publique du site (liens personnels, invitation, QR code), ou null si elle n'est pas configurée */
export function adresseDuSite(): string | null {
  try {
    return lireSiteUrl();
  } catch {
    return null;
  }
}
