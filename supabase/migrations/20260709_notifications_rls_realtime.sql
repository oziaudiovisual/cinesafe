-- ============================================================================
-- Notificações: RLS de INSERT (+ Realtime opcional)
-- Corrige: "enviei interesse de aluguel/venda e o proprietário não recebeu".
--
-- CAUSA RAIZ (confirmada em produção)
--   A tabela public.notifications tinha policies criadas à mão no painel que
--   contradiziam o modelo do app. Em especial, uma policy de INSERT legada
--   `notifications_insert_auth` **RESTRICTIVE** com `to_user_id = auth.uid()`:
--   como policies RESTRICTIVE se combinam por AND, ela permitia criar notificação
--   apenas PARA SI MESMO — bloqueando (HTTP 403 / 42501) qualquer aviso a OUTRO
--   usuário (interesse de aluguel/venda, alerta de roubo, convite, transferência,
--   atraso). Os inserts de sorteio (funções SECURITY DEFINER) ignoram a RLS, por
--   isso só aqueles funcionavam.
--
-- COMO APLICAR
--   Cole a PARTE 1 no Supabase -> SQL Editor -> Run. É idempotente.
--   A PARTE 2 (realtime) é OPCIONAL e deve ser rodada SEPARADAMENTE (ver nota).
--
-- MODELO DE ACESSO (canônico)
--   select / update / delete  -> só o destinatário   (to_user_id  = auth.uid())
--   insert                    -> remetente assinado   (from_user_id = auth.uid())
-- ============================================================================

-- ====================== PARTE 1 — RLS + policies (ESSENCIAL) =================
alter table public.notifications enable row level security;

grant select, insert, update, delete on public.notifications to authenticated;

-- Modelo canônico (permissive):
drop policy if exists notifications_select_recipient on public.notifications;
create policy notifications_select_recipient on public.notifications
  for select using (to_user_id = auth.uid());

drop policy if exists notifications_insert_sender on public.notifications;
create policy notifications_insert_sender on public.notifications
  for insert with check (from_user_id = auth.uid());

drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient on public.notifications
  for update using (to_user_id = auth.uid()) with check (to_user_id = auth.uid());

drop policy if exists notifications_delete_recipient on public.notifications;
create policy notifications_delete_recipient on public.notifications
  for delete using (to_user_id = auth.uid());

-- Remove as policies legadas do painel (a `_insert_auth` RESTRICTIVE era a causa
-- raiz; as `_own` eram duplicatas). Sem elas, sobra só o modelo canônico acima.
drop policy if exists notifications_insert_auth on public.notifications;
drop policy if exists notifications_select_own  on public.notifications;
drop policy if exists notifications_update_own  on public.notifications;
drop policy if exists notifications_delete_own  on public.notifications;

-- Conferência (deve retornar exatamente 4 linhas):
--   select policyname, cmd, permissive from pg_policies
--    where schemaname='public' and tablename='notifications' order by cmd;

-- ====================== PARTE 2 — Realtime (OPCIONAL) =======================
-- Só é preciso para ENTREGA AO VIVO (sem recarregar). Sem isto, a notificação
-- ainda aparece quando o destinatário abre/recarrega o inbox (carga inicial).
--
-- ⚠️ Rode SEPARADO da Parte 1 (selecione só estas 2 linhas -> Run). Se falhar
-- com "must be owner of publication", use o Dashboard:
--   Database -> Replication -> supabase_realtime -> adicionar `notifications`.
--
-- alter table public.notifications replica identity full;
-- alter publication supabase_realtime add table public.notifications;
