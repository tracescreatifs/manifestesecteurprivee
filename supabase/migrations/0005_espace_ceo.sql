-- =====================================================================
-- 0005_espace_ceo.sql
-- Espace CEO, partie 2 : accusés en PDF, inscription par le lien ouvert
-- ou par parrainage (avec limite d'inscriptions), retrait d'une signature,
-- brouillon des informations (signature terminée sur le téléphone).
--
-- À coller en une seule fois dans le SQL Editor de Supabase, après 0004.
-- Idempotente : une deuxième exécution ne provoque aucune erreur.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Bucket privé des accusés de signature (D74).
-- Aucune policy : ni anon ni authenticated n'y ont accès, seul le serveur
-- (clé secrète) lit et écrit les fichiers.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('accuses', 'accuses', false)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 2. Limite d'inscriptions par le lien ouvert.
-- On n'enregistre qu'une empreinte hachée et salée de l'adresse IP
-- (calculée par le serveur), jamais l'adresse elle-même. Les lignes de plus
-- d'un jour sont effacées à chaque inscription.
-- ---------------------------------------------------------------------
create table if not exists public.inscriptions_ouvertes (
  id uuid primary key default gen_random_uuid(),
  empreinte text not null,
  cree_le timestamptz not null default now()
);
create index if not exists inscriptions_ouvertes_empreinte_idx
  on public.inscriptions_ouvertes (empreinte, cree_le desc);

-- RLS activée, sans aucune policy : accès par le serveur seulement
alter table public.inscriptions_ouvertes enable row level security;
revoke all on table public.inscriptions_ouvertes from anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Inscription d'un CEO absent de la liste (lien ouvert ou parrainage).
-- Crée l'entreprise (retrouvée par nom normalisé), la personne et l'invitation,
-- en une seule transaction. Rien n'indique au CEO qu'un numéro ou une entreprise
-- existe déjà : un doublon est créé normalement et traité dans « À vérifier ».
-- p_saisie : { prenom, nom, fonction, entreprise, maillon, telephone }
-- Codes d'erreur (message) : pas_ouvert, signatures_fermees, date_limite_depassee,
--   lien_en_pause, limite_atteinte, maillon_invalide.
-- ---------------------------------------------------------------------
create or replace function public.inscrire_par_lien_ouvert(
  p_manifeste_id uuid,
  p_saisie jsonb,
  p_jeton text,
  p_code_parrainage text,
  p_code_parrain text,
  p_invite_par text,
  p_empreinte text,
  p_limite_par_heure int
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_man public.manifestes%rowtype;
  v_maillon uuid;
  v_entreprise uuid;
  v_personne uuid;
  v_parrain uuid;
  v_invitation uuid;
  v_origine public.origine_invitation;
begin
  select * into v_man from public.manifestes m where m.id = p_manifeste_id;
  if not found or v_man.statut = 'redaction' then
    raise exception 'pas_ouvert';
  end if;
  if v_man.statut <> 'gele' then
    raise exception 'signatures_fermees';
  end if;
  if now() > v_man.date_limite then
    raise exception 'date_limite_depassee';
  end if;
  if not v_man.lien_ouvert_actif then
    raise exception 'lien_en_pause';
  end if;

  -- Limite d'inscriptions par empreinte, contrôlée sous verrou
  perform pg_advisory_xact_lock(hashtext('inscription:' || p_empreinte));
  delete from public.inscriptions_ouvertes where cree_le < now() - interval '1 day';
  if (
    select count(*) from public.inscriptions_ouvertes i
    where i.empreinte = p_empreinte and i.cree_le > now() - interval '1 hour'
  ) >= p_limite_par_heure then
    raise exception 'limite_atteinte';
  end if;
  insert into public.inscriptions_ouvertes (empreinte) values (p_empreinte);

  select m.id into v_maillon
  from public.maillons m
  where m.libelle = btrim(p_saisie->>'maillon') and m.actif;
  if v_maillon is null then
    raise exception 'maillon_invalide';
  end if;

  -- Parrain : seulement un code existant pour ce Manifeste
  if nullif(btrim(p_code_parrain), '') is not null then
    select i.id into v_parrain
    from public.invitations i
    where i.code_parrainage = upper(btrim(p_code_parrain)) and i.manifeste_id = p_manifeste_id;
  end if;
  v_origine := case when v_parrain is null then 'lien_ouvert' else 'parrainage' end;

  v_entreprise := public.trouver_ou_creer_entreprise(btrim(p_saisie->>'entreprise'), v_maillon);

  insert into public.personnes (entreprise_id, prenom, nom, fonction, telephone)
  values (
    v_entreprise,
    btrim(p_saisie->>'prenom'),
    btrim(p_saisie->>'nom'),
    nullif(btrim(p_saisie->>'fonction'), ''),
    nullif(btrim(p_saisie->>'telephone'), '')
  )
  returning id into v_personne;

  -- Le lien a été ouvert par le CEO lui-même : statut « ouvert » dès l'inscription
  insert into public.invitations (
    manifeste_id, personne_id, entreprise_id, jeton, code_parrainage, origine,
    parrain_invitation_id, invite_par_texte, saisie_ceo, statut_envoi, ouvert_le
  )
  values (
    p_manifeste_id, v_personne, v_entreprise, p_jeton, p_code_parrainage, v_origine,
    v_parrain, nullif(btrim(p_invite_par), ''), p_saisie, 'ouvert', now()
  )
  returning id into v_invitation;

  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'ceo', v_invitation, 'inscription_lien_ouvert', 'ceo', v_invitation,
    jsonb_build_object(
      'nom', btrim(p_saisie->>'prenom') || ' ' || btrim(p_saisie->>'nom'),
      'entreprise', btrim(p_saisie->>'entreprise'),
      'origine', v_origine
    )
  );

  return jsonb_build_object('invitation_id', v_invitation, 'origine', v_origine);
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Retrait de la signature active d'un CEO (et première moitié de « Refaire »).
-- Possible seulement tant que les signatures sont ouvertes (gelé, date limite
-- non passée). La signature n'est jamais effacée : seul retiree_le est renseigné.
-- Codes d'erreur : lien_invalide, signatures_fermees, date_limite_depassee, aucune_signature.
-- ---------------------------------------------------------------------
create or replace function public.retirer_signature(p_invitation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_man public.manifestes%rowtype;
  v_sig public.signatures%rowtype;
begin
  select * into v_inv from public.invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'lien_invalide';
  end if;
  select * into v_man from public.manifestes m where m.id = v_inv.manifeste_id;
  if v_man.statut <> 'gele' then
    raise exception 'signatures_fermees';
  end if;
  if now() > v_man.date_limite then
    raise exception 'date_limite_depassee';
  end if;

  select * into v_sig from public.signatures s
  where s.invitation_id = p_invitation_id and s.retiree_le is null
  for update;
  if not found then
    raise exception 'aucune_signature';
  end if;

  update public.signatures set retiree_le = now() where id = v_sig.id;
  update public.invitations
  set statut_envoi = 'ouvert',
      ouvert_le = coalesce(ouvert_le, now()),
      verification = 'aucune',
      motif = null
  where id = v_inv.id;

  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'ceo', v_inv.id, 'signature_retiree', 'ceo', v_inv.id,
    jsonb_build_object(
      'nom', coalesce(v_sig.prenom, '') || ' ' || coalesce(v_sig.nom, ''),
      'entreprise', v_sig.entreprise_nom,
      'reference', v_sig.reference
    )
  );

  return jsonb_build_object('reference', v_sig.reference);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Brouillon des informations de l'étape 1 (saisie_ceo), pour terminer
-- la signature sur le téléphone. Sans effet si une signature est active.
-- Codes d'erreur : lien_invalide, signatures_fermees, date_limite_depassee.
-- ---------------------------------------------------------------------
create or replace function public.enregistrer_brouillon(p_invitation_id uuid, p_saisie jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_man public.manifestes%rowtype;
begin
  select * into v_inv from public.invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'lien_invalide';
  end if;
  select * into v_man from public.manifestes m where m.id = v_inv.manifeste_id;
  if v_man.statut <> 'gele' then
    raise exception 'signatures_fermees';
  end if;
  if now() > v_man.date_limite then
    raise exception 'date_limite_depassee';
  end if;
  if exists (
    select 1 from public.signatures s
    where s.invitation_id = p_invitation_id and s.retiree_le is null
  ) then
    return false;
  end if;

  update public.invitations set saisie_ceo = p_saisie where id = p_invitation_id;
  return true;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Droits : ces fonctions ne sont exécutables que par le serveur (clé secrète)
-- ---------------------------------------------------------------------
revoke execute on function public.inscrire_par_lien_ouvert(uuid, jsonb, text, text, text, text, text, int) from public, anon, authenticated;
revoke execute on function public.retirer_signature(uuid) from public, anon, authenticated;
revoke execute on function public.enregistrer_brouillon(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.inscrire_par_lien_ouvert(uuid, jsonb, text, text, text, text, text, int) to service_role;
grant execute on function public.retirer_signature(uuid) to service_role;
grant execute on function public.enregistrer_brouillon(uuid, jsonb) to service_role;
