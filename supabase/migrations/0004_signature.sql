-- =====================================================================
-- 0004_signature.sql
-- Signature d'un CEO depuis son lien personnel, en une seule transaction,
-- et numéro WhatsApp de la Task Force (bouton « Une question ? »).
--
-- À coller en une seule fois dans le SQL Editor de Supabase, après 0003.
-- Idempotente : une deuxième exécution ne provoque aucune erreur.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Numéro WhatsApp de la Task Force, au format international (+221...)
-- ---------------------------------------------------------------------
alter table public.manifestes add column if not exists whatsapp_task_force text;


-- ---------------------------------------------------------------------
-- 2. Résultat renvoyé au CEO : référence, date, version, informations imprimées
-- ---------------------------------------------------------------------
create or replace function public.resultat_signature(p_signature_id uuid, p_deja boolean)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'reference', s.reference,
    'signe_le', s.signe_le,
    'version', v.numero,
    'prenom', s.prenom,
    'nom', s.nom,
    'fonction', s.fonction,
    'entreprise', s.entreprise_nom,
    'maillon', s.maillon_libelle,
    'validee', s.validee,
    'invitation_id', s.invitation_id,
    'deja', p_deja
  )
  from public.signatures s
  join public.manifeste_versions v on v.id = s.manifeste_version_id
  where s.id = p_signature_id;
$$;


-- ---------------------------------------------------------------------
-- 3. Enregistrement d'une signature.
-- Appelée par le serveur avec la clé secrète, après validation du jeton
-- et de la saisie. Les règles sont contrôlées ici une dernière fois,
-- dans la même transaction que l'écriture :
--   - clé anti-doublon : une clé déjà enregistrée renvoie la signature existante ;
--   - Manifeste au statut « gelé » ;
--   - date limite non dépassée (même sans clôture manuelle) ;
--   - une seule signature active par invitation.
-- p_signature : { prenom, nom, fonction, entreprise, maillon, telephone, trace, appareil, saisie }
-- p_verification : { validee, verification, motif }
-- Codes d'erreur (message) : cle_invalide, lien_invalide, signatures_fermees,
--   date_limite_depassee, deja_signe, aucune_version.
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
-- 4. Droits : ces fonctions ne sont exécutables que par le serveur (clé secrète)
-- ---------------------------------------------------------------------
revoke execute on function public.resultat_signature(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.enregistrer_signature(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.resultat_signature(uuid, boolean) to service_role;
grant execute on function public.enregistrer_signature(uuid, text, jsonb, jsonb) to service_role;
