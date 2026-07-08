# Design — Antifraude de Sorteios (Fase 1)

- **Data:** 2026-07-08
- **Status:** Aprovado (design) — aguardando plano de implementação
- **Revisão:** v3 (v2 incorporou C1, I1–I6, M1–M5; v3 corrige NEW-1/NEW-2/NEW-3)
- **Escopo:** garantir "1 pessoa real = 1 participação" nos sorteios, sem introduzir backend próprio (mantém arquitetura client-only + Supabase/Postgres).

---

## 1. Contexto e problema

Mecânica atual dos sorteios:

- **1 ticket automático no cadastro** (`AuthService.register`; no OAuth, `AuthService.getSession` → `raffleService.grantSignupTicket`).
- **+1 ticket de referral** ao indicador, no cadastro do convidado (`userService.processReferral` → `raffleService.grantReferralTicket`).
- **Sorteio** via `Math.random()` no admin (`raffleService.drawWinner`).

O app é **client-only**: a chave `anon` do Supabase é pública no navegador; RLS/permissões do Postgres são a única fronteira de segurança.

### Vetores de fraude

1. **Auto-fabricação de tickets (crítico).** RLS permite `insert` em `raffle_tickets` com `userId == auth.uid`. Pelo DevTools dá pra inserir tickets ilimitados. Trivial.
2. **Sybil / multi-conta (foco).** N e-mails → N contas → N auto-indicações → N chances.
3. **Referral farming.** Caso particular de (2).
4. **Integridade do sorteio.** `Math.random()` client-side — **fora de escopo** desta fase.

---

## 2. Decisões do brainstorming

| # | Decisão | Escolha |
|---|---|---|
| D1 | Objetivo | Pessoa real: matar "N e-mails → N participações". |
| D2 | Identificador | **CPF** validado por dígito, **único global** (1 CPF = 1 conta). |
| D3 | Robustez | **Fase 1 grátis** (validação por regra). API paga de existência de CPF = Fase 2. |
| D4 | Quando coletar CPF | **Somente ao participar** (não no cadastro/perfil). |
| D5 | Onde a regra roda | **Abordagem A**: funções Postgres `SECURITY DEFINER` + revogar escrita direta + constraints. |
| D6 | Ticket automático no cadastro | **Removido.** Ticket só nasce ao participar com CPF. |
| D7 | Referral | **Qualificado**: indicador ganha ticket quando o **convidado participa com CPF**. |
| D8 | Lembrete de convidados pendentes (>24h sem CPF) | **Notificação in-app**, do CineSafe, idempotente (sem `pg_cron`). |
| D9 | Migração dos tickets atuais | **Reset do sorteio ativo** + reativação com CPF (1 clique). |

---

## 3. Modelo de dados

### 3.1 Nova tabela `user_cpf` (isola o dado sensível) — resolve I2

Em vez de uma coluna `cpf` em `users` (que vazaria em todos os `select('*')` de `getUserProfile`/`getAllUsers`/`searchUsers`/`getConnections`), o CPF fica em tabela separada:

```
user_cpf (
  user_id   uuid  PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cpf       text  NOT NULL,            -- 11 dígitos, sem máscara
  created_at timestamptz DEFAULT now(),
  UNIQUE (cpf)                          -- 1 CPF = 1 conta (global)
)
```

- **RLS:** `SELECT` só do próprio (`user_id = auth.uid()`) ou admin. **Nenhuma** escrita pelo cliente (só via função `participar_sorteio`).
- **LGPD:** dado pessoal minimizado (coletado só de quem participa, D4), isolado, leitura restrita. Consentimento e finalidade declarados no modal (§7.2), com texto versionado.

### 3.2 `raffle_tickets` — unicidade + rename de `source`

- `source` passa a ser `'participation' | 'referral'` (renomeia o antigo `'signup'`).
- **Migração obrigatória antes das constraints (I3):** `UPDATE raffle_tickets SET source='participation' WHERE source='signup'` — aplica a **todos** os sorteios, inclusive concluídos (o reset de §4.3 só toca o ativo).
- Índices únicos parciais:
  - `UNIQUE (raffle_id, user_id) WHERE source='participation'` → 1 participação por pessoa/sorteio.
  - `UNIQUE (raffle_id, referred_user_id) WHERE source='referral'` → 1 referral por convidado/sorteio.
