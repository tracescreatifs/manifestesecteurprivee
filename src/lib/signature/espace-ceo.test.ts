import { describe, expect, it } from "vitest";

import { masquerAnnexe, type LigneAnnexeA4 } from "./annexe";
import { garderEnAttente, lireEnAttente, oublierEnAttente } from "./attente";
import { empreinteAdresse, inscrire, LIMITE_PAR_HEURE, type DepotInscription } from "./inscription";
import { signer, type ContexteSignature, type DepotSignature, type Saisie, type SignatureEnregistree } from "./regles";
import { retirerSignature, type DepotRetrait } from "./retrait";

const SAISIE: Saisie = {
  prenom: "Awa",
  nom: "Faye",
  fonction: "Directrice générale",
  entreprise: "Ferlo Traitement",
  maillon: "Traitement et valorisation",
  telephone: "+221770000300",
};
const TRACE = { vb: "0 0 600 250", d: ["M10 100 Q60 20 120 110 T260 90 L400 120"] };
const LE_23 = new Date("2026-11-23T10:00:00Z");

/* ----- Faux dépôts en mémoire, qui reprennent les règles des fonctions SQL ----- */

function baseInscriptions() {
  const invitations: { jeton: string; origine: string; parrain: string | null; codeParrainage: string; cle: string | null }[] = [
    { jeton: "JETONPARRAIN00000001", origine: "liste", parrain: null, codeParrainage: "ABCD2345", cle: null },
  ];
  const empreintes: { empreinte: string; le: number }[] = [];
  const depot: DepotInscription = {
    async inscrire(e) {
      /* Renvoi avec une clé déjà servie : même invitation, même jeton, rien n'est créé (0008) */
      const deja = invitations.find((i) => i.cle === e.cle);
      if (deja) return { ok: true, jeton: deja.jeton };
      const recentes = empreintes.filter((x) => x.empreinte === e.empreinte && LE_23.getTime() - x.le < 3600e3);
      if (recentes.length >= e.limiteParHeure) return { ok: false, code: "limite_atteinte" };
      empreintes.push({ empreinte: e.empreinte, le: LE_23.getTime() });
      const parrain = invitations.find((i) => e.codeParrain && i.codeParrainage === e.codeParrain.toUpperCase());
      invitations.push({
        jeton: e.jeton,
        origine: parrain ? "parrainage" : "lien_ouvert",
        parrain: parrain?.jeton ?? null,
        codeParrainage: e.codeParrainage,
        cle: e.cle,
      });
      return { ok: true, jeton: e.jeton };
    },
  };
  let n = 0;
  let c = 0;
  /* Une clé neuve par envoi, comme un nouveau formulaire */
  const cle = () => `cle-inscription-${String(++c).padStart(6, "0")}`;
  const generer = { jeton: () => `JETONNOUVEAU${String(++n).padStart(10, "0")}`, code: () => `CODE${String(n).padStart(4, "0")}` };
  return { invitations, depot, generer, cle };
}

function baseSignatures() {
  const signatures: (SignatureEnregistree & { cle: string; retiree: boolean })[] = [];
  const contexte = (): ContexteSignature => ({
    invitation: { id: "inv-1", origine: "lien_ouvert", saisieListe: null },
    manifeste: { statut: "gele", dateLimite: "2026-12-02T23:59:00Z", autoValidation: true },
    signatureActive: signatures.some((s) => !s.retiree),
  });
  const depot: DepotSignature & DepotRetrait = {
    async contexte(jeton) {
      return jeton === "JETON-VALIDE-1234567" ? contexte() : null;
    },
    async parCle(cle) {
      return signatures.find((s) => s.cle === cle) ?? null;
    },
    async doublonEntreprise() {
      return false;
    },
    async enregistrer(invitationId, cle, saisie, decision) {
      if (signatures.some((s) => !s.retiree)) return { ok: false, code: "deja_signe" };
      const s = {
        cle,
        retiree: false,
        reference: `MSP-2026-${String(signatures.length + 1).padStart(4, "0")}`,
        signeLe: LE_23.toISOString(),
        version: 1,
        ...saisie,
        validee: decision.validee,
        invitationId,
        deja: false,
      };
      signatures.push(s);
      return { ok: true, signature: s };
    },
    async retirer() {
      const active = signatures.find((s) => !s.retiree);
      if (!active) return { ok: false, code: "aucune_signature" };
      active.retiree = true;
      return { ok: true, reference: active.reference };
    },
  };
  return { signatures, depot };
}

