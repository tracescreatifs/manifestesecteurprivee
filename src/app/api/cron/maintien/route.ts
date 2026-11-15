import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { lireCronSecret } from "@/lib/env";
import { creerClientAdmin } from "@/lib/supabase/admin";

/*
  Maintien en éveil de Supabase (plan gratuit : mise en pause après une semaine sans activité).
  Appelée par la tâche planifiée de Vercel tous les 6 jours, qui envoie
  l'en-tête Authorization: Bearer CRON_SECRET.
*/
export const dynamic = "force-dynamic";

function secretValide(entete: string | null, secret: string): boolean {
  const attendu = Buffer.from(`Bearer ${secret}`);
  const recu = Buffer.from(entete ?? "");
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

export async function GET(request: NextRequest) {
  let secret: string;
  try {
    secret = lireCronSecret();
  } catch (e) {
    /* La cause (variable absente) va dans les journaux de Vercel, jamais dans la réponse publique */
    console.error("Tâche planifiée :", (e as Error).message);
    return NextResponse.json({ ok: false, erreur: "Accès refusé." }, { status: 401 });
  }

  if (!secretValide(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false, erreur: "Accès refusé." }, { status: 401 });
  }

  const { error } = await creerClientAdmin().from("pays").select("code").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, erreur: "Lecture de la base impossible." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, horodatage: new Date().toISOString() });
}
