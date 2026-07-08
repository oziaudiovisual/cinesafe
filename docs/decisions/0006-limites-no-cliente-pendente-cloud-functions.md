# ADR 0006 — Limites de uso no cliente (Cloud Functions pendente)

> Os limites do plano gratuito e algumas escritas de negócio são aplicados no cliente; migrá-los para Cloud Functions é uma pendência assumida.

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

O freemium ([ADR 0004](0004-freemium-por-indicacao.md)) impõe tetos: 5 itens no
inventário, 5 verificações de serial/mês, 3 contatos/mês. As Firestore Rules
([ADR 0005](0005-firestore-rules-por-campo.md)) sabem proteger *quais campos*
mudam, mas **não conseguem** validar de forma robusta lógica temporal como
"quantas verificações este usuário fez neste mês" nem recalcular reputação — isso
exigiria estado agregado e confiável do lado do servidor. Não há backend nem
Cloud Functions ([ADR 0001](0001-firebase-baas-client-only.md)).

## Decisão

**Aplicar os limites e alguns cálculos derivados no cliente**, em
`services/userService.ts`, aceitando conscientemente que é uma barreira de
produto (UX), não uma fronteira de segurança forte — e registrar a migração para
Cloud Functions como próximo passo.

### O que roda no cliente

| Lógica | Função | Natureza |
| --- | --- | --- |
| Checagem de limite antes da ação | `checkLimit(userId, 'inventory' \| 'check' \| 'contact')` | Lê o usuário e conta/compara com `FREE_LIMITS` |
| Incremento de uso mensal | `incrementUsage(userId, 'check' \| 'contact')` | Grava `usageStats.{serialChecks,contactReveals}.{count,month}` |
| Reputação | `calculateReputation(user, equipment)` | **Calculada no cliente, não autoritativa** — `reputationPoints` é recomputado a cada `getUserProfile`/`getAllUsers` |

```ts
// services/userService.ts — reputação é derivada no cliente, não persistida como verdade
user.reputationPoints = calculateReputation(user, equipment);
```

O contador mensal compara `stats.month` com `new Date().toISOString().slice(0,7)`;
Premium e admin ignoram os limites (`checkLimit` retorna `true` cedo).

## Consequências

**Positivas**

- Entrega o comportamento de freemium sem infraestrutura de servidor.
- `reputationPoints` nunca fica "preso" defasado: é sempre recalculado na leitura.

**Negativas / trade-offs**

- **Contornável por cliente adulterado:** quem editar o front ou chamar o SDK
  direto pode furar os limites ou forjar `usageStats`. As regras não impedem isso
  hoje.
- `reputationPoints` gravado no doc pode divergir do valor recalculado; o valor de
  exibição é o recalculado.
- Contagem de inventário usa `getCountFromServer` (barato), mas as checagens de
  serial/contato dependem de campos que o próprio usuário grava.

### Pendência registrada

`FIREBASE_RULES.md` documenta explicitamente a defesa em profundidade pendente:

> Mover as escritas cruzadas para Cloud Functions (para que nem os campos de
> fluxo possam ser adulterados entre usuários) e validar os limites de uso no
> servidor. Isso exige um ambiente de teste (emulador do Firebase com Java, ou
> staging) para não arriscar os fluxos de autenticação em produção — ficou como
> próximo passo.

## Referências cruzadas

- [ADR 0001 — Firebase client-only](0001-firebase-baas-client-only.md)
- [ADR 0004 — Freemium por indicação](0004-freemium-por-indicacao.md)
- [ADR 0005 — Firestore Rules por campo](0005-firestore-rules-por-campo.md)
- [Segurança](../04-security.md)
- [FIREBASE_RULES.md (raiz)](../../FIREBASE_RULES.md)

## Fontes no código

- `services/userService.ts` (`FREE_LIMITS`, `checkLimit`, `incrementUsage`, `calculateReputation`, `getUserProfile`, `getAllUsers`)
- `FIREBASE_RULES.md` (bloco "Defesa em profundidade pendente")