/* Stockage de l'appareil, en mémoire */
function stockageMemoire() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    taille: () => m.size,
  };
}

describe("inscription par le lien ouvert et par parrainage", () => {
  it("crée un nouveau lien personnel, d'origine « lien ouvert »", async () => {
    const { invitations, depot, generer, cle } = baseInscriptions();
    const r = await inscrire(depot, { cle: cle(), saisie: SAISIE, invitePar: "Un ami", codeParrain: "", piege: "", empreinte: "e1" }, generer);
    expect(r).toEqual({ ok: true, jeton: "JETONNOUVEAU0000000001" });
    expect(invitations.at(-1)).toMatchObject({ origine: "lien_ouvert", parrain: null });
  });

  it("enregistre le parrain quand le code est valide (même en minuscules)", async () => {
    const { invitations, depot, generer, cle } = baseInscriptions();
    await inscrire(depot, { cle: cle(), saisie: SAISIE, invitePar: "", codeParrain: " abcd2345 ", piege: "", empreinte: "e1" }, generer);
    expect(invitations.at(-1)).toMatchObject({ origine: "parrainage", parrain: "JETONPARRAIN00000001" });
  });

  it("refuse un robot qui remplit le champ piège, sans rien créer", async () => {
    const { invitations, depot, generer, cle } = baseInscriptions();
    expect(await inscrire(depot, { cle: cle(), saisie: SAISIE, invitePar: "", codeParrain: "", piege: "http://x", empreinte: "e1" }, generer)).toEqual({
      ok: false,
      code: "refuse",
    });
    expect(invitations).toHaveLength(1);
  });

  it(`limite les inscriptions à ${LIMITE_PAR_HEURE} par heure et par adresse`, async () => {
    const { depot, generer, cle } = baseInscriptions();
    const entree = { saisie: SAISIE, invitePar: "", codeParrain: "", piege: "", empreinte: "meme-adresse" };
    for (let i = 0; i < LIMITE_PAR_HEURE; i++) expect((await inscrire(depot, { ...entree, cle: cle() }, generer)).ok).toBe(true);
    expect(await inscrire(depot, { ...entree, cle: cle() }, generer)).toEqual({ ok: false, code: "limite_atteinte" });
    expect((await inscrire(depot, { ...entree, cle: cle(), empreinte: "autre-adresse" }, generer)).ok).toBe(true);
  });

  it("un renvoi avec la même clé (coupure réseau) renvoie la même invitation sans en créer une deuxième", async () => {
    const { invitations, depot, generer, cle } = baseInscriptions();
    const entree = { cle: cle(), saisie: SAISIE, invitePar: "", codeParrain: "", piege: "", empreinte: "e1" };
    const premier = await inscrire(depot, entree, generer);
    const renvoi = await inscrire(depot, entree, generer);
    expect(premier).toEqual({ ok: true, jeton: "JETONNOUVEAU0000000001" });
    expect(renvoi).toEqual(premier);
    expect(invitations).toHaveLength(2);
    /* Deux clés différentes : deux inscriptions, comme avant (le doublon éventuel part dans « À vérifier ») */
    expect(await inscrire(depot, { ...entree, cle: cle() }, generer)).toEqual({ ok: true, jeton: "JETONNOUVEAU0000000003" });
    expect(invitations).toHaveLength(3);
  });

  it("refuse une inscription sans clé anti-doublon valide, sans rien créer", async () => {
    const { invitations, depot, generer } = baseInscriptions();
    const entree = { saisie: SAISIE, invitePar: "", codeParrain: "", piege: "", empreinte: "e1" };
    expect(await inscrire(depot, { ...entree, cle: "" }, generer)).toEqual({ ok: false, code: "cle_invalide" });
    expect(await inscrire(depot, { ...entree, cle: "courte" }, generer)).toEqual({ ok: false, code: "cle_invalide" });
    expect(await inscrire(depot, { ...entree, cle: "pas de*clé_valide!!" }, generer)).toEqual({ ok: false, code: "cle_invalide" });
    expect(invitations).toHaveLength(1);
  });

  it("n'enregistre qu'une empreinte de l'adresse, différente chaque jour", () => {
    const a = empreinteAdresse("196.207.1.2", "secret", LE_23);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("196");
    expect(empreinteAdresse("196.207.1.2", "secret", LE_23)).toBe(a);
    expect(empreinteAdresse("196.207.1.2", "secret", new Date("2026-11-24T10:00:00Z"))).not.toBe(a);
  });
});

