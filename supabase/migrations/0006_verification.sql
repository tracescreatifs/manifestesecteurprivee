-- =====================================================================
-- 0006_verification.sql
-- Vérification des signatures (« À vérifier ») et traitement des commentaires.
-- Toutes les décisions passent par des fonctions transactionnelles réservées
-- aux admins actifs (est_admin), appelées avec la session de l'admin, et journalisées.
--
-- À coller en une seule fois dans le SQL Editor de Supabase, après 0005.
-- Idempotente : une deuxième exécution ne provoque aucune erreur.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Décision de l'admin sur l'invitation (affichée dans « Traités » et dans la fiche).
-- verification passe à valide ou rejete ; verifie_par et verifie_le existent depuis 0001.
-- decision_signature_id : la signature concernée (pour l'accusé et pour « Rétablir »).
-- ---------------------------------------------------------------------
alter table public.invitations add column if not exists decision text;
alter table public.invitations add column if not exists decision_signature_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invitations_decision_valeurs'
  ) then
    alter table public.invitations add constraint invitations_decision_valeurs
      check (decision is null or decision in (
        'verifiee', 'validee', 'deux_gardees', 'entreprise_mise_a_jour', 'retiree', 'refusee', 'retablie'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'invitations_decision_signature_fkey'
  ) then
    alter table public.invitations add constraint invitations_decision_signature_fkey
      foreign key (decision_signature_id) references public.signatures (id) on delete set null;
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Enregistrement d'une signature (remplace la version de 0004) :
-- un lien dont la signature a été retirée ou refusée par un admin ne peut plus signer.
-- Code d'erreur ajouté : signature_refusee.
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

-- ---------------------------------------------------------------------
-- 3. Outils communs : contrôle de l'admin, signature active, ligne du journal
-- ---------------------------------------------------------------------
create or replace function public.exiger_admin()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'acces_refuse';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.journaliser_decision(
  p_action text,
  p_invitation_id uuid,
  p_signature public.signatures,
  p_extra jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'admin', auth.uid(), p_action, 'ceo', p_invitation_id,
    jsonb_build_object(
      'nom', coalesce(p_signature.prenom, '') || ' ' || coalesce(p_signature.nom, ''),
      'entreprise', p_signature.entreprise_nom,
      'reference', p_signature.reference
    ) || coalesce(p_extra, '{}'::jsonb)
  );
$$;


-- ---------------------------------------------------------------------
-- 4. Confirmer une signature à vérifier :
--   verifiee (modification, ou validation automatique coupée), validee (nouvel inscrit :
--   la signature entre dans l'annexe), deux_gardees (doublon d'entreprise).
-- Codes d'erreur : acces_refuse, lien_invalide, deja_traite, aucune_signature, decision_invalide.
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


-- ---------------------------------------------------------------------
-- 5. Mettre à jour l'entreprise avec la version du CEO (nom et maillon), puis vérifiée.
-- Codes d'erreur : acces_refuse, lien_invalide, deja_traite, aucune_signature,
--   aucune_saisie, maillon_invalide, entreprise_existe.
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- 6. Retirer (modification, doublon, ou toute signature active) ou refuser (nouvel inscrit).
-- La signature n'est jamais effacée : retiree_le est renseigné et la vérification passe à rejete,
-- ce qui empêche ce lien de signer de nouveau. Le motif reste dans le journal, jamais montré au CEO.
-- Impossible après la publication du document.
-- Codes d'erreur : acces_refuse, lien_invalide, aucune_signature, document_publie.
-- ---------------------------------------------------------------------
create or replace function public.retirer_signature_admin(p_invitation_id uuid, p_motif text)
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
  v_decision text;
begin
  select * into v_inv from public.invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'lien_invalide';
  end if;
  select * into v_man from public.manifestes m where m.id = v_inv.manifeste_id;
  if v_man.statut = 'publie' then
    raise exception 'document_publie';
  end if;
  select * into v_sig from public.signatures s
  where s.invitation_id = p_invitation_id and s.retiree_le is null
  for update;
  if not found then
    raise exception 'aucune_signature';
  end if;

  -- Un nouvel inscrit (pas encore dans l'annexe) est « refusé » ; les autres signatures sont « retirées »
  v_decision := case when not v_sig.validee then 'refusee' else 'retiree' end;
  update public.signatures set retiree_le = now() where id = v_sig.id;
  update public.invitations
  set verification = 'rejete', decision = v_decision, decision_signature_id = v_sig.id,
      verifie_par = v_admin, verifie_le = now(), statut_envoi = 'ouvert'
  where id = v_inv.id;

  perform public.journaliser_decision(
    case v_decision when 'refusee' then 'signature_refusee' else 'signature_retiree_admin' end,
    v_inv.id, v_sig,
    case when nullif(btrim(p_motif), '') is null then null else jsonb_build_object('motif', left(btrim(p_motif), 500)) end
  );
  return jsonb_build_object('decision', v_decision, 'reference', v_sig.reference);
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Rétablir une signature retirée ou refusée par un admin, tant que les signatures
-- sont ouvertes (gelé, date limite non passée). Elle redevient active et vérifiée.
-- Codes d'erreur : acces_refuse, lien_invalide, rien_a_retablir, signatures_fermees,
--   date_limite_depassee, deja_signe.
-- ---------------------------------------------------------------------
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
  select * into v_sig from public.signatures s where s.id = v_inv.decision_signature_id for update;
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


-- ---------------------------------------------------------------------
-- 8. Traiter un commentaire : statut et note interne (jamais visibles par le CEO).
-- Codes d'erreur : acces_refuse, commentaire_introuvable.
-- ---------------------------------------------------------------------
create or replace function public.traiter_commentaire(
  p_commentaire_id uuid,
  p_statut public.statut_commentaire,
  p_note text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admin uuid := public.exiger_admin();
  v_com public.commentaires%rowtype;
  v_note text := nullif(btrim(p_note), '');
  v_nom text;
  v_entreprise text;
begin
  select * into v_com from public.commentaires c where c.id = p_commentaire_id for update;
  if not found then
    raise exception 'commentaire_introuvable';
  end if;
  if v_com.statut = p_statut and v_com.note_admin is not distinct from v_note then
    return jsonb_build_object('statut', p_statut, 'inchange', true);
  end if;

  update public.commentaires
  set statut = p_statut, note_admin = v_note, traite_par = v_admin, traite_le = now()
  where id = v_com.id;

  select coalesce(p.prenom, '') || ' ' || coalesce(p.nom, ''), e.nom
  into v_nom, v_entreprise
  from public.invitations i
  left join public.personnes p on p.id = i.personne_id
  left join public.entreprises e on e.id = i.entreprise_id
  where i.id = v_com.invitation_id;

  insert into public.journal (acteur_type, acteur_id, action, cible_type, cible_id, details)
  values (
    'admin', v_admin, 'commentaire_traite', 'ceo', v_com.invitation_id,
    jsonb_build_object(
      'nom', v_nom, 'entreprise', v_entreprise, 'statut', p_statut,
      'statut_precedent', v_com.statut, 'note_modifiee', v_com.note_admin is distinct from v_note
    )
  );
  return jsonb_build_object('statut', p_statut, 'inchange', false);
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Droits : enregistrement de la signature par le serveur seulement ;
-- décisions par les admins connectés (contrôle est_admin dans chaque fonction).
-- ---------------------------------------------------------------------
revoke execute on function public.enregistrer_signature(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_signature(uuid, text, jsonb, jsonb) to service_role;

revoke execute on function public.exiger_admin() from public, anon;
revoke execute on function public.journaliser_decision(text, uuid, public.signatures, jsonb) from public, anon;
revoke execute on function public.confirmer_signature(uuid, text) from public, anon;
revoke execute on function public.mettre_a_jour_entreprise(uuid) from public, anon;
revoke execute on function public.retirer_signature_admin(uuid, text) from public, anon;
revoke execute on function public.retablir_signature(uuid) from public, anon;
revoke execute on function public.traiter_commentaire(uuid, public.statut_commentaire, text) from public, anon;
grant execute on function public.exiger_admin() to authenticated;
-- Appelée par les fonctions ci-dessous avec les droits de l'admin ; la RLS du journal s'applique toujours
grant execute on function public.journaliser_decision(text, uuid, public.signatures, jsonb) to authenticated;
grant execute on function public.confirmer_signature(uuid, text) to authenticated;
grant execute on function public.mettre_a_jour_entreprise(uuid) to authenticated;
grant execute on function public.retirer_signature_admin(uuid, text) to authenticated;
grant execute on function public.retablir_signature(uuid) to authenticated;
grant execute on function public.traiter_commentaire(uuid, public.statut_commentaire, text) to authenticated;
