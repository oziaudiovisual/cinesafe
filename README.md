<div align="center">
<img width="1200" height="475" alt="CineSafe" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Cine Safe

**Segurança e negócios para o audiovisual.** Plataforma para profissionais do audiovisual
gerenciarem inventário, reportarem roubos com geolocalização, verificarem números de série
e alugarem/venderem equipamentos — com contratos, chat, rede de confiança e reputação.

**Stack:** React 18 + TypeScript 5 + Vite 5 + Firebase (Auth, Firestore, Storage) +
Tailwind CSS. Aplicação **client-side** (sem backend próprio); mapas via Leaflet.

## Rodar localmente

**Pré-requisitos:** Node.js 18+

```bash
npm install     # instala as dependências
npm run dev     # sobe o app em desenvolvimento (Vite + HMR)
npm run build   # build de produção em dist/
```

> A configuração do Firebase (chaves públicas do cliente) fica em
> [`services/firebase.ts`](services/firebase.ts). Guia completo:
> [docs/guides/getting-started.md](docs/guides/getting-started.md).

## 📚 Documentação

A documentação completa está em **[`docs/`](docs/README.md)** e segue os padrões de mercado
**Diátaxis + C4 + ADRs**. Atalhos:

| | |
| :--- | :--- |
| 🧭 [Visão geral](docs/01-overview.md) | O que é, personas, funcionalidades, glossário |
| 🏗️ [Arquitetura](docs/02-architecture.md) | Modelo C4, stack, fluxo de dados |
| 🗄️ [Modelo de dados](docs/03-data-model.md) | Coleções Firestore e diagrama ER |
| 🔐 [Segurança](docs/04-security.md) | Auth, RBAC, regras do Firestore/Storage |
| 🧩 [Referência de código](docs/reference/services.md) | Services, hooks, componentes, páginas |
| 🚀 [Deploy](docs/guides/deployment.md) | Vercel, container e regras do Firebase |
| 🤖 [AGENTS.md](AGENTS.md) | Guia para agentes de IA |

## Scripts

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Build de produção (`dist/`) |
| `npm run preview` | Serve o build localmente |
| `npm start` | Servidor Express (`server.js`) servindo `dist/` |

## Contribuindo

Leia as [convenções de código](docs/guides/conventions.md) antes de começar. Mudanças de
comportamento devem atualizar a doc de feature correspondente em
[`docs/features/`](docs/README.md#features--explicação); decisões de arquitetura viram um
[ADR](docs/decisions/README.md).