- `types.ts`: atualizar o union `RaffleTicket.source` (M5).

### 3.3 Contadores

`raffles.total_tickets` / `total_participants` são **recalculados por `COUNT()` dentro da função** ao final (evita read-modify-write racy — I4). `total_participants` = nº de `user_id` distintos com ticket `participation`.

### 3.4 `notifications` / `NotificationType` (M3)

- Novo tipo `RAFFLE_CPF_REMINDER` no union `NotificationType` (`types.ts`).
- O lembrete reusa `itemId = raffleId` (não há coluna `raffle_id`); `fromUserId = raffle.createdBy`, `fromUserName = 'Cine Safe'` (mesmo padrão de `RAFFLE_WINNER`).

---

## 4. Lógica no Postgres (Abordagem A)

Funções `SECURITY DEFINER` com `search_path` fixo (`SET search_path = public, pg_temp`). Cliente chama via `supabase.rpc(...)`.

### 4.1 `participar_sorteio(p_raffle_id uuid, p_cpf text) → json`

Transacional:

1. `v_uid := auth.uid()`; rejeita se anônimo.
2. **Normaliza** `v_cpf := regexp_replace(p_cpf, '\D', '', 'g')` (M1) e **valida** `is_valid_cpf(v_cpf)` → senão `CPF_INVALIDO`.
3. **Sorteio** ativo e no período → senão `SORTEIO_INDISPONIVEL`.
4. **CPF do usuário** (tabela `user_cpf`):
   - `SELECT` a linha de `v_uid`: se existir com `cpf <> v_cpf` → `CPF_DIVERGENTE`; se existir com o mesmo `cpf`, segue (idempotente).
   - Senão, inserir dentro de bloco `BEGIN INSERT INTO user_cpf(user_id, cpf) VALUES (v_uid, v_cpf); EXCEPTION WHEN unique_violation THEN <retornar CPF_EM_USO>; END`. **Atenção (NEW-3):** `ON CONFLICT (user_id) DO NOTHING` **não** captura a violação do `UNIQUE(cpf)` de outro dono — é preciso o handler de `unique_violation` para mapear em `CPF_EM_USO`.
5. **Ticket de participação**: `INSERT ... source='participation' ON CONFLICT DO NOTHING` (idempotente pela constraint §3.2).
6. **Ticket de referral qualificado** (corrige C1/I1):
   - Resolver indicador: `SELECT id FROM users WHERE referral_code = (SELECT referred_by FROM users WHERE id = v_uid)`. (`referred_by` guarda o **código**, não o id — I1.)
   - Conceder **somente se**: indicador encontrado **E `indicador.id <> v_uid`** (bloqueia auto-referral — C1) **E** ainda não há ticket `referral` com `referred_user_id = v_uid` neste sorteio.
   - `INSERT ... source='referral', user_id=indicador, referred_user_id=v_uid ON CONFLICT DO NOTHING`.
7. **Recalcular contadores** por `COUNT()` (I4) e `UPDATE raffles`.
8. Retorna `{ ok:true, tickets:<n do usuário neste sorteio> }`.

Erros: `{ ok:false, code, message }` (mensagens §9).

### 4.2 `ensure_participation_reminder() → void` (D8)

Idempotente, chamada no carregamento do app (usuário logado):

1. Só age se há sorteio **ativo**.
2. Só age se o usuário: tem `referred_by` não nulo, **não tem** linha em `user_cpf`, cadastrou-se há **> 24h** (fonte: `auth.users.created_at` — `public.users` não tem `created_at`, M2), e **não existe** ainda notificação `RAFFLE_CPF_REMINDER` com `toUserId=v_uid` e `itemId=raffleId`.
3. Cria **uma** notificação (§3.4): "Você foi convidado! Complete seu CPF e concorra a {prêmio}."

> In-app só alcança quem retorna ao app (decisão D8). Complementa o banner do sorteio com cutucada direcionada.

### 4.3 `resetar_participacoes_sorteio(p_raffle_id uuid)` — migração (admin, D9)

Apaga tickets do sorteio ativo, zera contadores e cria a notificação de reativação para quem tinha ticket. Só admin.

---

## 5. Permissões / RLS (Postgres — corrige C2, I2, M4)

