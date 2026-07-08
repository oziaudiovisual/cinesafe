# Referência de Componentes Compartilhados

> Catálogo dos componentes reutilizáveis em `components/` do Cine Safe: propósito, props reais (lidas das interfaces TypeScript) e onde/como cada um é usado.

Esta página documenta apenas os componentes compartilhados no diretório `components/`. Componentes específicos de tela vivem dentro de `pages/` e estão descritos em [`./pages.md`](./pages.md). Para o design system (glassmorphism, tokens `brand-*`/`accent-*`, classes `glass`/`glass-card`/`glass-input`) veja [`../../DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) e [`../05-frontend.md`](../05-frontend.md).

## Visão geral

| Componente | Arquivo | Tipo | `memo` | Portal | Propósito |
|---|---|---|---|---|---|
| `Layout` | `components/Layout.tsx` | Shell de navegação | Sim | Não | Sidebar (desktop) + header/menu (mobile) que envolve as telas logadas |
| `AdBanner` | `components/AdBanner.tsx` | Apresentação + tracking | Sim | Não | Banner de anúncio composto; registra clique |
| `ConfirmModal` | `components/ConfirmModal.tsx` | Modal genérico | Sim | Sim | Confirmação de ação (normal ou destrutiva) |
| `ContractModal` | `components/ContractModal.tsx` | Modal de formulário | Não | Sim | Proposta de contrato (aluguel/venda) a partir do chat |
| `ReferralModal` | `components/ReferralModal.tsx` | Modal de upsell | Não | Sim | Paywall de indicações (freemium) e convite |
| `LocationGateModal` | `components/LocationGateModal.tsx` | Modal bloqueante | Não | Sim | Gate obrigatório de cidade/estado para usuários OAuth sem localização |
| `RaffleCpfModal` | `components/RaffleCpfModal.tsx` | Modal de formulário | Não | Sim | Coleta CPF (antifraude) para participar do sorteio; chama a RPC `participar_sorteio` |
| `CurrencyInput` | `components/CurrencyInput.tsx` | Input controlado | Não | Não | Input de moeda (BRL) com máscara "centavos" — fonte da verdade é um `number` |
| `UserAvatar` | `components/UserAvatar.tsx` | Apresentação | Sim | Não | Avatar com fallback de iniciais quando não há foto |
| `CineSafeLogo` | `components/CineSafeLogo.tsx` | Apresentação | Sim | Não | Logotipo (`/logo.webp`) |
| `CineGuardLogo` | `components/CineGuardLogo.tsx` | — | — | — | **Arquivo vazio (0 bytes)** — sem export; ver seção própria |
| `Icons` | `components/Icons.tsx` | Registro de ícones | — | — | Reexporta os ícones `lucide-react` usados no app |

Todos os modais que usam `createPortal` renderizam diretamente em `document.body`, escapando de qualquer `overflow: hidden` do layout.

---

## `Layout`

Shell de aplicação para as telas autenticadas. Renderiza a estrutura fixa (sidebar flutuante em desktop, header + menu de overlay em mobile) e injeta o conteúdo da rota em `children`. Fonte: `components/Layout.tsx`.

### Props

| Nome | Tipo | Descrição |
|---|---|---|
| `children` | `React.ReactNode` | Conteúdo da página renderizado dentro do `<main>` (centralizado em `max-w-7xl`). |

### Comportamento

- Consome `useAuth()` (de `context/AuthContext`) para obter `user` e `logout`.
- `handleLogout` chama `logout()` e navega para `/` (a landing pública), **não** para `/login` — comentário explícito em `Layout.tsx:18`.
- `navItems` é uma lista `useMemo` fixa de 11 destinos, cada um com `to`, `label` (pt-BR) e `icon` (de `Icons`):

  | `to` | `label` | Ícone |
  |---|---|---|
  | `/` | Início | `Home` |
  | `/notifications` | Notificações | `MessageCircle` |
  | `/chat` | Mensagens | `Mail` |
  | `/contracts` | Contratos | `FileText` |
  | `/network` | Minha Rede | `Users` |
  | `/inventory` | Inventário | `Camera` |
  | `/rentals` | Alugar | `ShoppingBag` |
  | `/sales` | Comprar | `Tag` |
  | `/safety` | Segurança | `Siren` |
  | `/check-serial` | Verificar | `Search` |
  | `/rankings` | Ranking | `Trophy` |

- Link **Admin** (`/admin`, ícone `Lock`) só é renderizado quando `user?.role === 'admin'`.
- Botão fixo **REPORTAR** (`/report-theft`, ícone `ShieldAlert`, gradiente vermelho) e o cartão de perfil só aparecem quando há `user`; caso contrário mostra o CTA "Entrar" (`/login`).
- O cartão de perfil usa `user.avatarUrl` diretamente em um `<img>` (não usa `UserAvatar`), exibe `user.name.split(' ')[0]` (primeiro nome) e `user.reputationPoints` como "XP".
- Navegação ativa usa a prop de render `({ isActive }) => …` do `NavLink` (react-router-dom v6) para estilizar o item selecionado.
- Estado local `isMobileMenuOpen` controla o overlay mobile; `toggleMobileMenu`/`closeMobileMenu` são `useCallback`. O menu mobile fecha ao clicar em qualquer item.
- Usa `CineSafeLogo` no header (largura total no desktop, `size={32}` no mobile).

### Uso

Aplicado exclusivamente em `App.tsx`, envolvendo o conteúdo de rotas protegidas. `ProtectedRoute` retorna `<Layout>{children}</Layout>` após validar sessão/role (`App.tsx:66`); `RootRoute` retorna `<Layout><Home /></Layout>` para usuários logados (`App.tsx:78`). As telas públicas (`Landing`, `Login`, `Register`) **não** são envolvidas por `Layout`.

---

## `AdBanner`

Banner de anúncio composto (texto + imagem de produto) renderizado a partir de um documento da coleção `ads`. Fonte: `components/AdBanner.tsx`.

### Props

| Nome | Tipo | Descrição |
|---|---|---|
| `ad` | `Ad` | Documento do anúncio a exibir (ver interface `Ad` em `types.ts:194`). |

Campos de `Ad` consumidos pelo componente: `id`, `imageUrl`, `linkUrl?`, `tagline?`, `title`, `priceOld?`, `priceNew?`, `buttonText`. (`advertiserName`, `weight`, `active`, `startDate`, `endDate`, `impressions`, `clicks` existem no tipo mas não são renderizados aqui.)

### Comportamento

- Monta o layout do banner no cliente a partir dos campos do anúncio (headline, badge de tagline, preços antigo/novo, botão CTA e imagem do produto) — o banner é "composto", não uma imagem estática única.
- `handleClick`: se houver `ad.linkUrl`, chama `adService.trackAdClick(ad.id)` e abre o link em nova aba (`window.open(ad.linkUrl, '_blank')`). Sem `linkUrl`, o cursor não fica clicável e nada acontece.
- **Impressões NÃO são registradas aqui.** O incremento de `impressions` acontece no hook [`useAd`](./hooks.md) (`hooks/useAd.ts`), que chama `adService.trackAdImpression(id)` ao carregar o anúncio ativo. O `AdBanner` só lida com o clique.
- Fade-in progressivo da imagem: estado `isImageLoaded` vira `true` no `onLoad`; um `useEffect` reseta esse estado sempre que `ad.imageUrl` muda (suporta rotação de anúncios).

### Uso

Sempre em conjunto com o hook `useAd` (seleção aleatória ponderada por `weight` do anúncio ativo — ver `adService.getActiveAd` em `services/adService.ts`). Renderizado de forma condicional (`{ad && <AdBanner ad={ad} />}`) em `pages/Home.tsx`, `pages/SerialCheck.tsx` e `pages/Notifications.tsx`. Detalhes de negócio em [`../features/advertising.md`](../features/advertising.md).

```tsx
const { ad } = useAd();      // hooks/useAd.ts — busca ativo + registra impressão
return ad ? <AdBanner ad={ad} /> : null;
```

---

## `ConfirmModal`

Diálogo de confirmação genérico, com variação visual para ações destrutivas e estado de processamento. Renderizado via portal em `document.body` (`z-[3000]`). Fonte: `components/ConfirmModal.tsx`.

### Props

| Nome | Tipo | Padrão | Descrição |
|---|---|---|---|
| `isOpen` | `boolean` | — | Controla a exibição; retorna `null` quando `false`. |
| `title` | `string` | — | Título em destaque no topo. |
| `message` | `string` | — | Corpo/descrição da confirmação. |
| `confirmLabel` | `string?` | `"Confirmar"` | Texto do botão de confirmação. |
| `isDestructive` | `boolean?` | `false` | Se `true`, usa paleta vermelha e ícone `AlertTriangle` (senão, ciano/`HelpCircle`). |
| `onConfirm` | `() => void` | — | Callback do botão de confirmar. |
| `onCancel` | `() => void` | — | Callback do botão "Cancelar". |
| `isProcessing` | `boolean?` | `false` | Se `true`, desabilita ambos os botões e mostra spinner no botão de confirmar. |

### Comportamento

- Fecha (retorna `null`) apenas quando `isOpen === false`; não há fechamento por clique no backdrop nem por tecla `Esc` — o controle é 100% via props do pai.
- Layout de dois botões em grid; ícone e cores mudam conforme `isDestructive`.

### Uso

Componente de confirmação padrão do app. Usado em `pages/Sales.tsx`, `pages/Rentals.tsx`, `pages/SerialCheck.tsx`, `pages/Notifications.tsx`, `pages/Inventory.tsx`, `pages/Network.tsx`, `pages/AdminDashboard.tsx` e `pages/Contracts.tsx`, tipicamente para confirmar exclusões, transferências, aceites e outras ações irreversíveis.

---

## `ContractModal`

Formulário modal para o dono propor um contrato de **aluguel** ou **venda** de um item do próprio inventário a uma contraparte. Renderizado via portal (`z-[5000]`). Fonte: `components/ContractModal.tsx`.

### Props

| Nome | Tipo | Descrição |
|---|---|---|
| `isOpen` | `boolean` | Controla a exibição; retorna `null` quando `false`. |
| `onClose` | `() => void` | Fecha o modal (botão `X` e após envio bem-sucedido). |
| `owner` | `User` | Dono/proponente (normalmente o usuário logado); origem dos equipamentos disponíveis. |
| `counterparty` | `{ id: string; name: string; avatarUrl: string }` | A outra parte do contrato. |
| `chatId` | `string?` | ID do chat associado, repassado ao contrato criado. |
| `onCreated` | `(summary: string) => void` | Callback chamado após criação, recebendo um resumo pronto em pt-BR para postar no chat. |

### Comportamento

- Ao abrir (`useEffect` em `isOpen`/`owner.id`), busca `equipmentService.getUserEquipment(owner.id)` e mantém apenas itens com `status === EquipmentStatus.SAFE` (não lista itens roubados/perdidos/em transferência). Reseta o formulário a cada abertura.
- Estado local do formulário: `type` (`'rental' | 'sale'`, padrão `rental`), `equipmentId`, `value`, `pickupDate`, `returnDate`, além de `saving` e `error`.
- Validações no `handleSubmit`: exige item selecionado; exige `value > 0`; para `rental`, exige `pickupDate` e `returnDate` e proíbe devolução anterior à retirada.
- Cria o contrato via `contractService.createContract({ type, owner, counterparty, equipment, value, pickupDate?, returnDate?, chatId })`. Datas só são enviadas quando `type === 'rental'`.
- Em sucesso, monta um `summary` formatado (valor em `pt-BR`/BRL, datas para `rental`) e chama `onCreated(summary)`, depois `onClose()`. Em falha, exibe mensagem de erro.
- Texto de rodapé esclarece que a contraparte precisa aceitar; na venda, o item passa para o inventário dela ao aceitar (fluxo de transferência de posse).

### Uso

Usado somente em `pages/Chat.tsx` (`pages/Chat.tsx:144`). O `owner` é o `user` logado, a `counterparty` é derivada do outro participante do chat, `chatId` é o chat atual e `onCreated` posta o resumo como mensagem via `chatService.sendMessage`. Fluxo completo em [`../features/contracts-and-payments.md`](../features/contracts-and-payments.md).

---

## `ReferralModal`

Paywall/upsell do modelo freemium: exibido ao atingir um limite do plano gratuito ou ao convidar amigos. Mostra o progresso de indicações e o link de convite. Portal (`z-[5000]`). Fonte: `components/ReferralModal.tsx`.

### Props

| Nome | Tipo | Descrição |
|---|---|---|
| `isOpen` | `boolean` | Controla a exibição. Retorna `null` se `false` **ou** se não houver `user`. |
| `onClose` | `() => void` | Fecha o modal (botão `X`). |
| `reason` | `'inventory' \| 'check' \| 'contact' \| 'invite'` | Define o título e a mensagem do modal e o ícone do cabeçalho. |

### Comportamento

- Consome `useAuth()` para obter `user`; se não houver usuário, não renderiza.
- Título/mensagem por `reason` (textos exatos do código):

  | `reason` | Título | Mensagem |
  |---|---|---|
  | `inventory` | Limite de Inventário Atingido | No plano gratuito, você pode cadastrar até 5 equipamentos. |
  | `check` | Limite de Verificações Atingido | Você atingiu seu limite de 5 verificações de serial por mês. |
  | `contact` | Limite de Contatos Atingido | Você já enviou 3 interesses/contatos este mês. |
  | `invite` | Convide Amigos | Ajude a comunidade a crescer e desbloqueie recursos ilimitados para sua conta. |

  Ícone do cabeçalho: `Users` quando `reason === 'invite'`, senão `Lock`.
- Meta fixa de indicações `target = 5`; barra de progresso calculada como `Math.min(100, (user.referralCount || 0) / 5 * 100)`. Isso reflete a regra de Premium (`PREMIUM_REFERRALS = 5`) descrita em [`../features/referral-and-freemium.md`](../features/referral-and-freemium.md).
- Link de convite: `` `${window.location.origin}/#/register?ref=${user.referralCode}` `` (HashRouter). `copyToClipboard` usa `navigator.clipboard.writeText` e mostra "Link copiado!" por 2s (estado `copied`).

### Uso

Aberto quando uma tela detecta que o limite gratuito foi atingido (a validação de limites acontece no cliente, ver [`../reference/services.md`](./services.md)). Usos: `reason="inventory"` em `pages/Inventory.tsx`; `reason="check"` em `pages/SerialCheck.tsx`; `reason="contact"` em `pages/Rentals.tsx` e `pages/Sales.tsx`; `reason="invite"` em `pages/Home.tsx`.

---

## `LocationGateModal`

Gate **obrigatório e não-dispensável** de localização. Fecha a lacuna do login com Google, que cria o perfil sem cidade/estado (`location: 'Brasil'`, ver [`../05-frontend.md`](../05-frontend.md) §6 e `services/auth.ts`). Portal (`createPortal` → `document.body`, `z-[2000]`). Fonte: `components/LocationGateModal.tsx`.

### Props

Nenhuma. O componente é **auto-suficiente**: lê `user`/`refreshUser` de `useAuth()` e decide sozinho se aparece.

### Comportamento

- **Condição de exibição** (`isLocationMissing`): `!user.location || user.location === 'Brasil' || !user.location.includes(' - ')`. Quando a localização é válida (`"Cidade - UF"`), retorna `null`.
- **Montagem**: renderizado uma única vez no `Layout` (`components/Layout.tsx`), portanto cobre **todas** as telas autenticadas (`RootRoute`/`Home` e qualquer `ProtectedRoute`).
- **Bloqueio total**: sem `X`, sem fechar por clique no backdrop, sem `Esc`; trava `document.body.style.overflow` enquanto aberto. A única saída é preencher e confirmar.
- **Formulário**: selects encadeados Estado → Cidade via `IBGEService` (`getUFs` / `getCitiesByUF`). O botão **"Finalizar acesso"** fica desabilitado até ambos preenchidos e exibe spinner ("Salvando...") durante o save.
- **Persistência**: grava `location = "Cidade - UF"` com `userService.updateUserProfile(user.id, { location })` e chama `refreshUser()`. Isso atualiza `user.location` → `isLocationMissing` vira `false` → o modal desmonta e o app é liberado. Em falha, exibe erro e permite nova tentativa.

### Uso

Não recebe props nem é aberto manualmente. Basta estar montado no `Layout` — ver `components/Layout.tsx` (`<LocationGateModal />` ao final do container).

---

## `CurrencyInput`

Input de moeda (BRL) com **máscara única de todo o sistema**: ponto separa milhar, vírgula separa centavos (`"16.900,00"`). Máscara do tipo **"centavos"** — cada dígito digitado é um centavo, então o valor cresce da direita para a esquerda (digitar `1690000` → `16.900,00`). Fonte: `components/CurrencyInput.tsx`. Não usa portal.

### Props

Estende `React.InputHTMLAttributes<HTMLInputElement>` (menos `value`/`onChange`/`type`), então aceita `className`, `placeholder`, `disabled`, etc.

| Nome | Tipo | Descrição |
|---|---|---|
| `value` | `number \| null \| undefined` | Valor atual **em reais** (fonte da verdade). Ex.: `16900` é exibido como `"16.900,00"`; `0`/vazio mostra o `placeholder`. |
| `onValueChange` | `(value: number) => void` | Recebe o novo valor **em reais** (número já parseado). |

### Comportamento

- O texto exibido é sempre derivado de `value` via `numberToCurrencyMask` (a cada render) — estado e exibição nunca divergem.
- No `onChange`, os dígitos do texto são convertidos de volta com `parseCurrencyBRL` e emitidos como `number`.
- Renderiza um `<input type="text" inputMode="numeric">` (teclado numérico no mobile), repassando o restante das props.
- Helpers de formatação/parse em `utils/formatters.ts` (ver [`../05-frontend.md`](../05-frontend.md) §9).

### Uso

Substitui os `<input type="number">` de preço. Usos atuais: `pages/Inventory.tsx` (valor estimado, valor da diária, valor de venda, valor da transação) e `components/ContractModal.tsx` (valor do contrato). Os campos de preço do **anúncio** (`pages/AdminDashboard.tsx`) são `string` livre e aplicam `maskCurrencyBRL` inline em vez deste componente.

---

## `RaffleCpfModal`

Modal antifraude de participação no sorteio. Coleta o CPF (máscara `000.000.000-00` + validação de dígito em tempo real via `utils/cpf.ts`) e chama `raffleService.participate` → RPC `participar_sorteio`. Portal (`createPortal` → `document.body`, `z-[2000]`). Dispensável (X, backdrop, trava scroll). Fonte: `components/RaffleCpfModal.tsx`.

### Props

| Nome | Tipo | Descrição |
|---|---|---|
| `isOpen` | `boolean` | Controla a exibição; retorna `null` se `false`. |
| `raffleId` | `string` | Sorteio no qual participar. |
| `onClose` | `() => void` | Fecha o modal. |
| `onParticipated` | `(tickets: number) => void` | Chamado após sucesso, com o total de tickets do usuário. |

### Comportamento

- Botão "Confirmar e participar" fica desabilitado até o CPF ser válido (`isValidCPF`) e mostra spinner durante o envio.
- Em erro, exibe a mensagem retornada pela RPC (ex.: `CPF_EM_USO`, `CPF_INVALIDO`).
- A regra (validação, unicidade global do CPF, ticket de participação, referral qualificado, contadores) roda **no Postgres** — o cliente só chama a função. Ver [`../features/raffles.md`](../features/raffles.md).

### Uso

Renderizado em `pages/Raffles.tsx`, aberto pelo botão "Participar do sorteio" (só aparece para quem ainda não concorre). Em `onParticipated`, a página recarrega os tickets do usuário.

---

## `UserAvatar`

Avatar de usuário com fallback determinístico de iniciais quando não há foto real. Fonte: `components/UserAvatar.tsx`.

### Props

| Nome | Tipo | Descrição |
|---|---|---|
| `user` | `{ name: string; avatarUrl: string }` | Objeto mínimo com nome e URL do avatar. Se `user` for falsy, retorna `null`. |

### Comportamento

- Considera "avatar padrão" (sem foto real) quando `!user.avatarUrl` **ou** `user.avatarUrl.includes('ui-avatars.com')`. Nesse caso renderiza um círculo com iniciais.
- Iniciais (`getInitials`): primeira letra do primeiro nome + primeira letra do último nome (uppercase); se houver só um termo, usa os 2 primeiros caracteres; nome vazio → `"??"`.
- Cor de fundo (`colorForName`): determinística por soma dos `charCodeAt` do nome, módulo sobre uma paleta fixa de 6 cores (`bg-orange-500`, `bg-sky-500`, `bg-emerald-500`, `bg-purple-500`, `bg-rose-500`, `bg-slate-500`) — o mesmo nome sempre gera a mesma cor.
- Quando há foto real, renderiza `<img src={user.avatarUrl}>` com `object-cover`.
- Tamanho fixo (`w-8 h-8`); não aceita prop de tamanho.

### Uso

Usado em listas/cartões de usuários em `pages/Sales.tsx`, `pages/Rentals.tsx`, `pages/Notifications.tsx`, `pages/SerialCheck.tsx`, `pages/Network.tsx` e `pages/Profile.tsx`. Observação: o `Layout` **não** usa `UserAvatar` no cartão de perfil — ele renderiza `user.avatarUrl` diretamente.

---

## Logos

### `CineSafeLogo`

Renderiza o logotipo do produto a partir do asset estático `/logo.webp`. Fonte: `components/CineSafeLogo.tsx`.

#### Props

| Nome | Tipo | Padrão | Descrição |
|---|---|---|---|
| `size` | `number?` | `40` | Largura em px, usada **apenas** como fallback quando `className` não contém uma classe de largura (`w-`). |
| `className` | `string?` | `''` | Classes CSS. Se incluir uma classe `w-…`, ela controla a largura e `size` é ignorado. |

Detalhe de implementação: o `style` inline é `{ width: size, height: 'auto' }` quando `className` não tem `w-`, ou apenas `{ height: 'auto' }` quando tem — para não sobrescrever a largura vinda do Tailwind.

#### Uso

`components/Layout.tsx` (header desktop com `className="w-full"`; header mobile com `size={32}`), `pages/Login.tsx`, `pages/Landing.tsx` e `pages/Register.tsx`.

### `CineGuardLogo`

**O arquivo `components/CineGuardLogo.tsx` está vazio (0 bytes) e não exporta nenhum componente.** Nenhum import de `CineGuardLogo` foi encontrado no código (`grep` sem resultados). É um resquício da nomenclatura antiga do projeto ("cine-guard" ainda é o ID do projeto Firebase, mas o produto se chama Cine Safe). Use `CineSafeLogo` para exibir o logotipo. Nenhuma funcionalidade depende deste arquivo.

---

## `Icons`

Registro central de ícones do app. Não é um componente React em si, e sim um objeto (`components/Icons.tsx`) que reexporta ícones da biblioteca `lucide-react`, para que o restante do código importe sempre de um único lugar (`import { Icons } from '.../Icons'`) e use `<Icons.Nome />`.

### Ícones expostos

`Camera`, `Mic`, `Video`, `MapPin`, `ShieldAlert`, `ShieldCheck`, `Search`, `Menu`, `X`, `Plus`, `Trophy`, `ShoppingBag`, `Home`, `Settings`, `AlertTriangle`, `CheckCircle`, `Navigation`, `MessageCircle`, `Pencil`, `Trash2`, `HelpCircle`, `Upload`, `Image`, `Users`, `Lock`, `Megaphone`, `BarChart`, `Calendar`, `ExternalLink`, `MousePointer`, `Siren`, `Map`, `Mail`, `ArrowRight`, `Wallet`, `LogOut`, `Tag`, `Banknote`, `Clock`, `Globe`, `User`, `FileText`, `DollarSign`, `UserPlus`, `Download`, `Link`.

Cada entrada é o componente de ícone `lucide-react` correspondente, aceitando as props usuais desses ícones (ex.: `className`, `size`). Padrão de uso no app: `<Icons.Camera className="w-5 h-5" />`.

---

## Notas técnicas

- **Portais**: `ConfirmModal`, `ContractModal` e `ReferralModal` usam `createPortal(..., document.body)`, escapando de contêineres com `overflow: hidden`/`transform`. Ordem de empilhamento por `z-index`: `ConfirmModal` (`z-[3000]`) < `ContractModal`/`ReferralModal` (`z-[5000]`); o `Layout` fica abaixo (sidebar/header em `z-[1050]`, overlay mobile em `z-[1040]`).
- **`memo`**: `Layout`, `AdBanner`, `ConfirmModal`, `UserAvatar` e `CineSafeLogo` são exportados via `React.memo`. `ContractModal` e `ReferralModal` **não** são memoizados.
- **Tracking dividido de anúncios**: cliques são registrados pelo `AdBanner`; impressões pelo hook `useAd`. Não confunda os dois pontos.
- **Fallback de avatar**: `UserAvatar` trata URLs de `ui-avatars.com` como "sem foto real" e cai no modo iniciais.

## Fontes no código

- `components/Layout.tsx`
- `components/AdBanner.tsx`
- `components/ConfirmModal.tsx`
- `components/ContractModal.tsx`
- `components/ReferralModal.tsx`
- `components/UserAvatar.tsx`
- `components/CineSafeLogo.tsx`
- `components/CineGuardLogo.tsx` (vazio)
- `components/Icons.tsx`
- `hooks/useAd.ts` (impressões de anúncio)
- `services/adService.ts` (`getActiveAd`, `trackAdClick`, `trackAdImpression`)
- `types.ts` (interface `Ad`, `types.ts:194`)
- `App.tsx` (aplicação do `Layout` em `ProtectedRoute`/`RootRoute`)
- Consumidores em `pages/`: `Chat.tsx`, `Home.tsx`, `SerialCheck.tsx`, `Notifications.tsx`, `Inventory.tsx`, `Rentals.tsx`, `Sales.tsx`, `Network.tsx`, `Profile.tsx`, `Contracts.tsx`, `AdminDashboard.tsx`, `Login.tsx`, `Landing.tsx`, `Register.tsx`
