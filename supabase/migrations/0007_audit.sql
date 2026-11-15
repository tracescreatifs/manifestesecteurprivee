-- =====================================================================
-- 0007_audit.sql
-- Corrections de l'audit d'avant l'envoi des liens (prompt 06) :
-- droits d'exécution, immutabilité, contrôles en base, buckets.
-- Aucune donnée n'est modifiée.
--
-- À coller en une seule fois dans le SQL Editor de Supabase, après 0006.
-- Idempotente : une deuxième exécution ne provoque aucune erreur.
--
-- Important : les migrations se rejouent toujours dans l'ordre complet (0001 à 0007).
-- Rejouer seule une migration ancienne (par exemple 0004) remplacerait des fonctions
-- par leur version précédente.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Références des signatures : la fonction et sa séquence ne sont plus
-- accessibles avec la clé publique (anon) ni par un utilisateur connecté.
-- Avant : n'importe qui pouvait appeler la fonction et créer des trous dans les références.
-- Au-delà de MSP-2026-9999, le numéro n'est plus tronqué.
-- ---------------------------------------------------------------------
create or replace function public.generer_reference_signature()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'MSP-2026-' || (
    select case when n < 10000 then lpad(n::text, 4, '0') else n::text end
    from (select nextval('public.signature_reference_seq') as n) x
  );
$$;

revoke execute on function public.generer_reference_signature() from public, anon, authenticated;
grant execute on function public.generer_reference_signature() to service_role;
revoke all on sequence public.signature_reference_seq from public, anon, authenticated;
grant usage, select on sequence public.signature_reference_seq to service_role;


-- ---------------------------------------------------------------------
-- 2. Fonctions des admins de 0002 et 0003 : plus appelables avec la clé publique (anon).
-- Elles contrôlaient déjà est_admin ; c'est une défense de plus.
-- ---------------------------------------------------------------------
revoke execute on function public.trouver_ou_creer_entreprise(text, uuid) from public, anon;
revoke execute on function public.importer_ceo(uuid, jsonb) from public, anon;
revoke execute on function public.modifier_ceo(uuid, jsonb) from public, anon;
revoke execute on function public.retirer_ceo(uuid) from public, anon;
grant execute on function public.trouver_ou_creer_entreprise(text, uuid) to authenticated, service_role;
grant execute on function public.importer_ceo(uuid, jsonb) to authenticated;
grant execute on function public.modifier_ceo(uuid, jsonb) to authenticated;
grant execute on function public.retirer_ceo(uuid) to authenticated;

-- TRUNCATE contourne les triggers par ligne : jamais pour anon ni pour un utilisateur connecté
revoke truncate on all tables in schema public from anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Une signature n'est jamais supprimée (D25, D56). Seul le script de nettoyage
-- des données de test (supabase/seed/9000) désactive ce trigger, le temps de sa transaction.
-- ---------------------------------------------------------------------
create or replace function public.refuser_suppression_signature()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Une signature n''est jamais supprimée : elle peut seulement être retirée.';
end;
$$;

drop trigger if exists signatures_non_supprimees on public.signatures;
create trigger signatures_non_supprimees
  before delete on public.signatures
  for each row execute function public.refuser_suppression_signature();


-- ---------------------------------------------------------------------
-- 4. Versions du texte : jamais modifiées ni supprimées (une correction crée une
-- nouvelle version). L'application ne fait que les créer.
-- ---------------------------------------------------------------------
create or replace function public.proteger_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Une version du texte n''est jamais supprimée.';
  end if;
  if new.manifeste_id is distinct from old.manifeste_id
     or new.numero is distinct from old.numero
     or new.type is distinct from old.type
     or new.titre is distinct from old.titre
     or new.sous_titre is distinct from old.sous_titre
     or new.blocs is distinct from old.blocs then
    raise exception 'Une version du texte n''est jamais modifiée : une correction crée une nouvelle version.';
  end if;
  return new;
end;
$$;

drop trigger if exists versions_figees on public.manifeste_versions;
create trigger versions_figees
  before update or delete on public.manifeste_versions
  for each row execute function public.proteger_version();


