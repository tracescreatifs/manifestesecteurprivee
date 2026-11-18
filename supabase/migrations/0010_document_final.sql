-- =====================================================================
-- migrations/0010_document_final.sql
-- Document final (prompt 08) : réglages de l'annexe, clôture, réouverture (D18), publication (D25),
-- signataires sur place (cahier des charges, partie 8), bucket privé des signatures manuscrites.
--
-- À coller en une seule fois dans le SQL Editor de Supabase, après 0009.
-- Idempotente : une deuxième exécution ne change rien et ne provoque aucune erreur.
-- Une signature en ligne est déjà refusée dès que le statut n'est plus « gele » (enregistrer_signature),
-- en plus du contrôle de la date limite.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Réglages de l'annexe (D69), sur le Manifeste
-- ---------------------------------------------------------------------
alter table public.manifestes add column if not exists annexe_ordre text not null default 'entreprise';
alter table public.manifestes add column if not exists annexe_lignes_par_page integer not null default 10;
alter table public.manifestes add column if not exists annexe_lignes_vides integer not null default 0;

alter table public.manifestes drop constraint if exists manifestes_annexe_ordre_valeurs;
alter table public.manifestes add constraint manifestes_annexe_ordre_valeurs
  check (annexe_ordre in ('entreprise', 'maillon', 'nom', 'date'));
alter table public.manifestes drop constraint if exists manifestes_annexe_lignes_par_page_valeurs;
alter table public.manifestes add constraint manifestes_annexe_lignes_par_page_valeurs
  check (annexe_lignes_par_page in (8, 10, 15));
alter table public.manifestes drop constraint if exists manifestes_annexe_lignes_vides_valeurs;
alter table public.manifestes add constraint manifestes_annexe_lignes_vides_valeurs
  check (annexe_lignes_vides in (0, 5, 10));


-- ---------------------------------------------------------------------
-- 2. Bucket privé des signatures manuscrites (photos prises sur place) : admins seulement
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;
update storage.buckets
set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg']
where id = 'signatures';

drop policy if exists manifeste_admins_signatures on storage.objects;
create policy manifeste_admins_signatures on storage.objects
  for all to authenticated
  using (bucket_id = 'signatures' and public.est_admin())
  with check (bucket_id = 'signatures' and public.est_admin());


-- ---------------------------------------------------------------------
-- 3. Signatures : figées, sauf une signature sur place tant que le Manifeste est clos (correction par un admin).
--    Après la publication, plus aucune signature ne change (ni retrait, ni validation).
-- ---------------------------------------------------------------------
create or replace function public.proteger_signature()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_statut public.statut_manifeste;
  v_sur_place_corrigeable boolean;
begin
  select m.statut into v_statut from public.manifestes m where m.id = old.manifeste_id;
  if v_statut = 'publie' then
    raise exception 'document_publie';
  end if;

  v_sur_place_corrigeable := old.origine = 'sur_place' and v_statut = 'clos' and old.retiree_le is null;

  if new.manifeste_id is distinct from old.manifeste_id
     or new.invitation_id is distinct from old.invitation_id
     or new.manifeste_version_id is distinct from old.manifeste_version_id
     or new.origine is distinct from old.origine
     or (not v_sur_place_corrigeable and (
           new.prenom is distinct from old.prenom
           or new.nom is distinct from old.nom
           or new.fonction is distinct from old.fonction
           or new.entreprise_nom is distinct from old.entreprise_nom
           or new.maillon_libelle is distinct from old.maillon_libelle
           or new.image_path is distinct from old.image_path))
     or new.trace is distinct from old.trace
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


