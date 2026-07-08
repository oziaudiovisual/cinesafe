# ADR 0004 — Freemium destravado por indicação (referral)

> O plano gratuito tem limites; o Premium não é pago em dinheiro — é destravado indicando 5 pessoas (ou sendo admin).

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

O produto precisa de um mecanismo de crescimento e de um teto de uso no plano
gratuito, mas ainda **não há infraestrutura de pagamento** (sem backend, ver
[ADR 0001](0001-firebase-baas-client-only.md)). A monetização por assinatura
exigiria gateway, faturamento e webhooks de servidor — fora do escopo atual.

## Decisão

Adotar um **freemium viral**: o usuário desbloqueia o Premium **indicando**
`PREMIUM_REFERRALS = 5` pessoas, ou sendo `admin`. Os limites e a regra de
Premium vivem em `services/userService.ts`.

```ts
// services/userService.ts
export const PREMIUM_REFERRALS = 5;
export const FREE_LIMITS = {
  inventory: 5,       // itens no inventário
  serialChecks: 5,    // verificações de serial por mês
  contactReveals: 3,  // interesses/contatos enviados por mês
};

isPremium: (user) => (user.referralCount || 0) >= PREMIUM_REFERRALS || user.role === 'admin';
```

### Limites do plano gratuito

| Recurso | Limite grátis | Tipo em `checkLimit` | Como é medido |
| --- | --- | --- | --- |
| Itens no inventário | 5 | `'inventory'` | `getCountFromServer` da coleção `equipment` por `ownerId` |
| Verificações de serial | 5 / mês | `'check'` | `usageStats.serialChecks { count, month }` |
| Contatos/interesses | 3 / mês | `'contact'` | `usageStats.contactReveals { count, month }` |

`checkLimit` retorna `true` imediatamente se `isPremium`. As contagens mensais
usam o mês corrente (`new Date().toISOString().slice(0,7)`, formato `YYYY-MM`);
ao virar o mês, o contador reinicia.

### Fluxo de indicação

Cada usuário tem `referralCode` e `referredBy`. `userService.processReferral`
resolve o código do indicador e incrementa `referralCount`:

```ts
processReferral: async (referralCode) => {
  const snap = await getDocs(query(collection(db, 'users'), where('referralCode', '==', referralCode)));
  if (!snap.empty) await updateDoc(snap.docs[0].ref, { referralCount: increment(1) });
}
```

## Consequências

**Positivas**

- Crescimento orgânico embutido no produto, sem custo de aquisição.
- Nenhuma dependência de gateway de pagamento nesta fase.

**Negativas / trade-offs**

- `referralCount` é o campo que confere Premium; por isso as Firestore Rules o
  **blindam**: o próprio dono não pode alterá-lo (evita auto-promoção a Premium),
  e escritas cruzadas só podem tocá-lo dentro do fluxo legítimo (ver
  [ADR 0005](0005-firestore-rules-por-campo.md)).
- A aplicação dos limites é feita no cliente (`checkLimit`/`incrementUsage`),
  passível de contorno por um cliente adulterado — registrado como pendência em
  [ADR 0006](0006-limites-no-cliente-pendente-cloud-functions.md).
- Não há verificação anti-fraude de indicações (ex.: contas falsas) nesta fase.

## Referências cruzadas

- [ADR 0005 — Firestore Rules por campo](0005-firestore-rules-por-campo.md)
- [ADR 0006 — Limites no cliente](0006-limites-no-cliente-pendente-cloud-functions.md)
- [Feature: Indicação e Freemium](../features/referral-and-freemium.md)
- [Referência de serviços](../reference/services.md)

## Fontes no código

- `services/userService.ts` (`PREMIUM_REFERRALS`, `FREE_LIMITS`, `isPremium`, `checkLimit`, `incrementUsage`, `processReferral`)
