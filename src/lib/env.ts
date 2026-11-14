/*
  Lecture des variables d'environnement.
  Rien n'est lu à l'import : le build réussit sans aucune variable.
  Une variable manquante lève une erreur claire au moment de l'appel.

  Les variables NEXT_PUBLIC_ sont lues par leur nom complet (process.env.NOM)
  pour que Next.js puisse les intégrer au code du navigateur.
  Les autres (clé secrète, secret de la tâche planifiée) ne sont jamais
  envoyées au navigateur : Next.js ne les intègre pas au code client.
*/

function exiger(nom: string, valeur: string | undefined): string {
  if (!valeur || valeur.trim() === "") {
    throw new Error(
      `La variable d'environnement ${nom} est manquante. Ajoutez-la dans Vercel (Settings, Environment Variables), puis redéployez.`,
    );
  }
  return valeur;
}

function refuserCoteNavigateur(nom: string) {
  if (typeof window !== "undefined") {
    throw new Error(`La variable ${nom} ne peut être lue que côté serveur.`);
  }
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

/* Vrai si l'adresse et la clé publique de Supabase sont renseignées */
export function supabaseConfigure(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

/* Adresse publique de la plateforme, sans barre oblique finale */
export function lireSiteUrl(): string {
  return exiger("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, "");
}

/* Clé secrète Supabase : serveur uniquement */
export function lireSupabaseCleSecrete(): string {
  refuserCoteNavigateur("SUPABASE_SECRET_KEY");
  return exiger("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}

/* Secret de la tâche planifiée : serveur uniquement */
export function lireCronSecret(): string {
  refuserCoteNavigateur("CRON_SECRET");
  return exiger("CRON_SECRET", process.env.CRON_SECRET);
}
