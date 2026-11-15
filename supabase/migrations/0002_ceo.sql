-- =====================================================================
-- 0002_ceo.sql
-- Liste des CEO : import, modification et retrait, chacun en une seule
-- transaction (en cas d'erreur, rien n'est enregistré).
--
-- À coller en une seule fois dans le SQL Editor de Supabase, après 0001.
-- Idempotente : une deuxième exécution ne provoque aucune erreur.
-- Aucune table n'est créée : les fonctions utilisent la structure de 0001.
-- Les fonctions s'exécutent avec les droits de l'admin connecté (RLS appliquée)
-- et vérifient en plus qu'il s'agit d'un admin actif.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Retrouve l'entreprise par son nom normalisé, ou la crée.
-- Le maillon est renseigné s'il manquait.
-- ---------------------------------------------------------------------
create or replace function public.trouver_ou_creer_entreprise(p_nom text, p_maillon_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select e.id into v_id
  from public.entreprises e
  where e.nom_normalise = public.normaliser_nom_entreprise(p_nom)
  order by e.cree_le
  limit 1;

  if v_id is null then
    insert into public.entreprises (nom, maillon_id)
    values (btrim(p_nom), p_maillon_id)
    returning id into v_id;
  elsif p_maillon_id is not null then
    update public.entreprises set maillon_id = p_maillon_id
    where id = v_id and maillon_id is null;
  end if;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Import d'une liste de CEO (ou ajout d'un seul).
-- p_lignes : tableau de { prenom, nom, fonction, entreprise, maillon_id,
--   telephone, jeton, code_parrainage, saisie_liste }.
-- Pour chaque ligne : entreprise (retrouvée ou créée), personne, invitation.
-- Renvoie le nombre de CEO créés.
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

    insert into public.personnes (entreprise_id, prenom, nom, fonction, telephone)
    values (
      v_entreprise,
      coalesce(btrim(l->>'prenom'), ''),
      coalesce(btrim(l->>'nom'), ''),
      nullif(btrim(l->>'fonction'), ''),
      nullif(btrim(l->>'telephone'), '')
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
-- Modification d'un CEO de la liste.
-- p_ligne : { prenom, nom, fonction, entreprise, maillon_id, telephone, saisie_liste }.
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
      telephone = nullif(btrim(p_ligne->>'telephone'), '')
  where id = v_personne;

  update public.invitations
  set personne_id = v_personne,
      entreprise_id = v_entreprise,
      saisie_liste = case when v_signe then saisie_liste else p_ligne->'saisie_liste' end
  where id = p_invitation_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Retrait d'un CEO de la liste : seulement s'il n'a jamais signé.
-- Supprime l'invitation (son lien ne fonctionne plus), puis la personne
-- si elle n'a pas d'autre invitation.
-- ---------------------------------------------------------------------
create or replace function public.retirer_ceo(p_invitation_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_personne uuid;
  v_statut public.statut_envoi;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins actifs.';
  end if;

  select i.personne_id, i.statut_envoi into v_personne, v_statut
  from public.invitations i
  where i.id = p_invitation_id;

  if not found then
    raise exception 'CEO introuvable.';
  end if;
  if v_statut = 'signe' or exists (select 1 from public.signatures s where s.invitation_id = p_invitation_id) then
    raise exception 'Ce CEO a signé : il ne peut pas être retiré de la liste.';
  end if;

  delete from public.invitations where id = p_invitation_id;

  if v_personne is not null
     and not exists (select 1 from public.invitations i where i.personne_id = v_personne) then
    delete from public.personnes where id = v_personne;
  end if;
end;
$$;
