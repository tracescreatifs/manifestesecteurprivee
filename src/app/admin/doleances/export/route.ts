import { NextResponse } from "next/server";

import { dateHeureDakar, tableauCsv } from "@/lib/csv";
import { lireDoleancesAdmin } from "@/lib/doleances/admin";
import { journaliser } from "@/lib/journal";
import { exigerAdminActif } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste } from "@/lib/texte/serveur";

/*
  Export des doléances pour Excel (prompt 09a), sur le modèle de l'export des signatures :
  un fichier CSV (point-virgule, BOM UTF-8). Réservé aux admins actifs, noté au journal.
*/
export const dynamic = "force-dynamic";

export async function GET() {
  const acces = await exigerAdminActif();
  if (!acces.ok) return NextResponse.json({ ok: false, erreur: acces.erreur }, { status: 401 });

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return NextResponse.json({ ok: false, erreur: "Le Manifeste n'existe pas encore en base." }, { status: 409 });
  const donnees = await lireDoleancesAdmin(supabase, manifeste.id);
  if (!donnees.disponible) {
    return NextResponse.json({ ok: false, erreur: "La migration 0009 des doléances n'est pas encore exécutée." }, { status: 409 });
  }

  /* De la plus ancienne à la plus récente */
  const liste = [...donnees.doleances].reverse();
  const csv = tableauCsv(
    [
      "Thème",
      "Thème proposé",
      "Doléance",
      "Proposition de solution",
      "Déposée le (heure de Dakar)",
      "Auteur",
      "Entreprise",
      "Signataire",
      "Ne jamais publier",
      "Lue",
    ],
    liste.map((d) => [
      d.theme ?? "Autre",
      d.themePropose,
      d.texte,
      d.solution,
      dateHeureDakar(d.deposeLe),
      d.auteur.nom,
      d.auteur.entreprise,
      d.auteur.signataire ? "Oui" : "Non",
      d.neJamaisPublier ? "Oui" : "Non",
      d.lueLe ? `Oui, le ${dateHeureDakar(d.lueLe)}${d.luePar ? ` par ${d.luePar}` : ""}` : "Non",
    ]),
  );

  const exporteLe = new Date().toISOString();
  await journaliser({
    acteurType: "admin",
    acteurId: acces.admin.user_id,
    action: "doleances_exportees",
    cibleType: "manifeste",
    cibleId: manifeste.id,
    details: { nombre: liste.length, objet: "doleances" },
  });

  const horodatage = dateHeureDakar(exporteLe).replace(" ", "-").replace(":", "h");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="doleances-${horodatage}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
