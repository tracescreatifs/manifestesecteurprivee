import { describe, expect, it } from "vitest";

import { signer, type ContexteSignature, type DepotSignature } from "@/lib/signature/regles";

import {
  actionsPossibles,
  avertirIntegration,
  comparerChamps,
  deciderCas,
  messageValidation,
  peutRetablir,
  regrouperCommentaires,
  type ActionVerification,
  type CasLu,
  type DepotVerification,
} from "./regles";

const A_VERIFIER = { verification: "a_verifier" as const, active: true, entrepriseDifferente: false };

/* Faux dépôt : garde l'état du cas et applique les décisions comme les fonctions SQL de la migration 0006 */
function depot(cas: CasLu) {
  const appliquees: { action: ActionVerification; motif: string }[] = [];
  const d: DepotVerification & { cas: CasLu; appliquees: typeof appliquees } = {
    cas,
    appliquees,
    async lireCas(id) {
      return id === "inv-1" ? d.cas : null;
    },
    async appliquer(_id, action, motif) {
      appliquees.push({ action, motif });
      d.cas = { ...d.cas, verification: action === "retirer" ? "rejete" : "valide", active: action !== "retirer" };
      return { ok: true };
    },
  };
  return d;
}

describe("décisions proposées pour chaque cas", () => {
  it("modification : vérifier, mettre à jour l'entreprise (si elle diffère), retirer", () => {
    expect(actionsPossibles({ ...A_VERIFIER, motif: "modification" })).toEqual(["verifier", "retirer"]);
    expect(actionsPossibles({ ...A_VERIFIER, motif: "modification", entrepriseDifferente: true })).toEqual([
      "verifier",
      "mettre_a_jour_entreprise",
      "retirer",
    ]);
  });

  it("nouvel inscrit : valider ou refuser ; doublon : garder les deux ou retirer", () => {
    expect(actionsPossibles({ ...A_VERIFIER, motif: "nouveau" })).toEqual(["valider", "retirer"]);
    expect(actionsPossibles({ ...A_VERIFIER, motif: "doublon" })).toEqual(["garder_les_deux", "retirer"]);
    expect(actionsPossibles({ ...A_VERIFIER, motif: null })).toEqual(["verifier", "retirer"]);
  });

  it("un cas traité, ou sans signature active, ne propose plus rien", () => {
    expect(actionsPossibles({ ...A_VERIFIER, verification: "valide", motif: "nouveau" })).toEqual([]);
    expect(actionsPossibles({ ...A_VERIFIER, active: false, motif: "doublon" })).toEqual([]);
  });
});

describe("application d'une décision", () => {
  it("valide un nouvel inscrit, puis refuse une deuxième décision sur le même cas", async () => {
    const d = depot({ ...A_VERIFIER, motif: "nouveau" });
    expect(await deciderCas(d, { invitationId: "inv-1", action: "valider", motif: "" })).toEqual({ ok: true });
    expect(await deciderCas(d, { invitationId: "inv-1", action: "retirer", motif: "" })).toEqual({ ok: false, code: "action_impossible" });
    expect(d.appliquees.map((a) => a.action)).toEqual(["valider"]);
  });

  it("refuse une décision qui ne s'applique pas au cas (valider une modification, renommer sans différence)", async () => {
    const d = depot({ ...A_VERIFIER, motif: "modification" });
    expect(await deciderCas(d, { invitationId: "inv-1", action: "valider", motif: "" })).toEqual({ ok: false, code: "action_impossible" });
    expect(await deciderCas(d, { invitationId: "inv-1", action: "mettre_a_jour_entreprise", motif: "" })).toEqual({
      ok: false,
      code: "action_impossible",
    });
    expect(await deciderCas(d, { invitationId: "inconnu", action: "verifier", motif: "" })).toEqual({ ok: false, code: "introuvable" });
    expect(d.appliquees).toEqual([]);
  });

  it("retire un doublon avec un motif nettoyé (journal), et garde les deux sur un autre cas", async () => {
    const d = depot({ ...A_VERIFIER, motif: "doublon" });
    await deciderCas(d, { invitationId: "inv-1", action: "retirer", motif: "  On garde le DG  " });
    expect(d.appliquees).toEqual([{ action: "retirer", motif: "On garde le DG" }]);
    expect(d.cas.verification).toBe("rejete");
    const e = depot({ ...A_VERIFIER, motif: "doublon" });
    expect(await deciderCas(e, { invitationId: "inv-1", action: "garder_les_deux", motif: "" })).toEqual({ ok: true });
  });
});

