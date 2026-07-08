# CLAUDE.md

> Instruções para o Claude Code (e demais agentes) neste repositório.

**O guia operacional canônico é o [AGENTS.md](AGENTS.md).** Leia-o primeiro — ele traz o
resumo do projeto, comandos, mapa do repositório, convenções obrigatórias e as regras de
segurança. Este arquivo existe para compatibilidade com o Claude Code e apenas reforça os
pontos mais sensíveis.

## 🔴 Regra permanente — Documentação Viva

**Toda modificação vem acompanhada da documentação.** Antes de alterar qualquer coisa,
**leia a doc relevante em [`docs/`](docs/README.md)**; depois de alterar, **atualize a doc
correspondente** (features/, reference/, ADRs, modelo de dados, segurança) na mesma
entrega. Meta: o sistema permanece **100% documentado** — código e docs nunca divergem.
Uma mudança sem atualização de doc é **incompleta**. Esta regra é reforçada por hooks em
[`.claude/settings.json`](.claude/settings.json) (ver seção 0 do [AGENTS.md](AGENTS.md)).

## Regras rápidas

- **Stack:** React 18 + TypeScript + Vite + Firebase (Auth/Firestore/Storage), **client-only**.
  Sem backend próprio — as `firestore.rules`/`storage.rules` são a fronteira de segurança.
- **Acesso a dados só via `services/`.** Tipos só em [`types.ts`](types.ts).
- **Não há testes nem lint** configurados. Valide rodando `npm run dev` e exercitando o
  fluxo afetado no browser antes de dizer que está pronto.
- **Firestore rejeita `undefined`** — limpe os campos antes de gravar.
- **Idioma:** código, comentários e UI em **pt-BR**.
- **Não commitar/deployar sem pedido explícito** do usuário.

## Documentação

Toda a documentação vive em [`docs/`](docs/README.md) e segue **Diátaxis + C4 + ADRs**.
Ao alterar comportamento, atualize a doc de feature em `docs/features/`; ao tomar uma
decisão de arquitetura, registre um ADR em `docs/decisions/`.
