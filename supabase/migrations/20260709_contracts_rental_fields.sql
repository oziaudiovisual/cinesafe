-- ============================================================================
-- Contratos de aluguel: horários, combinação de pagamento e chave PIX
--
-- Adiciona à tabela public.contracts os campos que faltavam para a logística
-- de aluguel entre as duas partes:
--   - hora de retirada / devolução (além da data)
--   - quando/como o pagamento acontece (antecipado, na retirada, na devolução,
--     ou numa data combinada) + a data-limite quando for "data"
--   - a chave PIX do locador (recebedor), para o locatário pagar
--
-- COMO APLICAR: cole no Supabase -> SQL Editor -> Run. Idempotente.
-- Não mexe em RLS (as policies de `contracts` já existem e continuam valendo:
-- leitura/escrita pelas partes). Ver docs/04-security.md §3.8.
-- ============================================================================

alter table public.contracts add column if not exists pickup_time      text;   -- 'HH:MM'
alter table public.contracts add column if not exists return_time      text;   -- 'HH:MM'
alter table public.contracts add column if not exists payment_timing   text;   -- antecipado | na_retirada | na_devolucao | data
alter table public.contracts add column if not exists payment_due_date date;   -- usado quando payment_timing = 'data'
alter table public.contracts add column if not exists pix_key          text;   -- chave PIX do recebedor
alter table public.contracts add column if not exists pickup_photos    jsonb;  -- vistoria na retirada: [{url,by,at}]
alter table public.contracts add column if not exists return_photos    jsonb;  -- vistoria na devolução: [{url,by,at}]

-- (Opcional) validação do domínio de payment_timing. NOT VALID: não checa
-- linhas antigas (que têm NULL), só novas inserções.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contracts'::regclass and conname = 'contracts_payment_timing_check'
  ) then
    alter table public.contracts
      add constraint contracts_payment_timing_check
      check (payment_timing is null or payment_timing in ('antecipado','na_retirada','na_devolucao','data'))
      not valid;
  end if;
end $$;
