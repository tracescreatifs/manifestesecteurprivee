/*
  Types de la base, écrits à la main (pas de génération automatique).
  Ils suivent exactement supabase/migrations/0001_fondations.sql.
  À mettre à jour dans le même prompt que toute nouvelle migration.
*/

export type Json = string | number | boolean | null | { [cle: string]: Json | undefined } | Json[];

/* ----- Énumérations ----- */

export type StatutManifeste = "redaction" | "gele" | "clos" | "publie";
export type TypeVersion = "redaction" | "correction_mineure";
export type OrigineInvitation = "liste" | "lien_ouvert" | "parrainage";
export type StatutEnvoi = "a_envoyer" | "envoye" | "ouvert" | "signe";
export type EtatVerification = "aucune" | "a_verifier" | "valide" | "rejete";
/* Migration 0006 : décision de l'admin sur une signature à vérifier (ou sur toute signature, pour le retrait) */
export type DecisionVerification =
  | "verifiee"
  | "validee"
  | "deux_gardees"
  | "entreprise_mise_a_jour"
  | "retiree"
  | "refusee"
  | "retablie";
export type MotifVerification = "modification" | "nouveau" | "doublon";
export type OrigineSignature = "en_ligne" | "sur_place";
export type TypeConsentement = "signature_publique" | "recontact" | "annuaire" | "photo_communication";
export type StatutCommentaire = "nouveau" | "retenu" | "integre" | "non_retenu";
export type TypeActeur = "admin" | "ceo" | "systeme";
/* Doléances (0009) : seul « recue » est utilisé au prompt 09a ; « publiee » et « masquee » serviront au prompt 09b */
export type StatutDoleance = "recue" | "publiee" | "masquee";

/* ----- Structures JSON ----- */

/* Bloc du texte : types titre, sous, h, accroche, mention, p, li */
export type TypeBloc = "titre" | "sous" | "h" | "accroche" | "mention" | "p" | "li";
export type Bloc = { id: string; type: TypeBloc; html: string };

/* Signature vectorielle : viewBox et liste de tracés SVG */
export type TraceSignature = { vb: string; d: string[] };

/* ----- Base ----- */