describe("retirer et refaire sa signature", () => {
  const entree = { jeton: "JETON-VALIDE-1234567", cle: "cle-1", saisie: SAISIE };

  it("retire la signature active, puis permet de signer de nouveau avec une nouvelle référence", async () => {
    const { signatures, depot } = baseSignatures();
    const premiere = await signer(depot, entree, LE_23);
    expect(premiere.ok && premiere.signature.reference).toBe("MSP-2026-0001");
    expect(await retirerSignature(depot, entree.jeton, LE_23)).toEqual({ ok: true, reference: "MSP-2026-0001" });
    const seconde = await signer(depot, { ...entree, cle: "cle-2" }, LE_23);
    expect(seconde.ok && seconde.signature.reference).toBe("MSP-2026-0002");
    expect(signatures.map((s) => s.retiree)).toEqual([true, false]);
  });

  it("refuse le retrait après la date limite, et sans signature active", async () => {
    const { depot } = baseSignatures();
    await signer(depot, entree, LE_23);
    expect(await retirerSignature(depot, entree.jeton, new Date("2026-12-03T00:00:01Z"))).toEqual({
      ok: false,
      code: "signatures_closes",
    });
    await retirerSignature(depot, entree.jeton, LE_23);
    expect(await retirerSignature(depot, entree.jeton, LE_23)).toEqual({ ok: false, code: "aucune_signature" });
  });

  it("un nouvel inscrit n'entre pas dans l'annexe avant la validation", async () => {
    const { depot } = baseSignatures();
    const r = await signer(depot, entree, LE_23);
    expect(r.ok && r.signature.validee).toBe(false);
  });
});

describe("reprise après une coupure du réseau", () => {
  it("garde la signature et sa clé sur l'appareil, puis la renvoie une seule fois", async () => {
    const appareil = stockageMemoire();
    const { signatures, depot } = baseSignatures();
    garderEnAttente(appareil, "JETON-VALIDE-1234567", { cle: "cle-coupure", saisie: SAISIE, trace: TRACE }, LE_23);

    /* Page rechargée : la signature gardée est relue et renvoyée deux fois (réseau instable) */
    const gardee = lireEnAttente(appareil, "JETON-VALIDE-1234567", LE_23);
    expect(gardee?.cle).toBe("cle-coupure");
    const envoi = { jeton: "JETON-VALIDE-1234567", cle: gardee!.cle, saisie: gardee!.saisie };
    const premier = await signer(depot, envoi, LE_23);
    const second = await signer(depot, envoi, LE_23);
    expect(premier.ok && second.ok && second.signature.deja).toBe(true);
    expect(signatures).toHaveLength(1);

    oublierEnAttente(appareil, "JETON-VALIDE-1234567");
    expect(appareil.taille()).toBe(0);
  });

  it("ignore une signature gardée illisible ou trop ancienne", () => {
    const appareil = stockageMemoire();
    appareil.setItem("manifeste-signature-J", "{pas du json");
    expect(lireEnAttente(appareil, "J", LE_23)).toBeNull();
    garderEnAttente(appareil, "J", { cle: "c", saisie: SAISIE, trace: TRACE }, new Date("2026-09-01T00:00:00Z"));
    expect(lireEnAttente(appareil, "J", LE_23)).toBeNull();
    expect(appareil.taille()).toBe(0);
  });
});

describe("signatures des autres pendant la campagne (D75)", () => {
  const ligne = (moi: boolean): LigneAnnexeA4 & { moi: boolean } => ({
    cle: moi ? "moi" : "s1",
    prenom: "A",
    nom: "B",
    fonction: "C",
    entreprise: "D",
    maillon: "E",
    trace: TRACE,
    signeLe: LE_23.toISOString(),
    moi,
  });

  it("n'envoie pas l'image des autres avant la publication, mais garde la sienne", () => {
    const [autre, moi] = masquerAnnexe([ligne(false), ligne(true)], false);
    expect(autre).toMatchObject({ trace: null, masquee: true, entreprise: "D" });
    expect(moi.trace).toEqual(TRACE);
    expect(moi.masquee).toBeUndefined();
  });

  it("montre toutes les signatures après la publication", () => {
    expect(masquerAnnexe([ligne(false)], true)[0].trace).toEqual(TRACE);
  });
});
