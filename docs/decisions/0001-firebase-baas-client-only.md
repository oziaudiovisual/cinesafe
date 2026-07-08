# ADR 0001 — Firebase como BaaS, aplicação client-only

> Todo o backend do Cine Safe é o Firebase; não existe servidor de aplicação próprio nem Cloud Functions.

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

O Cine Safe é um produto de estágio inicial mantido por uma equipe muito enxuta,
que precisa entregar autenticação, banco em tempo real, armazenamento de imagens
e hospedagem sem operar infraestrutura de servidor. As funcionalidades (inventário,
marketplace, chat, contratos, mapa de roubos) são majoritariamente CRUD sobre
documentos, com sincronização em tempo real via `onSnapshot`.

## Decisão

Adotar o **Firebase como Backend-as-a-Service**, consumido **somente pelo cliente**
(SPA React), sem camada de servidor de aplicação nem Cloud Functions.

O ponto único de inicialização é `services/firebase.ts`, que:

- usa `firebase/compat/app`, `firebase/compat/auth` e `firebase/compat/storage`
  para **Auth** (e-mail/senha) e **Storage** — a API compat foi escolhida para
  compatibilidade ampla entre ambientes de build/CDN;
- usa o **SDK modular** (`getFirestore`) para o **Firestore**;
- inicializa o app apenas se ainda não houver um (`firebase.apps.length > 0`),
  evitando erro em hot-reload.

```ts
// services/firebase.ts
export const auth = app.auth();          // compat
export const db = getFirestore(app);     // modular
export const storage = app.storage();    // compat
```

Projeto Firebase: **`cine-guard`** (`projectId: "cine-guard"`,
`storageBucket: "cine-guard.firebasestorage.app"`). A configuração do cliente é
pública por natureza (chaves de API do Firebase não são segredos); a segurança é
garantida pelas Firestore Rules e pelas Storage Rules, não por ocultar a config.

Camadas de serviço em `services/*.ts` (`equipmentService`, `userService`,
`chatService`, `contractService`, `notificationService`, `adService`)
encapsulam o acesso ao Firestore/Storage. Não há endpoints HTTP próprios.

## Consequências

**Positivas**

- Zero infraestrutura de servidor para operar: sem provisionamento, sem escalonamento manual.
- Tempo real nativo (`onSnapshot`) sem WebSocket próprio.
- Deploy do front como estático (Vercel) ou por um Express mínimo (`server.js`)
  apenas servindo `dist/` — este último não executa lógica de negócio.

**Negativas / trade-offs**

- **A regra de segurança é a fronteira de confiança.** Sem servidor, validações e
  limites que idealmente rodariam no back-end ficam no cliente (ver
  [ADR 0006](0006-limites-no-cliente-pendente-cloud-functions.md)) ou nas próprias
  Firestore Rules (ver [ADR 0005](0005-firestore-rules-por-campo.md)).
- Operações atômicas dependem de `writeBatch` no cliente; não há transações de
  servidor nem triggers pós-escrita.
- Mistura de APIs (compat para auth/storage, modular para firestore) exige o cast
  `getFirestore(app as unknown as any)` em `services/firebase.ts` — dívida técnica
  consciente pela compatibilidade de build.

## Referências cruzadas

- [ADR 0005 — Firestore Rules por campo](0005-firestore-rules-por-campo.md)
- [ADR 0006 — Limites no cliente](0006-limites-no-cliente-pendente-cloud-functions.md)
- [Arquitetura](../02-architecture.md)
- [Segurança](../04-security.md)

## Fontes no código

- `services/firebase.ts`
- `services/equipmentService.ts`, `services/userService.ts`, `services/chatService.ts`, `services/contractService.ts`
- `package.json` (dependência `firebase ^10.8.0`)
