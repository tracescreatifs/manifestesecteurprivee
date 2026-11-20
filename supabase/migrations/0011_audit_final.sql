-- =====================================================================
-- 0011_audit_final.sql
-- Correctifs de l'audit final avant l'envoi des liens (prompt 06b). Idempotente : réexécutable sans erreur.
-- À exécuter après 0010, en un seul copier-coller dans le SQL Editor de Supabase.
--
-- 1. Signatures : un admin connecté ne peut plus insérer, supprimer ni modifier directement une signature par l'API
--    (seules restent les colonnes « validee » et « retiree_le », utilisées par les fonctions de vérification, qui
--    journalisent). Toute insertion, même par la clé secrète, est recontrôlée : une signature en ligne seulement si le
--    Manifeste est gelé et la date limite non passée (règle 6), un signataire sur place seulement s'il est clos,
--    jamais après la publication. Le Manifeste est lu « for share » : une clôture en cours attend la signature, ou l'inverse.
-- 2. Cycle de vie du Manifeste protégé en base : rédaction -> gelé -> clos -> publié, retour de gelé à rédaction,
--    réouverture de clos à gelé avec une date limite à venir ; publication seulement avec le PDF déposé ;
--    après la publication, le statut, le PDF, les dates de clôture et de publication, la version gelée et les réglages
--    de l'annexe ne changent plus. Plus de suppression du Manifeste par un admin.
-- 3. Consentements : plus d'ajout, de modification ni de suppression directe par un admin (règle 15).
-- 4. Stockage : les buckets exports (PDF du document final) et signatures (photos des signataires sur place),
--    écrits par le serveur seulement, deviennent en lecture seule pour les admins ; exports limité à 4 Mo en PDF.
-- 5. Doléances : la limite par jour se compte au journal (déposer puis supprimer ne la contourne plus).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Signatures
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.signatures from authenticated;
grant update (validee, retiree_le) on public.signatures to authenticated;

create or replace function public.controler_insertion_signature()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_man public.manifestes%rowtype;
begin
  select * into v_man from public.manifestes m where m.id = new.manifeste_id for share;
  if not found then
    raise exception 'manifeste_introuvable';
  end if;
  if v_man.statut = 'publie' then
    raise exception 'document_publie';
  end if;
  if coalesce(new.origine::text, 'en_ligne') = 'sur_place' then
    if v_man.statut <> 'clos' then
      raise exception 'statut_invalide';
    end if;
  elsif v_man.statut <> 'gele' or now() > v_man.date_limite then
    raise exception 'signatures_fermees';
  end if;
  return new;
end;
$$;

drop trigger if exists signatures_insertion_controlee on public.signatures;
create trigger signatures_insertion_controlee
  before insert on public.signatures
  for each row execute function public.controler_insertion_signature();


-- ---------------------------------------------------------------------
-- 2. Cycle de vie du Manifeste
-- ---------------------------------------------------------------------
create or replace function public.proteger_manifeste()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.statut = 'publie' and (
       new.statut, new.pdf_final_path, new.publie_le, new.clos_le, new.version_gelee_id,
       new.annexe_ordre, new.annexe_lignes_par_page, new.annexe_lignes_vides
     ) is distinct from (
       old.statut, old.pdf_final_path, old.publie_le, old.clos_le, old.version_gelee_id,
       old.annexe_ordre, old.annexe_lignes_par_page, old.annexe_lignes_vides
     ) then
    raise exception 'document_publie';
  end if;

  if new.statut is distinct from old.statut and not (
       (old.statut = 'redaction' and new.statut = 'gele')
    or (old.statut = 'gele' and new.statut in ('redaction', 'clos'))
    or (old.statut = 'clos' and new.statut = 'gele' and new.date_limite > now())
    or (old.statut = 'clos' and new.statut = 'publie')
  ) then
    raise exception 'statut_invalide';
  end if;

  if new.statut = 'publie' and old.statut <> 'publie' then
    if coalesce(new.pdf_final_path, '') !~ '^document-final/[A-Za-z0-9._-]+\.pdf$'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'exports' and o.name = new.pdf_final_path) then
      raise exception 'pdf_introuvable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists manifestes_cycle_de_vie on public.manifestes;
create trigger manifestes_cycle_de_vie
  before update on public.manifestes
  for each row execute function public.proteger_manifeste();

revoke delete on public.manifestes from authenticated;


-- ---------------------------------------------------------------------
-- 3. Consentements : historique écrit par le serveur seulement (clé secrète)
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.consentements from authenticated;


-- ---------------------------------------------------------------------
-- 4. Stockage
-- ---------------------------------------------------------------------
drop policy if exists manifeste_admins_stockage on storage.objects;
create policy manifeste_admins_stockage on storage.objects
  for all to authenticated
  using (bucket_id in ('imports', 'photos') and public.est_admin())
  with check (bucket_id in ('imports', 'photos') and public.est_admin());

drop policy if exists manifeste_admins_signatures on storage.objects;
drop policy if exists manifeste_admins_lecture_serveur on storage.objects;
create policy manifeste_admins_lecture_serveur on storage.objects
  for select to authenticated
  using (bucket_id in ('exports', 'signatures') and public.est_admin());

update storage.buckets
set file_size_limit = 4194304, allowed_mime_types = array['application/pdf']
where id = 'exports';


-- ---------------------------------------------------------------------
-- 5. Doléances : limite par jour comptée au journal
-- ---------------------------------------------------------------------
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

  -- Audit 06b : les dépôts se comptent au journal (qui ne s'efface jamais), pas dans la table :
  -- déposer puis supprimer ne remet plus le compteur à zéro
  if (
    select count(*) from public.journal j
    where j.action = 'doleance_deposee' and j.acteur_type = 'ceo' and j.acteur_id = p_invitation_id
      and j.cree_le > now() - interval '1 day'
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
