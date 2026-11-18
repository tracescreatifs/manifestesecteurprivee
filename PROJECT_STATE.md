# État du projet

Mis à jour à la fin de chaque prompt. Dernière mise à jour : prompt R1, 18 novembre 2026.

---

## Feuille de route des prompts

Selon la partie 17 du cahier des charges, avec l'ordre des lots modifié par D26. Le prompt 07 est avancé avant l'audit (06), pour que l'audit porte sur la plateforme complète avant l'envoi du 23 novembre. Un prompt d'audit est ajouté après les prompts 08 et 09. À partir du 23 novembre 2026, chaque lot part sur sa propre branche (`feat/...`, `fix/...`) avant sa fusion dans `main`.

| N° | Contenu | Branche | À livrer avant | Statut |
| --- | --- | --- | --- | --- |
| 00 | Initialisation : rangement du dépôt, lecture du cahier des charges, fichiers mémoire | `main` | 14 novembre 2026 | Validé |
| 01 | Décisions du prompt 00 ; socle : Next.js, configuration, charte et polices, clients Supabase, page minimale | `main` | 14 novembre 2026 | Validé |
| 02 | Base de données, connexion et gestion des admins, journal, tâche planifiée de maintien en éveil | `main` | 16 novembre 2026 | Validé |
| 03 | Texte : import Word, versions, comparaison, page A4, gel et corrections mineures | `main` | 17 novembre 2026 | Validé |
| 04 | Liste des CEO : import Excel ou CSV, liens personnels, envoi et relance WhatsApp, lien ouvert et QR code, export des signatures | `main` | 19 novembre 2026 | Validé |
| 04.1 | Correctifs CEO : menu des lignes visible, fiche du CEO, raison des boutons désactivés, import de l'email | `main` | 19 novembre 2026 | Validé |
| 05 | Espace CEO, partie 1 : lecture, commentaires, signature en 3 étapes, annexe, moment de l'annexe, accusé, confidentialité, refus des signatures après la date limite | `main` | 21 novembre 2026 | Validé |
| 05.2 | Espace CEO, partie 2 : lien ouvert (`/rejoindre`), parrainage, fiche et photo, refaire ou retirer sa signature, coupures réseau (signature gardée sur l'appareil), signature depuis le téléphone (QR code), accusé PDF et correctifs | `main` | 21 novembre 2026 | Validé |
| 05.3 | Correctifs de l'espace CEO : fermeture des fenêtres du parcours, signature par QR code après une inscription par le lien ouvert | `main` | 21 novembre 2026 | Validé |
| 07 | Vérification des signatures (« À vérifier ») et traitement des commentaires, avancé avant l'audit | `main` | 21 novembre 2026 | Validé |
| 06 | Audit complet et vérifications d'avant mise en ligne (domaine, redirections, RLS, parcours sur téléphone et ordinateur), sur la plateforme complète ; message de validation avec le lien ; script de nettoyage des données de test | `main` | 22 novembre 2026 | Validé |
| 06.1 | Finitions d'interface (marque, liste des CEO, barre d'étapes, en-tête CEO), messages WhatsApp mis en forme, clé anti-doublon de l'inscription par le lien ouvert | `main` | 22 novembre 2026 | Validé |
| 06.2 | Date limite en heure de Dakar et d'Abu Dhabi, message du lien ouvert au nom de la Task Force, rubrique CEO sans chevauchement | `main` | 22 novembre 2026 | Validé |
| 09a | Doléances privées (D108, D109) : le CEO dépose une doléance depuis son lien, qu'il ait signé ou non ; lue par les admins seuls ; rubrique Doléances, thèmes, export, clôture des doléances | `main` | 22 novembre 2026 | Validé |
| 09a.1 | Libellé « Proposition de solution » dans les doléances, « 1er » pour le premier jour du mois dans toutes les dates, décisions D111 et D112, feuille de route après le 23 novembre | `main` | 20 novembre 2026 | Validé |
| 08 | Document final (D113 à D117) : rubrique Document A4 (aperçu complet, réglages de l'annexe, impression du texte seul, de l'annexe seule avec la numérotation du document complet, et du document complet), clôture, réouverture, signataires sur place, publication avec dépôt du PDF, espace CEO après la clôture et après la publication | `main` | 22 novembre 2026 | En cours de validation |
| 08.1 | Numérotation des pages sans le total (D118) | `main` | 22 novembre 2026 | En cours de validation |
| R1 | Refonte de l'admin, partie 1 (D119 à D122) : socle visuel partagé, cadre de l'admin (panneau flottant, « À faire maintenant », barre d'étapes flottante, barre basse du téléphone avec « Plus »), page « Tableau de bord », « Exporter en PDF » dans la rubrique Document A4 | `main` | 22 novembre 2026 | En cours de validation |
| R2 | Refonte de l'admin, partie 2 : les rubriques (Texte, CEO avec rangées arrondies et recherche, Doléances, Document A4, Réglages) dans le nouveau socle | `main` | 22 novembre 2026 | À faire |
| Partenaires 1 | Engagements des partenaires (lot b ci-dessous) | `main` | 22 novembre 2026 | À faire |
| Audit | Audit complet avant l'envoi des liens, sur la plateforme avec le document final, la refonte et les engagements | `main` | 22 novembre 2026 | À faire |


### Lots décrits au prompt 09a.1 (a et b avancés sur `main` avant le 23 novembre, décision de Ziza au prompt 08 ; c, d et e après le 23 novembre, chacun sur sa branche)

Aucun code de ces lots n'est écrit tant que leur prompt n'est pas donné. Ordre de la suite sur `main` : R1 (fait), R2, Partenaires 1, audit. Le prompt 08 (document final) est fait : l'annexe seule s'imprime en un clic dès la clôture.

| Ordre | Lot | Contenu | Branche | Statut |
| --- | --- | --- | --- | --- |
| a | Refonte visuelle de l'admin | D'après la maquette validée par Ziza (https://claude.ai/artifact/VzNbF7bJyQmPc6AnLc3JDH) : menu latéral flottant aux grands arrondis, colonne « À faire maintenant », cartes blanches aux grands arrondis et ombre légère, chiffres grands et fins, rangées arrondies pour la liste des CEO, barre de recherche CEO et doléances, arc du taux de signature, carte « Signatures » en réservoir d'eau animé dont le niveau est le taux de signature. Règles de cohérence : l'admin et l'espace CEO partagent couleurs, polices, arrondis, ombres et la courbe d'animation ; seuls les fonds diffèrent (papier côté CEO, neutre côté admin) ; l'eau ne signifie qu'une chose, la progression des signatures, jamais un décor ; une seule animation d'eau dans l'admin, lente, arrêtée si `prefers-reduced-motion` ; verre dépoli seulement sur les barres fixes ; contrastes AA | `main` (R1 et R2) | R1 fait, R2 à faire |
| b | Engagements des partenaires | Registre interne, réservé aux admins, jamais publié ni visible des CEO : partenaire et type (agence des Nations unies, ONG, ministère, bailleur, autre), engagement en quelques lignes, date, source (lettre, email, réunion) avec document joint dans le stockage privé, niveau de certitude (annoncé oralement, confirmé par écrit, en cours, réalisé), thèmes de doléances auxquels il répond, journalisé. Les partenaires n'ont aucun accès à la plateforme (règle 18 de CLAUDE.md) | `main` | À faire |
| c | 09b, doléances partie publique (déjà prévu) | Après la clôture des signatures : validation par un admin, publication anonyme, visibilité entre CEO (sans nom ni entreprise, jamais une doléance « Ne jamais la publier, même sans nom »), soutiens (table `doleance_soutiens`, l'auteur compte pour un, D22), classement par soutiens, export PDF (A4), fusion de thèmes. Le modèle de 0009 est prêt : statut (`recue`, `publiee`, `masquee`), thèmes ordonnés et désactivables | `feat/...` | À faire |
| d | Adhésion par le lien ouvert après la clôture des signatures | /rejoindre passe en mode adhésion : fiche sans signature, validation par un admin, pour embarquer les entreprises qui n'étaient pas au Manifeste | `feat/...` | À faire |
| e | Option à décider pendant la refonte (lot a) | Côté CEO, sur l'écran de remerciement après la signature : une fine ligne d'eau qui monte d'un cran pendant que sa ligne s'inscrit dans l'annexe (même sens que le réservoir de l'admin) | `feat/...` | À décider |

### Après Abu Dhabi (feuille de route)

| Lot | Contenu | Statut |
| --- | --- | --- |
| Page publique du document final | Une page publique du document final, partageable sans lien personnel. D'ici là, le partage du CEO reste sans lien (D116) | À faire |
| Essai de la publication | Début décembre : essai complet de la publication (dépôt du PDF, publication, espace CEO) sur une copie de la plateforme, jamais sur la base de production (la publication est irréversible) | À faire |

### Calendrier (décision de Ziza, D105 ; prime sur la partie 2 du cahier des charges)

| Date | Étape |
| --- | --- |
| Vendredi 20 novembre 2026 | Gel du texte |
| Lundi 23 novembre 2026 | Envoi des liens aux CEO |
| Mardi 8 décembre 2026 à minuit, heure de Dakar (9 décembre à 4 h à Abu Dhabi) | Clôture des signatures (`date_limite` = `2026-12-09T00:00:00Z`, à saisir par Ziza dans Réglages, onglet Manifeste) |
| Mercredi 9 décembre 2026, avant 9 h à Abu Dhabi | Impression de l'annexe sur place (les pages du texte sont imprimées à l'avance) |
| Mercredi 9 décembre 2026 | Remise du Manifeste (conférence du 8 au 10 décembre à Abu Dhabi) |
| Jeudi 31 décembre 2026 à 23 h 59, heure de Dakar (1er janvier à 3 h 59 à Abu Dhabi) | Clôture des doléances (D111 ; réglage saisi par Ziza dans Réglages, onglet Manifeste, qui fait foi) |

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
- Prompt 05.3, aucune migration : bouton « Fermer » en haut à droite et Échap sur toutes les fenêtres du parcours CEO, avec la confirmation « Quitter sans signer ? » quand des informations ou une signature seraient perdues (D87) ; après une inscription par /rejoindre, chargement complet du nouveau lien personnel à l'étape 2, avec « Signer sur mon téléphone » (D88). Tests vitest : 71.
- Prompt 07, migration `0006_verification.sql` : décision sur l'invitation (`decision`, `decision_signature_id`), fonctions `confirmer_signature`, `mettre_a_jour_entreprise`, `retirer_signature_admin`, `retablir_signature` et `traiter_commentaire` (admins actifs seulement, journalisées), et nouvelle version d'`enregistrer_signature` qui refuse un lien rejeté. Testée deux fois de suite sur PostgreSQL 16, avec chaque décision, le refus sans session d'admin, le refus d'une nouvelle signature après un rejet, le rétablissement et la date limite.
- Rubrique CEO, onglet « À vérifier » : modification (comparaison champ par champ, empilée sur téléphone ; « Marquer comme vérifié », « Mettre à jour l'entreprise »), nouvel inscrit (« Valider », puis « Prévenir sur WhatsApp » ; « Refuser »), doublon d'entreprise (les deux signatures côte à côte ; « Garder les deux », « Retirer cette signature ») ; retrait ou refus avec confirmation et motif facultatif ; filtre « Traités » avec la décision, l'admin et la date. Nombre de cas à côté de « CEO » dans la navigation, en argile (D89, D90).
- Onglet « Commentaires » : regroupés par paragraphe, filtres par statut, statut et note interne, avertissement avant « Intégré » après le gel (D92). Fiche du CEO : état de vérification, raccourci vers le cas, « Rétablir », commentaires. Côté CEO : « Votre signature n'a pas été retenue », accusé toujours téléchargeable (D91). Tests vitest : 82.
- Prompt 06, audit avant l'envoi des liens : parcours admin et CEO relus dans le code et rejoués dans un navigateur (05, 05.2, 05.3, 07), audit de sécurité table par table, bucket par bucket, fonction par fonction et route par route, cohérence des libellés et règles de rédaction, 17 écrans à 5 tailles, accessibilité, contrastes, charte, performance de l'espace CEO remesurée.
- Migration `0007_audit.sql` : références de signature et séquence réservées à la clé secrète, numérotation au-delà de 9999 sans troncature, droits d'exécution retirés à `anon` sur les fonctions d'admin, signatures jamais supprimées, versions du texte immuables, journal écrit au nom de l'admin connecté seulement, verrou contre le retrait simultané des deux derniers admins, clé anti-doublon obligatoire, refus des changements après la publication, buckets privés avec taille et format limités (D94). Testée deux fois de suite sur PostgreSQL 16.
- Correctifs du code relevés par l'audit (D95, D97, D98) : photo (envoi limité avant lecture, deux envois simultanés, retrait toujours possible), accords de la fiche donnés seulement avec une signature active, limite de 30 commentaires par heure et double clic absorbé, signature retirée renvoyée sans être réenregistrée, page « Le service est momentanément indisponible » au lieu d'un faux « lien non valide », aperçu WhatsApp sans aucune lecture en base, accusé encore téléchargeable après un refus, envoi et relance comptés une seule fois en cas de double clic, taille du Word décompressé limitée, aucun Referer depuis `/auth/confirm`.
- Charte : bandeau de coupure réseau en encre, icônes et pastilles neutres, l'argile réservée à « à vérifier » et aux champs modifiés (D99).
- Message « Prévenir sur WhatsApp » après la validation d'un nouvel inscrit : il contient le lien personnel (D93).
- Script `supabase/seed/9000_nettoyage_donnees_test.sql` : aperçu d'abord, puis suppression des entreprises de test en une transaction, séquence des références remise à MSP-2026-0001 s'il ne reste aucune signature, journal intact (D96). Testé sur PostgreSQL 16 avec une entreprise réelle qui reste intacte. Tests vitest : 83.
- Prompt 06.1, interface : marque commune (`src/components/marque.tsx`) avec le nom complet sur deux lignes, dans la barre latérale de l'admin (élargie à 240 px), en tête de page de l'admin sur téléphone et dans l'en-tête de l'espace CEO ; « Signature avant le … » (CalendarClock) à droite sur ordinateur, seulement avant la signature et la date limite (D103, D104).
- Liste des CEO : maillon sur sa ligne, numéro entier sur la suivante (icône Phone, chiffres tabulaires) ou « Sans téléphone » ; colonnes du tableau à partir de 1200 px, lignes empilées en dessous (D104).
- Barre d'étapes : sur ordinateur, bouton « Aide sur cette étape » et bulle dans un portail (survol, focus, toucher ; Échap et clic ailleurs), bouton d'action relié au texte par aria-describedby ; sur téléphone, l'aide sous l'action ; une seule ligne dès 820 px (D104).
- Messages WhatsApp mis en forme (D101) : nouveau modèle d'origine, « *Petit rappel.* » sur sa ligne, message après validation en paragraphes, lien ouvert, lien personnel envoyé à soi-même, invitation d'un confrère, liens d'admin ; données insérées neutralisées (*, _, ~, `) ; aperçu fidèle en éléments React dans la fenêtre d'envoi, la file de relance, Réglages, Messages et après une validation. Seed `0002_modele_message_whatsapp.sql`, testé deux fois de suite.
- Nom complet partout : textes des accords de la fiche complétés (D103) ; recherche dans `src/` jointe au rapport.
- Inscription par le lien ouvert : clé anti-doublon (migration `0008_inscription_anti_doublon.sql`, D102), testée deux fois de suite sur PostgreSQL 16 avec la même clé (une seule invitation) et deux clés (deux invitations, comme avant). Tests vitest : 90.
- Prompt 06.2 : date limite affichée en heure de Dakar et d'Abu Dhabi, par une seule fonction (`formaterDateLimiteComplete` dans `src/lib/ceo/message.ts`, forme longue et forme courte), dans les messages, l'en-tête et la colonne de l'espace CEO, « Refaire » et « Retirer », Réglages (aperçu en direct sous le champ) ; message de partage du lien ouvert au nom de la Task Force, avec aperçu ; compteur et extrait de l'annexe de la rubrique CEO l'un sous l'autre sous 1200 px (D105 à D107). Aucune migration. Tests vitest : 91.
- Prompt 09a, doléances privées (D108, D109, D110) : migration `0009_doleances.sql` et seed `0003_themes_doleances.sql`, testés deux fois de suite sur PostgreSQL 16 (dépôt, renvoi avec la même clé, droit de dépôt, longueurs, thème désactivé, limite par jour, ouverture et clôture, contenu figé, suppression par l'auteur seulement, RLS : rien pour anon ni pour un utilisateur non admin, journal sans le texte).
- Espace CEO : carte « Vos doléances » après la signature et les commentaires (formulaire dans une fenêtre, compteurs, « Ne jamais la publier, même sans nom », clé anti-doublon, liste et suppression, rappel « Pensez aussi à signer le Manifeste », phrase de clôture) ; confidentialité complétée. Aucune carte pour un nouvel inscrit non validé, un lien refusé, avant le gel, ou sans la migration 0009.
- Admin : rubrique « Doléances » entre CEO et Réglages avec la pastille des non lues ; liste filtrable (thème, lecture, auteur) et triée par date ; fiche dans un panneau (marquer comme lue ou non lue, rattacher une doléance « Autre », lien vers la fiche CEO par `/admin/ceo?fiche=`) ; onglet Thèmes (créer, renommer, réordonner, désactiver) ; export CSV pour Excel noté au journal ; Réglages, onglet Manifeste : « Clôture des doléances » avec la forme longue en direct. Tests vitest : 103.
- Prompt 09a.1 : « Proposition de solution » partout (formulaire du CEO : « Votre proposition de solution (facultatif) » avec une aide, liste du CEO, fiche admin, export, confidentialité, messages d'erreur) ; « 1er » pour le premier jour du mois dans toutes les dates en lettres (`formaterAvecPremier` dans `src/lib/dates.ts`, utilisée aussi par la date limite) ; D111 et D112 ; feuille de route après le 23 novembre. Aucune migration. Tests vitest : 105.
- Prompt 08, document final (D113 à D116) : migration `0010_document_final.sql`, testée deux fois de suite sur PostgreSQL 16 (réglages, clôture, signature refusée après la clôture, réouverture avec une date passée puis à venir, signataires sur place ajoutés, corrigés et retirés par la clé secrète seulement, publication avec le PDF présent, plus rien ne change après, droits refusés à anon et aux non-admins).
- Rubrique « Document A4 » (Texte, CEO, Doléances, Document A4, Réglages) : aperçu complet avec toutes les signatures (D75), réglages de l'annexe enregistrés, pages du texte et de l'annexe, trois impressions A4 strictes (`/impression/texte`, `/impression/annexe`, `/impression/complet`, l'annexe seule numérotée à la suite du texte), mode d'emploi du 9 décembre, signataires sur place (photo recadrée, mise sur fond blanc et compressée dans le navigateur), document publié téléchargeable.
- Barre d'étapes : « Clore les signatures » (aussi après la date limite sans clic), « Rouvrir » avec une nouvelle date en heure de Dakar et d'Abu Dhabi, « Publier » (impression du document complet, dépôt du PDF vérifié, confirmation). Espace CEO : « Les signatures sont closes depuis le … », annexe selon les réglages, document final publié avec toutes les signatures et « Télécharger le document final » (le PDF stocké), partage sans lien personnel. Impressions vérifiées dans Chromium (PDF A4, une feuille par page, numérotation, aucun intertitre seul). Tests vitest : 112.
- Prompt 08, complément (D117) : annexe et impressions disponibles dès le gel (rédaction : texte seul, expliqué), mise à jour en continu de la rubrique Document A4 toutes les 30 secondes quand l'onglet est visible (« Mis à jour à … », « Actualiser »), rappel de l'export des signatures pour la sauvegarde du soir.
- Prompt 08.1 (D118) : pied de page avec le numéro seul, sans total ; noms accessibles « Page 1 », « Page 6, annexe des signataires ». Vérifié en impression réelle dans Chromium : texte seul (page 1), puis annexe seule avec 15 signatures de plus (pages 2 à 6), puis document complet (1 à 6), sans rupture ni total. Aucune migration.

- Prompt R1, refonte de l'admin partie 1 (D119 à D122) : jetons partagés (rayons, ombres, fonds de l'admin, chiffre clé) ; cadre de l'admin : panneau flottant (navigation avec « Tableau de bord », « Journal », bloc du compte), « À faire maintenant » (À vérifier, À relancer, Doléances, Export du soir : valeurs réelles, chaque raccourci mène où agir, avec les filtres `?filtre=ouvert` de la rubrique CEO et `?lecture=non_lues` des doléances), barre d'étapes flottante, barre basse flottante du téléphone (Accueil, Texte, CEO, Doléances, Plus). Page « Tableau de bord » (`/admin`) : vue d'ensemble et ligne d'état, réservoir d'eau animé (immobile si mouvement réduit), parcours des liens, clôture, taux de signature en arc, doléances par thème, dernières actions, actualisation toutes les 30 secondes ; état propre avant le gel. Document A4 : « Exporter en PDF », « Texte seul », « Annexe seule » en tête de rubrique, même libellé dans la fenêtre de publication et la page d'export. Aucune migration, aucune dépendance. Tests vitest : 118.

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
| 0005 | `supabase/migrations/0005_espace_ceo.sql` | Bucket privé `accuses`, table `inscriptions_ouvertes` (empreintes), fonctions `inscrire_par_lien_ouvert`, `retirer_signature` et `enregistrer_brouillon` (clé secrète seulement) | Oui (15 novembre 2026) |
| 0006 | `supabase/migrations/0006_verification.sql` | Décision de l'admin sur l'invitation, fonctions de vérification et de traitement des commentaires (admins actifs, journalisées), signature refusée après un rejet | Oui (15 novembre 2026) |
| 0007 | `supabase/migrations/0007_audit.sql` | Correctifs de l'audit 06 : droits des fonctions et de la séquence, signatures et versions jamais supprimées, journal au nom de l'admin, verrou du dernier admin, clé anti-doublon obligatoire, document publié protégé, limites des buckets | Oui (confirmée au prompt 06.1) |
| seed 9000 | `supabase/seed/9000_nettoyage_donnees_test.sql` | Nettoyage des données de test avant l'envoi des liens, doléances comprises depuis le prompt 09a, signataires sur place des entreprises de test depuis le prompt 08 (avec la liste de leurs photos dans le bucket signatures) (aperçu, puis `confirmer` à `true`). Exécuté par Ziza seulement, jamais par Claude Code | Non |
| 0008 | `supabase/migrations/0008_inscription_anti_doublon.sql` | Clé anti-doublon de l'inscription par le lien ouvert (`invitations.cle_inscription`, unique), fonction `inscrire_par_lien_ouvert` avec la clé | Oui (confirmée au prompt 09a) |
| seed 0002 | `supabase/seed/0002_modele_message_whatsapp.sql` | Modèle du message WhatsApp mis en forme, seulement si le modèle en base est encore l'ancien modèle d'origine (à exécuter après 0008) | Oui (confirmée au prompt 09a) |
| 0009 | `supabase/migrations/0009_doleances.sql` | Doléances privées : clôture des doléances sur le Manifeste, tables `doleance_themes` et `doleances` (contenu figé, clé anti-doublon unique), RLS admins seuls avec droits limités aux colonnes utiles, fonctions du CEO (clé secrète) et des admins (session), journal sans le texte | Oui (confirmée au prompt 08) |
| seed 0003 | `supabase/seed/0003_themes_doleances.sql` | Les 6 thèmes de départ, seulement si aucun thème n'existe (à exécuter après 0009) | Oui (confirmée au prompt 08) |
| 0010 | `supabase/migrations/0010_document_final.sql` | Document final : réglages de l'annexe sur le Manifeste, bucket privé `signatures`, signatures figées (sauf un signataire sur place corrigé quand le Manifeste est clos ; plus rien après la publication), fonctions clore, rouvrir, publier, régler l'annexe (session d'admin) et signataires sur place (clé secrète) | Oui (confirmée au prompt R1) |

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
| Confirmation de la clôture des doléances | Avant la publication | Fourni : le 31 décembre 2026 à 23 h 59, heure de Dakar (D111) |
| Test du modèle Word après passage dans Google Docs | Avant le prompt 03 | À fournir |
| Thèmes de doléances issus des tables du déjeuner du 22 octobre (à défaut, les 6 thèmes de départ, D23) | Avant la publication | À fournir |

---

## Problèmes ouverts

- Fichiers importés puis abandonnés sans cliquer sur « Annuler » : ils restent dans le bucket `imports` (quelques dizaines de Ko chacun). Un nettoyage pourra être ajouté si besoin.

- « Mot de passe oublié » par email : le fournisseur email par défaut de Supabase n'envoie qu'aux membres du projet Supabase. Pour les autres admins, utiliser « Générer un lien de réinitialisation » (D16) tant qu'aucun SMTP n'est configuré sur le domaine définitif.

- Un admin connecté peut écrire directement dans les tables par l'API de Supabase (RLS « admin peut tout »), sans passer par les fonctions journalisées. À restreindre dans un lot dédié, après le 23 novembre.
- Les jetons apparaissent dans les journaux d'accès de Vercel (adresse de la page) : accès réservé au compte Vercel.
- La limite d'inscriptions par heure du lien ouvert repose sur l'adresse IP : un changement d'adresse la contourne (protection anti-spam, pas une barrière).
