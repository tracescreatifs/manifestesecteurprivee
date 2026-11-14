-- =====================================================================
-- 0001_fondations.sql
-- Structure de la base du Manifeste du secteur privé sénégalais de l'eau
-- et de l'assainissement (hors cahier de doléances, prévu au prompt 09).
--
-- À coller en une seule fois dans le SQL Editor de Supabase.
-- Idempotente : une deuxième exécution ne provoque aucune erreur.
-- Aucune donnée ici : les référentiels sont dans supabase/seed/.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;


-- ---------------------------------------------------------------------
-- 2. Types énumérés (créés seulement s'ils n'existent pas)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'statut_manifeste') then
    create type public.statut_manifeste as enum ('redaction', 'gele', 'clos', 'publie');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'type_version') then
    create type public.type_version as enum ('redaction', 'correction_mineure');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'origine_invitation') then
    create type public.origine_invitation as enum ('liste', 'lien_ouvert', 'parrainage');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'statut_envoi') then
    create type public.statut_envoi as enum ('a_envoyer', 'envoye', 'ouvert', 'signe');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'etat_verification') then
    create type public.etat_verification as enum ('aucune', 'a_verifier', 'valide', 'rejete');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'motif_verification') then
    create type public.motif_verification as enum ('modification', 'nouveau', 'doublon');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'origine_signature') then
    create type public.origine_signature as enum ('en_ligne', 'sur_place');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'type_consentement') then
    create type public.type_consentement as enum ('signature_publique', 'recontact', 'annuaire', 'photo_communication');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'statut_commentaire') then
    create type public.statut_commentaire as enum ('nouveau', 'retenu', 'integre', 'non_retenu');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'type_acteur') then
    create type public.type_acteur as enum ('admin', 'ceo', 'systeme');
  end if;
end
$$;


-- ---------------------------------------------------------------------
-- 3. Fonctions utilitaires
-- ---------------------------------------------------------------------

-- Met à jour la colonne modifie_le à chaque modification d'une ligne.
create or replace function public.maj_modifie_le()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

-- Normalise un nom d'entreprise pour détecter les doublons :
-- minuscules, sans accents, points retirés (S.A.R.L. devient sarl), autre ponctuation
-- remplacée par des espaces, espaces réduits, sans forme juridique finale
-- (SARL, SA, SAS, SASU, SUARL, GIE).
create or replace function public.normaliser_nom_entreprise(p_nom text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      btrim(regexp_replace(replace(lower(extensions.unaccent(coalesce(p_nom, ''))), '.', ''), '[^a-z0-9]+', ' ', 'g')),
      '\s+(sarl|sasu|sas|sa|suarl|gie)$',
      ''
    )
  );
$$;

-- Remplit entreprises.nom_normalise.
create or replace function public.maj_nom_normalise()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nom_normalise := public.normaliser_nom_entreprise(new.nom);
  return new;
end;
$$;

-- Refuse toute modification d'une ligne (consentements, journal).
create or replace function public.refuser_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Cette ligne ne peut être ni modifiée ni supprimée (table %).', tg_table_name;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Tables
-- ---------------------------------------------------------------------

