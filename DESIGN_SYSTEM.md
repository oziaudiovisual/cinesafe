# Cine Safe - Design System & Guia Visual

Este documento define os padrões visuais, paleta de cores, tipografia e componentes de interface do **Cine Safe**. O objetivo é manter uma estética futurista, profissional ("Cyberpunk Clean") e focada na usabilidade em modo escuro.

---

## 1. Filosofia Visual
*   **Tema:** Dark Mode Nativo (Midnight Blue profundo).
*   **Estilo:** Glassmorphism (Vidro Fosco), Neon Accents, Bordas Sutis.
*   **Sensação:** Tecnologia, Segurança, Premium, Audiovisual.

---

## 2. Paleta de Cores

### Fundo (Backgrounds)
Baseada em tons profundos de azul/preto para evitar o "preto absoluto" cansativo e criar profundidade.

| Nome | Tailwind Class | Hex | Uso |
| :--- | :--- | :--- | :--- |
| **Deep Midnight** | `bg-brand-950` | `#020410` | Fundo global da página. |
| **Surface Dark** | `bg-brand-900` | `#080C18` | Cartões de fundo, sidebar mobile. |
| **Surface Light** | `bg-brand-800` | `#0F1526` | Cartões de destaque, sidebar desktop. |

### Acentos (Accents)
Cores vibrantes para ações, destaques e status.

| Nome | Tailwind Class | Hex | Uso |
| :--- | :--- | :--- | :--- |
| **Neon Cyan** | `text-accent-primary` / `bg-accent-primary` | `#22d3ee` | Botões primários, ícones ativos, links. |
| **Neon Violet** | `text-accent-secondary` / `bg-accent-secondary` | `#a78bfa` | Gradientes, detalhes secundários. |
| **Success** | `text-green-500` / `bg-green-500` | `#22c55e` | Status "Seguro", "Venda", Sucesso. |
| **Danger** | `text-red-500` / `bg-red-500` | `#ef4444` | Status "Roubado", Botões destrutivos. |
| **Warning/Gold** | `text-accent-warning` / `bg-yellow-500` | `#fbbf24` | Premium, Admin, Ranking. |

### Texto e Bordas

| Nome | Tailwind Class | Hex | Uso |
| :--- | :--- | :--- | :--- |
| **Text Primary** | `text-white` | `#ffffff` | Títulos, dados importantes. |
| **Text Secondary** | `text-brand-300` | `#CBD5E1` | Parágrafos, descrições. |
| **Text Muted** | `text-brand-400` | `#94A3B8` | Labels, metadados, placeholders. |
| **Border Subtle** | `border-white/5` | `rgba(255,255,255,0.05)` | Divisores, bordas de cards padrão. |
| **Border Active** | `border-white/10` | `rgba(255,255,255,0.10)` | Hover, inputs. |

---

## 3. Tipografia

*   **Família:** `Plus Jakarta Sans`, sans-serif.
*   **Pesos:**
    *   `Light (300)`: Saudações sutis.
    *   `Regular (400)`: Texto corrido.
    *   `Medium (500)`: Links de navegação.
    *   `Bold (700)`: Títulos, Botões, Valores.
    *   `ExtraBold (800)`: Títulos de destaque, Rankings.

---

## 4. Componentes UI (Glassmorphism)

O estilo "Glass" é a assinatura do app. Ele utiliza transparência, blur e bordas sutis.

### Cards (Padrão)
Utilizados para listar equipamentos, usuários e notificações.
*   **Background:** `bg-white/5` ou `bg-brand-900` (com opacidade).
*   **Blur:** `backdrop-blur-xl`.
*   **Borda:** `border border-white/5` ou `border-white/10`.
*   **Arredondamento:** `rounded-2xl` ou `rounded-3xl`.
*   **Sombra:** `shadow-lg`.

