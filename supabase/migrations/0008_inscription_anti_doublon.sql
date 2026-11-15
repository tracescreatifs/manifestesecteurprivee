-- =====================================================================
-- migrations/0008_inscription_anti_doublon.sql
-- Inscription par le lien ouvert (/rejoindre) : clé anti-doublon (prompt 06.1, D102).
-- Une inscription renvoyée après une coupure réseau, avec la même clé, renvoie la même invitation
-- et le même jeton, sans rien créer (même principe que la signature).
--
-- À coller en une seule fois dans le SQL Editor de Supabase, après 0007.
-- Idempotente : une deuxième exécution ne change rien et ne provoque aucune erreur.
-- Les inscriptions déjà en base gardent une clé vide (colonne facultative, unicité seulement sur les clés remplies).
-- =====================================================================

-- 1. Clé d'inscription sur l'invitation
alter table public.invitations add column if not exists cle_inscription text;

alter table public.invitations drop constraint if exists invitations_cle_inscription_longueur;
alter table public.invitations add constraint invitations_cle_inscription_longueur
  check (cle_inscription is null or char_length(cle_inscription) between 16 and 64);

create unique index if not exists invitations_cle_inscription_unique
  on public.invitations (cle_inscription)
  where cle_inscription is not null;

-- 2. La fonction d'inscription demande la clé : l'ancienne version (sans clé) est retirée
drop function if exists public.inscrire_par_lien_ouvert(uuid, jsonb, text, text, text, text, text, int);

create or replace function public.inscrire_par_lien_ouvert(
  p_manifeste_id uuid,
  p_saisie jsonb,
  p_jeton text,
  p_code_parrainage text,
  p_code_parrain text,
  p_invite_par text,
  p_empreinte text,
  p_limite_par_heure int,
  p_cle_inscription text
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
  v_existante public.invitations%rowtype;
begin
  -- Clé anti-doublon obligatoire, tirée dans le navigateur et renvoyée telle quelle à chaque nouvel essai
  if p_cle_inscription is null or char_length(p_cle_inscription) < 16 or char_length(p_cle_inscription) > 64 then
    raise exception 'cle_invalide';
  end if;

  -- Renvoi d'une inscription déjà enregistrée (coupure réseau) : même invitation, même jeton, rien n'est créé.
  -- Le verrou sur la clé fait attendre un envoi simultané, qui retrouve alors l'invitation créée.
  perform pg_advisory_xact_lock(hashtext('inscription_cle:' || p_cle_inscription));
  select * into v_existante
  from public.invitations i
  where i.cle_inscription = p_cle_inscription and i.manifeste_id = p_manifeste_id;
  if found then
    return jsonb_build_object(
      'invitation_id', v_existante.id, 'origine', v_existante.origine, 'jeton', v_existante.jeton, 'renvoi', true
    );
  end if;

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
  ) >= coalesce(p_limite_par_heure, 0) then
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
    parrain_invitation_id, invite_par_texte, saisie_ceo, statut_envoi, ouvert_le, cle_inscription
  )
  values (
    p_manifeste_id, v_personne, v_entreprise, p_jeton, p_code_parrainage, v_origine,
    v_parrain, nullif(btrim(p_invite_par), ''), p_saisie, 'ouvert', now(), p_cle_inscription
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

  return jsonb_build_object('invitation_id', v_invitation, 'origine', v_origine, 'jeton', p_jeton, 'renvoi', false);
end;
$$;

-- 3. Droits : clé secrète seulement (comme en 0005 et 0007)
revoke execute on function public.inscrire_par_lien_ouvert(uuid, jsonb, text, text, text, text, text, int, text) from public, anon, authenticated;
grant execute on function public.inscrire_par_lien_ouvert(uuid, jsonb, text, text, text, text, text, int, text) to service_role;
