# État du projet

Mis à jour à la fin de chaque prompt. Dernière mise à jour : prompt 02, 14 novembre 2026.

---

## Feuille de route des prompts

Selon la partie 17 du cahier des charges, avec l'ordre des lots modifié par D26. Un prompt d'audit est ajouté après les prompts 08 et 09.

| N° | Contenu | Branche | À livrer avant | Statut |
| --- | --- | --- | --- | --- |
| 00 | Initialisation : rangement du dépôt, lecture du cahier des charges, fichiers mémoire | `main` | 14 novembre 2026 | Validé |
| 01 | Décisions du prompt 00 ; socle : Next.js, configuration, charte et polices, clients Supabase, page minimale | `main` | 14 novembre 2026 | Validé |
| 02 | Base de données, connexion et gestion des admins, journal, tâche planifiée de maintien en éveil | `main` | 16 novembre 2026 | En cours de validation |
| 03 | Texte : import Word, versions, comparaison, page A4, gel et corrections mineures | `main` | 17 novembre 2026 | À faire |
| 04 | Liste des CEO : import Excel ou CSV, liens personnels, envoi et relance WhatsApp, lien ouvert et QR code, export des signatures | `main` | 19 novembre 2026 | À faire |
| 05 | Espace CEO : lecture, signature en 3 étapes, moment de l'annexe, accusé, fiche, confidentialité, coupures réseau, signature depuis le téléphone, refus des signatures après la date limite | `main` | 21 novembre 2026 | À faire |
| 06 | Audit complet et vérifications d'avant mise en ligne (domaine, redirections, RLS, parcours sur téléphone et ordinateur) | `main` | 22 novembre 2026 | À faire |
| 07 | Vérification, commentaires | branche | 25 novembre 2026 | À faire |
| 08 | Document final : PDF A4, clôture, publication, signataires sur place | branche | 2 décembre 2026 | À faire |
| 09 | Cahier de doléances | branche | décembre 2026 | À faire |

---

## Fait

- Prompt 00 : dépôt rangé (`docs/`, `docs/prototypes/`), ancienne version 1 du cahier des charges supprimée, fichiers mémoire créés (`CLAUDE.md`, `PROJECT_STATE.md`, `decisions.md`, `.gitignore`, `.env.example`). Aucun code applicatif.
- Prompt 01, décisions : D15 à D32 inscrites dans `decisions.md`, règle de priorité entre les documents et règle 13 complétées dans `CLAUDE.md`, feuille de route réordonnée (D26), thèmes de doléances ajoutés aux contenus à fournir.
- Prompt 01, socle : projet Next.js 16.4.6 (App Router, TypeScript strict, `src/`, alias `@/*`, ESLint, Tailwind 4.3), dépendances `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`, `zod`, `motion`.
- Polices Fraunces, Jost, Gelasio et Carlito dans `src/lib/fonts.ts` ; charte complète en jetons Tailwind dans `src/app/globals.css` (couleurs, polices, courbe, ambiances `data-ambiance="ceo"` et `data-ambiance="admin"`, focus visible, animations réduites).
- Lecture des variables à l'appel (`src/lib/env.ts`), clients Supabase navigateur et serveur (`src/lib/supabase/`).
- Page d'accueil minimale, page 404, `robots.txt` qui interdit tout et balise noindex sur tout le site (D29), `vercel.json` en région `cdg1`.
- Prompt 02, base : migration `0001_fondations.sql` (10 types énumérés, 13 tables, vue `consentements_courants`, triggers `modifie_le`, nom normalisé, signatures figées, journal et consentements immuables, dernier admin actif protégé, fonctions `est_admin` et `promouvoir_premier_admin`, RLS sur toutes les tables, buckets privés `imports`, `photos`, `exports`) et seed `0001_referentiels.sql`. Testées deux fois de suite sur PostgreSQL 16.
- Prompt 02, code : types de la base écrits à la main (`src/types/database.ts`), client avec la clé secrète (`src/lib/supabase/admin.ts`, paquet `server-only`), proxy Next.js 16 (`src/proxy.ts`), mode classique de rendu (D33).
- Connexion des admins (`/connexion`), durée de 30 jours par cookie httpOnly, mot de passe oublié (`/mot-de-passe-oublie`), lien d'invitation ou de réinitialisation (`/auth/confirm`, vérifié au clic : D34), choix du mot de passe (`/definir-mot-de-passe`), déconnexion journalisée.
- Coquille de l'espace admin : barre latérale, barre basse en verre dépoli sur téléphone, barre d'étapes lue depuis `manifestes.statut`, menu du compte avec « Se déconnecter ».
- Réglages, onglet Admins : inviter (lien à copier ou à envoyer sur WhatsApp), générer un nouveau lien ou un lien de réinitialisation, couper ou rétablir l'accès (blocage dans Supabase Auth), dernier admin actif protégé dans l'interface et en base. Onglet Journal paginé (50 lignes), en français, à l'heure de Dakar.
- Tâche planifiée de maintien en éveil : `/api/cron/maintien` (401 sans `CRON_SECRET`), déclarée dans `vercel.json` (`0 6 */6 * *`).