> Nota: os docs `04-security.md`/`03-data-model.md` ainda descrevem regras em sintaxe **Firestore** (divergência pré-existente da migração para Supabase). Ao tocar esses arquivos (§13), reconciliar para Postgres.

- **`raffle_tickets`:** `REVOKE INSERT, UPDATE, DELETE ... FROM authenticated, anon`. Leitura `SELECT` para autenticados. Escrita só via funções `SECURITY DEFINER`.
- **`users` — trigger, NÃO GRANT por coluna (corrige C2 sem quebrar o app — NEW-1):** um `REVOKE UPDATE` + `GRANT UPDATE (colunas)` é *role-wide* e quebraria escritas legítimas do cliente (`referral_count` em `processReferral`, `connections` em add/removeConnection, `usage_stats`, `checks_count`/`reports_count`, `notification_stats`, `transaction_history`) **e** as ações de admin (`role`/`is_blocked`) — além de contradizer o §8. **Manter o modelo de UPDATE atual.** Como o CPF já está isolado em `user_cpf` (I2) e o auto-referral já é barrado dentro da função independentemente do valor de `referred_by` (C1), travar `referred_by` é apenas **defesa-em-profundidade**: implementar via um **`BEFORE UPDATE` trigger** cirúrgico em `users` que rejeita alterar `referred_by` depois de definido (sem tocar nas outras colunas). Defesa extra no cliente: não incluir `referred_by` no caminho de `updateUserProfile`.
- **INSERT de `users` (hardening adjacente — NEW-2):** no INSERT do próprio perfil o cliente ainda define qualquer coluna, inclusive `role='admin'` (escalonamento **pré-existente**, não introduzido aqui). Recomenda-se um trigger/policy que force `role='user'` no INSERT feito pelo cliente e só aceite `referred_by` que corresponda a um `referral_code` existente. Fora do núcleo antifraude, mas relacionado — tratar como hardening adjacente (pode virar tarefa própria).
- **`user_cpf`:** `SELECT` só dono/admin; sem `INSERT/UPDATE/DELETE` para cliente (só função).
- **Funções:** `GRANT EXECUTE` de `participar_sorteio`/`ensure_participation_reminder` a `authenticated`; `resetar_participacoes_sorteio` só admin. Todas `SECURITY DEFINER` + `search_path` fixo.

---

## 6. Validação de CPF (dupla)

- **Cliente** — `utils/cpf.ts`: `isValidCPF(cpf)` (dígitos verificadores; rejeita sequências repetidas tipo `111.111.111-11`) + `maskCPF()` (`000.000.000-00`). Só UX.
- **Banco** — `is_valid_cpf(text)` replicando o algoritmo, com normalização. **Fonte da verdade.**

---

## 7. UI / Fluxo

### 7.1 Página `pages/Raffles.tsx` e `RaffleCard`

- Botão **"Participar do sorteio"** só para quem **ainda não concorre** (sem ticket `participation`).
- Quem concorre vê **"Você está concorrendo 🎟️ — X tickets"**.
- **Corrigir `Raffles.tsx:91`** (M5): o filtro `source === 'signup'` quebra com o rename → usar `'participation'`.

### 7.2 Modal antifraude (`components/RaffleCpfModal.tsx`, React Portal)

> 🛡️ **Nossos sorteios são protegidos contra fraude.**
> Para garantir que cada pessoa concorra **uma vez só**, precisamos do seu CPF. Ele é usado apenas pelo nosso sistema antifraude e para a entrega do prêmio.

- Campo CPF com máscara + validação em tempo real (botão desabilitado enquanto inválido).
- **"Confirmar e participar"** (loading) → `raffleService.participate(raffleId, cpf)` → `rpc('participar_sorteio')`.
- Sucesso → fecha, estado vira "concorrendo". Erro → exibe mensagem (§9).

### 7.3 Serviço

`raffleService.participate(raffleId, cpf)` encapsula o `rpc`. Remover `grantSignupTicket`/`grantReferralTicket` do fluxo de cadastro; a concessão de referral migra para dentro de `participar_sorteio`.

---

## 8. Mudanças no cadastro e referral (D6/D7, I5)

