-- ============================================================================
-- Antifraude de Sorteios (Fase 1)
-- Spec: docs/superpowers/specs/2026-07-08-antifraude-sorteios-design.md
--
-- COMO APLICAR: cole este arquivo inteiro no Supabase → SQL Editor → Run.
-- É idempotente (pode rodar mais de uma vez com segurança).
--
-- PRESSUPOSTOS (verifique se batem com seu schema real):
--   - tabelas: users, raffles, raffle_tickets, notifications (nomes de coluna
--     em snake_case, conforme os mappers em services/*.ts).
--   - users tem: id (uuid), role, referral_code, referred_by (guarda o CÓDIGO
--     do indicador, não o id), name, avatar_url.
--   - raffle_tickets tem: id, raffle_id, user_id, user_name, user_avatar,
--     source, referred_user_id, referred_user_name, created_at.
--   - raffles tem: id, status, title, prize_image_url, created_by,
--     total_tickets, total_participants, updated_at, end_date.
--   - notifications tem: id, to_user_id, from_user_id, from_user_name, type,
--     created_at, read, message, item_id, item_name, item_image.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Helper: is_admin() — no Postgres não existe o isAdmin() do Firestore.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- 1. Validação de CPF (dígito verificador). Fonte da verdade do antifraude.
-- ----------------------------------------------------------------------------
create or replace function public.is_valid_cpf(p_cpf text)
returns boolean
language plpgsql immutable as $$
declare
  c text;
  s int; i int; r int;
begin
  c := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  if length(c) <> 11 then return false; end if;
  -- rejeita sequências repetidas (000..., 111..., ..., 999...)
  if c ~ ('^(' || substr(c, 1, 1) || '){11}$') then return false; end if;

  -- 1º dígito verificador
  s := 0;
  for i in 1..9 loop
    s := s + (substr(c, i, 1))::int * (11 - i);
  end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  if r <> (substr(c, 10, 1))::int then return false; end if;

  -- 2º dígito verificador
  s := 0;
  for i in 1..10 loop
    s := s + (substr(c, i, 1))::int * (12 - i);
  end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  if r <> (substr(c, 11, 1))::int then return false; end if;

  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Tabela user_cpf — isola o dado sensível (LGPD). 1 CPF = 1 conta (global).
-- ----------------------------------------------------------------------------
create table if not exists public.user_cpf (
  user_id    uuid primary key references public.users(id) on delete cascade,
  cpf        text not null,
  created_at timestamptz not null default now(),
  constraint user_cpf_cpf_unique unique (cpf)
);

alter table public.user_cpf enable row level security;

-- Leitura só do próprio dono ou admin. Nenhuma escrita direta pelo cliente
-- (só via participar_sorteio, que roda como SECURITY DEFINER).
drop policy if exists user_cpf_select_own_or_admin on public.user_cpf;
create policy user_cpf_select_own_or_admin on public.user_cpf
  for select using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.user_cpf from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Migração do source e índices únicos de raffle_tickets.
--    'signup' (legado) -> 'participation'. Roda ANTES dos índices.
-- ----------------------------------------------------------------------------
-- Existe um CHECK antigo que só permite ('signup','referral'); remova antes do
-- relabel e recrie já com os valores novos.
alter table public.raffle_tickets drop constraint if exists raffle_tickets_source_check;

update public.raffle_tickets set source = 'participation' where source = 'signup';

alter table public.raffle_tickets
  add constraint raffle_tickets_source_check check (source in ('participation', 'referral'));

-- 1 ticket de participação por pessoa por sorteio.
create unique index if not exists uq_ticket_participation
  on public.raffle_tickets (raffle_id, user_id)
  where source = 'participation';

-- 1 ticket de referral por convidado por sorteio.
create unique index if not exists uq_ticket_referral
  on public.raffle_tickets (raffle_id, referred_user_id)
  where source = 'referral';

-- ----------------------------------------------------------------------------
-- 4. Trava de escrita: cliente não insere mais ticket "na mão" (fecha o buraco
--    do console). Só as funções SECURITY DEFINER escrevem.
--    Admin continua podendo update/delete (sortear, excluir).
-- ----------------------------------------------------------------------------
revoke insert on public.raffle_tickets from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Defesa-em-profundidade: bloquear alteração de referred_by depois de
--    definido (o auto-referral já é barrado na função; isto é reforço).
--    NÃO usamos GRANT por coluna (quebraria referral_count/connections/etc.).
-- ----------------------------------------------------------------------------
create or replace function public.prevent_referred_by_change()
returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and old.referred_by is distinct from new.referred_by
     and not public.is_admin() then
    raise exception 'referred_by não pode ser alterado';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_referred_by_change on public.users;
create trigger trg_prevent_referred_by_change
  before update on public.users
  for each row execute function public.prevent_referred_by_change();

-- ----------------------------------------------------------------------------
-- 6. participar_sorteio — coração do antifraude.
-- ----------------------------------------------------------------------------
create or replace function public.participar_sorteio(p_raffle_id uuid, p_cpf text)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid          uuid := auth.uid();
  v_cpf          text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_existing_cpf text;
  v_name         text;
  v_avatar       text;
  v_referred     text;
  v_ref_id       uuid;
  v_ref_name     text;
  v_ref_avatar   text;
  v_tickets      int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'code', 'NAO_AUTENTICADO', 'message', 'Sessão inválida. Entre novamente.');
  end if;

  if not public.is_valid_cpf(v_cpf) then
    return json_build_object('ok', false, 'code', 'CPF_INVALIDO', 'message', 'CPF inválido. Confira os números.');
  end if;

  if not exists (select 1 from public.raffles where id = p_raffle_id and status = 'active') then
    return json_build_object('ok', false, 'code', 'SORTEIO_INDISPONIVEL', 'message', 'Este sorteio não está disponível para participação.');
  end if;

  -- CPF do usuário (tabela isolada)
  select cpf into v_existing_cpf from public.user_cpf where user_id = v_uid;
  if v_existing_cpf is not null and v_existing_cpf <> v_cpf then
    return json_build_object('ok', false, 'code', 'CPF_DIVERGENTE', 'message', 'Sua conta já tem outro CPF cadastrado. Fale com o suporte.');
  end if;
  if v_existing_cpf is null then
    begin
      insert into public.user_cpf (user_id, cpf) values (v_uid, v_cpf);
    exception when unique_violation then
      return json_build_object('ok', false, 'code', 'CPF_EM_USO', 'message', 'Este CPF já está participando deste sorteio. Cada pessoa concorre uma vez.');
    end;
  end if;

  select name, avatar_url into v_name, v_avatar from public.users where id = v_uid;

  -- Ticket de participação (idempotente)
  insert into public.raffle_tickets (id, raffle_id, user_id, user_name, user_avatar, source, created_at)
  values (gen_random_uuid(), p_raffle_id, v_uid, v_name, v_avatar, 'participation', now())
  on conflict (raffle_id, user_id) where source = 'participation' do nothing;

  -- Ticket de referral qualificado (resolve indicador pelo CÓDIGO; bloqueia auto-referral)
  select referred_by into v_referred from public.users where id = v_uid;
  if v_referred is not null then
    select id, name, avatar_url into v_ref_id, v_ref_name, v_ref_avatar
      from public.users where referral_code = v_referred limit 1;
    if v_ref_id is not null and v_ref_id <> v_uid then
      insert into public.raffle_tickets (id, raffle_id, user_id, user_name, user_avatar, source, referred_user_id, referred_user_name, created_at)
      values (gen_random_uuid(), p_raffle_id, v_ref_id, v_ref_name, v_ref_avatar, 'referral', v_uid, v_name, now())
      on conflict (raffle_id, referred_user_id) where source = 'referral' do nothing;
    end if;
  end if;

  -- Recalcula contadores (evita drift/corrida)
  update public.raffles set
    total_tickets      = (select count(*) from public.raffle_tickets where raffle_id = p_raffle_id),
    total_participants = (select count(distinct user_id) from public.raffle_tickets where raffle_id = p_raffle_id),
    updated_at         = now()
  where id = p_raffle_id;

  select count(*) into v_tickets from public.raffle_tickets where raffle_id = p_raffle_id and user_id = v_uid;
  return json_build_object('ok', true, 'tickets', v_tickets);
end;
$$;

revoke all on function public.participar_sorteio(uuid, text) from public;
grant execute on function public.participar_sorteio(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. ensure_participation_reminder — lembrete in-app idempotente (>24h sem CPF).
-- ----------------------------------------------------------------------------
create or replace function public.ensure_participation_reminder()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid      uuid := auth.uid();
  v_referred text;
  v_created  timestamptz;
  v_id       uuid; v_title text; v_img text; v_by uuid;
begin
  if v_uid is null then return; end if;

  select referred_by into v_referred from public.users where id = v_uid;
  if v_referred is null then return; end if;                        -- só convidados
  if exists (select 1 from public.user_cpf where user_id = v_uid) then return; end if;  -- já tem CPF

  select created_at into v_created from auth.users where id = v_uid; -- cadastro há > 24h
  if v_created is null or v_created > now() - interval '24 hours' then return; end if;

  select id, title, prize_image_url, created_by into v_id, v_title, v_img, v_by
    from public.raffles where status = 'active' order by end_date asc limit 1;
  if v_id is null then return; end if;                              -- precisa de sorteio ativo

  -- idempotência: 1 lembrete por sorteio
  if exists (
    select 1 from public.notifications
    where to_user_id = v_uid and item_id = v_id::text and type = 'RAFFLE_CPF_REMINDER'
  ) then return; end if;

  insert into public.notifications
    (id, to_user_id, from_user_id, from_user_name, type, created_at, read, message, item_id, item_name, item_image)
  values
    (gen_random_uuid(), v_uid, v_by, 'Cine Safe', 'RAFFLE_CPF_REMINDER', now(), false,
     'Você foi convidado! Complete seu CPF e concorra a ' || v_title || '.', v_id::text, v_title, v_img);
end;
$$;

revoke all on function public.ensure_participation_reminder() from public;
grant execute on function public.ensure_participation_reminder() to authenticated;

-- ----------------------------------------------------------------------------
-- 8. resetar_participacoes_sorteio — migração D9 (rodar UMA vez, quando decidir).
--    Zera tickets do sorteio e notifica reativação. Só admin.
--    Uso: select public.resetar_participacoes_sorteio('<raffle_id>');
-- ----------------------------------------------------------------------------
create or replace function public.resetar_participacoes_sorteio(p_raffle_id uuid)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_title text; v_img text; v_by uuid; v_n int;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Apenas admin.');
  end if;

  select title, prize_image_url, created_by into v_title, v_img, v_by from public.raffles where id = p_raffle_id;

  -- notifica quem tinha ticket (dedup por tipo+sorteio)
  insert into public.notifications
    (id, to_user_id, from_user_id, from_user_name, type, created_at, read, message, item_id, item_name, item_image)
  select gen_random_uuid(), t.user_id, v_by, 'Cine Safe', 'RAFFLE_CPF_REMINDER', now(), false,
         'Reforçamos a proteção do sorteio. Reative sua participação informando seu CPF.', p_raffle_id::text, v_title, v_img
  from (select distinct user_id from public.raffle_tickets where raffle_id = p_raffle_id) t
  where not exists (
    select 1 from public.notifications n
    where n.to_user_id = t.user_id and n.item_id = p_raffle_id::text and n.type = 'RAFFLE_CPF_REMINDER'
  );

  delete from public.raffle_tickets where raffle_id = p_raffle_id;
  get diagnostics v_n = row_count;

  update public.raffles set total_tickets = 0, total_participants = 0, updated_at = now() where id = p_raffle_id;

  return json_build_object('ok', true, 'removed', v_n);
end;
$$;

revoke all on function public.resetar_participacoes_sorteio(uuid) from public;
grant execute on function public.resetar_participacoes_sorteio(uuid) to authenticated; -- guardado por is_admin() interno

commit;

-- ============================================================================
-- PÓS-APLICAÇÃO (opcional, quando quiser fazer o reset do sorteio ativo — D9):
--   select public.resetar_participacoes_sorteio('<COLE_O_ID_DO_SORTEIO_ATIVO>');
--
-- TESTES RÁPIDOS:
--   select public.is_valid_cpf('529.982.247-25');  -- true (CPF de teste válido)
--   select public.is_valid_cpf('111.111.111-11');  -- false
-- ============================================================================
