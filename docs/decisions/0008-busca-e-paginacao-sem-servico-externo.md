# ADR 0008 — Busca e paginação sem serviço externo

> Busca textual e filtros do marketplace são feitos no cliente sobre lotes do Firestore; sem Algolia/Typesense, com limites explícitos.

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

O Firestore não oferece busca full-text nem operador "contains" eficiente. O
marketplace precisa de: paginação estável, filtro por categoria, filtro por
localização (substring) e busca textual por nome/marca/modelo. Adotar um serviço
externo de indexação (Algolia, Typesense) traria custo, uma cópia de dados para
manter sincronizada e mais infraestrutura — desproporcional para um catálogo
ainda pequeno e uma arquitetura sem backend ([ADR 0001](0001-firebase-baas-client-only.md)).

## Decisão

Implementar busca e paginação **no cliente**, em
`services/equipmentService.ts`, misturando o que o Firestore faz bem
(igualdade + ordenação + limite) com filtragem "soft" em memória sobre a página.

### Paginação — `_getMarketplaceItems`

- Filtros server-side por **igualdade**: `where(filterField, '==', true)`,
  `where('status', '==', 'SAFE')` e, se houver, `where('category', '==', ...)`.
- **`orderBy('id')`** garante ordem estável para `startAfter(lastDoc)` — não há
  campo `createdAt`, então o `id` é a chave de cursor (o código anota como ponto a
  evoluir).
- Busca `limit(limitCount + 1)` e usa o item extra só para calcular `hasMore`,
  evitando uma segunda consulta de contagem.
- **Filtro de localização é "soft"**, aplicado em memória **só sobre a página**
  (`item.ownerProfile?.location?.toLowerCase().includes(searchLoc)`).

```ts
// services/equipmentService.ts
// NOTA: isso pode resultar em páginas com menos de 'limit' itens, mas preserva a arquitetura.
if (filters.uf || filters.city) {
  const searchLoc = (filters.city || filters.uf || '').toLowerCase();
  items = items.filter(item => item.ownerProfile?.location?.toLowerCase().includes(searchLoc));
}
```

`getRentalsPaginated` e `getSalesPaginated` são atalhos que passam `'isForRent'`
ou `'isForSale'` como `filterField`.

### Busca textual — `searchMarketplace`

Busca por trecho (substring, case-insensitive) sobre um **lote de até 120 itens**:

```ts
const q = query(collection(db, 'equipment'),
  where(filterField, '==', true), where('status', '==', 'SAFE'),
  orderBy('id'), limit(120));
// ...
items = items.filter(it => `${it.name} ${it.brand} ${it.model}`.toLowerCase().includes(needle));
```

O mesmo padrão aparece em `userService.searchUsers` (baixa todos os usuários e
filtra por `name`/`email` no cliente, `.slice(0, 20)`).

## Consequências

**Positivas**

- Zero dependência/custo de serviço externo e nenhuma migração de dados.
- Funciona sobre todos os campos sem índice de texto; simples de manter enquanto o
  catálogo é pequeno.

**Negativas / trade-offs**

- **Busca cobre só os ~120 primeiros itens** do filtro (ordenados por `id`).
  Acima disso, resultados relevantes podem ficar de fora — migrar para full-text
  externo é o caminho quando o catálogo crescer (anotado no próprio código).
- O filtro de localização "soft" pode devolver **páginas com menos itens que o
  `limit`**, porque filtra depois de paginar.
- Paginação por `orderBy('id')` não reflete recência; o comentário no código
  recomenda adicionar `createdAt` e ordenar por ele.
- `searchUsers` baixa a coleção `users` inteira antes de filtrar — não escala.

## Referências cruzadas

- [ADR 0001 — Firebase client-only](0001-firebase-baas-client-only.md)
- [ADR 0003 — Denormalização no cliente](0003-denormalizacao-no-cliente.md)
- [Feature: Marketplace](../features/marketplace.md)
- [Referência de serviços](../reference/services.md)

## Fontes no código

- `services/equipmentService.ts` (`_getMarketplaceItems`, `getRentalsPaginated`, `getSalesPaginated`, `searchMarketplace`)
- `services/userService.ts` (`searchUsers`)