-- ---------------------------------------------------------------------
-- 5. Journal : un admin n'ajoute que des lignes à son propre nom
-- (le serveur, avec la clé secrète, écrit les lignes des CEO et du système).
-- ---------------------------------------------------------------------
drop policy if exists journal_ajout on public.journal;
create policy journal_ajout on public.journal
  for insert to authenticated
  with check (public.est_admin() and acteur_type = 'admin' and acteur_id = auth.uid());


-- ---------------------------------------------------------------------
-- 6. Au moins un admin actif : verrou contre deux désactivations simultanées
-- ---------------------------------------------------------------------
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

  -- Deux désactivations simultanées : la seconde attend la première (audit 06)
  perform pg_advisory_xact_lock(hashtext('manifeste_admins_actifs'));

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


-- ---------------------------------------------------------------------
-- 7. Signature : clé anti-doublon obligatoire, et deux envois simultanés avec la
-- même clé renvoient la même signature (remplace la version de 0006).
-- ---------------------------------------------------------------------
create or replace function public.enregistrer_signature(
  p_invitation_id uuid,
  p_cle text,
  p_signature jsonb,
  p_verification jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existante uuid;
  v_invitation_existante uuid;
  v_inv public.invitations%rowtype;
  v_man public.manifestes%rowtype;
  v_version public.manifeste_versions%rowtype;
  v_signature_id uuid;
  v_reference text;
begin
  -- Clé anti-doublon obligatoire (audit 06) : sans elle, un renvoi pourrait créer une deuxième signature
  if p_cle is null or char_length(p_cle) < 16 then
    raise exception 'cle_invalide';
  end if;

  -- Clé anti-doublon : un renvoi après une coupure ne crée rien
  select s.id, s.invitation_id into v_existante, v_invitation_existante
  from public.signatures s
  where s.cle_idempotence = p_cle;
  if v_existante is not null then
    if v_invitation_existante is distinct from p_invitation_id then
      raise exception 'cle_invalide';
    end if;
    return public.resultat_signature(v_existante, true);
  end if;

  -- L'invitation est verrouillée jusqu'à la fin de la transaction
  select * into v_inv from public.invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'lien_invalide';
  end if;

  -- Deux envois simultanés avec la même clé : le second, après le verrou, retrouve le premier (audit 06)
  select s.id into v_existante from public.signatures s
  where s.cle_idempotence = p_cle and s.invitation_id = p_invitation_id;
  if v_existante is not null then
    return public.resultat_signature(v_existante, true);
  end if;

  -- Signature retirée ou refusée par un admin : ce lien ne peut plus signer (prompt 07)
  if v_inv.verification = 'rejete' then
    raise exception 'signature_refusee';
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
    raise exception 'deja_signe';
  end if;

  -- La signature porte sur la version courante (D24)
  select * into v_version
  from public.manifeste_versions v
  where v.manifeste_id = v_man.id
  order by v.numero desc
  limit 1;
  if not found then
    raise exception 'aucune_version';
  end if;

  insert into public.signatures (
    manifeste_id, invitation_id, manifeste_version_id, origine,
    prenom, nom, fonction, entreprise_nom, maillon_libelle,
    trace, texte_consentement, cle_idempotence, validee, appareil
  )
  values (
    v_man.id, v_inv.id, v_version.id, 'en_ligne',
    btrim(p_signature->>'prenom'), btrim(p_signature->>'nom'), btrim(p_signature->>'fonction'),
    btrim(p_signature->>'entreprise'), btrim(p_signature->>'maillon'),
    p_signature->'trace', v_man.texte_consentement, p_cle,
    coalesce((p_verification->>'validee')::boolean, false),
    nullif(p_signature->>'appareil', '')
  )
  returning id, reference into v_signature_id, v_reference;

  if v_inv.personne_id is not null then
    -- Consentement à la publication, avec le texte exact présenté
    insert into public.consentements (personne_id, type, accorde, texte, source)
    values (v_inv.personne_id, 'signature_publique', true, v_man.texte_consentement, 'signature');

    -- La version du CEO prime (D20). L'entreprise n'est pas renommée ici :
    -- un nom différent reste dans saisie_ceo et dans la signature, et passe par « À vérifier ».
    update public.personnes
    set prenom = btrim(p_signature->>'prenom'),
        nom = btrim(p_signature->>'nom'),
        fonction = nullif(btrim(p_signature->>'fonction'), ''),
        telephone = nullif(btrim(p_signature->>'telephone'), '')
    where id = v_inv.personne_id;
  end if;

  update public.invitations
  set statut_envoi = 'signe',
      ouvert_le = coalesce(ouvert_le, now()),
      saisie_ceo = p_signature->'saisie',
      verification = (p_verification->>'verification')::public.etat_verification,
      motif = nullif(p_verification->>'motif', '')::public.motif_verification
  where id = v_inv.id;

  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'ceo', v_inv.id, 'signature_enregistree', 'ceo', v_inv.id,
    jsonb_build_object(
      'nom', btrim(p_signature->>'prenom') || ' ' || btrim(p_signature->>'nom'),
      'entreprise', btrim(p_signature->>'entreprise'),
      'reference', v_reference,
      'version', v_version.numero
    )
  );

  return public.resultat_signature(v_signature_id, false);