describe("après un retrait ou un refus", () => {
  const contexte = (refusee: boolean): ContexteSignature => ({
    invitation: { id: "inv-1", origine: "lien_ouvert", saisieListe: null, refusee },
    manifeste: { statut: "gele", dateLimite: "2026-12-02T23:59:00Z", autoValidation: true },
    signatureActive: false,
  });
  const depotSignature = (refusee: boolean): DepotSignature => ({
    contexte: async () => contexte(refusee),
    parCle: async () => null,
    doublonEntreprise: async () => false,
    enregistrer: async () => {
      throw new Error("ne doit pas être appelé");
    },
  });
  const entree = {
    jeton: "JETON-VALIDE-1234567",
    cle: "cle-nouvelle",
    saisie: { prenom: "A", nom: "B", fonction: "C", entreprise: "D", maillon: "Études", telephone: "+221770000000" },
  };

  it("le CEO ne peut plus signer avec ce lien", async () => {
    expect(await signer(depotSignature(true), entree, new Date("2026-11-23T10:00:00Z"))).toEqual({ ok: false, code: "signature_refusee" });
  });

  it("« Rétablir » : seulement une signature rejetée, sans autre signature active, tant que les signatures sont ouvertes", () => {
    const manifeste = { statut: "gele" as const, dateLimite: "2026-12-02T23:59:00Z" };
    const rejetee = { verification: "rejete" as const, decisionSignature: true, signatureActive: false };
    expect(peutRetablir(rejetee, manifeste, new Date("2026-11-23T10:00:00Z"))).toBe(true);
    expect(peutRetablir(rejetee, manifeste, new Date("2026-12-03T00:00:01Z"))).toBe(false);
    expect(peutRetablir(rejetee, { ...manifeste, statut: "clos" }, new Date("2026-11-23T10:00:00Z"))).toBe(false);
    expect(peutRetablir({ ...rejetee, verification: "valide" }, manifeste, new Date("2026-11-23T10:00:00Z"))).toBe(false);
  });
});

describe("comparaison, commentaires et messages", () => {
  it("compare champ par champ en ignorant la casse, les accents et l'écriture du téléphone", () => {
    const lignes = comparerChamps(
      { prenom: "Moussa", nom: "Ndiaye", entreprise: "Forage du Ndiambour", telephone: "+221770000102" },
      { prenom: "moussa", nom: "Ndiaye", entreprise: "Forages du Ndiambour SARL", telephone: "77 000 01 02" },
    );
    expect(lignes.filter((l) => l.different).map((l) => l.champ)).toEqual(["entreprise"]);
  });

  it("regroupe par paragraphe : commentaires généraux d'abord, puis l'ordre du texte, paragraphe disparu à la fin", () => {
    const groupes = regrouperCommentaires(
      [
        { blocId: "b2", creeLe: "2026-11-23T10:00:00Z" },
        { blocId: "ancien", creeLe: "2026-11-23T09:00:00Z" },
        { blocId: null, creeLe: "2026-11-23T11:00:00Z" },
        { blocId: "b1", creeLe: "2026-11-23T12:00:00Z" },
        { blocId: "b2", creeLe: "2026-11-23T08:00:00Z" },
      ],
      [{ id: "b1" }, { id: "b2" }],
    );
    expect(groupes.map((g) => g.blocId)).toEqual([null, "b1", "b2", "ancien"]);
    expect(groupes[2].commentaires.map((c) => c.creeLe)).toEqual(["2026-11-23T08:00:00Z", "2026-11-23T10:00:00Z"]);
  });

  it("avertit avant « Intégré » après le gel, et le message de validation est celui demandé", () => {
    expect(avertirIntegration("integre", "gele")).toBe(true);
    expect(avertirIntegration("integre", "redaction")).toBe(false);
    expect(avertirIntegration("retenu", "gele")).toBe(false);
    expect(messageValidation("Ousmane")).toBe(
      "Bonjour Ousmane, votre signature du Manifeste du secteur privé sénégalais de l'eau et de l'assainissement est validée. Merci. La Task Force du secteur privé sénégalais de l'eau et de l'assainissement",
    );
  });
});
