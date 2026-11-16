import { strToU8, zipSync } from "fflate";
import { NextResponse } from "next/server";

import { traceSure } from "@/components/document/signature";
import { estTrace } from "@/lib/ceo/serveur";
import { cellule, dateHeureDakar } from "@/lib/csv";
import { journaliser } from "@/lib/journal";
import { exigerAdminActif } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste } from "@/lib/texte/serveur";

/*
  Sauvegarde des signatures (D26), à télécharger chaque soir pendant la campagne :
  un .zip avec signatures.csv (pour Excel), signatures.json (sauvegarde complète,
  tracés compris) et un SVG par signature, nommé par sa référence.
*/
export const dynamic = "force-dynamic";

function svg(vb: string, d: string[]): string {
  const chemins = d
    .map((x) => `  <path d="${x}" fill="none" stroke="#14212B" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">\n${chemins}\n</svg>\n`;
}

export async function GET() {
  const acces = await exigerAdminActif();
  if (!acces.ok) return NextResponse.json({ ok: false, erreur: acces.erreur }, { status: 401 });

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return NextResponse.json({ ok: false, erreur: "Le Manifeste n'existe pas encore en base." }, { status: 409 });

  const [{ data: signatures, error }, { data: versions }] = await Promise.all([
    supabase.from("signatures").select("*").eq("manifeste_id", manifeste.id).order("signe_le", { ascending: true }),
    supabase.from("manifeste_versions").select("id, numero").eq("manifeste_id", manifeste.id),
  ]);
  if (error) return NextResponse.json({ ok: false, erreur: "Lecture des signatures impossible." }, { status: 500 });

  const numeros = new Map((versions ?? []).map((v) => [v.id, v.numero]));
  const liste = signatures ?? [];

  const entetes = [
    "Référence",
    "Date et heure (Dakar)",
    "Prénom",
    "Nom",
    "Fonction",
    "Entreprise",
    "Maillon",
    "Origine",
    "Version signée",
    "Validée",
    "Retirée",
  ];
  const lignes = liste.map((s) =>
    [
      s.reference,
      dateHeureDakar(s.signe_le),
      s.prenom,
      s.nom,
      s.fonction,
      s.entreprise_nom,
      s.maillon_libelle,
      s.origine === "sur_place" ? "Sur place" : "En ligne",
      numeros.get(s.manifeste_version_id) ?? "",
      s.validee ? "Oui" : "Non",
      s.retiree_le ? `Oui, le ${dateHeureDakar(s.retiree_le)}` : "Non",
    ]
      .map(cellule)
      .join(";"),
  );
  /* BOM UTF-8 : Excel lit correctement les accents */
  const csv = `﻿${[entetes.map(cellule).join(";"), ...lignes].join("\r\n")}\r\n`;

  const exporteLe = new Date().toISOString();
  const json = JSON.stringify(
    {
      manifeste: { id: manifeste.id, titre: manifeste.titre, statut: manifeste.statut },
      exporte_le: exporteLe,
      nombre: liste.length,
      signatures: liste.map((s) => ({ ...s, version_numero: numeros.get(s.manifeste_version_id) ?? null })),
    },
    null,
    2,
  );

  const fichiers: Record<string, Uint8Array> = {
    "signatures.csv": strToU8(csv),
    "signatures.json": strToU8(json),
  };
  for (const s of liste) {
    if (!estTrace(s.trace)) continue;
    const sure = traceSure(s.trace);
    if (sure) fichiers[`signatures/${s.reference}.svg`] = strToU8(svg(sure.vb, sure.d));
  }

  const archive = zipSync(fichiers, { level: 6 });
  const horodatage = dateHeureDakar(exporteLe).replace(" ", "-").replace(":", "h");

  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "signatures_exportees",
    cibleType: "manifeste",
    cibleId: manifeste.id,
    details: { nombre: liste.length },
  });

  return new NextResponse(Buffer.from(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="signatures-${horodatage}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
