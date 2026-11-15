import { describe, expect, it } from "vitest";

import {
  champsModifies,
  decider,
  etatCampagne,
  signer,
  type ContexteSignature,
  type DepotSignature,
  type Saisie,
  type SignatureEnregistree,
} from "./regles";
import { longueurTrace, schemaTrace } from "./saisie";

const LISTE = {
  prenom: "Moussa",
  nom: "Ndiaye",
  fonction: "Directeur général",
  entreprise: "Forage du Ndiambour",
  maillon: "Production",
  telephone: "+221770000102",
};
const SAISIE: Saisie = { ...LISTE };
const AVANT = "2026-12-02T23:59:00Z";

/* Faux dépôt en mémoire */
function depot(options: Partial<ContexteSignature["manifeste"]> & { signatureActive?: boolean; doublon?: boolean } = {}) {
  const enregistrees: (SignatureEnregistree & { cle: string })[] = [];
  const contexte: ContexteSignature = {
    invitation: { id: "inv-1", origine: "liste", saisieListe: LISTE },
    manifeste: { statut: "gele", dateLimite: AVANT, autoValidation: true, ...options },
    signatureActive: options.signatureActive ?? false,
  };
  const d: DepotSignature & { enregistrees: typeof enregistrees; decisions: unknown[] } = {
    enregistrees,
    decisions: [],
    async contexte(jeton) {
      return jeton === "JETON-VALIDE-1234567" ? contexte : null;
    },
    async parCle(cle) {
      return enregistrees.find((s) => s.cle === cle) ?? null;
    },
    async doublonEntreprise() {
      return options.doublon ?? false;
    },
    async enregistrer(invitationId, cle, saisie, decision) {
      d.decisions.push(decision);
      const s = {
        cle,
        reference: `MSP-2026-${String(enregistrees.length + 1).padStart(4, "0")}`,
        signeLe: "2026-11-23T10:00:00Z",
        version: 1,
        ...saisie,
        validee: decision.validee,
        invitationId,
        deja: false,
      };
      enregistrees.push(s);
      contexte.signatureActive = true;
      return { ok: true, signature: s };
    },
  };
  return d;
}

const LE_23 = new Date("2026-11-23T10:00:00Z");

describe("état de la campagne", () => {
  it("ferme les signatures après la date limite, même sans clôture manuelle", () => {
    expect(etatCampagne("gele", AVANT, new Date("2026-12-02T23:58:59Z"))).toBe("ouvert");
    expect(etatCampagne("gele", AVANT, new Date("2026-12-03T00:00:01Z"))).toBe("clos");
    expect(etatCampagne("redaction", AVANT, LE_23)).toBe("pas_ouvert");
    expect(etatCampagne("clos", AVANT, LE_23)).toBe("clos");
  });
});

describe("règles de vérification", () => {
  it("valide automatiquement des informations identiques à la liste", () => {
    expect(champsModifies(LISTE, { ...SAISIE, telephone: "77 000 01 02", nom: " ndiaye " })).toEqual([]);
    expect(decider({ origine: "liste", autoValidation: true, modifie: false, doublon: false })).toEqual({
      validee: true,
      verification: "valide",
      motif: null,
    });
  });

  it("met à vérifier une information modifiée, sans bloquer l'annexe (D20)", () => {
    expect(champsModifies(LISTE, { ...SAISIE, entreprise: "Forages du Ndiambour SARL" })).toEqual(["entreprise"]);
    expect(decider({ origine: "liste", autoValidation: true, modifie: true, doublon: false })).toEqual({
      validee: true,
      verification: "a_verifier",
      motif: "modification",
    });
  });

  it("met à vérifier une entreprise qui a déjà signé", () => {
    expect(decider({ origine: "liste", autoValidation: true, modifie: true, doublon: true })).toMatchObject({
      verification: "a_verifier",
      motif: "doublon",
    });
  });

  it("met tout à vérifier quand la validation automatique est coupée", () => {
    expect(decider({ origine: "liste", autoValidation: false, modifie: false, doublon: false }).verification).toBe("a_verifier");
  });

  it("ne valide pas un nouvel inscrit avant la vérification", () => {
    expect(decider({ origine: "lien_ouvert", autoValidation: true, modifie: false, doublon: false })).toEqual({
      validee: false,
      verification: "a_verifier",
      motif: "nouveau",
    });
  });
});

