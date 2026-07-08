# Decisões de Arquitetura (ADRs)

> Registro das decisões técnicas estruturais do Cine Safe — o *porquê* por trás do código, não só o *o quê*.

Um **ADR** (Architecture Decision Record) é um documento curto e imutável que
captura **uma** decisão de arquitetura relevante, o contexto em que foi tomada,
a decisão em si e suas consequências (boas e ruins). O objetivo é dar
rastreabilidade: quando alguém — pessoa ou agente de IA — encontrar uma escolha
não óbvia no código (ex.: "por que não há backend?", "por que os limites do
plano grátis são checados no cliente?"), o ADR responde sem arqueologia de
commits.

## Convenções

- **Numeração sequencial** e imutável: `NNNN-titulo-em-kebab-case.md`. Um ADR
  nunca é reescrito para mudar a decisão; se a decisão mudar, cria-se um novo ADR
  que **supera** (supersedes) o anterior, e o antigo passa a `Status: Substituído`.
- **Formato fixo**: Título, Status, Data, (propósito em blockquote), Contexto, Decisão, Consequências.
- **Status possíveis**: `Proposto`, `Aceito`, `Substituído`, `Depreciado`.
- Todo ADR cita as **fontes no código** que o fundamentam (rastreabilidade).

## Índice

| ADR | Título | Status | Data |
| --- | --- | --- | --- |
| [0001](0001-firebase-baas-client-only.md) | Firebase como BaaS, aplicação client-only | Aceito | 2026-07-08 |
| [0002](0002-hashrouter-spa.md) | HashRouter para a SPA | Aceito | 2026-07-08 |
| [0003](0003-denormalizacao-no-cliente.md) | Denormalização de dados no cliente | Aceito | 2026-07-08 |
| [0004](0004-freemium-por-indicacao.md) | Freemium destravado por indicação (referral) | Aceito | 2026-07-08 |
| [0005](0005-firestore-rules-por-campo.md) | Firestore Rules com validação por campo | Aceito | 2026-07-08 |
| [0006](0006-limites-no-cliente-pendente-cloud-functions.md) | Limites de uso no cliente (Cloud Functions pendente) | Aceito | 2026-07-08 |
| [0007](0007-code-splitting-e-resiliencia-chunk-stale.md) | Code-splitting e resiliência a *chunk stale* | Aceito | 2026-07-08 |
| [0008](0008-busca-e-paginacao-sem-servico-externo.md) | Busca e paginação sem serviço externo | Aceito | 2026-07-08 |
| [0009](0009-chat-interno-remocao-do-whatsapp.md) | Chat interno como canal único (remoção do WhatsApp) | Aceito | 2026-07-08 |

## Como escrever um novo ADR

1. Copie o formato de um ADR existente.
2. Use o próximo número livre.
3. Comece com `Status: Proposto`; mude para `Aceito` quando a decisão entrar no
   código.
4. Registre honestamente as consequências negativas e os pontos pendentes — um
   ADR sem *trade-offs* é propaganda, não documentação.

## Referências cruzadas

- [Visão geral da arquitetura](../02-architecture.md)
- [Modelo de dados](../03-data-model.md)
- [Segurança](../04-security.md)
- [Referência de serviços](../reference/services.md)
- [Regras do Firestore (raiz)](../../FIREBASE_RULES.md)

## Fontes no código

- `firestore.rules`
- `services/firebase.ts`
- `App.tsx`
- `vite.config.ts`
- `services/equipmentService.ts`
- `services/userService.ts`
- `services/chatService.ts`
- `services/contractService.ts`
- `services/notificationService.ts`
- `FIREBASE_RULES.md`
