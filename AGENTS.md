# AGENTS.md — Guia para Agentes de IA

> Guia operacional, de alto sinal, para agentes de IA (Claude Code, Cursor, Copilot, etc.)
> trabalharem com segurança e precisão no código do **CINESAFE**. Humanos: veja o
> [README.md](README.md) e a documentação completa em [docs/](docs/README.md).

Este arquivo segue o padrão aberto [agents.md](https://agents.md). Leia-o **antes** de
alterar qualquer coisa. O [CLAUDE.md](CLAUDE.md) aponta para cá.

---

## 0. 🔴 REGRA PERMANENTE — Documentação Viva (obrigatória)

> **Toda modificação neste sistema é acompanhada da documentação. Sempre.**

Sempre que você for **rodar ou alterar** qualquer coisa neste projeto, siga este ciclo —
**sem exceção**:

1. **ANTES de modificar:** **leia a documentação relevante** em [`docs/`](docs/README.md).
   Localize a doc da área que vai tocar — a feature em [`docs/features/`](docs/README.md#features--explicação),
   a referência em [`docs/reference/`](docs/reference/services.md), o
   [modelo de dados](docs/03-data-model.md) ou a [segurança](docs/04-security.md). Entenda
   o comportamento atual documentado antes de mexer no código.
2. **DEPOIS de modificar:** **atualize a documentação** para refletir a mudança, na mesma
   entrega. Ajuste a doc de feature/referência afetada; se mudou uma decisão de
   arquitetura, adicione um **ADR** em [`docs/decisions/`](docs/decisions/README.md); se
   mudou dados ou regras, atualize [`docs/03-data-model.md`](docs/03-data-model.md) /
   [`docs/04-security.md`](docs/04-security.md).

**Objetivo:** o sistema fica **100% documentado** o tempo todo — código e documentação
nunca divergem. Uma mudança de comportamento sem atualização de doc é considerada
**incompleta**.

Esta regra é **reforçada por hooks** (o harness executa automaticamente, não depende de
memória) configurados em [`.claude/settings.json`](.claude/settings.json):
- **`PreToolUse`** (antes de editar código) injeta o lembrete para consultar `docs/`.
- **`Stop`** (ao finalizar) **bloqueia uma vez** se houver mudança de código-fonte sem a
  atualização correspondente em `docs/`.

Detalhes e scripts: [`.claude/hooks/`](.claude/hooks/). Veja também
[docs/guides/conventions.md](docs/guides/conventions.md).

---

## 1. O que é o projeto (em 30 segundos)

**Cine Safe** é uma SPA/PWA para profissionais do audiovisual no Brasil: inventário de
equipamentos, reporte de roubo com geolocalização, verificação de número de série,
marketplace de aluguel/venda, contratos, chat interno, rede de confiança, transferência
de posse, notificações, reputação/ranking, indicações (freemium), anúncios e painel admin.

**Arquitetura central:** aplicação **100% client-side** (React no browser) falando
**direto com o Firebase** (Auth, Firestore, Storage). **Não há backend próprio nem Cloud
Functions.** Isso tem uma consequência que você deve internalizar:

> ⚠️ **As Firestore/Storage Rules são a única fronteira de segurança do servidor.**
> Qualquer regra de negócio validada apenas no cliente (limites de plano, algumas escritas
> cruzadas) é contornável. Ao mexer em permissões ou dados sensíveis, pense primeiro nas
> `firestore.rules` / `storage.rules`.

---

## 2. Comandos essenciais

| Ação | Comando | Observações |
| :--- | :--- | :--- |
| Instalar deps | `npm install` | Node **>= 18** |
| Dev server | `npm run dev` | Vite; HMR |
| Build produção | `npm run build` | Gera `dist/` |
| Preview do build | `npm run preview` | Serve o `dist/` |
| Servidor Express | `npm start` | `node server.js` — serve `dist/` (container/Cloud Run) |
| Deploy de rules | `firebase deploy --only firestore:rules,storage` | Projeto `cine-guard` |

Não há suíte de testes nem linter configurados no repositório. **Verifique mudanças
rodando o app** (`npm run dev`) e conferindo o fluxo afetado no browser.

---

## 3. Mapa do repositório

```
CINESAFE/
├── App.tsx              # Rotas (HashRouter), ProtectedRoute, lazy load, ErrorBoundary
├── index.tsx            # Bootstrap React
├── index.html           # <head>: Leaflet (CDN), fontes, CSS global glassmorphism
├── types.ts             # TODOS os tipos/enums de domínio — fonte da verdade
├── context/
│   └── AuthContext.tsx  # Único contexto global: sessão, login/register/logout
├── pages/               # Uma tela por rota (Home, Inventory, Rentals, Admin, ...)
├── components/          # UI compartilhada (Layout, modais, AdBanner, UserAvatar, ...)
├── hooks/               # Hooks de domínio (useInventory, useUserStats, useAd)
├── services/            # Camada de acesso a dados (Firebase) — a "API" do app
│   ├── firebase.ts      # Init do Firebase (config pública do cliente)
│   ├── auth.ts          # AuthService (sessão, login, registro, logout)
│   ├── userService.ts   # Perfil, RBAC, limites, rede, reputação, stats
│   ├── equipmentService.ts   # Inventário, marketplace, serial, transferência
│   ├── contractService.ts    # Contratos, pagamento, não-devolução
│   ├── notificationService.ts / chatService.ts / adService.ts
│   ├── ibge.ts          # Estados/cidades (API IBGE)
│   └── storage.ts       # Facade legado StorageService (encaminha p/ os services)
├── utils/               # formatters (BRL/datas), imageProcessor (WebP, upload)
├── firestore.rules      # Regras do Firestore (fronteira de segurança)
├── storage.rules        # Regras do Storage
├── firebase.json / .firebaserc   # Deploy de rules (projeto cine-guard)
├── vite.config.ts / tailwind.config.js / server.js / vercel.json
└── docs/                # Documentação completa (comece por docs/README.md)
```

**Fluxo de dependência:** `pages/` → `hooks/` → `services/` → `firebase.ts`.
Componentes de página quase nunca chamam o Firestore direto; usam os **services**.

---

## 4. Convenções que você DEVE seguir

1. **Tipos primeiro.** Toda estrutura de dados vive em [`types.ts`](types.ts). Reuse os
   tipos/enums existentes; não redefina shapes inline.
2. **Acesso a dados só via `services/`.** Não espalhe chamadas Firestore em componentes.
   Cada service é um objeto exportado com métodos; erros são capturados e retornam
   `boolean`/`null`/`[]` em vez de lançar (siga o padrão do arquivo que editar).
3. **Firestore rejeita `undefined`.** Antes de `setDoc`/`updateDoc`, remova chaves
   `undefined` (padrão `Object.fromEntries(... filter v !== undefined)`), como em
   `notificationService.createNotification` e `contractService.createContract`.
4. **Atomicidade com `writeBatch`** para escritas que precisam ser tudo-ou-nada
   (ex.: conexões mútuas em `userService.addConnection`).
5. **Evite índices compostos:** o padrão do projeto é **ordenar/filtrar no cliente**
   após um `onSnapshot`/`getDocs` simples (ver `chatService`, `contractService`).
   Paginação do marketplace usa `orderBy('id')` + `limit(n+1)`.
6. **Serial sempre normalizado** (`trim().toUpperCase()`) ao gravar e ao verificar.
7. **Imagens** passam por `utils/imageProcessor.ts` (WebP 480px @0.85). PDFs de nota/
   comprovante vão direto (o pipeline WebP quebra com PDF).
8. **Denormalização deliberada:** `ownerProfile` é copiado no item; `participantInfo`
   no chat. **Telefone nunca é denormalizado no item** (a vitrine é pública). Se mudar
   nome/avatar de usuário, lembre que cópias denormalizadas podem ficar defasadas.
9. **Comentários e textos de UI em pt-BR.** Mantenha o tom do código existente.
10. **IDs:** `crypto.randomUUID()` para docs novos; `chatId` é determinístico
    (`[a,b].sort().join('__')`); o doc de stats é fixo (`stats/global`).

---

## 5. Segurança — cheque isto antes de mexer em dados

- **Vitrine pública:** apenas `equipment` com `status == 'SAFE'` e (`isForRent` ou
  `isForSale`) é legível sem login; idem imagens em `users/{uid}/equipment/**`.
  Inventário privado, perfis, notificações **não** são públicos.
- **Anti-escalonamento de privilégio (`users`):** as rules validam *por campo*. O dono
  não pode alterar `role`, `isBlocked` nem `referralCount`. Um terceiro só toca
  `connections`, `notificationStats`, `transactionHistory`, `referralCount`.
- **Limites de plano e algumas escritas cruzadas são validados no cliente** — documentado
  como dívida técnica (mover para Cloud Functions). Não confie neles como barreira.
- Detalhes: [docs/04-security.md](docs/04-security.md), [firestore.rules](firestore.rules),
  [storage.rules](storage.rules), [FIREBASE_RULES.md](FIREBASE_RULES.md).

---

## 6. Onde aprender cada assunto

| Preciso entender... | Leia |
| :--- | :--- |
| Visão geral / glossário | [docs/01-overview.md](docs/01-overview.md) |
| Arquitetura (C4, fluxo) | [docs/02-architecture.md](docs/02-architecture.md) |
| Coleções e campos Firestore | [docs/03-data-model.md](docs/03-data-model.md) |
| Regras de segurança e RBAC | [docs/04-security.md](docs/04-security.md) |
| Rotas, estado, UI | [docs/05-frontend.md](docs/05-frontend.md) |
| API dos services (funções) | [docs/reference/services.md](docs/reference/services.md) |
| Uma feature específica | [docs/features/](docs/features/) |
| Rodar/deploy | [docs/guides/](docs/guides/) |
| Por que uma decisão foi tomada | [docs/decisions/](docs/decisions/README.md) |

---

## 7. Armadilhas conhecidas (aprenda com elas)

- **Tela branca após deploy:** hashes de chunk mudam; `App.tsx` já recarrega uma vez
  (`lazyWithReload`) e cai no `RouteErrorBoundary`. Não remova essa proteção.
- **Upload falhando com CORS:** `resilientUpload` sinaliza `CORS_CONFIG_ERROR`; é preciso
  liberar o domínio no CORS do bucket do Storage.
- **Busca do marketplace é rasa:** `searchMarketplace` cobre só ~120 itens (sem serviço
  de full-text). Não presuma busca global.
- **`reputationPoints` é calculado no cliente** e não é autoritativo — é apresentacional.

Ao concluir uma mudança, atualize a doc de feature correspondente em `docs/features/` e,
se for uma decisão de arquitetura, adicione um ADR em `docs/decisions/`.
