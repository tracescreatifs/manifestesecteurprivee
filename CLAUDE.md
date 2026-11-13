# CLAUDE.md : plateforme du Manifeste du secteur privé sénégalais de l'eau et de l'assainissement

Ce fichier s'adresse à Claude Code. Il fixe les règles de travail du projet. Il est créé au prompt 00 et ne change que si une règle change.

Documents de référence (ne jamais modifier leur contenu) :

- `docs/CAHIER_DES_CHARGES.md` (version 1.1) : la référence fonctionnelle ;
- `docs/METHODE.md` : la méthode de travail ;
- `docs/prototypes/1-admin.html` et `docs/prototypes/2-ceo.html` : la référence visuelle et comportementale validée (JavaScript vanilla, un fichier chacun). On reproduit leur rendu et leur logique dans la stack du projet, sans copier leur code ;
- `docs/prototypes/Modele_Manifeste_GoogleDoc.docx` : le modèle Word, référence pour l'import du texte.

En cas d'écart entre ces documents : signaler l'écart dans le rapport et ne rien trancher seul.

---

## 1. Les rôles

- **Ziza** (porteur du projet) : donne la direction, les priorités et les décisions métier. Exécute les actions manuelles (SQL, variables d'environnement, réglages) et teste.
- **Claude** (dans la conversation) : génère les prompts et contrôle chaque rapport.
- **Claude Code** (toi) : tu exécutes uniquement ce que le prompt demande. Rien de plus, rien de moins.

---

## 2. Environnement de travail

- **Pas de travail en local.** Ziza utilise Claude Code sur le web, connecté au dépôt GitHub. Chaque session part d'une copie propre du dépôt, code, puis pousse sur GitHub.
- **Vercel est connecté à GitHub.** Chaque push déclenche un déploiement. L'URL Vercel est le seul environnement de test.
- **Supabase sans CLI.** Ziza exécute lui-même chaque migration en copiant le fichier SQL depuis GitHub dans le SQL Editor de Supabase.
- **Variables d'environnement** : Ziza les saisit lui-même dans Vercel (et dans Supabase si besoin). Tu n'y as pas accès.
- **Stack par défaut** : Next.js (App Router, TypeScript), Supabase (base, authentification, stockage), Vercel. Toute autre technologie doit être justifiée dans `decisions.md`.

### Conséquences obligatoires

1. **Migrations** : chaque migration est un fichier numéroté dans `supabase/migrations/` (`0001_init.sql`, `0002_xxx.sql`, etc.). Il est autonome, idempotent et exécutable en un seul copier-coller, dans l'ordre des numéros. Une migration déjà exécutée n'est jamais modifiée : on en crée une nouvelle.
2. **Données de départ** : séparées des migrations de structure, dans `supabase/seed/`, idempotentes elles aussi.
3. **Types** : pas de génération automatique. Les types de la base sont écrits et tenus à jour à la main dans `src/types/database.ts`, dans le même prompt que la migration.
4. **Build sans secrets** : le build doit réussir sans aucune variable d'environnement. Aucun crash à l'import si une clé manque : l'erreur est levée à l'exécution, avec un message clair. Toute nouvelle variable est ajoutée à `.env.example` et signalée dans le rapport.
5. **Tests sur Vercel** : chaque rapport dit exactement quoi tester sur l'URL Vercel, et dans quel ordre.
6. **Retour arrière** : l'historique GitHub est le filet de sécurité. On revient en arrière avec un `git revert` du commit fautif, jamais en réécrivant l'historique.

### Stratégie de branches

| Phase | Branche | Pourquoi |
| --- | --- | --- |
| Jusqu'au lundi 23 novembre 2026 (envoi des liens aux CEO) | `main` | L'URL Vercel n'est pas encore publique : chaque push est un test |
| À partir du 23 novembre 2026 | une branche par lot (`feat/...`, `fix/...`), puis fusion dans `main` | L'URL est publique : chaque branche a sa prévisualisation Vercel, la production reste stable |

La branche à utiliser est **toujours écrite explicitement dans chaque prompt**. Tu pousses sur cette branche, et sur aucune autre.

---

## 3. Règles absolues

**Règle 1 : Qualité avant vitesse.** Ne jamais bâcler, quitte à faire plus de prompts ou plus d'étapes.

**Règle 2 : Fonctionnalités complètes.** Chaque fonctionnalité demandée est implémentée à 100 %. Aucun bouton factice, aucun composant vide, aucun `TODO` dans le code, aucune donnée simulée présentée comme réelle. Seule exception : un contenu manquant (photo, texte) déjà listé comme « à fournir ». Il est alors affiché proprement et listé dans `PROJECT_STATE.md`.

**Règle 3 : Cohérence interface et serveur.** Chaque action de l'interface a son traitement côté serveur (Server Action, route handler ou requête protégée par RLS), et chaque traitement serveur a son interface. Aucun code mort, aucune route orpheline.

**Règle 4 : Tout dans le même prompt.** Si un fichier doit changer pour que la fonctionnalité marche, il change dans le même prompt. Jamais « à faire au prochain prompt » si c'est nécessaire maintenant.

**Règle 5 : Zéro erreur avant push.** `npm run lint`, `npx tsc --noEmit` et `npm run build` passent sans erreur. `npm run test` si des tests existent.

**Règle 6 : Décisions.** Une décision mineure et réversible non couverte par le cahier des charges : choisir l'option la plus simple et la noter dans le rapport, rubrique « Décisions prises ». Une décision structurante, irréversible ou métier : s'arrêter et demander. Ne jamais inventer une règle métier.

**Règle 7 : Git.** Un commit clair par prompt, poussé sur la branche indiquée. Jamais de force push, jamais de réécriture d'historique.

**Règle 8 : Un lot à la fois.** Un prompt traite un seul lot cohérent. Si le lot ne peut pas être terminé proprement, s'arrêter à un état stable qui compile, et le dire.

**Règle 9 : Pas d'initiative hors périmètre.** Pas de refactorisation, de renommage, de dépendance ou de « petite amélioration » non demandés. Un problème vu ailleurs est signalé dans le rapport, sans être corrigé.

---

## 4. Leçons apprises (à appliquer systématiquement)

- **MOBILE FIRST** : tout composant est responsive dès sa création. Zones tactiles de 44 px minimum. Grilles avec points de rupture. Fenêtres modales avec hauteur maximale (`max-h-[85vh]`) et défilement interne. Aucune largeur fixe sans point de rupture. Vérifier à 360 px de large.
- **DATES** : une date sans heure (`"2026-08-01"`) se parse avec `new Date(date + "T12:00:00")` pour éviter le décalage de fuseau. Les dates affichées sont en `fr-FR`, dans le fuseau `Africa/Dakar`.
- **SQL SUPABASE** : `DROP POLICY IF EXISTS` puis `CREATE POLICY` (`CREATE POLICY IF NOT EXISTS` n'existe pas). `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` avant `CREATE TRIGGER`. Buckets Storage créés en SQL avec `ON CONFLICT DO NOTHING`. Toute migration peut être réexécutée sans erreur.
- **RLS** : activée sur toutes les tables, sans exception. Chaque policy traduit la règle métier complète : si une donnée a un statut ou une date de publication, la policy de lecture l'inclut. Ne jamais compter sur le filtre côté client.
- **CLÉS** : la clé secrète Supabase (`SUPABASE_SECRET_KEY`, équivalent de l'ancienne clé `service_role`) reste côté serveur, jamais dans une variable `NEXT_PUBLIC_`. Aucune clé dans le code ni dans le dépôt.
- **STORAGE** : chaque bucket a ses policies (qui lit, qui écrit). Les images sont compressées avant envoi, et les domaines Supabase sont déclarés dans la configuration `next/image`.
- **NOTIFICATIONS** : ne notifier que ce qui est réellement visible. Si un contenu est programmé pour plus tard, pas de notification immédiate. Vérifier qu'aucun trigger PostgreSQL ne court-circuite la logique de l'application.
- **IMMUTABILITÉ** : un document officiel (attestation, contrat, facture) est stocké comme fichier dans Storage, pas régénéré à la volée. Sa date est la date d'émission, pas celle du téléchargement.
- **NIVEAU DES DONNÉES** : chaque donnée vit au bon niveau d'abstraction, avec repli sur le parent si besoin.
- **FORMULAIRES** : validation côté serveur (en plus du client), messages d'erreur qui disent quoi corriger, protection anti-spam sur les formulaires publics (champ piège et limitation des envois).
- **AUDITS** : après chaque lot de fonctionnalités, audit de parcours complet en lisant le code comme un utilisateur, du premier clic au résultat en base.
- **LIBELLÉS** : un même concept porte le même libellé partout (espace CEO, administration, messages WhatsApp, documents).
- **INFRASTRUCTURE** : vérifier que le DNS, les redirections, le CORS et les domaines fonctionnent réellement, en navigation privée, pas seulement que la configuration affiche « Valid ». Vérifier aussi les URL de redirection de l'authentification Supabase pour chaque domaine.
- **IMAGES ET LOGO** : `next/image` avec dimensions ou ratio fournis, jamais d'étirement. Le logo n'est jamais déformé, recoloré ni recadré : on fixe sa largeur ou sa hauteur, jamais les deux.
- **IDENTITÉ** : icônes au trait uniquement (lucide), jamais d'emojis dans l'interface. Jamais de tiret long ni de demi-cadratin dans les textes visibles : deux-points, virgules ou parenthèses.
- **ACCESSIBILITÉ** : navigation complète au clavier, focus visible, textes alternatifs, contrastes suffisants (niveau AA), animations réduites si l'utilisateur l'a demandé (`prefers-reduced-motion`).
- **SEO** (pages publiques) : titre et description par page, balises Open Graph, `sitemap.xml`, `robots.txt`, données structurées de l'organisation.
- **PERFORMANCE** : images en formats modernes et chargées à la demande, pas de dépendance lourde sans raison. Objectif Lighthouse mobile de 90 ou plus sur les pages publiques.

---

## 5. Protocole de chaque prompt

Dans cet ordre :

1. Lire `CLAUDE.md`, `PROJECT_STATE.md` et `decisions.md`. Citer en 3 lignes les règles qui s'appliquent à la tâche.
2. **Règle propre au projet** : relire aussi `docs/CAHIER_DES_CHARGES.md`, et consulter les prototypes concernés par la tâche (`docs/prototypes/1-admin.html` pour l'espace admin, `docs/prototypes/2-ceo.html` pour l'espace CEO, les deux pour la page A4 et l'annexe, le modèle Word pour l'import).
3. Vérifier être sur la bonne branche, à jour.
4. Lire les fichiers concernés avant de coder. Comprendre le contexte existant.
5. Exécuter la tâche.
6. `npm run lint`, `npx tsc --noEmit`, `npm run build` (et `npm run test` si présent) : confirmer zéro erreur.
7. Mettre à jour `PROJECT_STATE.md` (et `decisions.md` si une décision a été prise).
8. `git add .` puis `git commit -m "[type]: [description précise]"` puis `git push origin [branche]`.
9. Rédiger le rapport (partie 6).

Types de commit : `feat` (fonctionnalité), `fix` (correctif), `db` (migration), `content` (contenus), `docs` (documentation), `chore` (configuration).

Tu ne marques jamais une migration comme exécutée dans le registre : c'est Ziza qui le confirme, et Claude qui le reporte dans le prompt suivant.

---

## 6. Format du rapport après chaque prompt

1. **Fait** : une ligne par point implémenté.
2. **Fichiers modifiés** : liste et nombre.
3. **Vérifications** : lint, types, build, tests (OK ou erreur).
4. **Actions pour Ziza** :
   - migrations à exécuter (chemin exact, dans l'ordre) ;
   - variables à ajouter dans Vercel (nom, rôle, où trouver la valeur) ;
   - réglages Supabase ou autres services.
5. **Comment tester** : parcours précis à faire sur l'URL Vercel, avec le résultat attendu.
6. **Décisions prises** et **ambiguïtés restantes**.
7. **Problèmes rencontrés** et solution appliquée.
8. **Signalements hors périmètre** : problèmes vus ailleurs, non corrigés.
9. **Commit** : hash et branche.

---

## 7. Stack et conventions du projet

- **Next.js**, App Router, **TypeScript strict**, code dans `src/`.
- **Tailwind** pour les styles.
- **Supabase** (base, authentification, stockage) avec **`@supabase/ssr`** : un client côté serveur et un client côté navigateur.
- **Vercel**, fonctions dans la région de Paris (**`cdg1`**).
- **Framer Motion** pour les animations, **lucide-react** pour les icônes, **zod** pour la validation (côté serveur obligatoirement).
- Fuseau d'affichage : **`Africa/Dakar`** (UTC+0). Dates affichées en **`fr-FR`**.
- Variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (serveur uniquement), `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`. Le build réussit sans aucune d'elles.
- Maintien en éveil de Supabase : tâche planifiée Vercel tous les 6 jours, protégée par `CRON_SECRET`.
- Migrations dans `supabase/migrations/`, données de départ dans `supabase/seed/`, types écrits à la main dans `src/types/database.ts`.
- PDF : rendu par l'impression du navigateur au format A4 (`@page`), sans génération lourde côté serveur.

---

## 8. Charte graphique

Direction : **solennel, posé, chaleureux**. L'univers est celui du document officiel imprimé : le papier, l'encre, le filet doré.

### Polices

- Titres de l'interface : **Fraunces**.
- Interface : **Jost**.
- Document (page A4, annexe, lecture) : **Georgia** et **Calibri**, avec **Gelasio** et **Carlito** comme équivalents libres.

### Couleurs (cahier des charges, partie 14)

| Rôle | Valeur |
| --- | --- |
| Accent unique : bleu eau profonde | `#1D4E5C` |
| Argile : réservée à « à vérifier » et aux champs modifiés | `#B5653A` |
| Fond de l'espace CEO : papier chaud | `#F7F3EA` |
| Fond de l'admin : neutre | `#F7F7F6` |
| Document : vert | `#0E4B3A` |
| Document : or | `#C2A14D` |
| Document : gris | `#6A736E` |

Le vert et le rouge de l'interface ne servent qu'au sens (succès, erreur).

### Valeurs complémentaires relevées dans les prototypes (référence visuelle)

| Rôle | Valeur |
| --- | --- |
| Encre (texte) | `#14212B` |
| Texte secondaire | `#5B6670` |
| Succès | `#2F6B4F` (fond `#E2EFE6`) |
| Erreur | `#A23B2A` (fond `#F7E2DD`) |
| Eau profonde, fond doux | `#E4EEF0` |
| Argile, fond doux | `#F6E7DB` |
| Filets du document | `#D9D3C2` |
| Texte du document | `#1E2622` |
| Surface (cartes, feuilles) | `#FFFFFF` |
| Filets de l'interface | `rgba(20,33,43,.10)` et `rgba(20,33,43,.20)` |
| Fond surélevé de l'admin (barre latérale, en-têtes) | `#F1F1EF` |

### Animation

- Framer Motion, sobre.
- **Une seule courbe : `cubic-bezier(0.22, 1, 0.36, 1)`.**
- Respect de `prefers-reduced-motion`.

### Composition

- Le moment fort : la page A4 et l'annexe. Côté CEO, sa ligne qui s'inscrit dans l'annexe après la signature (la signature se trace à l'encre) ; côté admin, l'annexe qui se remplit à côté du compteur de signatures.
- Le texte se présente comme une feuille imprimée (ombre douce, coins presque droits).
- **Verre dépoli uniquement sur les barres fixes** (en-tête, barre de signature, barre d'étapes), jamais sur les cartes ni sur le document.
- Grille de 4 px.
- Petits titres en casse normale, jamais en majuscules espacées (sauf dans la page A4, qui suit la charte du document).
- Icônes lucide uniquement, une taille, un trait. Aucun emoji.

---

## 9. Règles de rédaction de l'interface

- Français partout.
- Aucun tiret long ni demi-cadratin : utiliser deux-points, virgules ou parenthèses.
- Écrire « secteur privé sénégalais de l'eau et de l'assainissement ». Ne jamais écrire « WASH », « réseau », « alliance » ni « continental ». Écrire UNIDO, pas ONUDI.
- Pas de point d'exclamation dans l'interface. Pas de point final sur les titres, boutons et libellés courts.
- Ne jamais inventer d'information, de chiffre ou de citation.

---

## 10. Règles métier non négociables

1. **La signature passe en premier pour le CEO.** Tout le reste (fiche, photo, consentements, invitation d'un confrère, commentaires) est facultatif et vient après.
2. **Les informations saisies par le CEO priment sur la liste de l'admin.** Si elles sont identiques à la liste, la signature est validée automatiquement (réglage activable) ; sinon elle passe dans « À vérifier » (modification, nouveau, doublon).
3. **Les CEO n'ont pas de compte.** Ils accèdent par un lien personnel `/s/[jeton]`, avec un jeton aléatoire d'au moins 16 caractères, jamais devinable. Toutes leurs actions passent par des routes serveur qui valident le jeton. Ils n'ont aucun accès direct aux tables.
4. **A4 strict**, identique à l'écran, au PDF et à l'impression. Aucun intertitre orphelin en bas de page. **L'annexe des signataires commence sur la page qui suit la dernière page de texte.**
5. **Une correction mineure après le gel n'annule jamais les signatures.** Elle crée une nouvelle version de type `correction_mineure`.
6. **Aucune signature n'est acceptée après la date limite**, même si aucun admin n'a cliqué sur « Clore ». Le contrôle est fait côté serveur.
7. **Les commentaires des CEO ne sont lus que par les admins**, jamais par les autres CEO. **Les doléances sont publiées sans nom ni entreprise**, après validation par un admin.
8. **Les messages et l'espace CEO parlent au nom de « la Task Force du secteur privé sénégalais de l'eau et de l'assainissement ».** Le Manifeste lui-même (document imprimé et publié) ne mentionne pas la Task Force.
9. **Au moins un admin actif en permanence**, garanti en base.
10. **RLS sur toutes les tables**, et **la clé secrète Supabase reste côté serveur**. Stockage privé uniquement (imports, photos, exports).
11. Cycle de vie du Manifeste : `redaction`, puis `gele`, puis `clos`, puis `publie`. Les liens CEO ne sont actifs qu'à partir du gel. La version gelée est celle que les CEO signent.
12. Une seule signature active par invitation, protégée par une clé anti-doublon (une signature renvoyée après une coupure réseau n'est jamais enregistrée deux fois). Une seule signature par entreprise est recommandée, sans être imposée.
13. La signature d'un nouveau inscrit (lien ouvert) n'entre dans l'annexe qu'après validation par un admin.
14. Les signatures sont enregistrées en vectoriel (`{vb, d[]}`), avec les informations imprimées figées, la version signée, le texte de consentement accepté et une référence au format `MSP-2026-0001`.
15. Jamais publiés : le téléphone, les commentaires, l'auteur d'une doléance. Chaque consentement est historisé avec le texte exact présenté et la date.
16. Le journal des actions n'est jamais modifié.
17. Les inscriptions publiques sont désactivées dans Supabase. L'invitation d'un admin et la réinitialisation d'un mot de passe passent par un lien généré, sans dépendre de l'email.
18. Le Ministère et les partenaires ne signent pas le Manifeste et n'ont pas d'accès pour l'instant.
