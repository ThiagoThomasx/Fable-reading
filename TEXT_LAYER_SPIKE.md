# Spike Técnico — Text Layer (Sprint 8)

Documento do spike de viabilidade técnica para adicionar text layer do pdf.js ao reader,
permitindo seleção real de texto e uma futura base para highlight textual. Não é uma sprint de
produto — nenhuma feature final foi exposta ao usuário neste spike.

> **Nota de promoção (2026-07-10 — Text Highlights):** o protótipo descrito aqui foi promovido a
> feature estável. `TextLayerOverlay`, `rects.ts` e `text-content.ts` migraram de
> `text-layer-experiment/` (atrás de `ENABLE_TEXT_LAYER_EXPERIMENT`, removida) para
> `app/src/features/reader/highlights/`, sem flag — o "modo seleção" continua sob demanda, mas
> agora persiste `ReadingAnnotation` do tipo `highlight` de verdade. Este documento permanece
> como registro histórico do spike; ver `ARCHITECTURE.md` para o comportamento atual e
> `ROADMAP_SPRINTS.md`/`CHANGELOG.md` para o relatório da promoção.

## Decisão final

**GO condicionado.** Text layer é tecnicamente viável e funciona bem em PDFs textuais, incluindo
scans com OCR embutido, mas deve permanecer **sob demanda** ("modo seleção"), nunca sempre-ativa,
e precisa de fallback silencioso para páginas sem texto extraível. Ver Estratégia B, abaixo.

## Auditoria inicial (resumo)

- `app/src/lib/pdf/pdf-engine.ts`: pdfjs-dist `^4.10.38`, render canvas-only via canvas offscreen →
  `ImageBitmap`, `intent: 'print'` (evita travar em aba oculta). `getTextContent()` nunca era
  chamado em lugar nenhum do código antes deste spike.
- `app/src/features/reader/use-reader.ts`: `cssWidth` (CSS px, não pixels de dispositivo) é o
  valor certo para casar a viewport do text layer com o que é exibido — o canvas raster usa uma
  largura maior (`renderWidthFor`, escalada por `devicePixelRatio`).
- `app/src/features/reader/PdfReader.tsx`: `pageWrapperRef` (a `<div>` com `position: relative`
  que envolve canvas + hotzones) é o container correto para montar o text layer como overlay
  absoluto.
- Hotzones (`app/src/features/reader/PdfReader.tsx`, terços esquerdo/direito): dois `<button>`
  absolutos que cobrem a página — conflito direto e esperado com qualquer overlay de seleção de
  texto full-page.
- `ReadingAnnotation.textAnchor` (`app/src/types/models.ts`) já modelado desde a Sprint 6,
  nunca usado.
- Nenhuma dependência de text layer pré-existente (`TextLayer`, `getTextContent`,
  `renderTextLayer`: zero matches antes deste spike).

## Protótipo implementado

Flag interna `ENABLE_TEXT_LAYER_EXPERIMENT` (`app/src/features/reader/text-layer-experiment/flag.ts`),
`false` por padrão — não há controle de acesso/feature-flag de produção neste projeto
local-first, então manter desligada é o que garante que nada do spike vaza para uma sessão de
leitura normal. Para validar manualmente, alterne a constante para `true` localmente (não commitar
como `true`). Componente experimental `TextLayerOverlay` montado dentro do
`pageWrapperRef`, **depois** dos botões de hotzone no DOM (para cobri-los quando ativo), ativado
por um "modo seleção" (atalho `T`, botão flutuante no canto inferior direito, `Escape` desliga
antes de fechar painéis/reader).

### Arquivos criados
- `app/src/features/reader/text-layer-experiment/flag.ts`
- `app/src/features/reader/text-layer-experiment/TextLayerOverlay.tsx`
- `app/src/features/reader/text-layer-experiment/rects.ts` (+ `.test.ts`)
- `app/src/features/reader/text-layer-experiment/text-content.ts` (+ `.test.ts`)

### Arquivos alterados (mudanças aditivas, sem tocar no caminho de render estável)
- `app/src/lib/pdf/pdf-engine.ts`: novo método `getPageForTextLayer(pageNumber)`, expõe o
  `PDFPageProxy` cacheado internamente pelo pdf.js (não repete parse). Renderização de canvas
  inalterada.
- `app/src/features/reader/use-reader.ts`: retorno do hook ganhou `engineRef` (a mesma ref já
  interna, agora exposta) — nenhuma mudança de comportamento.
- `app/src/features/reader/PdfReader.tsx`: estado `isSelectModeActive`, atalho `T`, botão de
  alternância, montagem condicional do `TextLayerOverlay`.
- `app/src/styles/index.css`: réplica mínima do CSS oficial do pdf.js para `.textLayer-experiment`
  (spans transparentes, `::selection` temático).

## Resultado por cenário de PDF

