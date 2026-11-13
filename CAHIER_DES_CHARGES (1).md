# Cahier des charges : plateforme du Manifeste du secteur privé sénégalais de l'eau et de l'assainissement

Version 1, 13 novembre 2026. Ce document est la référence fonctionnelle du projet. Les prototypes validés dans `docs/prototypes/` en sont la référence visuelle et comportementale. En cas d'écart entre les deux, signaler l'écart et ne rien trancher seul.

---

## 1. Contexte et objectif

Le « Manifeste du secteur privé sénégalais de l'eau et de l'assainissement » sera présenté à la Conférence des Nations Unies sur l'eau, à Abu Dhabi, en décembre 2026. Tous les dirigeants (CEO) des entreprises concernées ne seront pas sur place.

La plateforme sert d'abord à :

1. publier le texte du Manifeste, rédigé en dehors de la plateforme (Google Docs) ;
2. recueillir à distance la signature de chaque CEO, au nom de son entreprise ;
3. produire le document final A4 : le texte, puis l'annexe des signataires (nom, fonction, entreprise, maillon, signature en grand).

Elle deviendra ensuite la plateforme durable du secteur privé de l'eau et de l'assainissement : cahier de doléances, annuaire des membres, puis d'autres pays. Le modèle de données doit donc être générique dès le départ (entreprises et personnes séparées, pays sur chaque entité concernée).

## 2. Calendrier

| Date | Étape |
|---|---|
| Vendredi 20 novembre 2026 | Gel du texte (validation finale) |
| Lundi 23 novembre 2026 | Envoi des liens aux CEO |
| Mercredi 2 décembre 2026, 23:59 (Dakar, UTC+0) | Clôture des signatures |
| Jeudi 3 décembre 2026 | PDF final |
| Vendredi 4 décembre 2026 | Impression à Dakar |
| Conférence d'Abu Dhabi | Remise du Manifeste, signatures manuscrites possibles sur place |
| Après Abu Dhabi | Publication du document final, ouverture du cahier de doléances |
| 8 janvier 2027 (provisoire) | Clôture du cahier de doléances |

## 3. Acteurs

| Acteur | Accès | Rôle |
|---|---|---|
| Admin | Compte (email et mot de passe) | Importe le texte, gère les CEO, envoie les liens, vérifie, publie. Plusieurs admins possibles, au moins un admin actif en permanence. |
| CEO | Lien personnel, sans compte | Lit, commente, signe, complète sa fiche, dépose des doléances. |
| Rédacteurs | Aucun accès à la plateforme | Écrivent dans le Google Doc partagé. |
| Ministère et partenaires | Aucun accès pour l'instant | Ils ne signent pas le Manifeste. Un rôle « Observateur » en lecture seule pourra être ajouté plus tard. |

Les messages et l'espace CEO parlent au nom de « la Task Force du secteur privé sénégalais de l'eau et de l'assainissement », la seule structure annoncée aux CEO lors du déjeuner du 22 octobre 2026. Le Manifeste lui-même (document imprimé et publié) ne mentionne pas la Task Force.

## 4. Cycle de vie du Manifeste

`redaction` → `gele` → `clos` → `publie`

- **Rédaction** : les imports Word créent des versions successives. Les liens CEO ne sont pas encore actifs.
- **Gelé** : la version gelée est celle que les CEO signent. Seules des corrections mineures restent possibles (coquille, ponctuation). Une correction mineure crée une nouvelle version de type `correction_mineure` et n'annule jamais les signatures déjà recueillies.
- **Clos** : plus aucune signature. Après la date limite, le serveur refuse toute signature, même si aucun admin n'a cliqué sur « Clore ».
- **Publié** : le document final est visible par les CEO sur leur lien. Le cahier de doléances s'ouvre.

## 5. Le texte

### 5.1 Rédaction et import

- Le texte s'écrit dans un Google Doc partagé, créé à partir du modèle `docs/prototypes/Modele_Manifeste_GoogleDoc.docx`.
- L'admin télécharge le Google Doc en Word (.docx) et l'importe. La plateforme lit les styles et applique sa propre mise en page.
- Correspondance des styles : Titre → titre ; Sous-titre → sous-titre ; Titre 1 → intertitre ; Titre 2 → accroche ; Titre 3 → mention finale ; liste numérotée → engagement ou demande numérotée ; reste → paragraphe. Le gras est conservé. Les images, les tableaux et les commentaires sont ignorés.
- L'import est bloqué s'il reste des suggestions (modifications non acceptées) ou s'il n'y a pas de style Titre. Des avertissements non bloquants signalent les titres de niveau 4 et plus, et les paragraphes entièrement en gras.
- Avant validation, un écran « Vérifier l'import » montre ce qui a été reconnu, les changements par rapport à la version précédente et les avertissements.