### Inputs e Selects
*   **Background:** `bg-black/20` ou `glass-input`.
*   **Borda:** `border border-white/10`.
*   **Texto:** Branco.
*   **Placeholder:** `text-brand-600`.
*   **Foco:** Borda `border-accent-primary` e sombra `shadow-glow`.

### Botões

1.  **Primário (Ação):**
    *   `bg-accent-primary` (Ciano).
    *   `text-brand-950` (Texto escuro para contraste).
    *   `font-bold`, `rounded-xl`.
    *   Hover: `hover:bg-cyan-400`, `shadow-lg`.

2.  **Secundário/Neutro:**
    *   `bg-brand-800` ou `bg-white/5`.
    *   `text-white`.
    *   Borda `border-white/5`.
    *   Hover: `hover:bg-brand-700`.

3.  **Destrutivo:**
    *   `bg-red-600`.
    *   `text-white`.
    *   Hover: `shadow-red-600/20`.

---

## 5. Anúncios (AdBanner)

O sistema de banners segue uma lógica de camadas ("Layers") para responsividade.

*   **Dimensões:** Altura fixa (`h-64`), Largura fluida (`w-full`).
*   **Fundo:** Gradiente Radial Escuro (`radial-gradient(ellipse at top right, #1a1a1a 0%, #000000 70%)`).
*   **Elementos:**
    *   Linhas concêntricas decorativas (CSS `.line`).
    *   **Texto:** Alinhado à esquerda (`z-30`), com sombra projetada.
    *   **Imagem do Produto:**
        *   Formato: **PNG com fundo transparente**.
        *   Posição: `absolute`, alinhado à direita.
        *   Animação: Fade-in suave (`duration-700`) após carregamento (`onLoad`).
        *   Tamanho Ideal: Altura de 600px no arquivo original para telas Retina.

---

## 6. Efeitos Visuais

### Background Global
O corpo da página possui "Orbs" de luz para ambientação.
```css
body {
  background-color: #020410;
  background-image: radial-gradient(circle at 15% 0%, rgba(59, 130, 246, 0.15), transparent 40%),
                    radial-gradient(circle at 85% 30%, rgba(167, 139, 250, 0.1), transparent 40%);
}
```

### Animações
*   **Fade In:** `animate-fade-in` (suave entrada de baixo para cima).
*   **Float:** `animate-float` (flutuação suave para elementos de fundo).
*   **Pulse:** Usado em alertas e status de notificação não lida.

### Sombras (Glow)
Usadas para indicar interatividade ou status neon.
*   `shadow-glow`: Sombra ciano suave.
*   `shadow-red-500/20`: Glow vermelho para alertas.

---

## 7. Mapas (Leaflet)
*   **Provider:** CartoDB (Dark Matter ou Positron).
*   **Dark Mode:** `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` (Usado no reporte de roubo).
*   **Light Mode:** `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` (Usado no mapa de segurança global para contraste com heatmap).
*   **Marcadores:** Customizados via CSS/DivIcon (bolinhas pulsantes).

---

## 8. Responsividade
*   **Mobile First:** O layout se adapta de colunas únicas para grids complexos.
*   **Navegação:**
    *   *Desktop:* Sidebar lateral flutuante de vidro.
    *   *Mobile:* Header fixo no topo + Menu overlay.
*   **Grids:**
    *   Mobile: `grid-cols-1`.
    *   Tablet: `grid-cols-2`.
    *   Desktop: `grid-cols-3` ou `grid-cols-4`.

---

## 9. Regras de Conteúdo
*   **Imagens de Usuário:** Sempre circulares (`rounded-full`), `object-cover`. Se não houver imagem, usar iniciais com fundo colorido.
*   **Imagens de Equipamento:** Aspect Ratio 4:3 ou 16:9, `object-cover`.
*   **Valores Monetários:** Sempre formatados em BRL (`R$ 1.200,00`).
*   **Datas:** Formato local (`dd/mm/aaaa`).