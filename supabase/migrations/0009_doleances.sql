-- =====================================================================
-- migrations/0009_doleances.sql
-- Doléances privées (prompt 09a, D108, D109) : un CEO dont le lien est valide dépose une doléance
-- depuis son lien, signataire ou non, du gel jusqu'à la clôture des doléances. Lues par les admins seuls.
-- La partie publique (publication anonyme, soutiens, classement) viendra au prompt 09b sans rien réécrire :
-- statut prêt (« recue » seulement ici), thèmes avec ordre et état, identifiants stables.
--
-- À coller en une seule fois dans le SQL Editor de Supabase, après 0008.
-- Idempotente : une deuxième exécution ne change rien et ne provoque aucune erreur.
-- Les thèmes de départ sont dans le seed 0003, à exécuter ensuite.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Clôture des doléances (réglage du Manifeste), indépendante de la clôture des signatures
--    Par défaut : le 8 janvier 2027 à 23 h 59, heure de Dakar (= UTC)
-- ---------------------------------------------------------------------
alter table public.manifestes
  add column if not exists doleances_cloture timestamptz not null default '2027-01-08 23:59:00+00';


-- ---------------------------------------------------------------------
-- 2. Thèmes
-- ---------------------------------------------------------------------
create table if not exists public.doleance_themes (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  ordre integer not null default 0,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint doleance_themes_libelle_longueur check (char_length(btrim(libelle)) between 2 and 60)
);
-- Libellé unique, sans tenir compte des majuscules ni des espaces autour
create unique index if not exists doleance_themes_libelle_unique on public.doleance_themes (lower(btrim(libelle)));