---

## Registre des migrations

Claude Code ne marque jamais une migration comme exécutée : Ziza le confirme, et Claude le reporte dans le prompt suivant.

| N° | Fichier | Objet | Exécutée par Ziza |
| --- | --- | --- | --- |
| 0001 | `supabase/migrations/0001_fondations.sql` | Structure complète du Manifeste (hors doléances) : types, tables, vue, triggers, fonctions, RLS, buckets privés | Non |
| seed 0001 | `supabase/seed/0001_referentiels.sql` | Pays (SN), 5 maillons, ligne du Manifeste (titre, date limite, consentement, modèle WhatsApp) | Non |

---

## Variables d'environnement attendues

À saisir par Ziza dans Vercel (Project Settings, Environment Variables). Le build réussit sans aucune d'elles.

| Nom | Rôle | Où trouver la valeur |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse du projet Supabase, utilisée par le navigateur et le serveur | Supabase, tableau de bord du projet : bouton « Connect » ou Project Settings, Data API : « Project URL » |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique Supabase (commence par `sb_publishable_`), soumise aux règles RLS | Supabase, Project Settings, API Keys : « Publishable key » |
| `SUPABASE_SECRET_KEY` | Clé secrète Supabase (commence par `sb_secret_`), qui contourne la RLS : serveur uniquement, jamais dans le navigateur | Supabase, Project Settings, API Keys : « Secret keys » (en créer une si besoin) |
| `NEXT_PUBLIC_SITE_URL` | Adresse publique de la plateforme, utilisée pour construire les liens personnels, le lien ouvert et les QR codes | L'URL Vercel du projet (Vercel, onglet Domains), puis le domaine définitif dès qu'il est actif |
| `CRON_SECRET` | Secret qui protège la tâche planifiée de maintien en éveil de Supabase (Vercel l'envoie automatiquement à la tâche) | À créer par Ziza : une chaîne aléatoire d'au moins 32 caractères (générateur de mots de passe) |

---

## Contenus et informations à fournir par le porteur du projet

Selon la partie 19 du cahier des charges.

| Contenu ou information | Échéance | Statut |
| --- | --- | --- |
| Domaine définitif | Actif avant le 23 novembre 2026 | À fournir |
| Numéro WhatsApp dédié de la Task Force (bouton « Une question ? ») | Avant le 23 novembre 2026 | À fournir |
| Liste du déjeuner du 22 octobre avec les numéros WhatsApp | Avant le 20 novembre 2026 | À fournir |
| Accord du groupe de la Task Force pour l'envoi des liens en son nom | Avant le 23 novembre 2026 | À fournir |
| Validations du texte avec Khadija : formulations sur l'Afrique (le Manifeste est sénégalais), sources des chiffres 9 % et 90 %, sens de « c'est un précédent », date de la mention finale | Avant le gel du 20 novembre 2026 | À fournir |
| Confirmation de « Axes transversaux » comme cinquième maillon | Avant l'import de la liste | À fournir |
| Confirmation de la clôture des doléances au 8 janvier 2027 | Avant la publication | À fournir |
| Test du modèle Word après passage dans Google Docs | Avant le prompt 03 | À fournir |
| Thèmes de doléances issus des tables du déjeuner du 22 octobre (à défaut, les 6 thèmes de départ, D23) | Avant la publication | À fournir |

---

## Problèmes ouverts

- « Mot de passe oublié » par email : le fournisseur email par défaut de Supabase n'envoie qu'aux membres du projet Supabase. Pour les autres admins, utiliser « Générer un lien de réinitialisation » (D16) tant qu'aucun SMTP n'est configuré sur le domaine définitif.
