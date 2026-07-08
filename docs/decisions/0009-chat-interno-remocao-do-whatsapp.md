# ADR 0009 — Chat interno como canal único (remoção do WhatsApp)

> Toda negociação acontece dentro do app, por um chat interno em tempo real; o WhatsApp foi removido como canal.

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

Versões anteriores encaminhavam o contato entre usuários para o WhatsApp (botão
"Conversar no WhatsApp" e links `wa.me`, além de compartilhamento de convite por
WhatsApp). Isso tirava a negociação de dentro da plataforma — incoerente com a
proposta de proteção do produto (rastreabilidade, reputação, contratos e alertas
de não-devolução só fazem sentido se a conversa e o acordo ficam registrados no
sistema). O commit `971c78a` (`refactor: remove WhatsApp — toda conversa fica
dentro do app`) consolidou a decisão.

## Decisão

Adotar um **chat interno em tempo real como canal único** de conversa, e
**remover o WhatsApp**. Implementado em `services/chatService.ts` sobre a coleção
`chats` + subcoleção `chats/{id}/messages`.

### Identidade determinística de conversa

O `chatId` é derivado dos dois participantes ordenados, de modo que abrir conversa
com a mesma pessoa sempre cai no **mesmo** documento (idempotente):

```ts
// services/chatService.ts
const chatIdFor = (a, b) => [a, b].sort().join('__');
```

- `openChat` cria o doc se não existir, com `participants` e `participantInfo`
  denormalizado (ver [ADR 0003](0003-denormalizacao-no-cliente.md)).
- `sendMessage` adiciona a mensagem e atualiza `lastMessage/lastMessageAt/lastSenderId`.
- `subscribeMessages` escuta em tempo real (`onSnapshot`, `orderBy('createdAt')`).
- `subscribeUserChats` lista as conversas do usuário e **ordena no cliente** por
  recência, evitando a necessidade de um índice composto.

### Reforço nas regras

As Firestore Rules restringem `chats`/`messages` aos participantes, e a mensagem
só pode ser criada pelo próprio `senderId` (ver [ADR 0005](0005-firestore-rules-por-campo.md)).
Mensagens são imutáveis (`update, delete: if false`).

### Escopo da remoção (commit `971c78a`)

- Notificações: removido o botão "Conversar no WhatsApp" e o fluxo `wa.me`;
  passa a "Conversar no app".
- `ReferralModal`: removido o compartilhamento por WhatsApp (mantido "copiar
  link"); corrigidos os textos de limite do plano grátis (5 itens, 5
  verificações, 3 contatos — coerente com [ADR 0004](0004-freemium-por-indicacao.md)).
- Rótulos "WhatsApp" trocados por "Telefone" em perfil, home, ranking e tipos.

## Consequências

**Positivas**

- Toda negociação fica registrada na plataforma, sustentando reputação,
  contratos e alertas de não-devolução.
- Nada de conversa saindo do sistema — coerente com a proposta de proteção.
- Chat em tempo real sem servidor próprio (usa `onSnapshot`).

**Negativas / trade-offs**

- Perde-se a familiaridade e as notificações push nativas do WhatsApp; o usuário
  precisa voltar ao app para ver mensagens.
- Ordenação de conversas no cliente evita índice composto, mas carrega todas as
  conversas do usuário para ordenar em memória.
- O telefone ainda circula, porém apenas via notificação (`fromUserPhone`) e sob
  o limite de contatos — não é denormalizado na vitrine (ver
  [ADR 0003](0003-denormalizacao-no-cliente.md)).

## Referências cruzadas

- [ADR 0003 — Denormalização no cliente](0003-denormalizacao-no-cliente.md)
- [ADR 0005 — Firestore Rules por campo](0005-firestore-rules-por-campo.md)
- [Feature: Chat](../features/chat.md)
- [Feature: Notificações](../features/notifications.md)

## Fontes no código

- `services/chatService.ts` (`chatIdFor`, `openChat`, `sendMessage`, `subscribeMessages`, `subscribeUserChats`)
- `firestore.rules` (bloco `chats` / `messages`)
- Commit `971c78a` (`refactor: remove WhatsApp — toda conversa fica dentro do app`)
