/*
  Lecture des variables d'environnement.
  Rien n'est lu à l'import : le build réussit sans aucune variable.
  Une variable manquante lève une erreur claire au moment de l'appel.

  Les variables NEXT_PUBLIC_ sont lues par leur nom complet (process.env.NOM)
  pour que Next.js puisse les intégrer au code du navigateur.
*/

function exiger(nom: string, valeur: string | undefined): string {
  if (!valeur || valeur.trim() === "") {
    throw new Error(
      `La variable d'environnement ${nom} est manquante. Ajoutez-la dans Vercel (Settings, Environment Variables), puis redéployez.`,
    );
  }
  return valeur;
}

export function lireSupabaseUrl(): string {
  return exiger("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function lireSupabaseClePublique(): string {
  return exiger(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