-- ---------------------------------------------------------------------
-- 4. Fonctions des admins (session d'un admin actif, RLS), journalisées dans la même transaction
--    Codes d'erreur : acces_refuse, introuvable, statut_invalide, date_invalide, document_publie,
--    reglage_invalide, pdf_introuvable.
-- ---------------------------------------------------------------------

create or replace function public.clore_signatures(p_manifeste_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_man public.manifestes%rowtype;
  v_annexe integer;
  v_attente integer;
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  select * into v_man from public.manifestes m where m.id = p_manifeste_id for update;
  if not found then
    raise exception 'introuvable';
  end if;
  if v_man.statut <> 'gele' then
    raise exception 'statut_invalide';
  end if;
  select count(*) into v_annexe from public.signatures s
  where s.manifeste_id = p_manifeste_id and s.retiree_le is null and s.validee;
  select count(*) into v_attente from public.invitations i
  where i.manifeste_id = p_manifeste_id and i.verification = 'a_verifier';

  update public.manifestes set statut = 'clos', clos_le = now() where id = p_manifeste_id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', auth.uid(), 'signatures_closes', 'manifeste', p_manifeste_id,
          jsonb_build_object('nombre', v_annexe, 'a_verifier', v_attente));
  return jsonb_build_object('annexe', v_annexe, 'a_verifier', v_attente);
end;
$$;

-- Réouverture (D18) : seulement avant la publication, avec une date limite postérieure à maintenant
create or replace function public.rouvrir_signatures(p_manifeste_id uuid, p_date_limite timestamptz)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_man public.manifestes%rowtype;
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  select * into v_man from public.manifestes m where m.id = p_manifeste_id for update;
  if not found then
    raise exception 'introuvable';
  end if;
  if v_man.statut = 'publie' then
    raise exception 'document_publie';
  end if;
  if v_man.statut <> 'clos' then
    raise exception 'statut_invalide';
  end if;
  if p_date_limite is null or p_date_limite <= now() then
    raise exception 'date_invalide';
  end if;

  update public.manifestes set statut = 'gele', clos_le = null, date_limite = p_date_limite where id = p_manifeste_id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', auth.uid(), 'signatures_rouvertes', 'manifeste', p_manifeste_id,
          jsonb_build_object('date_limite', p_date_limite, 'ancienne_date_limite', v_man.date_limite));
  return jsonb_build_object('date_limite', p_date_limite);
end;
$$;

-- Publication (D25) : seulement si clos, avec le PDF déposé dans le bucket privé exports. Aucun retour en arrière.
create or replace function public.publier_document(p_manifeste_id uuid, p_pdf_path text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_man public.manifestes%rowtype;
  v_annexe integer;
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  select * into v_man from public.manifestes m where m.id = p_manifeste_id for update;
  if not found then
    raise exception 'introuvable';
  end if;
  if v_man.statut = 'publie' then
    raise exception 'document_publie';
  end if;
  if v_man.statut <> 'clos' then
    raise exception 'statut_invalide';
  end if;
  if p_pdf_path is null or p_pdf_path !~ '^document-final/[A-Za-z0-9._-]+\.pdf$'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'exports' and o.name = p_pdf_path) then
    raise exception 'pdf_introuvable';
  end if;
  select count(*) into v_annexe from public.signatures s
  where s.manifeste_id = p_manifeste_id and s.retiree_le is null and s.validee;

  update public.manifestes set statut = 'publie', publie_le = now(), pdf_final_path = p_pdf_path where id = p_manifeste_id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', auth.uid(), 'document_publie', 'manifeste', p_manifeste_id,
          jsonb_build_object('nombre', v_annexe, 'fichier', p_pdf_path));
  return jsonb_build_object('annexe', v_annexe);
end;
$$;

