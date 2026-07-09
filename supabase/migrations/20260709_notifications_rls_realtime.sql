-- ============================================================================
-- Notificações: RLS de INSERT + Realtime
-- Corrige: "enviei interesse de aluguel/venda e o proprietário não recebeu".
--
-- CAUSA RAIZ
--   public.notifications está com RLS habilitado, mas SEM uma policy de INSERT
--   que aceite o remetente autenticado. Todo envio do cliente
--   (services/notificationService.ts -> supabase.from('notifications').upsert)
--   é negado pela RLS e o serviço engolia o erro (retornava false sem avisar a
--   UI). Sintoma: remetente vê "enviado", destinatário nunca recebe.
--
--   Isso afeta TODOS os tipos disparados pelo cliente — interesse de aluguel,
--   interesse de compra, alerta de item roubado, convite/aceite de conexão,
--   transferência de posse e aviso de contrato atrasado. Os inserts feitos por
--   funções SECURITY DEFINER de sorteio (participar_sorteio, etc.) NÃO passam
--   por esta RLS, por isso o lembrete de sorteio continuava funcionando.
--
-- COMO APLICAR
--   Cole este arquivo inteiro no Supabase -> SQL Editor -> Run.
--   É idempotente (pode rodar mais de uma vez) e apenas (re)cria as policies no
--   modelo já documentado em docs/features/notifications.md — não afeta nenhuma
--   escrita legítima.
--
-- MODELO DE ACESSO (igual ao documentado)
--   select / update / delete  -> só o destinatário   (to_user_id  = auth.uid())
--   insert                    -> remetente assinado   (from_user_id = auth.uid())
-- ============================================================================

begin;

-- Garante RLS ligado (idempotente).
alter table public.notifications enable row level security;

-- Privilégio de tabela para o papel autenticado (a RLS ainda filtra por policy).
grant select, insert, update, delete on public.notifications to authenticated;

-- SELECT: só o destinatário lê as próprias notificações.
drop policy if exists notifications_select_recipient on public.notifications;
create policy notifications_select_recipient on public.notifications
  for select using (to_user_id = auth.uid());

-- INSERT: qualquer autenticado cria, DESDE QUE assine como remetente
--         (impede forjar notificação em nome de terceiro). ESTE é o buraco.
drop policy if exists notifications_insert_sender on public.notifications;
create policy notifications_insert_sender on public.notifications
  for insert with check (from_user_id = auth.uid());

-- UPDATE: só o destinatário (ex.: marcar como lida).
drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient on public.notifications
  for update using (to_user_id = auth.uid()) with check (to_user_id = auth.uid());

-- DELETE: só o destinatário (faxina de expiradas / aceite de conexão/transferência).
drop policy if exists notifications_delete_recipient on public.notifications;
create policy notifications_delete_recipient on public.notifications
  for delete using (to_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Realtime: entrega ao vivo via postgres_changes. O app assina
-- notificationService.subscribeUserNotifications com filtro to_user_id=eq.<uid>.
-- Sem a tabela na publicação, a notificação só apareceria após recarregar.
-- replica identity full: garante que os eventos UPDATE/DELETE carreguem
-- to_user_id para o filtro do canal (INSERT já traz a linha nova completa).
-- ----------------------------------------------------------------------------
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

commit;

-- ============================================================================
-- VERIFICAÇÃO (rode depois de aplicar)
--   -- Deve listar as 4 policies (select/insert/update/delete):
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'notifications'
--    order by cmd;
--
--   -- Deve retornar 1 linha (tabela na publicação de realtime):
--   select 1 from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename = 'notifications';
-- ============================================================================
