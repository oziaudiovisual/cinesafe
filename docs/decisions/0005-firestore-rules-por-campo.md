# ADR 0005 — Firestore Rules com validação por campo

> Como não há backend, as Firestore Rules são a fronteira de segurança; a regra de `users` valida campo a campo para impedir escalonamento de privilégio.

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

Com a aplicação client-only ([ADR 0001](0001-firebase-baas-client-only.md)),
qualquer escrita chega ao Firestore direto do navegador. Ao mesmo tempo, o
produto exige **escritas cruzadas legítimas**: um usuário A precisa tocar o
documento do usuário B para criar uma conexão mútua, incrementar
`notificationStats`, registrar `transactionHistory` ou processar um referral. Um
"allow all" abriria a porta para adulteração; um "só o dono escreve o próprio
doc" quebraria esses fluxos.

## Decisão

Escrever `firestore.rules` com **validação por campo** (defesa contra
escalonamento de privilégio), em vez de regras binárias por documento. Helpers:
`isSignedIn()`, `isOwner(uid)`, `isAdmin()` (que lê o `role` do próprio doc do
usuário) e `contractData(cid)`.

### Regra de `users` (o núcleo da decisão)

```
allow update: if isAdmin()
  || (isOwner(userId)
      && request.resource.data.role == resource.data.role
      && request.resource.data.get('isBlocked', false) == resource.data.get('isBlocked', false)
      && request.resource.data.get('referralCount', 0) == resource.data.get('referralCount', 0))
  || (isSignedIn() && request.auth.uid != userId
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['connections', 'notificationStats', 'transactionHistory', 'referralCount']));
```

Três caminhos:

1. **Admin** faz tudo (painel: promover, bloquear, excluir).
2. **Dono** edita o próprio perfil, **exceto** `role`, `isBlocked` e
   `referralCount` — senão viraria admin, se desbloquearia ou se auto-promoveria
   a Premium (ver [ADR 0004](0004-freemium-por-indicacao.md)).
3. **Outro usuário** só pode alterar exatamente os quatro campos das escritas
   cruzadas (`connections`, `notificationStats`, `transactionHistory`,
   `referralCount`) via `diff().affectedKeys().hasOnly(...)` — não sobrescreve
   nome/perfil alheio.

### Outras regras-chave (mesmo princípio de menor privilégio)

| Coleção | Leitura | Escrita (destaque) |
| --- | --- | --- |
| `equipment` | pública só se `SAFE` **e** (`isForRent` ou `isForSale`); autenticado lê tudo | dono/admin; destinatário de `TRANSFER_PENDING` pode **aceitar** (vira dono) ou **recusar** (volta a `SAFE`, limpa `pendingTransferTo`) |
| `notifications` | só o `toUserId` | qualquer autenticado cria se assinar como `fromUserId`; só o destinatário atualiza/apaga |
| `theft_history` | autenticado | cria se `ownerId == auth.uid`; **imutável** (`update, delete: if false`) |
| `chats` / `messages` | só participantes | mensagem só criada pelo próprio `senderId` participante; mensagens imutáveis |
| `contracts` | as duas partes ou admin | criador é `ownerId` e está em `parties`; sem delete |
| `return_alerts` | **pública** | só o dono de um contrato **real** contra o locatário **real** daquele contrato (`contractData(...)` valida) |
| `ads` | pública | métricas por autenticado; criar/excluir só admin |

Destaque de `return_alerts`: o `create` é *grounded* — checa contra o contrato
real (`contractData(id).ownerId == auth.uid` e `.counterpartyId == renterId`),
impedindo acusação fabricada de não-devolução.

## Consequências

**Positivas**

- Fecha o buraco de escalonamento de privilégio (auto-promoção a admin/Premium,
  auto-desbloqueio) sem precisar de Cloud Functions.
- Permite os fluxos cruzados legítimos com escopo mínimo de campos.
- Leitura pública restrita ao estritamente necessário (só itens do marketplace e
  alertas/anúncios públicos).

**Negativas / trade-offs**

- As regras impedem *quais campos* mudam, mas **não** validam o *valor* de negócio
  (ex.: um usuário mal-intencionado ainda poderia inflar `referralCount` alheio
  dentro do conjunto permitido, ou o `transactionHistory`). Blindar isso exige
  mover as escritas cruzadas para Cloud Functions — registrado como pendência
  em [ADR 0006](0006-limites-no-cliente-pendente-cloud-functions.md) e em
  `FIREBASE_RULES.md`.
- `isAdmin()` faz um `get()` extra do doc do usuário por avaliação de regra
  (custo/latência).

## Referências cruzadas

- [ADR 0001 — Firebase client-only](0001-firebase-baas-client-only.md)
- [ADR 0006 — Limites no cliente (Cloud Functions pendente)](0006-limites-no-cliente-pendente-cloud-functions.md)
- [Segurança](../04-security.md)
- [FIREBASE_RULES.md (raiz)](../../FIREBASE_RULES.md)

## Fontes no código

- `firestore.rules` (regras de `users`, `equipment`, `notifications`, `theft_history`, `chats`, `contracts`, `return_alerts`, `ads`, `stats`)
- `FIREBASE_RULES.md` (nota de defesa em profundidade pendente)
