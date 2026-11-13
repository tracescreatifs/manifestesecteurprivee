# État du projet

Mis à jour à la fin de chaque prompt. Dernière mise à jour : prompt 00, 13 novembre 2026.

---

## Feuille de route des prompts

Selon la partie 17 du cahier des charges. Un prompt d'audit est ajouté après les prompts 08 et 09.

| N° | Contenu | Branche | À livrer avant | Statut |
| --- | --- | --- | --- | --- |
| 00 | Initialisation : rangement du dépôt, lecture du cahier des charges, fichiers mémoire | `main` | 14 novembre 2026 | En cours de validation |
| 01 | Socle : Next.js, configuration, charte et polices, clients Supabase, page minimale | `main` | 14 novembre 2026 | À faire |
| 02 | Base de données, connexion et gestion des admins, journal | `main` | 16 novembre 2026 | À faire |
| 03 | Texte : import Word, versions, comparaison, page A4, gel et corrections mineures | `main` | 17 novembre 2026 | À faire |
| 04 | Liste des CEO : import Excel ou CSV, liens personnels, envoi et relance WhatsApp, lien ouvert et QR code | `main` | 19 novembre 2026 | À faire |
| 05 | Espace CEO : lecture, signature en 3 étapes, moment de l'annexe, accusé, fiche, confidentialité, coupures réseau, signature depuis le téléphone | `main` | 21 novembre 2026 | À faire |
| 06 | Audit complet et vérifications d'avant mise en ligne (domaine, redirections, RLS, parcours sur téléphone et ordinateur) | `main` | 22 novembre 2026 | À faire |
| 07 | Vérification, commentaires, export des signatures | branche | 25 novembre 2026 | À faire |
| 08 | Document final : PDF A4, clôture, publication, signataires sur place | branche | 2 décembre 2026 | À faire |
| 09 | Cahier de doléances | branche | décembre 2026 | À faire |

---

## Fait

- Prompt 00 : dépôt rangé (`docs/`, `docs/prototypes/`), ancienne version 1 du cahier des charges supprimée, fichiers mémoire créés (`CLAUDE.md`, `PROJECT_STATE.md`, `decisions.md`, `.gitignore`, `.env.example`). Aucun code applicatif.

---

## Registre des migrations

Claude Code ne marque jamais une migration comme exécutée : Ziza le confirme, et Claude le reporte dans le prompt suivant.

| N° | Fichier | Objet | Exécutée par Ziza |
| --- | --- | --- | --- |
| | | Aucune migration pour l'instant | |

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

---

## Problèmes ouverts

Aucun pour l'instant.
