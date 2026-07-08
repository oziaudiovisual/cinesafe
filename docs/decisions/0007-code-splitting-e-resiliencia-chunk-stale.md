# ADR 0007 — Code-splitting e resiliência a *chunk stale*

> Páginas carregam sob demanda (lazy); quando um deploy troca os hashes dos chunks, o app recarrega uma vez sozinho em vez de mostrar tela preta.

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

A SPA tem muitas páginas; carregar tudo no bundle inicial piora o *first load*.
Por isso as páginas são *lazy*. Mas o *code-splitting* introduz um problema
clássico em produção: após um deploy novo, os arquivos de chunk ganham hashes
diferentes. Um usuário com a aba antiga aberta (ou um service worker/CDN servindo
`index.html` velho) tenta importar um chunk cujo nome não existe mais → o
`import()` rejeita → sem tratamento, a tela fica preta. O commit `1852941`
(`fix: tela preta ao navegar (chunk stale após deploy)`) resolveu exatamente isso.

## Decisão

Combinar **três camadas** em `App.tsx` mais a segmentação de vendors em
`vite.config.ts`.

### 1. `lazyWithReload` — auto-recuperação do chunk defasado

Cada página é embrulhada por um `lazy` que, se o `import()` falhar, recarrega a
página **uma única vez** (janela de 10s guardada em `sessionStorage`) para pegar o
`index.html` + chunks atuais. Se falhar de novo, propaga o erro (cai no
ErrorBoundary) — nunca fica em loop nem em tela preta.

```ts
// App.tsx
const lazyWithReload = (factory) =>
  lazy(() => factory().catch((err) => {
    const now = Date.now();
    const last = Number(sessionStorage.getItem('chunkReloadAt') || '0');
    if (now - last > 10000) {
      sessionStorage.setItem('chunkReloadAt', String(now));
      window.location.reload();
      return new Promise(() => {}); // pendura até o reload
    }
    throw err;
  }));
```

### 2. `RouteErrorBoundary` — rede de segurança final

Um `ErrorBoundary` de classe envolve as rotas. Se algo estourar (ex.: chunk que
não carrega nem após o reload), mostra uma tela amigável com botão "Recarregar"
(que limpa `chunkReloadAt` e recarrega), em vez de tela preta.

### 3. `Suspense` + `PageLoader`

`Suspense` exibe um spinner (`PageLoader`) enquanto o chunk carrega.

### 4. Segmentação de vendors (`vite.config.ts`)

`manualChunks` separa dependências estáveis para melhor cache entre deploys:

```ts
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
  'vendor-ui': ['lucide-react', 'react-easy-crop'],
}
```

## Consequências

**Positivas**

- *First load* menor (páginas sob demanda) e cache de vendors mais estável.
- Deploys deixam de causar "tela preta" para quem estava com a aba aberta: o app
  se recupera sozinho ou, no pior caso, oferece um botão de recarregar.

**Negativas / trade-offs**

- A auto-recuperação custa **um reload** perceptível ao usuário após um deploy.
- A janela de 10s em `sessionStorage` é heurística: dois erros de chunk
  genuinamente distintos dentro de 10s cairão direto no ErrorBoundary.
- Interações em andamento se perdem no reload automático.

## Referências cruzadas

- [ADR 0002 — HashRouter](0002-hashrouter-spa.md)
- [Frontend](../05-frontend.md)
- [Configuração](../reference/configuration.md)

## Fontes no código

- `App.tsx` (`lazyWithReload`, `RouteErrorBoundary`, `Suspense`/`PageLoader`)
- `vite.config.ts` (`build.rollupOptions.output.manualChunks`)