- `AuthService.register` e `AuthService.getSession` (OAuth): **remover** `grantSignupTicket`.
- `userService.processReferral`: **remover** o bloco que concede ticket de sorteio (import dinâmico de `raffleService`, M5). **Manter** o incremento de `referral_count` (métrica do Premium — separada).
- **Referral via Google (I5):** hoje `getSession` não seta `referredBy` e `loginWithGoogle` descarta o `?ref`. Correção: no `Register`/link de convite, **persistir o `ref` em `localStorage`** antes do redirect OAuth; em `getSession`, ao criar o perfil OAuth, ler o `ref`, gravar `referred_by` **no INSERT** (o trigger só bloqueia UPDATE — §5) e **limpar o `ref` do `localStorage` após consumo** (com TTL curto) para não atribuir a conta errada em navegador compartilhado. Sem isso, referral/lembrete excluiriam convidados que entram por Google (provável maioria).

---

## 9. Erros (pt-BR)

| code | Mensagem |
|---|---|
| `CPF_INVALIDO` | "CPF inválido. Confira os números." |
| `CPF_EM_USO` | "Este CPF já está participando deste sorteio. Cada pessoa concorre uma vez." |
| `CPF_DIVERGENTE` | "Sua conta já tem outro CPF cadastrado. Fale com o suporte." |
| `SORTEIO_INDISPONIVEL` | "Este sorteio não está disponível para participação." |
| genérico | "Não foi possível concluir. Tente novamente." |

---

## 10. Migração (D9, I3)

Ordem no rollout:
1. `UPDATE raffle_tickets SET source='participation' WHERE source='signup'` (todos os sorteios).
2. Criar tabela `user_cpf`, constraints e permissões (§3, §5).
3. `resetar_participacoes_sorteio(<sorteio ativo>)` → zera tickets do ativo e notifica reativação.
Impacto baixo (base pequena). Sorteios futuros já nascem protegidos.

---

## 11. Fora de escopo / riscos residuais conhecidos

- **Integridade do sorteio** (draw auditável / RPC) — não solicitado.
- **Fase 2 — API paga de existência de CPF** (Serpro/terceiro) via **Edge Function**: mata o atacante que **gera CPFs válidos**. Construir só com evidência de abuso.
- **Premium ainda farmável (I6):** `referral_count` continua incrementando no cadastro (sem CPF), então N e-mails ainda podem chegar a Premium (`isPremium` = ≥5). A garantia "pessoa real" cobre **tickets de sorteio**, **não** o Premium. Risco aceito nesta fase; documentar para não dar falsa sensação de cobertura total.
- **Lembrete por e-mail/WhatsApp** — só se o alcance in-app se mostrar insuficiente.

---

## 12. Testes / verificação

- **Unidade (cliente):** `isValidCPF` (válido, inválido, sequência repetida, tamanho), `maskCPF`.
- **Banco:** `is_valid_cpf` equivalente ao cliente; `participar_sorteio` — caminho feliz; CPF repetido (2º usuário → `CPF_EM_USO`); CPF divergente; sorteio inativo; **idempotência** (2 cliques → 1 ticket); **auto-referral bloqueado** (indicador = próprio → sem ticket de referral); referral qualificado criado 1x; contadores corretos após corrida.
- **Segurança:** `insert` direto em `raffle_tickets` **negado**; `update` de `referred_by` no próprio `users` **negado pelo trigger** (demais colunas seguem funcionando: `connections`, `usage_stats`, admin `role`/`is_blocked`); `insert/update` em `user_cpf` pelo cliente **negado**; `select` de `user_cpf` de outro usuário **negado**.
- **E2E manual:** convidado (e-mail e Google) → participar → CPF → concorrendo; 2ª conta mesmo CPF → bloqueada; lembrete in-app após 24h.

---

## 13. Impacto em documentação (Documentação Viva)

Atualizar na entrega: `docs/features/raffles.md` (mecânica, RPC, constraints, migração), `docs/features/referral-and-freemium.md` (referral qualificado + OAuth), `docs/03-data-model.md` (`user_cpf`, `source`, `RAFFLE_CPF_REMINDER`), `docs/04-security.md` (revoke + grants por coluna + funções SECURITY DEFINER; reconciliar sintaxe Firestore→Postgres), `docs/reference/components.md` (`RaffleCpfModal`), `docs/reference/services.md` (`raffleService.participate`, funções Postgres), `docs/05-frontend.md` (fluxo/estados) e `types.ts` (unions `RaffleTicket.source` e `NotificationType`).
