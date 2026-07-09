# ADR 0010 — Shell persistente de layout (fim do "flash" de navegação)

> O `Layout` (menu/sidebar) é montado uma única vez por uma **rota de layout** com `<Outlet/>`; ao navegar, só o conteúdo interno troca, e o `<Suspense>` das páginas lazy vive **dentro** do `Layout`.

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

O `App.tsx` original tinha dois problemas que, somados, causavam um "flash" (a tela inteira sumia e recarregava, às vezes piscando) ao trocar de página:

1. **`<Suspense fallback={<PageLoader/>}>` envolvia todas as `<Routes>`.** As páginas são carregadas com `React.lazy` (`lazyWithReload`, ver [ADR 0007](0007-code-splitting-e-resiliencia-chunk-stale.md)). Na **primeira** navegação para uma rota (chunk ainda não baixado), o React suspendia e mostrava o `PageLoader` de **tela cheia**, que apagava o menu junto. Na segunda vez (chunk em cache) não suspendia — daí o "às vezes pisca, às vezes não".
2. **Cada rota montava o próprio `<Layout>`.** `ProtectedRoute` e `RootRoute` retornavam `<Layout>{children}</Layout>`. Trocar de rota desmontava um `Layout` e montava outro — o menu reconstruía do zero a cada navegação.

## Decisão

Adotar o padrão de **rota de layout** do React Router v6:

- Um componente `AppShell` é o `element` de uma `<Route>` **sem `path`**, e todas as rotas autenticadas são suas **filhas** (`index` = `Home`, `path="inventory"`, `chat`, …).
- `AppShell` renderiza `<Layout><Suspense fallback={<ContentLoader/>}><Outlet/></Suspense></Layout>` quando há usuário. O `Layout` fica **montado de forma persistente**; só o `<Outlet/>` troca ao navegar.
- O `<Suspense>` passou para **dentro** do `Layout`, com um `ContentLoader` (spinner **só na área de conteúdo**, não tela cheia). O menu nunca some durante o carregamento de um chunk.
- Visitante em `/` recebe a `Landing` (vitrine pública); em qualquer outra rota, `Navigate` para `/login`. `AdminOnly` guarda `/admin` (checa `role`).
- `/login` e `/register` ficam **fora** do shell, cada uma com seu próprio `<Suspense fallback={<PageLoader/>}>` (não têm chrome a preservar).

## Consequências

- **Menu fixo e sem flash.** Navegar entre páginas mantém a sidebar montada; só o miolo mostra o `ContentLoader` na primeira carga de cada chunk.
- Substitui `ProtectedRoute`/`RootRoute` por `AppShell` + `AdminOnly`. A semântica (guarda de UI; autorização real no Supabase) é a mesma — ver [`../04-security.md`](../04-security.md).
- Efeitos montados no `Layout` (ex.: `LocationGateModal`, estado do menu mobile) deixam de re-executar a cada navegação, o que também é mais eficiente.
- Mantém `lazyWithReload` e `RouteErrorBoundary` (agora envolvendo `<Routes>`).

## Alternativas consideradas

- **Manter o `Suspense` externo, mas com fallback transparente.** Não resolve o remonte do `Layout` (problema 2) nem o menu sumindo.
- **Pré-carregar todos os chunks no boot.** Elimina o flash à custa de um bundle inicial maior — contraria o [ADR 0007](0007-code-splitting-e-resiliencia-chunk-stale.md).

Fonte: [`App.tsx`](../../App.tsx) · detalhes de front em [`../05-frontend.md`](../05-frontend.md) (§3, §4).
