-- =====================================================================
-- 0003_ceo_email.sql
-- L'email importé avec la liste des CEO (colonne Email, E-mail, Courriel ou Mail)
-- est enregistré dans personnes.email et dans l'instantané « liste » (D62).
-- Il n'est jamais demandé au CEO (D30).
--
-- À coller en une seule fois dans le SQL Editor de Supabase, après 0002.
-- Idempotente : les deux fonctions de 0002 sont simplement remplacées
-- (create or replace), aucune table ni donnée n'est modifiée.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Import d'une liste de CEO (ou ajout d'un seul), avec l'email.
-- p_lignes : tableau de { prenom, nom, fonction, entreprise, maillon_id,
--   telephone, email, jeton, code_parrainage, saisie_liste }.
-- ---------------------------------------------------------------------
create or replace function public.importer_ceo(p_manifeste_id uuid, p_lignes jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  l jsonb;
  v_entreprise uuid;
  v_personne uuid;
  n int := 0;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins actifs.';
  end if;
  if jsonb_typeof(p_lignes) <> 'array' then
    raise exception 'Liste invalide.';
  end if;

  for l in select value from jsonb_array_elements(p_lignes)
  loop
    v_entreprise := public.trouver_ou_creer_entreprise(l->>'entreprise', nullif(l->>'maillon_id', '')::uuid);

    insert into public.personnes (entreprise_id, prenom, nom, fonction, telephone, email)
    values (
      v_entreprise,
      coalesce(btrim(l->>'prenom'), ''),
      coalesce(btrim(l->>'nom'), ''),
      nullif(btrim(l->>'fonction'), ''),
      nullif(btrim(l->>'telephone'), ''),
      nullif(lower(btrim(l->>'email')), '')
    )
    returning id into v_personne;

    insert into public.invitations (manifeste_id, personne_id, entreprise_id, jeton, code_parrainage, origine, saisie_liste)
    values (p_manifeste_id, v_personne, v_entreprise, l->>'jeton', l->>'code_parrainage', 'liste', l->'saisie_liste');

    n := n + 1;
  end loop;

  return n;
end;
$$;


-- ---------------------------------------------------------------------
-- Modification d'un CEO de la liste, avec l'email.
-- p_ligne : { prenom, nom, fonction, entreprise, maillon_id, telephone, email, saisie_liste }.
-- L'instantané « liste » n'est mis à jour que tant que le CEO n'a pas signé.
-- ---------------------------------------------------------------------
create or replace function public.modifier_ceo(p_invitation_id uuid, p_ligne jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_personne uuid;
  v_entreprise uuid;
  v_signe boolean;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins actifs.';
  end if;

  select i.personne_id,
         i.statut_envoi = 'signe'
           or exists (select 1 from public.signatures s where s.invitation_id = i.id and s.retiree_le is null)
    into v_personne, v_signe
  from public.invitations i
  where i.id = p_invitation_id;

  if not found then
    raise exception 'CEO introuvable.';
  end if;

  v_entreprise := public.trouver_ou_creer_entreprise(p_ligne->>'entreprise', nullif(p_ligne->>'maillon_id', '')::uuid);
  if nullif(p_ligne->>'maillon_id', '') is not null then
    update public.entreprises set maillon_id = (p_ligne->>'maillon_id')::uuid where id = v_entreprise;
  end if;

  if v_personne is null then
    insert into public.personnes (entreprise_id, prenom, nom)
    values (v_entreprise, '', '')
    returning id into v_personne;
  end if;

  update public.personnes
  set entreprise_id = v_entreprise,
      prenom = coalesce(btrim(p_ligne->>'prenom'), ''),
      nom = coalesce(btrim(p_ligne->>'nom'), ''),
      fonction = nullif(btrim(p_ligne->>'fonction'), ''),
      telephone = nullif(btrim(p_ligne->>'telephone'), ''),
      email = nullif(lower(btrim(p_ligne->>'email')), '')
  where id = v_personne;

  update public.invitations
  set personne_id = v_personne,
      entreprise_id = v_entreprise,
      saisie_liste = case when v_signe then saisie_liste else p_ligne->'saisie_liste' end
  where id = p_invitation_id;
end;
$$;