-- ---------------------------------------------------------------------
-- 3. Doléances
-- ---------------------------------------------------------------------
create table if not exists public.doleances (
  id uuid primary key default gen_random_uuid(),
  manifeste_id uuid not null references public.manifestes (id) on delete cascade,
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  -- Auteur figé au dépôt : identifiants et noms tels qu'ils étaient à ce moment
  personne_id uuid references public.personnes (id) on delete set null,
  entreprise_id uuid references public.entreprises (id) on delete set null,
  auteur_nom text not null,
  entreprise_nom text not null,
  -- Thème : null = « Autre », avec le thème proposé par le CEO (facultatif)
  theme_id uuid references public.doleance_themes (id) on delete restrict,
  theme_propose text,
  texte text not null,
  solution text,
  ne_jamais_publier boolean not null default false,
  -- Prêt pour le prompt 09b ; seul « recue » est utilisé au prompt 09a
  statut text not null default 'recue',
  cle_idempotence text not null,
  depose_le timestamptz not null default now(),
  lue_le timestamptz,
  lue_par uuid references public.admins (user_id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint doleances_texte_longueur check (char_length(texte) between 15 and 500),
  constraint doleances_solution_longueur check (solution is null or char_length(solution) between 1 and 400),
  constraint doleances_theme_propose_longueur check (theme_propose is null or char_length(theme_propose) between 1 and 60),
  constraint doleances_statut_valeurs check (statut in ('recue', 'publiee', 'masquee')),
  constraint doleances_cle_longueur check (char_length(cle_idempotence) between 16 and 64),
  constraint doleances_cle_unique unique (cle_idempotence)
);
create index if not exists doleances_invitation_idx on public.doleances (invitation_id);
create index if not exists doleances_manifeste_depot_idx on public.doleances (manifeste_id, depose_le desc);
create index if not exists doleances_theme_idx on public.doleances (theme_id);


-- ---------------------------------------------------------------------
-- 4. Triggers : modifie_le, et contenu figé au dépôt
-- ---------------------------------------------------------------------
drop trigger if exists maj_modifie_le on public.doleance_themes;
create trigger maj_modifie_le before update on public.doleance_themes
  for each row execute function public.maj_modifie_le();
drop trigger if exists maj_modifie_le on public.doleances;
create trigger maj_modifie_le before update on public.doleances
  for each row execute function public.maj_modifie_le();

-- Ce que le CEO a déposé ne change jamais : seuls le thème (rattachement), le statut et la lecture changent
create or replace function public.proteger_doleance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.manifeste_id is distinct from old.manifeste_id
     or new.invitation_id is distinct from old.invitation_id
     or new.personne_id is distinct from old.personne_id and new.personne_id is not null
     or new.entreprise_id is distinct from old.entreprise_id and new.entreprise_id is not null
     or new.auteur_nom is distinct from old.auteur_nom
     or new.entreprise_nom is distinct from old.entreprise_nom
     or new.theme_propose is distinct from old.theme_propose
     or new.texte is distinct from old.texte
     or new.solution is distinct from old.solution
     or new.ne_jamais_publier is distinct from old.ne_jamais_publier
     or new.cle_idempotence is distinct from old.cle_idempotence
     or new.depose_le is distinct from old.depose_le
     or new.cree_le is distinct from old.cree_le then
    raise exception 'doleance_figee';
  end if;
  return new;
end;
$$;
drop trigger if exists doleances_figees on public.doleances;
create trigger doleances_figees before update on public.doleances
  for each row execute function public.proteger_doleance();


-- ---------------------------------------------------------------------
-- 5. Sécurité : RLS, et droits limités aux colonnes utiles
--    Admins actifs : lecture, rattachement à un thème, lecture (lue / non lue). Aucun accès anon ni CEO direct :
--    les CEO passent par les routes serveur (clé secrète), qui valident le jeton.
-- ---------------------------------------------------------------------
alter table public.doleance_themes enable row level security;
alter table public.doleances enable row level security;

drop policy if exists themes_lecture on public.doleance_themes;
create policy themes_lecture on public.doleance_themes for select to authenticated using (public.est_admin());
drop policy if exists themes_ajout on public.doleance_themes;
create policy themes_ajout on public.doleance_themes for insert to authenticated with check (public.est_admin());
drop policy if exists themes_modification on public.doleance_themes;
create policy themes_modification on public.doleance_themes for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

drop policy if exists doleances_lecture on public.doleances;
create policy doleances_lecture on public.doleances for select to authenticated using (public.est_admin());
drop policy if exists doleances_modification on public.doleances;
create policy doleances_modification on public.doleances for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

revoke all on public.doleance_themes from anon, authenticated;
grant select, insert on public.doleance_themes to authenticated;
grant update (libelle, ordre, actif) on public.doleance_themes to authenticated;

revoke all on public.doleances from anon, authenticated;
grant select on public.doleances to authenticated;
grant update (theme_id, lue_le, lue_par) on public.doleances to authenticated;

grant all on public.doleance_themes, public.doleances to service_role;


-- ---------------------------------------------------------------------
-- 6. Fonctions du CEO (clé secrète seulement, appelées par les routes serveur après validation du jeton)
--    Codes d'erreur : cle_invalide, lien_invalide, non_autorise, pas_ouvert, doleances_closes,
--    theme_invalide, texte_invalide, limite_atteinte, introuvable.
-- ---------------------------------------------------------------------

-- Droit de dépôt (D28) : CEO de la liste dont le lien n'est pas rejeté, ou nouvel inscrit
-- dont une signature a été validée par un admin. Indépendant de la signature et de sa clôture.
create or replace function public.peut_deposer_doleance(p_invitation_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.invitations i
    where i.id = p_invitation_id
      and i.verification <> 'rejete'
      and (
        i.origine = 'liste'
        or exists (select 1 from public.signatures s where s.invitation_id = i.id and s.validee)
      )
  );
$$;

create or replace function public.deposer_doleance(
  p_invitation_id uuid,
  p_theme_id uuid,
  p_theme_propose text,
  p_texte text,
  p_solution text,
  p_ne_jamais_publier boolean,
  p_cle text,
  p_limite_par_jour int
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_man public.manifestes%rowtype;
  v_existante public.doleances%rowtype;
  v_texte text := btrim(coalesce(p_texte, ''));
  v_solution text := nullif(btrim(coalesce(p_solution, '')), '');
  v_propose text := nullif(btrim(coalesce(p_theme_propose, '')), '');
  v_theme text;
  v_auteur text;
  v_entreprise text;
  v_id uuid;
begin
  if p_cle is null or char_length(p_cle) < 16 or char_length(p_cle) > 64 then
    raise exception 'cle_invalide';
  end if;

  -- Renvoi (coupure réseau, double clic) : même clé, même doléance, rien n'est créé
  perform pg_advisory_xact_lock(hashtext('doleance:' || p_cle));
  select * into v_existante from public.doleances d where d.cle_idempotence = p_cle;
  if found then
    if v_existante.invitation_id <> p_invitation_id then
      raise exception 'cle_invalide';
    end if;
    return jsonb_build_object('id', v_existante.id, 'renvoi', true);
  end if;

  -- Une invitation à la fois : la limite par jour est comptée sous verrou
  select * into v_inv from public.invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'lien_invalide';
  end if;
  select * into v_man from public.manifestes m where m.id = v_inv.manifeste_id;
  if v_man.statut = 'redaction' then
    raise exception 'pas_ouvert';
  end if;
  if now() > v_man.doleances_cloture then
    raise exception 'doleances_closes';
  end if;
  if not public.peut_deposer_doleance(p_invitation_id) then
    raise exception 'non_autorise';
  end if;

  if p_theme_id is not null then
    select t.libelle into v_theme from public.doleance_themes t where t.id = p_theme_id and t.actif;
    if v_theme is null then
      raise exception 'theme_invalide';
    end if;
    v_propose := null;
  elsif v_propose is not null and char_length(v_propose) > 60 then
    raise exception 'theme_invalide';
  end if;
  if char_length(v_texte) not between 15 and 500 or (v_solution is not null and char_length(v_solution) > 400) then
    raise exception 'texte_invalide';
  end if;

  if (
    select count(*) from public.doleances d
    where d.invitation_id = p_invitation_id and d.depose_le > now() - interval '1 day'
  ) >= coalesce(p_limite_par_jour, 0) then
    raise exception 'limite_atteinte';
  end if;

  select btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), coalesce(e.nom, '')
  into v_auteur, v_entreprise
  from public.invitations i
  left join public.personnes p on p.id = i.personne_id
  left join public.entreprises e on e.id = coalesce(i.entreprise_id, p.entreprise_id)
  where i.id = p_invitation_id;

  insert into public.doleances (
    manifeste_id, invitation_id, personne_id, entreprise_id, auteur_nom, entreprise_nom,
    theme_id, theme_propose, texte, solution, ne_jamais_publier, cle_idempotence
  )
  values (
    v_inv.manifeste_id, v_inv.id, v_inv.personne_id,
    coalesce(v_inv.entreprise_id, (select p.entreprise_id from public.personnes p where p.id = v_inv.personne_id)),
    coalesce(v_auteur, ''), coalesce(v_entreprise, ''),
    p_theme_id, v_propose, v_texte, v_solution, coalesce(p_ne_jamais_publier, false), p_cle
  )
  returning id into v_id;

  -- Jamais le texte de la doléance dans le journal
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'ceo', v_inv.id, 'doleance_deposee', 'doleance', v_id,
    jsonb_build_object('nom', v_auteur, 'entreprise', v_entreprise, 'theme', coalesce(v_theme, 'Autre'))
  );

  return jsonb_build_object('id', v_id, 'renvoi', false);
