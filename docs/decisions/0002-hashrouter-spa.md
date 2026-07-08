# ADR 0002 — HashRouter para a SPA

> O roteamento usa `HashRouter` (URLs com `#`) para funcionar em hospedagem estática sem configurar reescrita de rotas.

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

O Cine Safe é uma SPA com múltiplas rotas (`/inventory`, `/rentals`, `/chat`,
`/admin`, etc.) servida como arquivos estáticos a partir de `dist/` — seja na
Vercel, seja pelo Express mínimo em `server.js` (para container/Cloud Run). Em
hospedagem estática, uma rota do lado do cliente como `/inventory` só funciona no
*deep-link* / refresh se o servidor reescrever todos os caminhos para
`index.html`. Sem essa reescrita, um F5 em `/inventory` retorna 404.

## Decisão

Usar **`HashRouter`** do `react-router-dom` em `App.tsx`. Todas as rotas ficam
após o `#` (ex.: `https://.../#/inventory`), portanto o servidor sempre entrega o
mesmo `index.html` e o roteamento é 100% resolvido no cliente.

```tsx
// App.tsx
<HashRouter>
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<RootRoute />} />
    <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
    {/* ... */}
    <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
  </Routes>
</HashRouter>
```

Guardas de rota também vivem no cliente:

- `ProtectedRoute` redireciona para `/login` se não houver `user` e para `/` se
  `adminOnly` e `user.role !== 'admin'`.
- `RootRoute` decide a home: `Landing` (pública) para visitantes, `Home`
  (dashboard) para logados.

## Consequências

**Positivas**

- Funciona em **qualquer** host estático sem configuração de *rewrites*; F5 e
  *deep-links* nunca dão 404.
- Simplifica os dois alvos de deploy (Vercel e Express) — nenhum precisa de regra
  de fallback de SPA.

**Negativas / trade-offs**

- URLs contêm `#`, esteticamente menos limpas e piores para SEO de rotas internas.
  Mitigado pelo fato de a *landing* (`/`) ser pública e as demais rotas serem
  protegidas (não indexáveis de qualquer forma).
- O redirecionamento é apenas do cliente; a real proteção dos dados está nas
  Firestore Rules (ver [ADR 0005](0005-firestore-rules-por-campo.md)), não na rota.

## Referências cruzadas

- [ADR 0007 — Code-splitting e resiliência a chunk stale](0007-code-splitting-e-resiliencia-chunk-stale.md)
- [Frontend](../05-frontend.md)
- [Referência de páginas](../reference/pages.md)

## Fontes no código

- `App.tsx` (`HashRouter`, `ProtectedRoute`, `RootRoute`, tabela de rotas)
- `server.js`, `vercel.json` (alvos de deploy estático)
- `package.json` (`react-router-dom ^6.22.3`)
