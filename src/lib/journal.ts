import "server-only";

import { creerClientAdmin } from "@/lib/supabase/admin";
import type { Json, TypeActeur } from "@/types/database";
import type { ActionJournal } from "@/lib/journal-libelles";

type EntreeJournal = {
  acteurType: TypeActeur;
  acteurId?: string | null;
  action: ActionJournal;
  cibleType?: string | null;
  cibleId?: string | null;
  details?: Json | null;
};

/*
  Ajoute une ligne au journal (jamais modifiée ensuite).
  Écrit avec la clé secrète : le journal reste complet même quand l'acteur
  vient de perdre ses droits (déconnexion, accès coupé).
  Une erreur d'écriture est signalée dans les journaux du serveur,
  sans annuler l'action déjà faite.
*/
export async function journaliser(entree: EntreeJournal): Promise<void> {
  const { error } = await creerClientAdmin()
    .from("journal")
    .insert({
      acteur_type: entree.acteurType,
      acteur_id: entree.acteurId ?? null,
      action: entree.action,
      cible_type: entree.cibleType ?? null,
      cible_id: entree.cibleId ?? null,
      details: entree.details ?? null,
    });

  if (error) {
    console.error("Écriture au journal impossible :", error.message);
  }
}