### PDF textual leve (`leve.pdf`, "A metamorfose")
Seleção funcionando integralmente: linha única, multi-linha, após zoom (100%→125%), após navegar
e voltar. Texto extraído bate exatamente com o conteúdo renderizado no canvas (validado
visualmente comparando span-por-span com o texto do PDF).

### PDF pesado (`pesado.pdf`, livro técnico com imagens, 536 páginas)
Página densa chegou a **1010 spans**; montagem do text layer (`getTextContent` + `TextLayer.render()`)
levou **~1.5–2s** nessa página, isolada e só quando "modo seleção" é ligado — não acontece durante
leitura normal. Nenhum long task bloqueando a UI observado durante o teste manual (navegação e
troca de página continuaram responsivas com o modo desligado).

### PDF escaneado (`escaneado.pdf`, 574 páginas)
**Achado relevante**: nem toda página de um PDF "escaneado" carece de texto. Este arquivo tem
páginas de rosto/metadados com texto digital real (poucos spans) e um corpo com OCR já embutido
(centenas de spans, texto selecionável e coerente com o conteúdo visual — validado). Só páginas
genuinamente imagem-pura (ex.: capa) retornam vazias. Por isso a detecção de "sem texto" precisa
ser **por página**, nunca por documento inteiro — é exatamente o que `hasExtractableText`
(`text-content.ts`) faz. Nessas páginas vazias, o fallback (`status === 'empty'`) exibe um aviso
sutil sem quebrar layout nem permitir seleção falsa.

## Comportamento com zoom e resize

Confirmado alinhamento correto em 100% e 125% após correção de um bug encontrado durante o spike
(ver "Problemas encontrados" abaixo). Resize de viewport não foi testado em profundidade além do
preset mobile (ver limitações).

## Interação com layout existente

| Cenário | Resultado |
|---|---|
| Hotzones (terços esq./dir.) | Ao ligar "modo seleção", o text layer é montado depois dos botões no DOM e cobre toda a página — `document.elementFromPoint` confirmou que cliques nas hotzones passam a atingir o text layer, não os botões. Com modo desligado, hotzones funcionam normalmente (comportamento padrão, sem overlay presente). |
| Painel de notas aberto | Seleção de texto continua funcionando normalmente com o painel aberto (testado no tema dark) — painel usa `padding-right` (decisão da Sprint 6), não sobrepõe a página. |
| Modo foco | Não testado explicitamente neste spike (baixo risco: modo foco só esconde a topbar, não afeta `pageWrapperRef`). |
| Tema Paper/Dark | Testado em ambos; texto do text layer é sempre transparente (invisível), então o tema não afeta a legibilidade — apenas a cor de `::selection` foi fixada num tom fixo (`--color-storybook-sky` translúcido), não depende de token de tema. |
| Bookmark/notas (CRUD) | Confirmado funcionando após todas as mudanças (criação de bookmark testada manualmente; suíte de testes de notes/sessions/export permanece 100% verde). |
| Viewport mobile (375px) | Reader já é fixo em `BASE_CSS_WIDTH_PX` (720px) independente da viewport — limitação pré-existente, não uma regressão deste spike. "Modo seleção" liga sem erros no console mesmo com overflow horizontal. |

## Problemas encontrados e correções durante o spike

1. **`--scale-factor` CSS custom property obrigatória.** `pdfjs-dist@4.10` desacoplou o
   dimensionamento do text layer da viewport passada ao construtor: `TextLayer` sempre lê
   `viewport.rawDims` (dimensões **não escaladas** da página) e monta
   `calc(var(--scale-factor) * Npx)` internamente (`setLayerDimensions`, `pdf.mjs`). Sem definir
   essa custom property no container, o layout inteiro colapsava silenciosamente (span perdidos,
   zero altura/largura) — sem erro no console. Corrigido setando
   `container.style.setProperty('--scale-factor', String(viewport.scale))`. Implicação para uma
   futura Sprint 9: zoom poderia, em teoria, só atualizar essa CSS var (+ `layer.update({viewport})`)
   sem recriar spans — não explorado neste spike, mas é uma otimização candidata.
2. **Crash real de produção (`NotFoundError: removeChild`) ao misturar DOM imperativo do pdf.js
   com filhos React no mesmo container.** O componente inicial renderizava a mensagem de fallback
   ("sem texto extraível") como filho JSX do mesmo `<div>` que eu também manipulava via
   `container.replaceChildren()` (limpo antes de cada render do pdf.js) — e onde o próprio pdf.js
   também insere/remove spans via DOM API diretamente. Quando o React tentava reconciliar esse
   filho (ex.: sumir com o aviso ao trocar de página de "vazia" para "com texto"), o nó já tinha
   sido removido imperativamente por fora — `removeChild` falhava com `NotFoundError`, sem
   `ErrorBoundary` no app, o que **derrubava a árvore React inteira (tela branca)**. Reproduzido
   de forma determinística navegando ~9 páginas com "modo seleção" ligado no PDF escaneado.
   Corrigido separando definitivamente as duas responsabilidades: o `<div>` referenciado por
   `containerRef` nunca tem filhos declarados via JSX (só o pdf.js escreve nele); o aviso de
   fallback é um `<p>` irmão, 100% gerenciado pelo React. **Esta é a lição mais importante do
   spike** para qualquer implementação futura de highlight: qualquer UI React que precise
   coexistir com a saída do pdf.js deve viver em um nó DOM peer, nunca dentro do container que o
   pdf.js escreve.

