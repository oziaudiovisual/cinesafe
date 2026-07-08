# Documentação do Cine Safe

> Ponto de entrada da documentação técnica do **CINESAFE**. Feita para servir tanto a
> desenvolvedores quanto a agentes de IA.

Bem-vindo. Esta documentação cobre o sistema de ponta a ponta: o que é, como está
arquitetado, como os dados são modelados, como cada funcionalidade opera, como rodar e
implantar, e por que as principais decisões foram tomadas.

## Como esta documentação está organizada

Seguimos o framework **[Diátaxis](https://diataxis.fr/)**, o padrão de mercado que separa
a documentação por *objetivo do leitor*, combinado com **AGENTS.md** (guia para IAs),
**modelo C4 + diagramas Mermaid** (arquitetura) e **ADRs** (decisões de arquitetura).

| Você quer... | Vá para | Tipo (Diátaxis) |
| :--- | :--- | :--- |
| **Entender** o produto e o sistema | Núcleo (abaixo) + [Explicação de features](#features--explicação) | Explicação |
| **Consultar** uma função, tipo ou config | [Referência](#referência) | Referência |
| **Executar uma tarefa** (rodar, deployar) | [Guias](#guias--how-to) | How-to |
| **Saber por que** algo é assim | [Decisões (ADRs)](decisions/README.md) | Explicação |

> 🤖 **Agentes de IA:** comecem pelo [../AGENTS.md](../AGENTS.md). Ele é o guia operacional
> de alto sinal (comandos, convenções, armadilhas, fronteiras de segurança).

---

## Núcleo — entenda o sistema

Comece por aqui para formar o modelo mental completo.

1. [**01 · Visão geral**](01-overview.md) — o que é o Cine Safe, personas, catálogo de
   funcionalidades e glossário de domínio.
2. [**02 · Arquitetura**](02-architecture.md) — modelo C4 (contexto e containers), stack,
   modelo de execução client-only e fluxo de dados.
3. [**03 · Modelo de dados**](03-data-model.md) — todas as coleções Firestore, campos,
   diagrama ER e estratégia de denormalização.
4. [**04 · Segurança**](04-security.md) — autenticação, RBAC, Firestore/Storage Rules
   explicadas, modelo de ameaças e limitações conhecidas.
5. [**05 · Front-end**](05-frontend.md) — rotas, estado global, padrões de UI e resumo do
   design system.

---

## Referência

Descrições precisas, orientadas a consulta, de cada parte do código.

- [**Services** (API de dados)](reference/services.md) — cada módulo de serviço e suas funções.
- [**Hooks**](reference/hooks.md) — `useInventory`, `useUserStats`, `useAd`.
- [**Componentes**](reference/components.md) — UI compartilhada (Layout, modais, AdBanner…).
- [**Páginas**](reference/pages.md) — uma tela por rota.
- [**Utilitários**](reference/utils.md) — formatação (BRL/datas) e pipeline de imagem.
- [**Configuração & build**](reference/configuration.md) — Vite, Tailwind, Vercel, Express, CDNs.

---

## Features — explicação

Como cada funcionalidade de domínio funciona de verdade.

- [Inventário](features/inventory.md)
- [Marketplace (aluguel & venda)](features/marketplace.md)
- [Roubo & Segurança](features/theft-and-safety.md) (reporte, verificação de serial, mapa)
- [Contratos & Pagamentos](features/contracts-and-payments.md)
- [Rede de confiança & Transferência de posse](features/network-and-transfers.md)
- [Chat interno](features/chat.md)
- [Notificações](features/notifications.md)
- [Reputação & Ranking](features/reputation-and-rankings.md)
- [Indicações (Referral) & Freemium](features/referral-and-freemium.md)
- [Anúncios](features/advertising.md)
- [Painel administrativo](features/admin.md)

---

## Guias — how-to

- [Início rápido](guides/getting-started.md) — clonar, instalar, rodar, estrutura do repo.
- [Deploy](guides/deployment.md) — Vercel, container/Express e regras do Firebase.
- [Convenções de código](guides/conventions.md) — padrões e como adicionar uma feature.

---

## Decisões de arquitetura (ADRs)

- [Índice de ADRs](decisions/README.md) — por que o Cine Safe é client-only, usa HashRouter,
  denormaliza no cliente, freemium por indicação, rules por-campo, etc.

---

## Documentos de referência na raiz do repositório

- [../README.md](../README.md) — porta de entrada do projeto.
- [../AGENTS.md](../AGENTS.md) — guia para agentes de IA.
- [../DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) — guia visual (paleta, tipografia, componentes).
- [../FIREBASE_RULES.md](../FIREBASE_RULES.md) — visão geral e publicação das regras.

---

### Convenções desta documentação

- Idioma **pt-BR**, técnico e objetivo.
- Diagramas em **Mermaid** (renderizam no GitHub).
- Afirmações são aterradas no **código real**; cada documento cita suas fontes ao final.
- Links entre documentos são **relativos**.