-- Pays (code ISO alpha-2).
create table if not exists public.pays (
  code text primary key check (char_length(code) = 2),
  nom text not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

-- Maillons de la chaîne de valeur.
create table if not exists public.maillons (
  id uuid primary key default gen_random_uuid(),
  libelle text not null unique,
  description text,
  ordre int not null,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

-- Entreprises.
create table if not exists public.entreprises (
  id uuid primary key default gen_random_uuid(),
  pays_code text not null default 'SN' references public.pays (code),
  nom text not null,
  nom_normalise text,
  maillon_id uuid references public.maillons (id) on delete set null,
  telephone text,
  email text,
  site_web text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create index if not exists entreprises_nom_normalise_idx on public.entreprises (nom_normalise);

-- Personnes (dirigeants). L'email est facultatif et jamais demandé au CEO (D30).
create table if not exists public.personnes (
  id uuid primary key default gen_random_uuid(),
  pays_code text not null default 'SN' references public.pays (code),
  entreprise_id uuid references public.entreprises (id) on delete set null,
  prenom text not null,
  nom text not null,
  fonction text,
  telephone text,
  email text,
  photo_path text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create index if not exists personnes_telephone_idx on public.personnes (telephone);
create index if not exists personnes_entreprise_idx on public.personnes (entreprise_id);

-- Consentements : historique, jamais modifié (on ajoute une ligne).
create table if not exists public.consentements (
  id uuid primary key default gen_random_uuid(),
  personne_id uuid not null references public.personnes (id) on delete cascade,
  type public.type_consentement not null,
  accorde boolean not null,
  texte text not null,
  source text not null,
  cree_le timestamptz not null default now()
);
create index if not exists consentements_personne_type_idx on public.consentements (personne_id, type, cree_le desc);

-- Admins : un compte Supabase Auth par admin.
-- mot_de_passe_defini_le reste vide tant que l'invitation n'est pas utilisée.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  prenom text not null,
  nom text not null,
  actif boolean not null default true,
  mot_de_passe_defini_le timestamptz,
  cree_par uuid references public.admins (user_id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  desactive_le timestamptz
);
create unique index if not exists admins_email_idx on public.admins (lower(email));

-- Manifestes (une ligne pour le Manifeste d'Abu Dhabi).
create table if not exists public.manifestes (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  sous_titre text,
  statut public.statut_manifeste not null default 'redaction',
  date_limite timestamptz not null,
  version_gelee_id uuid,
  lien_ouvert_actif boolean not null default true,
  auto_validation boolean not null default true,
  texte_consentement text not null,
  modele_message_whatsapp text not null,
  google_doc_url text,
  gele_le timestamptz,
  clos_le timestamptz,
  publie_le timestamptz,
  pdf_final_path text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

-- Versions du texte. blocs : tableau de {id, type, html},
-- types possibles : titre, sous, h, accroche, mention, p, li.
create table if not exists public.manifeste_versions (
  id uuid primary key default gen_random_uuid(),
  manifeste_id uuid not null references public.manifestes (id) on delete cascade,
  numero int not null,
  type public.type_version not null,
  titre text not null,
  sous_titre text,
  blocs jsonb not null,
  resume jsonb,
  fichier_source_path text,
  cree_par uuid references public.admins (user_id) on delete set null,
  cree_le timestamptz not null default now(),
  unique (manifeste_id, numero)
);

-- Lien de manifestes vers la version gelée (ajouté après la création des versions).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'manifestes_version_gelee_id_fkey') then
    alter table public.manifestes
      add constraint manifestes_version_gelee_id_fkey
      foreign key (version_gelee_id) references public.manifeste_versions (id) on delete set null;
  end if;
end
$$;

-- Invitations : un lien par CEO (liste, lien ouvert ou parrainage).
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  manifeste_id uuid not null references public.manifestes (id) on delete cascade,
  personne_id uuid references public.personnes (id) on delete set null,
  entreprise_id uuid references public.entreprises (id) on delete set null,
  jeton text not null unique check (char_length(jeton) >= 16),
  code_parrainage text unique,
  origine public.origine_invitation not null,
  parrain_invitation_id uuid references public.invitations (id) on delete set null,
  invite_par_texte text,
  saisie_liste jsonb,
  saisie_ceo jsonb,
  statut_envoi public.statut_envoi not null default 'a_envoyer',
  envoye_le timestamptz,
  ouvert_le timestamptz,
  derniere_relance_le timestamptz,
  relances int not null default 0,
  verification public.etat_verification not null default 'aucune',
  motif public.motif_verification,
  verifie_par uuid references public.admins (user_id) on delete set null,
  verifie_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create index if not exists invitations_manifeste_idx on public.invitations (manifeste_id);
create index if not exists invitations_personne_idx on public.invitations (personne_id);

-- Référence des signatures : MSP-2026-0001, MSP-2026-0002, etc.
create sequence if not exists public.signature_reference_seq;

create or replace function public.generer_reference_signature()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'MSP-2026-' || lpad(nextval('public.signature_reference_seq')::text, 4, '0');
$$;

-- Signatures. Les informations imprimées sont un instantané figé.
-- validee = false pour un nouvel inscrit par le lien ouvert, jusqu'à la validation (D20).
create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  manifeste_id uuid not null references public.manifestes (id),
  invitation_id uuid references public.invitations (id),
  manifeste_version_id uuid not null references public.manifeste_versions (id),
  origine public.origine_signature not null default 'en_ligne',
  prenom text,
  nom text,
  fonction text,
  entreprise_nom text,
  maillon_libelle text,
  trace jsonb,
  image_path text,
  texte_consentement text,
  reference text not null unique default public.generer_reference_signature(),
  cle_idempotence text unique,
  validee boolean not null default true,
  signe_le timestamptz not null default now(),
  retiree_le timestamptz,
  appareil text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
-- Une seule signature active par invitation.
create unique index if not exists signatures_une_active_par_invitation
  on public.signatures (invitation_id)
  where retiree_le is null and invitation_id is not null;
create index if not exists signatures_manifeste_idx on public.signatures (manifeste_id);

-- Les champs figés d'une signature ne changent jamais (D25).
-- Seuls retiree_le et validee peuvent être modifiés.
create or replace function public.proteger_signature()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.manifeste_id is distinct from old.manifeste_id
     or new.invitation_id is distinct from old.invitation_id
     or new.manifeste_version_id is distinct from old.manifeste_version_id
     or new.origine is distinct from old.origine
     or new.prenom is distinct from old.prenom
     or new.nom is distinct from old.nom
     or new.fonction is distinct from old.fonction
     or new.entreprise_nom is distinct from old.entreprise_nom
     or new.maillon_libelle is distinct from old.maillon_libelle
     or new.trace is distinct from old.trace
     or new.image_path is distinct from old.image_path
     or new.texte_consentement is distinct from old.texte_consentement
     or new.reference is distinct from old.reference
     or new.cle_idempotence is distinct from old.cle_idempotence
     or new.signe_le is distinct from old.signe_le
     or new.appareil is distinct from old.appareil
     or new.cree_le is distinct from old.cree_le then
    raise exception 'Une signature enregistrée ne peut pas être modifiée : seuls son retrait et sa validation peuvent changer.';
  end if;
  return new;
end;
$$;

-- Commentaires des CEO, lus uniquement par les admins.
create table if not exists public.commentaires (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  manifeste_version_id uuid not null references public.manifeste_versions (id),
  bloc_id text,
  texte text not null,
  statut public.statut_commentaire not null default 'nouveau',
  note_admin text,
  traite_par uuid references public.admins (user_id) on delete set null,
  traite_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create index if not exists commentaires_invitation_idx on public.commentaires (invitation_id);

-- Journal des actions : jamais modifié, jamais supprimé.
create table if not exists public.journal (
  id uuid primary key default gen_random_uuid(),
  acteur_type public.type_acteur not null,
  acteur_id uuid,
  action text not null,
  cible_type text,
  cible_id uuid,
  details jsonb,
  cree_le timestamptz not null default now()
);
create index if not exists journal_cree_le_idx on public.journal (cree_le desc);


-- ---------------------------------------------------------------------
-- 5. Vue : état courant des consentements (la ligne la plus récente
--    par personne et par type). security_invoker : la RLS de la table
--    consentements s'applique.
-- ---------------------------------------------------------------------
create or replace view public.consentements_courants
with (security_invoker = true)
as
select distinct on (c.personne_id, c.type)
  c.id,
  c.personne_id,
  c.type,
  c.accorde,
  c.texte,
  c.source,
  c.cree_le
from public.consentements c
order by c.personne_id, c.type, c.cree_le desc, c.id desc;


-- ---------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------

-- modifie_le sur les tables modifiables.
do $$
declare
  t text;
begin
  foreach t in array array['pays', 'maillons', 'entreprises', 'personnes', 'admins',
                           'manifestes', 'invitations', 'signatures', 'commentaires']
  loop
    execute format('drop trigger if exists maj_modifie_le on public.%I', t);
    execute format('create trigger maj_modifie_le before update on public.%I
                    for each row execute function public.maj_modifie_le()', t);
  end loop;
end
$$;

-- Nom normalisé des entreprises.
drop trigger if exists maj_nom_normalise on public.entreprises;
create trigger maj_nom_normalise
  before insert or update of nom on public.entreprises
  for each row execute function public.maj_nom_normalise();

-- Consentements : jamais modifiés.
drop trigger if exists consentements_immuables on public.consentements;
create trigger consentements_immuables
  before update on public.consentements
  for each row execute function public.refuser_modification();

-- Journal : ni modification ni suppression.
drop trigger if exists journal_immuable on public.journal;
create trigger journal_immuable
  before update or delete on public.journal
  for each row execute function public.refuser_modification();

-- Signatures : champs figés.
drop trigger if exists signatures_figees on public.signatures;
create trigger signatures_figees
  before update on public.signatures
  for each row execute function public.proteger_signature();

-- Admins : il reste toujours au moins un admin actif.
-- Est compté comme actif un admin dont l'accès est ouvert et qui a défini
-- son mot de passe (une invitation en attente ne permet pas de se connecter).
create or replace function public.garder_un_admin_actif()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  restants int;
begin
  -- L'admin concerné n'était pas compté comme actif : rien à protéger.
  if not (old.actif and old.mot_de_passe_defini_le is not null) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Modification qui le laisse actif : rien à protéger.
  if tg_op = 'UPDATE' and new.actif and new.mot_de_passe_defini_le is not null then
    return new;
  end if;

  select count(*) into restants
  from public.admins a
  where a.user_id <> old.user_id
    and a.actif
    and a.mot_de_passe_defini_le is not null;

  if restants = 0 then
    raise exception 'Impossible : c''est le dernier admin actif. Invitez d''abord un autre admin.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists garder_un_admin_actif on public.admins;
create trigger garder_un_admin_actif
  before update or delete on public.admins
  for each row execute function public.garder_un_admin_actif();


-- ---------------------------------------------------------------------
-- 7. Fonctions d'accès
-- ---------------------------------------------------------------------

-- Vrai si l'utilisateur connecté est un admin actif.
create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = auth.uid() and a.actif
  );
$$;

-- Promotion du tout premier admin, à exécuter une seule fois dans le SQL Editor.
-- Ne fonctionne que s'il n'existe encore aucun admin.
create or replace function public.promouvoir_premier_admin(
  p_email text,
  p_prenom text default null,
  p_nom text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  if exists (select 1 from public.admins) then
    raise exception 'Un admin existe déjà : les admins suivants s''invitent depuis l''espace admin (Réglages, Admins).';
  end if;

  select u.id, u.email into v_user_id, v_email
  from auth.users u
  where lower(u.email) = lower(btrim(p_email));

  if v_user_id is null then
    raise exception 'Aucun utilisateur avec l''email % : créez-le d''abord dans Authentication, Users, Add user.', p_email;
  end if;

  insert into public.admins (user_id, email, prenom, nom, actif, mot_de_passe_defini_le)
  values (
    v_user_id,
    v_email,
    coalesce(nullif(btrim(p_prenom), ''), 'Admin'),
    coalesce(nullif(btrim(p_nom), ''), 'Admin'),
    true,
    now()
  );

  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('systeme', null, 'premier_admin_promu', 'admin', v_user_id, jsonb_build_object('email', v_email));

  return 'Premier admin créé : ' || v_email;
end;
$$;

revoke execute on function public.promouvoir_premier_admin(text, text, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. Sécurité : RLS sur toutes les tables, sans exception
-- ---------------------------------------------------------------------

-- Tables métier : lecture et écriture pour les admins actifs, rien pour les autres.
do $$
declare
  t text;
begin
  foreach t in array array['pays', 'maillons', 'entreprises', 'personnes', 'consentements',
                           'manifestes', 'manifeste_versions', 'invitations', 'signatures',
                           'commentaires']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admins_tout on public.%I', t);
    execute format('create policy admins_tout on public.%I for all to authenticated
                    using (public.est_admin()) with check (public.est_admin())', t);
  end loop;
end
$$;

-- Admins : lecture pour les admins actifs. Les modifications passent par
-- les routes serveur, avec la clé secrète.
alter table public.admins enable row level security;
drop policy if exists admins_lecture on public.admins;
create policy admins_lecture on public.admins
  for select to authenticated
  using (public.est_admin());

-- Journal : lecture et ajout pour les admins actifs, rien d'autre.
alter table public.journal enable row level security;
drop policy if exists journal_lecture on public.journal;
create policy journal_lecture on public.journal
  for select to authenticated
  using (public.est_admin());
drop policy if exists journal_ajout on public.journal;
create policy journal_ajout on public.journal
  for insert to authenticated
  with check (public.est_admin());


-- ---------------------------------------------------------------------
-- 9. Stockage : buckets privés, réservés aux admins actifs
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('imports', 'imports', false),
  ('photos', 'photos', false),
  ('exports', 'exports', false)
on conflict (id) do nothing;

drop policy if exists manifeste_admins_stockage on storage.objects;
create policy manifeste_admins_stockage on storage.objects
  for all to authenticated
  using (bucket_id in ('imports', 'photos', 'exports') and public.est_admin())
  with check (bucket_id in ('imports', 'photos', 'exports') and public.est_admin());