## Investigação de persistência (`textAnchor`)

Modelo já existente em `ReadingAnnotation.textAnchor` (`page`, `text`, `rects[]`) foi avaliado
contra três formatos possíveis:

- **Rects absolutos (viewport)**: descartado — instáveis a qualquer resize/zoom, exigiriam
  recomputar contra a viewport de renderização no momento da criação, frágil entre sessões.
- **Rects relativos [0,1] ao container da página**: candidato viável. Implementado como prova de
  conceito pura e testada em `rects.ts` (`toRelativeRects`, `sortRectsReadingOrder`) — converte
  `Range.getClientRects()` para frações da caixa da página, sobrevive a zoom/resize porque o
  consumidor futuro multiplica pela largura/altura atual no momento de desenhar o highlight, não
  precisa recomputar contra o texto. Não testado ainda contra rotação de página (`page.rotate`,
  fora do escopo deste PDF de teste) nem contra reflow entre fontes diferentes carregadas
  assincronamente (pdf.js resolve isso internamente antes de posicionar spans, então na prática
  não deveria mudar pós-render).
- **`quoteText` (texto puro, sem rects)**: robusto e trivial de persistir/exportar (funciona bem
  para Markdown/Obsidian), mas insuficiente sozinho para desenhar um highlight visual preciso
  (não localiza a posição exata na página, só o conteúdo).

**Recomendação para uma Sprint 9**: persistir os dois — `quoteText` como fallback sempre presente
(inclusive para export), e `rects` relativos como enriquecimento opcional quando a seleção around
tiver origem de uma sessão de "modo seleção" (nunca obrigatório, já que o dado só existe quando o
usuário ativamente selecionou over o text layer).

## Estratégias comparadas

| Estratégia | Veredito |
|---|---|
| A — Text layer sempre ativa | **Rejeitada.** Conflito permanente com hotzones (teria que reduzi-las ou detectar drag-vs-click em todo clique da página, aumentando complexidade permanente do componente estável). Custo de `getTextContent`/render em toda navegação, mesmo para quem nunca quer selecionar texto. |
| B — Text layer sob demanda ("modo seleção") | **Recomendada.** Isola 100% do risco (hotzones, performance, DOM) atrás de uma ação explícita do usuário. Testada neste spike com resultado limpo em todos os cenários (textual, pesado, escaneado, zoom, tema, painel de notas). Custo de montagem (~1.5–2s no pior caso observado) é aceitável porque só ocorre quando o usuário pediu para selecionar, não durante leitura. |
| C — Sem text layer, manter notes/bookmarks | Continua válida como baseline conservador, mas o spike mostrou que B é viável sem comprometer a estabilidade do reader — não há motivo técnico para descartar highlight textual, só para adiá-lo com escopo controlado. |

## Recomendação para a Sprint 9

**GO condicionado com Estratégia B.** Sprint 9 (Text Highlights) pode prosseguir implementando:
1. Persistência de `ReadingAnnotation` tipo `'highlight'` usando `quoteText` + `rects` relativos
   (formato validado em `rects.ts`).
2. UI de criação de highlight a partir de uma seleção feita em "modo seleção" (reaproveitar
   `TextLayerOverlay` como base, promovendo-o de experimental para estável).
3. Fallback explícito para páginas sem texto extraível — já implementado e testado
   (`hasExtractableText`), reaproveitável sem mudanças.
4. **Não** promover a Estratégia A (sempre ativa) sem evidência nova de que os usuários preferem
   isso a um modo explícito — não foi testado neste spike por estar fora do escopo recomendado.

## Pendências / riscos para a Sprint 9

- Rotação de página (`page.rotate` != 0) não foi testada — os três PDFs de teste não têm páginas
  rotacionadas.
- `--scale-round-x`/`--scale-round-y` (usadas pelo `round()` do pdf.js) não foram customizadas;
  comportamento padrão do navegador foi suficiente nos testes, mas vale revisitar se algum
  arredondamento de sub-pixel causar dessincronia visível entre texto/canvas em telas de alta
  densidade.
- Suporte a `CSS.supports('round(...))` deve ser confirmado nos navegadores-alvo reais do produto
  (testado apenas no Chromium do ambiente de preview); pdf.js já tem fallback interno
  (`useRound` → `calc()` simples) caso `round()` não seja suportado, então o risco é baixo mas não
  zero.
- Viewport mobile não foi resolvido (limitação pré-existente do reader, documentada, não deste
  spike) — qualquer highlight touch-based (long-press para selecionar) precisará de investigação
  própria antes de expor a feature em telas pequenas.