### 5.2 Versions

- Chaque import validé crée une version numérotée, avec un résumé automatique des changements. Aucun nom de version à saisir.
- Les blocs gardent un identifiant stable d'une version à l'autre (alignement par plus longue sous-séquence commune), pour que les commentaires restent attachés au bon paragraphe.
- On peut comparer deux versions et restaurer une version antérieure (tant que le texte n'est pas gelé).

### 5.3 Mise en page A4

- Format A4 strict, identique à l'écran, au PDF et à l'impression.
- Le texte s'enchaîne sur autant de pages que nécessaire, sans intertitre orphelin en bas de page.
- L'annexe des signataires commence toujours sur la page qui suit la dernière page de texte.
- Colonnes de l'annexe : N°, Entreprise, Maillon, Nom et fonction du signataire, Signature (en grand).
- Réglages de l'annexe : ordre (entreprise, maillon, nom ou date), lignes par page (8, 10 ou 15), lignes vides en fin d'annexe (0, 5 ou 10) pour les signatures manuscrites à Abu Dhabi.
- PDF : rendu par l'impression du navigateur au format A4 (`@page`), sans génération lourde côté serveur.

## 6. Les CEO

### 6.1 La liste

- Import d'un fichier Excel ou CSV (la liste du déjeuner du 22 octobre, la cartographie par maillon). Les colonnes sont reconnues par leur titre (entreprise, prénom, nom, fonction, maillon, téléphone). Pas de saisie manuelle un par un, sauf ajout ponctuel.
- Lignes signalées à l'import : déjà dans la liste, sans téléphone, maillon à préciser, dirigeant à préciser.
- Les informations importées sont conservées telles quelles (instantané « liste ») pour comparaison.

### 6.2 Les liens

- **Lien personnel** `/s/[jeton]` : un par CEO, jeton aléatoire d'au moins 16 caractères. Il donne le droit de signer au nom d'une entreprise : il ne doit jamais être devinable.
- **Lien ouvert** `/rejoindre` avec QR code : pour les CEO qui ne sont pas dans la liste. L'admin peut le mettre en pause. Protection contre les abus : limite de tentatives et piège anti-robot.
- **Lien de parrainage** `/rejoindre?par=[code]` : le CEO qui a signé invite un confrère. Le parrain est enregistré.

### 6.3 Envoi et relance

- Envoi par WhatsApp (`wa.me` avec message prérempli), pas par email. Un clic par CEO, depuis l'appareil de l'admin. Un numéro dédié est recommandé.
- Modèle de message modifiable dans les réglages, avec les variables `{prenom}`, `{lien}` et `{date_limite}`. Il est signé par la Task Force.
- Suivi par CEO : à envoyer, envoyé, ouvert, signé, avec les dates et le nombre de relances. File de relance « un par un ».

### 6.4 Vérification (« À vérifier »)

- Les informations saisies par le CEO priment toujours sur la liste.
- Si elles sont identiques à la liste, la signature est validée automatiquement (réglage activable).
- Sinon, la signature arrive dans « À vérifier » dans trois cas :
  - **modification** : liste et saisie affichées côte à côte, champ par champ ;
  - **nouveau** (lien ouvert) : l'admin valide, ce qui ouvre WhatsApp avec le lien personnel du nouveau CEO ;
  - **doublon** : l'entreprise a déjà une signature. Une seule signature par entreprise est recommandée, mais l'admin peut garder les deux.
- La signature d'un nouveau inscrit n'entre dans l'annexe qu'après validation.

### 6.5 Commentaires

- Un CEO identifié peut commenter un paragraphe ou le texte en général. Sur le lien ouvert, le commentaire n'est possible qu'après l'étape 1 de la signature.
- Les commentaires ne sont lus que par l'équipe de rédaction (les admins), jamais par les autres CEO.
- Traitement par l'admin : nouveau, retenu pour la suite, intégré, non retenu, avec une note. Intégrer un commentaire après le gel déclenche un avertissement.

## 7. L'espace CEO

### 7.1 Principes

- **La signature passe en premier.** Tout le reste (fiche, photo, consentements, invitation d'un confrère) est facultatif et vient après.
- Responsive : mise en page téléphone et mise en page ordinateur (voir `2-ceo.html`, sélecteur « Téléphone / Ordinateur »).
- La page indique qui l'envoie (la Task Force) et propose deux liens en bas de page : « Une question ? », qui ouvre WhatsApp vers le numéro de la Task Force, et « Confidentialité ».

### 7.2 Lecture

- Deux affichages : « Lecture » (texte adapté à l'écran) et « Page A4 » (rendu exact, avec zoom).
- Mention de la version et de la date limite.

### 7.3 Signature en trois étapes

1. **Vos informations** : prénom, nom, fonction, entreprise (nom officiel), maillon, téléphone WhatsApp ; « Qui vous a invité ? » sur le lien ouvert. Préremplies pour un CEO de la liste ; les champs modifiés sont signalés, avec la mention « C'est votre version qui sera retenue ». Sur le lien ouvert, la fiche est créée à la fin de cette étape.
2. **Votre signature** : tracé au doigt ou à la souris, enregistré en vectoriel (`{vb, d[]}`). Sur ordinateur, un bouton « Signer sur mon téléphone » affiche un QR code vers le lien personnel ; les informations de l'étape 1 sont conservées et la page de l'ordinateur se met à jour dès que la signature est faite sur le téléphone.
3. **Vérifiez et signez** : aperçu de sa ligne d'annexe telle qu'elle sera imprimée, case de consentement obligatoire (texte réglable par l'admin), bouton « Je signe le Manifeste ».

### 7.4 Après la signature

- **Le moment fort** : la ligne du CEO s'inscrit dans l'annexe, entre ses voisins, et sa signature se trace à l'encre.
- Accusé de signature (référence au format `MSP-2026-0001`, date, version signée), téléchargeable en PDF.
- Fiche facultative : photo (recadrée en carré, 400 px) et trois consentements indépendants :
  - être recontacté pour la suite de la démarche ;
  - figurer dans l'annuaire, réservé aux membres, avec sa photo ;
  - utiliser sa photo dans la communication autour du Manifeste (seulement si une photo est fournie).
- Inviter un confrère (WhatsApp et copie du lien de parrainage).
- Refaire ou retirer sa signature jusqu'à la clôture.

### 7.5 Coupures réseau

- Si la connexion coupe au moment de signer, la signature est gardée sur l'appareil, puis envoyée dès que le réseau revient.
- Une clé anti-doublon garantit qu'une signature renvoyée n'est jamais enregistrée deux fois.

### 7.6 Après la clôture et après la publication

- Après la clôture : lecture seule.
- Après la publication : document final avec l'annexe, partage et téléchargement, accès au cahier de doléances.

## 8. Signataires sur place à Abu Dhabi

- L'exemplaire imprimé peut comporter des lignes vides pour des signatures manuscrites.
- Après Abu Dhabi, l'admin ajoute ces signataires (nom, fonction, entreprise, maillon, photo de la signature recadrée) avant la publication, pour que le document final publié soit complet.

## 9. Cahier de doléances (décembre)

- Ouvert à la publication, sur les mêmes liens personnels. Clôture provisoire le 8 janvier 2027.
- Une doléance : thème, texte (500 caractères au plus), solution proposée (facultative).
- Les doléances publiées sont visibles par les autres CEO, sans nom ni entreprise. Chacun peut « soutenir » une doléance existante plutôt que de la réécrire ; les doléances du même thème s'affichent pendant la rédaction.
- Chaque doléance est validée par un admin avant d'être visible.
- Thèmes de départ : Accès aux marchés publics, Délais de paiement, Financement et garanties, Normes et réglementation, Formation et compétences, Contenu local. Un CEO peut choisir « Autre » et proposer un thème ; les admins créent, renomment, fusionnent ou rattachent les thèmes.
- Classement par nombre de soutiens et export.

## 10. Espace admin

Navigation : Texte, CEO, Doléances, Document A4, Réglages. Une barre d'étapes (Rédaction, Gel, Signatures, Publication) reste visible en haut et propose toujours la seule action suivante (Geler, Clore, Publier).

Réglages :
- **Manifeste** : date limite, lien du Google Doc, validation automatique, texte de consentement, maillons ;
- **Admins** : inviter, couper ou rétablir un accès, générer un lien de réinitialisation ;
- **Messages** : modèle WhatsApp ;
- **Journal** : historique des actions.

Sauvegarde : bouton « Exporter les signatures » (fichier avec les noms, entreprises, maillons, dates et signatures), à utiliser chaque soir pendant la campagne. Le plan gratuit de Supabase ne fournit pas de sauvegarde téléchargeable.

### Connexion des admins

- Email et mot de passe (10 caractères minimum). Un appareil reste connecté 30 jours.
- Les inscriptions publiques sont désactivées dans Supabase.
- Invitation d'un admin et réinitialisation d'un mot de passe par **lien généré** (copier ou envoyer sur WhatsApp), sans dépendre de l'email. « Mot de passe oublié » par email fonctionnera pour tous une fois un SMTP configuré sur le domaine définitif.

## 11. Référentiels

**Maillons**, dans cet ordre :

| Maillon | Description |
|---|---|
| Études | Bureaux d'études, ingénierie, conception, maîtrise d'œuvre |
| Production | Forage, captage, mobilisation de la ressource |
| Transport et distribution | Réseaux, canalisations, matériels hydrauliques, génie civil |
| Traitement et valorisation | Assainissement, traitement des effluents, réutilisation |
| Axes transversaux | Activités au service de toute la chaîne |

**Texte de consentement par défaut** : « J'accepte que mon nom, ma fonction, le nom de mon entreprise et ma signature figurent dans le Manifeste et dans sa diffusion publique. »

## 12. Données et confidentialité

- Données collectées : nom, fonction, entreprise, maillon, numéro WhatsApp, signature ; si le CEO le choisit : photo, commentaires, doléances.
- Publié avec le Manifeste : nom, fonction, entreprise, maillon, signature. Jamais publiés : téléphone, commentaires, auteur d'une doléance.
- Chaque consentement est historisé avec le texte exact présenté et la date ; l'état courant est le plus récent.
- Page « Confidentialité » accessible depuis l'espace CEO : ce qui est collecté, pourquoi, qui le voit, les droits du CEO. Mention : « Plateforme gérée par Aziz Fall pour le compte de la Task Force du secteur privé sénégalais de l'eau et de l'assainissement, dans le respect de la loi sénégalaise sur la protection des données personnelles. »
- Les comptes (domaine, GitHub, Supabase, Vercel) sont au nom du gestionnaire de la plateforme. Le transfert à la future structure collective se fera par contrat.

## 13. Modèle de données

Tables principales (détail dans `architecture.md` après le prompt 1) :

- `pays`, `maillons`
- `entreprises` (pays, nom, nom normalisé pour détecter les doublons, maillon)
- `personnes` (pays, entreprise, prénom, nom, fonction, téléphone, email, photo)
- `consentements` (historique par personne et par type : signature publique, recontact, annuaire, photo pour la communication)
- `admins` (utilisateur, actif, au moins un admin actif garanti en base)
- `manifestes` (titre, sous-titre, statut, date limite, version gelée, lien ouvert, validation automatique, texte de consentement, modèle WhatsApp, lien du Google Doc)
- `manifeste_versions` (numéro, type, blocs, résumé des changements, fichier source)
- `invitations` (jeton, origine liste, lien ouvert ou parrainage, code de parrainage, parrain, instantané « liste », saisie du CEO, statut d'envoi, état et motif de vérification)
- `signatures` (version signée, informations imprimées figées, tracé vectoriel, texte de consentement, référence, clé anti-doublon, date de retrait ; une seule signature active par invitation)
- `commentaires` (bloc visé, texte, statut de traitement, note)
- `journal` (acteur, action, cible, détails ; jamais modifié)
- En décembre : `doleances`, `doleance_themes`, `doleance_soutiens`

Sécurité : RLS sur toutes les tables. Les admins actifs passent par les politiques ; les CEO n'ont aucun accès direct, toutes leurs actions passent par des routes serveur qui valident le jeton. Stockage privé uniquement (imports, photos, exports).

## 14. Design

Direction : **solennel, posé, chaleureux**. L'univers est celui du document officiel imprimé : le papier, l'encre, le filet doré.

- Polices : Fraunces (titres), Jost (interface). Document : Georgia et Calibri, avec Gelasio et Carlito comme équivalents libres.
- Couleurs : un seul accent, le bleu eau profonde `#1D4E5C`. L'argile `#B5653A` est réservée à « à vérifier » et aux champs modifiés. Le vert et le rouge ne servent qu'au sens (succès, erreur).
- Fonds : papier chaud `#F7F3EA` dans l'espace CEO ; fond neutre `#F7F7F6` dans l'admin, où l'on passe des heures.
- Charte du document : vert `#0E4B3A`, or `#C2A14D`, gris `#6A736E`.
- Le moment fort : la page A4 et l'annexe. Côté CEO, sa ligne qui s'inscrit après la signature ; côté admin, l'annexe qui se remplit à côté du compteur de signatures.
- Le texte se présente comme une feuille imprimée (ombre douce, coins presque droits).
- Verre dépoli uniquement sur les barres fixes (en-tête, barre de signature, barre d'étapes), jamais sur les cartes ni sur le document.
- Grille de 4 px. Petits titres en casse normale, jamais en majuscules espacées (sauf dans la page A4, qui suit la charte du document).
- Icônes lucide uniquement, une taille, un trait. Aucun emoji.
- Animations Framer Motion, sobres : une seule courbe `cubic-bezier(0.22, 1, 0.36, 1)`, et respect de `prefers-reduced-motion`.

## 15. Règles de rédaction de l'interface

- Français partout.
- Aucun tiret long ni demi-cadratin : utiliser deux-points, virgules ou parenthèses.
- Écrire « secteur privé sénégalais de l'eau et de l'assainissement ». Ne jamais écrire « WASH », « réseau », « alliance » ni « continental ». Écrire UNIDO, pas ONUDI.
- Pas de point d'exclamation dans l'interface. Pas de point final sur les titres, boutons et libellés courts.
- Ne jamais inventer d'information, de chiffre ou de citation.

## 16. Technique

- Next.js (App Router), TypeScript strict, Tailwind, Supabase (`@supabase/ssr`), Vercel (fonctions à Paris, `cdg1`), Framer Motion, lucide-react, zod.
- Fuseau d'affichage : Africa/Dakar.
- Variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (serveur uniquement), `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`.
- Maintien en éveil de Supabase : tâche planifiée Vercel tous les 6 jours.
- Méthode de travail :
  - un prompt à la fois, avec relecture de ce cahier des charges et des 4 fichiers mémoire (`architecture.md`, `claude.md`, `decisions.md`, `project_state.md`) ;
  - `npm run build` sans erreur, checklist, commit et push sur `main` ;
  - zéro placeholder, et arrêt avec signalement en cas de doute ;
  - les migrations SQL sont écrites dans `supabase/migrations/` et collées à la main dans le SQL Editor (pas de CLI Supabase) ;
  - rien n'est exécuté en local par le porteur du projet.

## 17. Découpage en prompts

| N° | Contenu | À livrer avant |
|---|---|---|
| 1 | Fondations : base de données, connexion et gestion des admins, journal, design de base | 15 novembre |
| 2 | Texte : import Word, versions, comparaison, page A4, gel et corrections mineures | 17 novembre |
| 3 | Liste des CEO : import Excel ou CSV, liens personnels, envoi et relance WhatsApp, lien ouvert et QR code | 19 novembre |
| 4 | Espace CEO : lecture, signature en 3 étapes, moment de l'annexe, accusé, fiche, confidentialité, coupures réseau, signature depuis le téléphone | 21 novembre |
| 5 | Vérification, commentaires, export des signatures | 25 novembre |
| 6 | Document final : PDF A4, clôture, publication, signataires sur place | 2 décembre |
| 7 | Cahier de doléances | décembre |

## 18. Hors périmètre pour l'instant

- Rôle « Observateur » (Ministère, partenaires) en lecture seule.
- Annuaire consultable par les membres (les consentements sont déjà recueillis).
- Version anglaise du Manifeste.
- Autres pays.
- Envoi automatique de messages WhatsApp (API).

## 19. Points encore ouverts

- Domaine définitif, actif avant le 23 novembre.
- Numéro WhatsApp dédié de la Task Force.
- Liste du déjeuner avec les numéros WhatsApp, avant le 20 novembre.
- Accord du groupe de la Task Force pour l'envoi des liens en son nom.
- Validations du texte avec Khadija : formulations sur l'Afrique (le Manifeste est sénégalais), sources des chiffres 9 % et 90 %, sens de « c'est un précédent », date de la mention finale.
- Confirmation de « Axes transversaux » comme cinquième maillon et de la clôture des doléances au 8 janvier 2027.
- Test du modèle Word après passage dans Google Docs.