export type Database = {
  public: {
    Tables: {
      pays: {
        Row: {
          code: string;
          nom: string;
          cree_le: string;
          modifie_le: string;
        };
        Insert: {
          code: string;
          nom: string;
          cree_le?: string;
          modifie_le?: string;
        };
        Update: {
          code?: string;
          nom?: string;
          cree_le?: string;
          modifie_le?: string;
        };
        Relationships: [];
      };
      maillons: {
        Row: {
          id: string;
          libelle: string;
          description: string | null;
          ordre: number;
          actif: boolean;
          cree_le: string;
          modifie_le: string;
        };
        Insert: {
          id?: string;
          libelle: string;
          description?: string | null;
          ordre: number;
          actif?: boolean;
          cree_le?: string;
          modifie_le?: string;
        };
        Update: {
          id?: string;
          libelle?: string;
          description?: string | null;
          ordre?: number;
          actif?: boolean;
          cree_le?: string;
          modifie_le?: string;
        };
        Relationships: [];
      };
      entreprises: {
        Row: {
          id: string;
          pays_code: string;
          nom: string;
          nom_normalise: string | null;
          maillon_id: string | null;
          telephone: string | null;
          email: string | null;
          site_web: string | null;
          cree_le: string;
          modifie_le: string;
        };
        Insert: {
          id?: string;
          pays_code?: string;
          nom: string;
          nom_normalise?: string | null;
          maillon_id?: string | null;
          telephone?: string | null;
          email?: string | null;
          site_web?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        Update: {
          id?: string;
          pays_code?: string;
          nom?: string;
          nom_normalise?: string | null;
          maillon_id?: string | null;
          telephone?: string | null;
          email?: string | null;
          site_web?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entreprises_pays_code_fkey";
            columns: ["pays_code"];
            isOneToOne: false;
            referencedRelation: "pays";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "entreprises_maillon_id_fkey";
            columns: ["maillon_id"];
            isOneToOne: false;
            referencedRelation: "maillons";
            referencedColumns: ["id"];
          },
        ];
      };
      personnes: {
        Row: {
          id: string;
          pays_code: string;
          entreprise_id: string | null;
          prenom: string;
          nom: string;
          fonction: string | null;
          telephone: string | null;
          email: string | null;
          photo_path: string | null;
          cree_le: string;
          modifie_le: string;
        };
        Insert: {
          id?: string;
          pays_code?: string;
          entreprise_id?: string | null;
          prenom: string;
          nom: string;
          fonction?: string | null;
          telephone?: string | null;
          email?: string | null;
          photo_path?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        Update: {
          id?: string;
          pays_code?: string;
          entreprise_id?: string | null;
          prenom?: string;
          nom?: string;
          fonction?: string | null;
          telephone?: string | null;
          email?: string | null;
          photo_path?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: "personnes_pays_code_fkey";
            columns: ["pays_code"];
            isOneToOne: false;
            referencedRelation: "pays";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "personnes_entreprise_id_fkey";
            columns: ["entreprise_id"];
            isOneToOne: false;
            referencedRelation: "entreprises";
            referencedColumns: ["id"];
          },
        ];
      };
      consentements: {
        Row: {
          id: string;
          personne_id: string;
          type: TypeConsentement;
          accorde: boolean;
          texte: string;
          source: string;
          cree_le: string;
        };
        Insert: {
          id?: string;
          personne_id: string;
          type: TypeConsentement;
          accorde: boolean;
          texte: string;
          source: string;
          cree_le?: string;
        };
        /* Jamais modifié en base : on ajoute une ligne */
        Update: {
          id?: string;
          personne_id?: string;
          type?: TypeConsentement;
          accorde?: boolean;
          texte?: string;
          source?: string;
          cree_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consentements_personne_id_fkey";
            columns: ["personne_id"];
            isOneToOne: false;
            referencedRelation: "personnes";
            referencedColumns: ["id"];
          },
        ];
      };
      admins: {
        Row: {
          user_id: string;
          email: string;
          prenom: string;
          nom: string;
          actif: boolean;
          mot_de_passe_defini_le: string | null;
          cree_par: string | null;
          cree_le: string;
          modifie_le: string;
          desactive_le: string | null;
        };
        Insert: {
          user_id: string;
          email: string;
          prenom: string;
          nom: string;
          actif?: boolean;
          mot_de_passe_defini_le?: string | null;
          cree_par?: string | null;
          cree_le?: string;
          modifie_le?: string;
          desactive_le?: string | null;
        };
        Update: {
          user_id?: string;
          email?: string;
          prenom?: string;
          nom?: string;
          actif?: boolean;
          mot_de_passe_defini_le?: string | null;
          cree_par?: string | null;
          cree_le?: string;
          modifie_le?: string;
          desactive_le?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admins_cree_par_fkey";
            columns: ["cree_par"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["user_id"];
          },
        ];
      };
      manifestes: {
        Row: {
          id: string;
          titre: string;
          sous_titre: string | null;
          statut: StatutManifeste;
          date_limite: string;
          version_gelee_id: string | null;
          lien_ouvert_actif: boolean;
          auto_validation: boolean;
          texte_consentement: string;
          modele_message_whatsapp: string;
          google_doc_url: string | null;
          gele_le: string | null;
          clos_le: string | null;
          publie_le: string | null;
          pdf_final_path: string | null;
          whatsapp_task_force: string | null;
          /* Clôture des doléances (0009), heure de Dakar = UTC */
          doleances_cloture: string;
          cree_le: string;
          modifie_le: string;
        };
        Insert: {
          id?: string;
          titre: string;
          sous_titre?: string | null;
          statut?: StatutManifeste;
          date_limite: string;
          version_gelee_id?: string | null;
          lien_ouvert_actif?: boolean;
          auto_validation?: boolean;
          texte_consentement: string;
          modele_message_whatsapp: string;
          google_doc_url?: string | null;
          gele_le?: string | null;
          clos_le?: string | null;
          publie_le?: string | null;
          pdf_final_path?: string | null;
          whatsapp_task_force?: string | null;
          doleances_cloture?: string;
          cree_le?: string;
          modifie_le?: string;
        };
        Update: {
          id?: string;
          titre?: string;
          sous_titre?: string | null;
          statut?: StatutManifeste;
          date_limite?: string;
          version_gelee_id?: string | null;
          lien_ouvert_actif?: boolean;
          auto_validation?: boolean;
          texte_consentement?: string;
          modele_message_whatsapp?: string;
          google_doc_url?: string | null;
          gele_le?: string | null;
          clos_le?: string | null;
          publie_le?: string | null;
          pdf_final_path?: string | null;
          whatsapp_task_force?: string | null;
          doleances_cloture?: string;
          cree_le?: string;
          modifie_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manifestes_version_gelee_id_fkey";
            columns: ["version_gelee_id"];
            isOneToOne: false;
            referencedRelation: "manifeste_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      manifeste_versions: {
        Row: {
          id: string;
          manifeste_id: string;
          numero: number;
          type: TypeVersion;
          titre: string;
          sous_titre: string | null;
          blocs: Json;
          resume: Json | null;
          fichier_source_path: string | null;
          cree_par: string | null;
          cree_le: string;
        };
        Insert: {
          id?: string;
          manifeste_id: string;
          numero: number;
          type: TypeVersion;
          titre: string;
          sous_titre?: string | null;
          blocs: Json;
          resume?: Json | null;
          fichier_source_path?: string | null;
          cree_par?: string | null;
          cree_le?: string;
        };
        Update: {
          id?: string;
          manifeste_id?: string;
          numero?: number;
          type?: TypeVersion;
          titre?: string;
          sous_titre?: string | null;
          blocs?: Json;
          resume?: Json | null;
          fichier_source_path?: string | null;
          cree_par?: string | null;
          cree_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manifeste_versions_manifeste_id_fkey";
            columns: ["manifeste_id"];
            isOneToOne: false;
            referencedRelation: "manifestes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manifeste_versions_cree_par_fkey";
            columns: ["cree_par"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["user_id"];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          manifeste_id: string;
          personne_id: string | null;
          entreprise_id: string | null;
          jeton: string;
          code_parrainage: string | null;
          origine: OrigineInvitation;
          parrain_invitation_id: string | null;
          invite_par_texte: string | null;
          saisie_liste: Json | null;
          saisie_ceo: Json | null;
          statut_envoi: StatutEnvoi;
          envoye_le: string | null;
          ouvert_le: string | null;
          derniere_relance_le: string | null;
          relances: number;
          verification: EtatVerification;
          motif: MotifVerification | null;
          verifie_par: string | null;
          verifie_le: string | null;
          decision: DecisionVerification | null;
          decision_signature_id: string | null;
          /* Clé anti-doublon d'une inscription par le lien ouvert (0008), null pour les autres */
          cle_inscription: string | null;
          cree_le: string;
          modifie_le: string;
        };
        Insert: {
          id?: string;
          manifeste_id: string;
          personne_id?: string | null;
          entreprise_id?: string | null;
          jeton: string;
          code_parrainage?: string | null;
          origine: OrigineInvitation;
          parrain_invitation_id?: string | null;
          invite_par_texte?: string | null;
          saisie_liste?: Json | null;
          saisie_ceo?: Json | null;
          statut_envoi?: StatutEnvoi;
          envoye_le?: string | null;
          ouvert_le?: string | null;
          derniere_relance_le?: string | null;
          relances?: number;
          verification?: EtatVerification;
          motif?: MotifVerification | null;
          verifie_par?: string | null;
          verifie_le?: string | null;
          decision?: DecisionVerification | null;
          decision_signature_id?: string | null;
          cle_inscription?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        Update: {
          id?: string;
          manifeste_id?: string;
          personne_id?: string | null;
          entreprise_id?: string | null;
          jeton?: string;
          code_parrainage?: string | null;
          origine?: OrigineInvitation;
          parrain_invitation_id?: string | null;
          invite_par_texte?: string | null;
          saisie_liste?: Json | null;
          saisie_ceo?: Json | null;
          statut_envoi?: StatutEnvoi;
          envoye_le?: string | null;
          ouvert_le?: string | null;
          derniere_relance_le?: string | null;
          relances?: number;
          verification?: EtatVerification;
          motif?: MotifVerification | null;
          verifie_par?: string | null;
          verifie_le?: string | null;
          decision?: DecisionVerification | null;
          decision_signature_id?: string | null;
          cle_inscription?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_manifeste_id_fkey";
            columns: ["manifeste_id"];
            isOneToOne: false;
            referencedRelation: "manifestes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_personne_id_fkey";
            columns: ["personne_id"];
            isOneToOne: false;
            referencedRelation: "personnes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_entreprise_id_fkey";
            columns: ["entreprise_id"];
            isOneToOne: false;
            referencedRelation: "entreprises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_parrain_invitation_id_fkey";
            columns: ["parrain_invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_verifie_par_fkey";
            columns: ["verifie_par"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["user_id"];
          },
        ];
      };
      signatures: {
        Row: {
          id: string;
          manifeste_id: string;
          invitation_id: string | null;
          manifeste_version_id: string;
          origine: OrigineSignature;
          prenom: string | null;
          nom: string | null;
          fonction: string | null;
          entreprise_nom: string | null;
          maillon_libelle: string | null;
          trace: Json | null;
          image_path: string | null;
          texte_consentement: string | null;
          reference: string;
          cle_idempotence: string | null;
          validee: boolean;
          signe_le: string;
          retiree_le: string | null;
          appareil: string | null;
          cree_le: string;
          modifie_le: string;
        };
        Insert: {
          id?: string;
          manifeste_id: string;
          invitation_id?: string | null;
          manifeste_version_id: string;
          origine?: OrigineSignature;
          prenom?: string | null;
          nom?: string | null;
          fonction?: string | null;
          entreprise_nom?: string | null;
          maillon_libelle?: string | null;
          trace?: Json | null;
          image_path?: string | null;
          texte_consentement?: string | null;
          reference?: string;
          cle_idempotence?: string | null;
          validee?: boolean;
          signe_le?: string;
          retiree_le?: string | null;
          appareil?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        /* Seuls retiree_le et validee peuvent changer (trigger signatures_figees) */
        Update: {
          retiree_le?: string | null;
          validee?: boolean;
          modifie_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signatures_manifeste_id_fkey";
            columns: ["manifeste_id"];
            isOneToOne: false;
            referencedRelation: "manifestes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signatures_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signatures_manifeste_version_id_fkey";
            columns: ["manifeste_version_id"];
            isOneToOne: false;
            referencedRelation: "manifeste_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      commentaires: {
        Row: {
          id: string;
          invitation_id: string;
          manifeste_version_id: string;
          bloc_id: string | null;
          texte: string;
          statut: StatutCommentaire;
          note_admin: string | null;
          traite_par: string | null;
          traite_le: string | null;
          cree_le: string;
          modifie_le: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          manifeste_version_id: string;
          bloc_id?: string | null;
          texte: string;
          statut?: StatutCommentaire;
          note_admin?: string | null;
          traite_par?: string | null;
          traite_le?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        Update: {
          id?: string;
          invitation_id?: string;
          manifeste_version_id?: string;
          bloc_id?: string | null;
          texte?: string;
          statut?: StatutCommentaire;
          note_admin?: string | null;
          traite_par?: string | null;
          traite_le?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commentaires_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commentaires_manifeste_version_id_fkey";
            columns: ["manifeste_version_id"];
            isOneToOne: false;
            referencedRelation: "manifeste_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commentaires_traite_par_fkey";
            columns: ["traite_par"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["user_id"];
          },
        ];
      };
      journal: {
        Row: {
          id: string;
          acteur_type: TypeActeur;
          acteur_id: string | null;
          action: string;
          cible_type: string | null;
          cible_id: string | null;
          details: Json | null;
          cree_le: string;
        };
        Insert: {
          id?: string;
          acteur_type: TypeActeur;
          acteur_id?: string | null;
          action: string;
          cible_type?: string | null;
          cible_id?: string | null;
          details?: Json | null;
          cree_le?: string;
        };
        /* Jamais modifié ni supprimé (trigger journal_immuable) */
        Update: Record<string, never>;
        Relationships: [];
      };
      /* Migration 0009 : thèmes des doléances (libellé unique, ordre, actif) */
      doleance_themes: {
        Row: { id: string; libelle: string; ordre: number; actif: boolean; cree_le: string; modifie_le: string };
        Insert: { id?: string; libelle: string; ordre?: number; actif?: boolean; cree_le?: string; modifie_le?: string };
        Update: { id?: string; libelle?: string; ordre?: number; actif?: boolean; cree_le?: string; modifie_le?: string };
        Relationships: [];
      };
      /* Migration 0009 : doléances privées, lues par les admins seuls ; contenu figé au dépôt (trigger doleances_figees) */
      doleances: {
        Row: {
          id: string;
          manifeste_id: string;
          invitation_id: string;
          personne_id: string | null;
          entreprise_id: string | null;
          auteur_nom: string;
          entreprise_nom: string;
          /* null : « Autre » */
          theme_id: string | null;
          theme_propose: string | null;
          texte: string;
          solution: string | null;
          ne_jamais_publier: boolean;
          statut: StatutDoleance;
          cle_idempotence: string;
          depose_le: string;
          lue_le: string | null;
          lue_par: string | null;
          cree_le: string;
          modifie_le: string;
        };
        /* Insertion par la fonction deposer_doleance seulement (clé secrète) */
        Insert: {
          id?: string;
          manifeste_id: string;
          invitation_id: string;
          personne_id?: string | null;
          entreprise_id?: string | null;
          auteur_nom: string;
          entreprise_nom: string;
          theme_id?: string | null;
          theme_propose?: string | null;
          texte: string;
          solution?: string | null;
          ne_jamais_publier?: boolean;
          statut?: StatutDoleance;
          cle_idempotence: string;
          depose_le?: string;
          lue_le?: string | null;
          lue_par?: string | null;
          cree_le?: string;
          modifie_le?: string;
        };
        /* Les admins ne peuvent modifier que theme_id, lue_le et lue_par */
        Update: { theme_id?: string | null; statut?: StatutDoleance; lue_le?: string | null; lue_par?: string | null };
        Relationships: [
          {
            foreignKeyName: "doleances_theme_id_fkey";
            columns: ["theme_id"];
            isOneToOne: false;
            referencedRelation: "doleance_themes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "doleances_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      /* Migration 0005 : empreintes hachées et salées des inscriptions par le lien ouvert (serveur seulement) */
      inscriptions_ouvertes: {
        Row: { id: string; empreinte: string; cree_le: string };
        Insert: { id?: string; empreinte: string; cree_le?: string };
        Update: { id?: string; empreinte?: string; cree_le?: string };
        Relationships: [];
      };
    };
    Views: {
      consentements_courants: {
        Row: {
          id: string | null;
          personne_id: string | null;
          type: TypeConsentement | null;
          accorde: boolean | null;
          texte: string | null;
          source: string | null;
          cree_le: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consentements_personne_id_fkey";
            columns: ["personne_id"];
            isOneToOne: false;
            referencedRelation: "personnes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      est_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      normaliser_nom_entreprise: {
        Args: { p_nom: string };
        Returns: string;
      };
      generer_reference_signature: {
        Args: Record<string, never>;
        Returns: string;
      };
      /* Migration 0002 : liste des CEO, chaque appel en une seule transaction */
      trouver_ou_creer_entreprise: {
        Args: { p_nom: string; p_maillon_id: string | null };
        Returns: string;
      };
      importer_ceo: {
        Args: { p_manifeste_id: string; p_lignes: Json };
        Returns: number;
      };
      modifier_ceo: {
        Args: { p_invitation_id: string; p_ligne: Json };
        Returns: undefined;
      };
      retirer_ceo: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      /* Migration 0004 : signature d'un CEO, exécutable seulement par le serveur (clé secrète) */
      resultat_signature: {
        Args: { p_signature_id: string; p_deja: boolean };
        Returns: Json;
      };
      enregistrer_signature: {
        Args: { p_invitation_id: string; p_cle: string; p_signature: Json; p_verification: Json };
        Returns: Json;
      };
      /* Migration 0005, clé secrète seulement */
      inscrire_par_lien_ouvert: {
        Args: {
          p_manifeste_id: string;
          p_saisie: Json;
          p_jeton: string;
          p_code_parrainage: string;
          p_code_parrain: string;
          p_invite_par: string;
          p_empreinte: string;
          p_limite_par_heure: number;
          p_cle_inscription: string;
        };
        /* { invitation_id, origine, jeton, renvoi } : renvoi vrai si la clé avait déjà servi (0008) */
        Returns: Json;
      };
      retirer_signature: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      enregistrer_brouillon: {
        Args: { p_invitation_id: string; p_saisie: Json };
        Returns: boolean;
      };
      /* Migration 0006 : décisions des admins (session de l'admin, contrôle est_admin dans la fonction) */
      exiger_admin: {
        Args: Record<string, never>;
        Returns: string;
      };
      confirmer_signature: {
        Args: { p_invitation_id: string; p_decision: "verifiee" | "validee" | "deux_gardees" };
        Returns: Json;
      };
      mettre_a_jour_entreprise: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      retirer_signature_admin: {
        Args: { p_invitation_id: string; p_motif: string };
        Returns: Json;
      };
      retablir_signature: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      traiter_commentaire: {
        Args: { p_commentaire_id: string; p_statut: StatutCommentaire; p_note: string };
        Returns: Json;
      };
      /* Migration 0009, CEO (clé secrète seulement) : { id, renvoi } */
      deposer_doleance: {
        Args: {
          p_invitation_id: string;
          p_theme_id: string | null;
          p_theme_propose: string | null;
          p_texte: string;
          p_solution: string | null;
          p_ne_jamais_publier: boolean;
          p_cle: string;
          p_limite_par_jour: number;
        };
        Returns: Json;
      };
      supprimer_doleance: {
        Args: { p_invitation_id: string; p_doleance_id: string };
        Returns: Json;
      };
      peut_deposer_doleance: {
        Args: { p_invitation_id: string };
        Returns: boolean;
      };
      /* Migration 0009, admins actifs (session) */
      marquer_doleance_lue: {
        Args: { p_doleance_id: string; p_lue: boolean };
        Returns: Json;
      };
      rattacher_doleance: {
        Args: { p_doleance_id: string; p_theme_id: string };
        Returns: Json;
      };
      creer_theme_doleance: {
        Args: { p_libelle: string };
        Returns: Json;
      };
      renommer_theme_doleance: {
        Args: { p_theme_id: string; p_libelle: string };
        Returns: Json;
      };
      activer_theme_doleance: {
        Args: { p_theme_id: string; p_actif: boolean };
        Returns: Json;
      };
      ordonner_themes_doleances: {
        Args: { p_ids: string[] };
        Returns: Json;
      };
      /* Exécution révoquée pour anon et authenticated : SQL Editor uniquement */
      promouvoir_premier_admin: {
        Args: { p_email: string; p_prenom?: string; p_nom?: string };
        Returns: string;
      };
    };
    Enums: {
      statut_manifeste: StatutManifeste;
      type_version: TypeVersion;
      origine_invitation: OrigineInvitation;
      statut_envoi: StatutEnvoi;
      etat_verification: EtatVerification;
      motif_verification: MotifVerification;
      origine_signature: OrigineSignature;
      type_consentement: TypeConsentement;
      statut_commentaire: StatutCommentaire;
      type_acteur: TypeActeur;
    };
    CompositeTypes: Record<string, never>;
  };
};

/* Raccourcis */
export type Ligne<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Insertion<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type MiseAJour<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