describe("signature", () => {
  const entree = { jeton: "JETON-VALIDE-1234567", cle: "cle-1", saisie: SAISIE };

  it("enregistre une première signature", async () => {
    const d = depot();
    const r = await signer(d, entree, LE_23);
    expect(r.ok && r.signature.reference).toBe("MSP-2026-0001");
    expect(d.enregistrees).toHaveLength(1);
  });

  it("clé anti-doublon : un renvoi renvoie la même signature, sans en créer une autre", async () => {
    const d = depot();
    await signer(d, entree, LE_23);
    const renvoi = await signer(d, entree, LE_23);
    expect(renvoi.ok && renvoi.signature.reference).toBe("MSP-2026-0001");
    expect(renvoi.ok && renvoi.signature.deja).toBe(true);
    expect(d.enregistrees).toHaveLength(1);
  });

  it("refuse une deuxième signature avec une autre clé", async () => {
    const d = depot();
    await signer(d, entree, LE_23);
    expect(await signer(d, { ...entree, cle: "cle-2" }, LE_23)).toEqual({ ok: false, code: "deja_signe" });
  });

  it("refuse une signature après la date limite", async () => {
    const d = depot();
    expect(await signer(d, entree, new Date("2026-12-03T00:00:01Z"))).toEqual({ ok: false, code: "signatures_closes" });
    expect(d.enregistrees).toHaveLength(0);
  });

  it("refuse un jeton inconnu et un texte encore en rédaction", async () => {
    expect(await signer(depot(), { ...entree, jeton: "inconnu" }, LE_23)).toEqual({ ok: false, code: "lien_invalide" });
    expect(await signer(depot({ statut: "redaction" }), entree, LE_23)).toEqual({ ok: false, code: "pas_ouvert" });
  });

  it("transmet la décision de vérification au moment d'enregistrer", async () => {
    const d = depot({ doublon: true });
    await signer(d, { ...entree, saisie: { ...SAISIE, fonction: "Gérant" } }, LE_23);
    expect(d.decisions[0]).toEqual({ validee: true, verification: "a_verifier", motif: "doublon" });
  });
});

describe("renvoi d'une signature retirée depuis (audit 06)", () => {
  it("n'est jamais présenté comme enregistré, et dit le refus si un admin l'a refusée", async () => {
    const d = depot();
    await signer(d, { jeton: "JETON-VALIDE-1234567", cle: "cle-1", saisie: SAISIE }, LE_23);
    d.enregistrees[0].retiree = true;
    expect(await signer(d, { jeton: "JETON-VALIDE-1234567", cle: "cle-1", saisie: SAISIE }, LE_23)).toEqual({ ok: false, code: "cle_invalide" });
    const refusee = depot();
    await signer(refusee, { jeton: "JETON-VALIDE-1234567", cle: "cle-1", saisie: SAISIE }, LE_23);
    refusee.enregistrees[0].retiree = true;
    const contexte = await refusee.contexte("JETON-VALIDE-1234567");
    if (contexte) contexte.invitation.refusee = true;
    expect(await signer(refusee, { jeton: "JETON-VALIDE-1234567", cle: "cle-1", saisie: SAISIE }, LE_23)).toEqual({
      ok: false,
      code: "signature_refusee",
    });
  });
});

describe("tracé", () => {
  it("refuse un tracé trop court (un simple point)", () => {
    const point = { vb: "0 0 600 250", d: ["M100 100 L100.5 100.5"] };
    expect(longueurTrace(point)).toBeLessThan(1);
    expect(schemaTrace.safeParse(point).success).toBe(false);
  });

  it("accepte une vraie signature, et refuse un tracé avec autre chose que des commandes SVG", () => {
    expect(schemaTrace.safeParse({ vb: "0 0 600 250", d: ["M10 100 Q60 20 120 110 T260 90 L400 120"] }).success).toBe(true);
    expect(schemaTrace.safeParse({ vb: "0 0 600 250", d: ["M10 10 <script>"] }).success).toBe(false);
  });
});