end;
$$;

-- Le CEO supprime sa propre doléance (jamais celle d'un autre), tant qu'elle n'est pas publiée
create or replace function public.supprimer_doleance(p_invitation_id uuid, p_doleance_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dol public.doleances%rowtype;
  v_theme text;
begin
  select * into v_dol from public.doleances d
  where d.id = p_doleance_id and d.invitation_id = p_invitation_id and d.statut = 'recue'
  for update;
  if not found then
    raise exception 'introuvable';
  end if;
  select t.libelle into v_theme from public.doleance_themes t where t.id = v_dol.theme_id;

  delete from public.doleances where id = v_dol.id;

  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'ceo', p_invitation_id, 'doleance_supprimee', 'doleance', v_dol.id,
    jsonb_build_object('nom', v_dol.auteur_nom, 'entreprise', v_dol.entreprise_nom, 'theme', coalesce(v_theme, 'Autre'))
  );
  return jsonb_build_object('id', v_dol.id);
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Fonctions des admins (session d'un admin actif, RLS), journalisées dans la même transaction
--    Codes d'erreur : acces_refuse, introuvable, theme_invalide, theme_existe, libelle_invalide.
-- ---------------------------------------------------------------------

create or replace function public.marquer_doleance_lue(p_doleance_id uuid, p_lue boolean)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dol public.doleances%rowtype;
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  select * into v_dol from public.doleances d where d.id = p_doleance_id for update;
  if not found then
    raise exception 'introuvable';
  end if;
  update public.doleances
  set lue_le = case when p_lue then coalesce(v_dol.lue_le, now()) else null end,
      lue_par = case when p_lue then coalesce(v_dol.lue_par, auth.uid()) else null end
  where id = v_dol.id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'admin', auth.uid(), case when p_lue then 'doleance_lue' else 'doleance_non_lue' end, 'doleance', v_dol.id,
    jsonb_build_object('nom', v_dol.auteur_nom, 'entreprise', v_dol.entreprise_nom)
  );
  return jsonb_build_object('lue', p_lue);
end;
$$;

create or replace function public.rattacher_doleance(p_doleance_id uuid, p_theme_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dol public.doleances%rowtype;
  v_ancien text;
  v_nouveau text;
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  select * into v_dol from public.doleances d where d.id = p_doleance_id for update;
  if not found then
    raise exception 'introuvable';
  end if;
  select t.libelle into v_nouveau from public.doleance_themes t where t.id = p_theme_id and t.actif;
  if v_nouveau is null then
    raise exception 'theme_invalide';
  end if;
  select t.libelle into v_ancien from public.doleance_themes t where t.id = v_dol.theme_id;
  update public.doleances set theme_id = p_theme_id where id = v_dol.id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'admin', auth.uid(), 'doleance_rattachee', 'doleance', v_dol.id,
    jsonb_build_object(
      'nom', v_dol.auteur_nom, 'entreprise', v_dol.entreprise_nom,
      'de', coalesce(v_ancien, 'Autre' || coalesce(' (« ' || v_dol.theme_propose || ' »)', '')),
      'vers', v_nouveau
    )
  );
  return jsonb_build_object('theme', v_nouveau);
end;
$$;

create or replace function public.creer_theme_doleance(p_libelle text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_libelle text := btrim(coalesce(p_libelle, ''));
  v_id uuid;
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  if char_length(v_libelle) not between 2 and 60 then
    raise exception 'libelle_invalide';
  end if;
  if exists (select 1 from public.doleance_themes t where lower(btrim(t.libelle)) = lower(v_libelle)) then
    raise exception 'theme_existe';
  end if;
  insert into public.doleance_themes (libelle, ordre)
  values (v_libelle, coalesce((select max(t.ordre) from public.doleance_themes t), 0) + 1)
  returning id into v_id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', auth.uid(), 'theme_cree', 'theme', v_id, jsonb_build_object('libelle', v_libelle));
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.renommer_theme_doleance(p_theme_id uuid, p_libelle text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_libelle text := btrim(coalesce(p_libelle, ''));
  v_ancien text;
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  if char_length(v_libelle) not between 2 and 60 then
    raise exception 'libelle_invalide';
  end if;
  select t.libelle into v_ancien from public.doleance_themes t where t.id = p_theme_id for update;
  if v_ancien is null then
    raise exception 'introuvable';
  end if;
  if v_ancien = v_libelle then
    return jsonb_build_object('id', p_theme_id);
  end if;
  if exists (
    select 1 from public.doleance_themes t where lower(btrim(t.libelle)) = lower(v_libelle) and t.id <> p_theme_id
  ) then
    raise exception 'theme_existe';
  end if;
  update public.doleance_themes set libelle = v_libelle where id = p_theme_id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', auth.uid(), 'theme_renomme', 'theme', p_theme_id, jsonb_build_object('libelle', v_libelle, 'ancien', v_ancien));
  return jsonb_build_object('id', p_theme_id);
end;
$$;

-- Désactiver : le thème n'est plus proposé aux CEO, mais reste sur les doléances existantes
create or replace function public.activer_theme_doleance(p_theme_id uuid, p_actif boolean)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_theme public.doleance_themes%rowtype;
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  select * into v_theme from public.doleance_themes t where t.id = p_theme_id for update;
  if not found then
    raise exception 'introuvable';
  end if;
  if v_theme.actif = p_actif then
    return jsonb_build_object('actif', p_actif);
  end if;
  update public.doleance_themes set actif = p_actif where id = p_theme_id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'admin', auth.uid(), case when p_actif then 'theme_reactive' else 'theme_desactive' end, 'theme', p_theme_id,
    jsonb_build_object('libelle', v_theme.libelle)
  );
  return jsonb_build_object('actif', p_actif);
end;
$$;

-- Nouvel ordre : la liste complète des thèmes, dans l'ordre voulu
create or replace function public.ordonner_themes_doleances(p_ids uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  if p_ids is null
     or cardinality(p_ids) <> (select count(*) from public.doleance_themes)
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) as x)
     or exists (select 1 from unnest(p_ids) as x where x not in (select t.id from public.doleance_themes t)) then
    raise exception 'theme_invalide';
  end if;
  update public.doleance_themes t set ordre = o.n
  from unnest(p_ids) with ordinality as o(id, n)
  where t.id = o.id and t.ordre <> o.n;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', auth.uid(), 'themes_reordonnes', null, null, null);
  return jsonb_build_object('ok', true);
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Droits d'exécution : jamais anon ; CEO par la clé secrète ; admins par leur session
-- ---------------------------------------------------------------------
revoke execute on function public.peut_deposer_doleance(uuid) from public, anon, authenticated;
revoke execute on function public.deposer_doleance(uuid, uuid, text, text, text, boolean, text, int) from public, anon, authenticated;
revoke execute on function public.supprimer_doleance(uuid, uuid) from public, anon, authenticated;
grant execute on function public.peut_deposer_doleance(uuid) to service_role;
grant execute on function public.deposer_doleance(uuid, uuid, text, text, text, boolean, text, int) to service_role;
grant execute on function public.supprimer_doleance(uuid, uuid) to service_role;

revoke execute on function public.marquer_doleance_lue(uuid, boolean) from public, anon;
revoke execute on function public.rattacher_doleance(uuid, uuid) from public, anon;
revoke execute on function public.creer_theme_doleance(text) from public, anon;
revoke execute on function public.renommer_theme_doleance(uuid, text) from public, anon;
revoke execute on function public.activer_theme_doleance(uuid, boolean) from public, anon;
revoke execute on function public.ordonner_themes_doleances(uuid[]) from public, anon;
grant execute on function public.marquer_doleance_lue(uuid, boolean) to authenticated;
grant execute on function public.rattacher_doleance(uuid, uuid) to authenticated;
grant execute on function public.creer_theme_doleance(text) to authenticated;
grant execute on function public.renommer_theme_doleance(uuid, text) to authenticated;
grant execute on function public.activer_theme_doleance(uuid, boolean) to authenticated;
grant execute on function public.ordonner_themes_doleances(uuid[]) to authenticated;

revoke execute on function public.proteger_doleance() from public, anon, authenticated;