end;
$$;

revoke execute on function public.enregistrer_signature(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_signature(uuid, text, jsonb, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- 8. Lien ouvert : la limite d'inscriptions s'applique toujours ;
-- brouillon refusé pour un lien dont la signature a été refusée (remplacent 0005).
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
  if v_inv.verification = 'rejete' then
    raise exception 'signature_refusee';
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

revoke execute on function public.inscrire_par_lien_ouvert(uuid, jsonb, text, text, text, text, text, int) from public, anon, authenticated;
revoke execute on function public.enregistrer_brouillon(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.inscrire_par_lien_ouvert(uuid, jsonb, text, text, text, text, text, int) to service_role;
grant execute on function public.enregistrer_brouillon(uuid, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- 9. Décisions des admins : rien n'entre dans l'annexe après la publication ;
-- « Rétablir » ne touche que la signature de ce CEO (remplacent 0006).
-- ---------------------------------------------------------------------
create or replace function public.confirmer_signature(p_invitation_id uuid, p_decision text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admin uuid := public.exiger_admin();
  v_inv public.invitations%rowtype;
  v_sig public.signatures%rowtype;
  v_action text;
begin
  if p_decision not in ('verifiee', 'validee', 'deux_gardees') then
    raise exception 'decision_invalide';
  end if;
  select * into v_inv from public.invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'lien_invalide';
  end if;
  if v_inv.verification <> 'a_verifier' then
    raise exception 'deja_traite';
  end if;
  if exists (select 1 from public.manifestes m where m.id = v_inv.manifeste_id and m.statut = 'publie') then
    raise exception 'document_publie';
  end if;
  select * into v_sig from public.signatures s
  where s.invitation_id = p_invitation_id and s.retiree_le is null
  for update;
  if not found then
    raise exception 'aucune_signature';
  end if;

  update public.signatures set validee = true where id = v_sig.id;
  update public.invitations
  set verification = 'valide', decision = p_decision, decision_signature_id = v_sig.id,
      verifie_par = v_admin, verifie_le = now()
  where id = v_inv.id;

  v_action := case p_decision
    when 'validee' then 'signature_validee'
    when 'deux_gardees' then 'doublon_garde'
    else 'signature_verifiee'
  end;
  perform public.journaliser_decision(v_action, v_inv.id, v_sig, null);
  return jsonb_build_object('decision', p_decision);
end;
$$;

create or replace function public.mettre_a_jour_entreprise(p_invitation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admin uuid := public.exiger_admin();
  v_inv public.invitations%rowtype;
  v_sig public.signatures%rowtype;
  v_nom text;
  v_maillon uuid;
  v_ancien text;
begin
  select * into v_inv from public.invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'lien_invalide';
  end if;
  if v_inv.verification <> 'a_verifier' then
    raise exception 'deja_traite';
  end if;
  if exists (select 1 from public.manifestes m where m.id = v_inv.manifeste_id and m.statut = 'publie') then
    raise exception 'document_publie';
  end if;
  select * into v_sig from public.signatures s
  where s.invitation_id = p_invitation_id and s.retiree_le is null;
  if not found then
    raise exception 'aucune_signature';
  end if;
  v_nom := nullif(btrim(v_inv.saisie_ceo->>'entreprise'), '');
  if v_nom is null or v_inv.entreprise_id is null then
    raise exception 'aucune_saisie';
  end if;
  select m.id into v_maillon from public.maillons m where m.libelle = btrim(v_inv.saisie_ceo->>'maillon') and m.actif;
  if v_maillon is null then
    raise exception 'maillon_invalide';
  end if;
  -- Un autre nom d'entreprise identique une fois normalisé : refus, rien n'est fusionné
  if exists (
    select 1 from public.entreprises e
    where e.nom_normalise = public.normaliser_nom_entreprise(v_nom) and e.id <> v_inv.entreprise_id
  ) then
    raise exception 'entreprise_existe';
  end if;

  select e.nom into v_ancien from public.entreprises e where e.id = v_inv.entreprise_id;
  update public.entreprises set nom = v_nom, maillon_id = v_maillon where id = v_inv.entreprise_id;
  update public.invitations
  set verification = 'valide', decision = 'entreprise_mise_a_jour', decision_signature_id = v_sig.id,
      verifie_par = v_admin, verifie_le = now()
  where id = v_inv.id;

  perform public.journaliser_decision(
    'entreprise_mise_a_jour', v_inv.id, v_sig,
    jsonb_build_object('ancien_nom', v_ancien, 'nouveau_nom', v_nom)
  );
  return jsonb_build_object('entreprise', v_nom);
end;
$$;

create or replace function public.retablir_signature(p_invitation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admin uuid := public.exiger_admin();
  v_inv public.invitations%rowtype;
  v_man public.manifestes%rowtype;
  v_sig public.signatures%rowtype;
begin
  select * into v_inv from public.invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'lien_invalide';
  end if;
  if v_inv.verification <> 'rejete' or v_inv.decision_signature_id is null then
    raise exception 'rien_a_retablir';
  end if;
  select * into v_man from public.manifestes m where m.id = v_inv.manifeste_id;
  if v_man.statut <> 'gele' then
    raise exception 'signatures_fermees';
  end if;
  if now() > v_man.date_limite then
    raise exception 'date_limite_depassee';
  end if;
  if exists (
    select 1 from public.signatures s where s.invitation_id = p_invitation_id and s.retiree_le is null
  ) then
    raise exception 'deja_signe';
  end if;
  select * into v_sig from public.signatures s
  where s.id = v_inv.decision_signature_id and s.invitation_id = p_invitation_id
  for update;
  if not found then
    raise exception 'rien_a_retablir';
  end if;

  update public.signatures set retiree_le = null, validee = true where id = v_sig.id;
  update public.invitations
  set verification = 'valide', decision = 'retablie', statut_envoi = 'signe',
      verifie_par = v_admin, verifie_le = now()
  where id = v_inv.id;

  perform public.journaliser_decision('signature_retablie', v_inv.id, v_sig, null);
  return jsonb_build_object('reference', v_sig.reference);
end;
$$;

revoke execute on function public.confirmer_signature(uuid, text) from public, anon;
revoke execute on function public.mettre_a_jour_entreprise(uuid) from public, anon;
revoke execute on function public.retablir_signature(uuid) from public, anon;
grant execute on function public.confirmer_signature(uuid, text) to authenticated;
grant execute on function public.mettre_a_jour_entreprise(uuid) to authenticated;
grant execute on function public.retablir_signature(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 10. Buckets : toujours privés, même si l'un d'eux a été rendu public à la main ;
-- taille et type limités pour les photos (400 Ko, JPEG) et les accusés (5 Mo, PDF).
-- ---------------------------------------------------------------------
update storage.buckets set public = false where id in ('imports', 'photos', 'exports', 'accuses');
update storage.buckets set file_size_limit = 409600, allowed_mime_types = array['image/jpeg'] where id = 'photos';
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['application/pdf'] where id = 'accuses';