-- Réglages de l'annexe : modifiables tant que le document n'est pas publié
create or replace function public.regler_annexe(p_manifeste_id uuid, p_ordre text, p_lignes_par_page integer, p_lignes_vides integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_man public.manifestes%rowtype;
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  select * into v_man from public.manifestes m where m.id = p_manifeste_id for update;
  if not found then
    raise exception 'introuvable';
  end if;
  if v_man.statut = 'publie' then
    raise exception 'document_publie';
  end if;
  if p_ordre not in ('entreprise', 'maillon', 'nom', 'date')
     or p_lignes_par_page not in (8, 10, 15) or p_lignes_vides not in (0, 5, 10) then
    raise exception 'reglage_invalide';
  end if;
  if v_man.annexe_ordre = p_ordre and v_man.annexe_lignes_par_page = p_lignes_par_page
     and v_man.annexe_lignes_vides = p_lignes_vides then
    return jsonb_build_object('ok', true);
  end if;
  update public.manifestes
  set annexe_ordre = p_ordre, annexe_lignes_par_page = p_lignes_par_page, annexe_lignes_vides = p_lignes_vides
  where id = p_manifeste_id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', auth.uid(), 'annexe_reglee', 'manifeste', p_manifeste_id,
          jsonb_build_object('ordre', p_ordre, 'lignes_par_page', p_lignes_par_page, 'lignes_vides', p_lignes_vides));
  return jsonb_build_object('ok', true);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Signataires sur place (clé secrète seulement : la référence MSP n'est générée que par le serveur).
--    Le serveur vérifie la session de l'admin, puis transmet son identifiant ; la fonction recontrôle
--    qu'il s'agit d'un admin actif. Codes : acces_refuse, statut_invalide, maillon_invalide,
--    champ_invalide, introuvable, aucune_version.
-- ---------------------------------------------------------------------

create or replace function public.ajouter_signataire_sur_place(
  p_manifeste_id uuid,
  p_admin_id uuid,
  p_prenom text,
  p_nom text,
  p_fonction text,
  p_entreprise text,
  p_maillon text,
  p_image_path text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_man public.manifestes%rowtype;
  v_version uuid;
  v_sig public.signatures%rowtype;
begin
  if not exists (select 1 from public.admins a where a.user_id = p_admin_id and a.actif) then
    raise exception 'acces_refuse';
  end if;
  select * into v_man from public.manifestes m where m.id = p_manifeste_id for update;
  if not found then
    raise exception 'introuvable';
  end if;
  if v_man.statut <> 'clos' then
    raise exception 'statut_invalide';
  end if;
  if not exists (select 1 from public.maillons m where m.libelle = btrim(p_maillon) and m.actif) then
    raise exception 'maillon_invalide';
  end if;
  if char_length(btrim(coalesce(p_prenom, ''))) not between 1 and 80
     or char_length(btrim(coalesce(p_nom, ''))) not between 1 and 80
     or char_length(btrim(coalesce(p_fonction, ''))) not between 1 and 120
     or char_length(btrim(coalesce(p_entreprise, ''))) not between 1 and 160
     or p_image_path is null or p_image_path !~ '^sur-place/[A-Za-z0-9._-]+\.jpg$' then
    raise exception 'champ_invalide';
  end if;
  -- La version imprimée : la version courante du texte (la plus récente)
  select v.id into v_version from public.manifeste_versions v
  where v.manifeste_id = p_manifeste_id order by v.numero desc limit 1;
  if v_version is null then
    raise exception 'aucune_version';
  end if;

  insert into public.signatures (
    manifeste_id, invitation_id, manifeste_version_id, origine, prenom, nom, fonction,
    entreprise_nom, maillon_libelle, trace, image_path, validee, appareil
  )
  values (
    p_manifeste_id, null, v_version, 'sur_place', btrim(p_prenom), btrim(p_nom), btrim(p_fonction),
    btrim(p_entreprise), btrim(p_maillon), null, p_image_path, true, 'sur_place'
  )
  returning * into v_sig;

  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', p_admin_id, 'signataire_sur_place_ajoute', 'signature', v_sig.id,
          jsonb_build_object('nom', v_sig.prenom || ' ' || v_sig.nom, 'entreprise', v_sig.entreprise_nom, 'reference', v_sig.reference));
  return jsonb_build_object('id', v_sig.id, 'reference', v_sig.reference);
end;
$$;

-- Correction d'un signataire sur place (avant la publication) ; image inchangée si p_image_path est null
create or replace function public.modifier_signataire_sur_place(
  p_signature_id uuid,
  p_admin_id uuid,
  p_prenom text,
  p_nom text,
  p_fonction text,
  p_entreprise text,
  p_maillon text,
  p_image_path text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sig public.signatures%rowtype;
  v_statut public.statut_manifeste;
  v_ancienne_image text;
begin
  if not exists (select 1 from public.admins a where a.user_id = p_admin_id and a.actif) then
    raise exception 'acces_refuse';
  end if;
  select * into v_sig from public.signatures s where s.id = p_signature_id and s.origine = 'sur_place' and s.retiree_le is null for update;
  if not found then
    raise exception 'introuvable';
  end if;
  select m.statut into v_statut from public.manifestes m where m.id = v_sig.manifeste_id;
  if v_statut <> 'clos' then
    raise exception 'statut_invalide';
  end if;
  if not exists (select 1 from public.maillons m where m.libelle = btrim(p_maillon) and m.actif) then
    raise exception 'maillon_invalide';
  end if;
  if char_length(btrim(coalesce(p_prenom, ''))) not between 1 and 80
     or char_length(btrim(coalesce(p_nom, ''))) not between 1 and 80
     or char_length(btrim(coalesce(p_fonction, ''))) not between 1 and 120
     or char_length(btrim(coalesce(p_entreprise, ''))) not between 1 and 160
     or (p_image_path is not null and p_image_path !~ '^sur-place/[A-Za-z0-9._-]+\.jpg$') then
    raise exception 'champ_invalide';
  end if;
  v_ancienne_image := v_sig.image_path;

  update public.signatures
  set prenom = btrim(p_prenom), nom = btrim(p_nom), fonction = btrim(p_fonction),
      entreprise_nom = btrim(p_entreprise), maillon_libelle = btrim(p_maillon),
      image_path = coalesce(p_image_path, image_path)
  where id = v_sig.id;

  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', p_admin_id, 'signataire_sur_place_modifie', 'signature', v_sig.id,
          jsonb_build_object('nom', btrim(p_prenom) || ' ' || btrim(p_nom), 'entreprise', btrim(p_entreprise), 'reference', v_sig.reference));
  -- L'ancienne image, à supprimer du stockage par le serveur si elle a été remplacée
  return jsonb_build_object(
    'id', v_sig.id,
    'ancienne_image', case when p_image_path is not null and p_image_path <> v_ancienne_image then v_ancienne_image end
  );
end;
$$;

-- Retrait d'un signataire sur place (avant la publication) : la signature est retirée, jamais effacée
create or replace function public.retirer_signataire_sur_place(p_signature_id uuid, p_admin_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sig public.signatures%rowtype;
  v_statut public.statut_manifeste;
begin
  if not exists (select 1 from public.admins a where a.user_id = p_admin_id and a.actif) then
    raise exception 'acces_refuse';
  end if;
  select * into v_sig from public.signatures s where s.id = p_signature_id and s.origine = 'sur_place' and s.retiree_le is null for update;
  if not found then
    raise exception 'introuvable';
  end if;
  select m.statut into v_statut from public.manifestes m where m.id = v_sig.manifeste_id;
  if v_statut <> 'clos' then
    raise exception 'statut_invalide';
  end if;
  update public.signatures set retiree_le = now() where id = v_sig.id;
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values ('admin', p_admin_id, 'signataire_sur_place_retire', 'signature', v_sig.id,
          jsonb_build_object('nom', v_sig.prenom || ' ' || v_sig.nom, 'entreprise', v_sig.entreprise_nom, 'reference', v_sig.reference));
  return jsonb_build_object('id', v_sig.id);
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Droits d'exécution : jamais anon ; admins par leur session ; signataires sur place par la clé secrète
-- ---------------------------------------------------------------------
revoke execute on function public.clore_signatures(uuid) from public, anon;
revoke execute on function public.rouvrir_signatures(uuid, timestamptz) from public, anon;
revoke execute on function public.publier_document(uuid, text) from public, anon;
revoke execute on function public.regler_annexe(uuid, text, integer, integer) from public, anon;
grant execute on function public.clore_signatures(uuid) to authenticated;
grant execute on function public.rouvrir_signatures(uuid, timestamptz) to authenticated;
grant execute on function public.publier_document(uuid, text) to authenticated;
grant execute on function public.regler_annexe(uuid, text, integer, integer) to authenticated;

revoke execute on function public.ajouter_signataire_sur_place(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.modifier_signataire_sur_place(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.retirer_signataire_sur_place(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ajouter_signataire_sur_place(uuid, uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.modifier_signataire_sur_place(uuid, uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.retirer_signataire_sur_place(uuid, uuid) to service_role;

revoke execute on function public.proteger_signature() from public, anon, authenticated;
