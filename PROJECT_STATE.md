# État du projet

Mis à jour à la fin de chaque prompt. Dernière mise à jour : prompt 05.2, 15 novembre 2026.

---

## Feuille de route des prompts

Selon la partie 17 du cahier des charges, avec l'ordre des lots modifié par D26. Un prompt d'audit est ajouté après les prompts 08 et 09.

| N° | Contenu | Branche | À livrer avant | Statut |
| --- | --- | --- | --- | --- |
| 00 | Initialisation : rangement du dépôt, lecture du cahier des charges, fichiers mémoire | `main` | 14 novembre 2026 | Validé |
| 01 | Décisions du prompt 00 ; socle : Next.js, configuration, charte et polices, clients Supabase, page minimale | `main` | 14 novembre 2026 | Validé |
| 02 | Base de données, connexion et gestion des admins, journal, tâche planifiée de maintien en éveil | `main` | 16 novembre 2026 | Validé |
| 03 | Texte : import Word, versions, comparaison, page A4, gel et corrections mineures | `main` | 17 novembre 2026 | Validé |
| 04 | Liste des CEO : import Excel ou CSV, liens personnels, envoi et relance WhatsApp, lien ouvert et QR code, export des signatures | `main` | 19 novembre 2026 | Validé |
| 04.1 | Correctifs CEO : menu des lignes visible, fiche du CEO, raison des boutons désactivés, import de l'email | `main` | 19 novembre 2026 | Validé |
| 05 | Espace CEO, partie 1 : lecture, commentaires, signature en 3 étapes, annexe, moment de l'annexe, accusé, confidentialité, refus des signatures après la date limite | `main` | 21 novembre 2026 | Validé |
| 05.2 | Espace CEO, partie 2 : lien ouvert (`/rejoindre`), parrainage, fiche et photo, refaire ou retirer sa signature, coupures réseau (signature gardée sur l'appareil), signature depuis le téléphone (QR code), accusé PDF et correctifs | `main` | 21 novembre 2026 | En cours de validation |
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
- Prompt 03, aucune migration : la structure de 0001 suffit (versions, bucket `imports`, colonnes du gel).
- Lecture du Word côté serveur (`src/lib/texte/lire-docx.ts`, `fflate` et `@xmldom/xmldom`) : styles reconnus par identifiant et par nom, en français et en anglais ; gras seul conservé, texte échappé ; avertissements bloquants, attention et info. Tests vitest sur le modèle Word (`npm run test`, 16 tests).
- Alignement des versions par plus longue sous-séquence commune, identifiants stables, résumé automatique, différence mot à mot (`src/lib/texte/comparer.ts`).
- Rubrique Texte (`/admin/texte`, page d'arrivée de l'admin) : version courante en A4, Google Doc, dépôt du fichier, liste des versions, restauration ; état vide expliqué. Écran « Vérifier l'import » (`/admin/texte/verifier`) et comparaison de deux versions (`/admin/texte/comparer`).
- Composant A4 partagé (`src/components/document/document-a4.tsx`) : rendu et pagination du prototype, zoom, aucun intertitre seul en bas de page.
- Gel du texte depuis la barre d'étapes, corrections mineures (case obligatoire), retour en rédaction tant qu'aucun lien n'est parti (D42). Réglages, onglet Manifeste : lien du Google Doc. Nouveaux libellés du journal.
- Prompt 04, migration `0002_ceo.sql` : fonctions `importer_ceo`, `modifier_ceo`, `retirer_ceo` et `trouver_ou_creer_entreprise` (une transaction par opération, D53). Testée deux fois de suite sur PostgreSQL 16.
- Rubrique CEO (`/admin/ceo`, onglet « Liste et suivi ») : compteur et barre d'avancement, extrait d'annexe, filtres par statut et par maillon, recherche, ligne compacte sur téléphone, menu (copier le lien, modifier, marquer comme non envoyé, retirer).
- Import de la liste (.xlsx, CSV, tableau collé) : en-tête détecté sous les lignes de titre, colonnes reconnues par leur titre, nom complet séparé, maillon rapproché, téléphone au format international, doublons signalés et décochés (D21). Jetons de 22 caractères, codes de parrainage de 8 caractères.
- Envoi et relance sur WhatsApp (fenêtre avec message modifiable, D54), file « Relancer un par un », lien ouvert avec QR code téléchargeable et interrupteur, export des signatures en .zip (CSV, JSON, SVG).
- Réglages, onglet Messages (modèle WhatsApp, aperçu « Exemple », retour au modèle d'origine). Zoom de la page A4 de 50 % à 200 %. Icône du site et image d'aperçu de partage (Open Graph).
- Tests vitest : 35 (lecture du Word, comparaison, lecture de la liste, messages).
- Prompt 04.1 : menus d'actions et infobulles dans un portail (jamais coupés, ouverture vers le haut si besoin, clavier), y compris le menu du compte ; fiche du CEO (panneau à droite, plein écran sur téléphone) au clic sur une ligne ou avec Entrée ; raison des boutons « Envoyer » indisponibles au survol, au focus et au toucher ; email importé, modifiable par l'admin et affiché dans la fiche (D62, D63, migration 0003). Tests vitest : 37.
- Prompt 05, migration `0004_signature.sql` : colonne `whatsapp_task_force`, fonctions `enregistrer_signature` (clé anti-doublon, statut gelé, date limite, une seule signature active, version courante, consentement historisé, fiche mise à jour sans renommer l'entreprise, journal) et `resultat_signature`, exécutables seulement avec la clé secrète. Testée deux fois de suite sur PostgreSQL 16, avec la signature, le renvoi, la double signature, la date limite, le statut clos et les droits refusés.
- Espace CEO `/s/[jeton]` (hors du proxy admin) : jeton validé par le serveur ; écrans « Ce lien n'est pas valide », « pas encore ouvert », ouvert, « Les signatures sont closes » (date limite ou clôture) et publié en lecture seule ; titre générique, noindex, aucun Referer. « Ouvert » noté par le navigateur (D65).
- Lecture et Page A4 (zoom), mention de l'expéditeur, version et date limite, « Une question ? » et « Confidentialité ». Commentaires sur un paragraphe ou sur tout le texte, liste de ses propres commentaires (D68).
- Annexe dans le composant A4 partagé : page qui suit le texte, colonnes du cahier des charges, ordre, lignes par page et lignes vides réglables dans le composant (D69).
- Signature en trois étapes : informations préremplies (champs modifiés en argile), pavé vectoriel lissé (souris, doigt, stylet, clavier), aperçu de la ligne d'annexe, consentement obligatoire ; enregistrement côté serveur (D66, D67) ; moment de l'annexe et tracé à l'encre ; « Merci » ; carte « Votre signature » au retour.
- Accusé imprimable en A4 (`/s/[jeton]/accuse`, D70). Admin : signature, référence et date dans la fiche du CEO. Réglages, onglet Manifeste : date limite, validation automatique, numéro de la Task Force, texte de consentement (D72). Tests vitest : 54.
- Prompt 05.2, migration `0005_espace_ceo.sql` : testée deux fois de suite sur PostgreSQL 16 (inscription, parrainage, limite, pause, maillon invalide, brouillon, retrait, nouvelle signature, date limite, droits refusés à anon et authenticated).
- Correctifs : fenêtres de l'admin dans un portail, centrées, 85 % de l'écran au plus avec pied toujours visible (D76) ; zoom au pourcentage réel (D77) ; titre équilibré en lecture ; signatures des autres remplacées par « Signé » côté CEO avant la publication (D75) ; image d'aperçu recomposée pour le carré de WhatsApp ; polices du document chargées à la demande (D84).
- Accusé PDF produit côté serveur, rangé dans le bucket `accuses`, téléchargé par `/s/[jeton]/accuse/pdf`, y compris pour une signature antérieure (D74).
- Lien ouvert et parrainage (`/rejoindre`, D78, D79), fiche (photo et consentements, D80), inviter un confrère, retirer et refaire (D81), signature gardée sur l'appareil en cas de coupure (D82), signature sur le téléphone par QR code (D83).
- Admin : origine, parrain, « À valider », photo et consentements dans la fiche (D85). Tests vitest : 67.

---

## Registre des migrations

Claude Code ne marque jamais une migration comme exécutée : Ziza le confirme, et Claude le reporte dans le prompt suivant.

| N° | Fichier | Objet | Exécutée par Ziza |
| --- | --- | --- | --- |
| 0001 | `supabase/migrations/0001_fondations.sql` | Structure complète du Manifeste (hors doléances) : types, tables, vue, triggers, fonctions, RLS, buckets privés | Oui (15 novembre 2026) |
| seed 0001 | `supabase/seed/0001_referentiels.sql` | Pays (SN), 5 maillons, ligne du Manifeste (titre, date limite, consentement, modèle WhatsApp) | Oui (15 novembre 2026) |
| 0002 | `supabase/migrations/0002_ceo.sql` | Fonctions d'import, de modification et de retrait des CEO, chacune en une seule transaction | Oui (15 novembre 2026) |
| 0003 | `supabase/migrations/0003_ceo_email.sql` | Email des CEO enregistré à l'import et à la modification (fonctions de 0002 remplacées) | Oui (15 novembre 2026) |
| 0004 | `supabase/migrations/0004_signature.sql` | Numéro WhatsApp de la Task Force (`manifestes.whatsapp_task_force`), fonctions `enregistrer_signature` et `resultat_signature` (une transaction, clé secrète seulement) | Oui (15 novembre 2026) |
| 0005 | `supabase/migrations/0005_espace_ceo.sql` | Bucket privé `accuses`, table `inscriptions_ouvertes` (empreintes), fonctions `inscrire_par_lien_ouvert`, `retirer_signature` et `enregistrer_brouillon` (clé secrète seulement) | Non |

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
| Numéro WhatsApp dédié de la Task Force (bouton « Une question ? », à saisir dans Réglages, onglet Manifeste ; le bouton est masqué tant qu'il est vide) | Avant le 23 novembre 2026 | À fournir |
| Liste du déjeuner du 22 octobre avec les numéros WhatsApp | Avant le 20 novembre 2026 | À fournir |
| Accord du groupe de la Task Force pour l'envoi des liens en son nom | Avant le 23 novembre 2026 | À fournir |
| Validations du texte avec Khadija : formulations sur l'Afrique (le Manifeste est sénégalais), sources des chiffres 9 % et 90 %, sens de « c'est un précédent », date de la mention finale | Avant le gel du 20 novembre 2026 | À fournir |
| Confirmation de « Axes transversaux » comme cinquième maillon | Avant l'import de la liste | À fournir |
| Confirmation de la clôture des doléances au 8 janvier 2027 | Avant la publication | À fournir |
| Test du modèle Word après passage dans Google Docs | Avant le prompt 03 | À fournir |
| Thèmes de doléances issus des tables du déjeuner du 22 octobre (à défaut, les 6 thèmes de départ, D23) | Avant la publication | À fournir |

---

## Problèmes ouverts

- Fichiers importés puis abandonnés sans cliquer sur « Annuler » : ils restent dans le bucket `imports` (quelques dizaines de Ko chacun). Un nettoyage pourra être ajouté si besoin.

- « Mot de passe oublié » par email : le fournisseur email par défaut de Supabase n'envoie qu'aux membres du projet Supabase. Pour les autres admins, utiliser « Générer un lien de réinitialisation » (D16) tant qu'aucun SMTP n'est configuré sur le domaine définitif.
