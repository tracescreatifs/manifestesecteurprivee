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
export type MotifVerification = "modification" | "nouveau" | "doublon";
export type OrigineSignature = "en_ligne" | "sur_place";
export type TypeConsentement = "signature_publique" | "recontact" | "annuaire" | "photo_communication";
export type StatutCommentaire = "nouveau" | "retenu" | "integre" | "non_retenu";
export type TypeActeur = "admin" | "ceo" | "systeme";

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
